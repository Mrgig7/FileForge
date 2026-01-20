/**
 * Billing Routes
 * 
 * Endpoints for subscription management:
 * - Create checkout session
 * - Handle webhooks
 * - Get subscription status
 * - Cancel subscription
 * 
 * Security:
 * - Webhooks MUST verify signatures
 * - Use idempotency keys to prevent duplicate processing
 * - Never trust client-side payment confirmations
 */

const router = require('express').Router();
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const { getBillingProvider } = require('../services/billingProvider');

// Idempotency tracking (use Redis in production)
const processedEvents = new Set();

/**
 * @route   POST /api/billing/checkout
 * @desc    Create checkout session for subscription
 * @access  Private
 */
router.post('/checkout', ensureApiAuth, async (req, res) => {
  try {
    const { plan, workspaceId } = req.body;
    
    if (!plan || !['PRO', 'TEAM', 'ENTERPRISE'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan'
      });
    }
    
    // TEAM and ENTERPRISE require workspace
    if ((plan === 'TEAM' || plan === 'ENTERPRISE') && !workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID required for team plans'
      });
    }
    
    // If workspace, verify ownership
    let workspace = null;
    if (workspaceId) {
      workspace = await Workspace.findById(workspaceId);
      if (!workspace || !workspace.isOwner(req.user._id)) {
        return res.status(403).json({
          success: false,
          error: 'Only workspace owner can subscribe'
        });
      }
    }
    
    const provider = getBillingProvider();
    
    const session = await provider.createCheckoutSession({
      userId: req.user._id,
      workspaceId: workspace?._id,
      plan,
      email: req.user.email,
      successUrl: `${process.env.APP_BASE_URL || 'http://localhost:5173'}/billing/success`,
      cancelUrl: `${process.env.APP_BASE_URL || 'http://localhost:5173'}/billing/cancel`
    });
    
    await AuditLog.logFromRequest(req, 'billing.checkout_created', {
      metadata: { plan, provider: provider.providerName, sessionId: session.sessionId }
    });
    
    res.json({
      success: true,
      sessionId: session.sessionId,
      checkoutUrl: session.checkoutUrl
    });
    
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

/**
 * @route   POST /api/billing/webhook
 * @desc    Handle billing provider webhooks
 * @access  Public (verified by signature)
 * 
 * Security: Signature verification is CRITICAL
 */
router.post('/webhook',
  // Raw body needed for signature verification
  require('express').raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const provider = getBillingProvider();
      const signature = req.headers['stripe-signature'] || req.headers['x-webhook-signature'];
      
      let event;
      try {
        event = provider.verifyWebhook(req.body, signature);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({
          success: false,
          error: 'Invalid signature'
        });
      }
      
      // Idempotency check
      const eventId = event.id || `${event.type}_${Date.now()}`;
      if (processedEvents.has(eventId)) {
        console.log('Duplicate webhook event:', eventId);
        return res.json({ success: true, message: 'Already processed' });
      }
      processedEvents.add(eventId);
      
      // Cleanup old events (keep last 1000)
      if (processedEvents.size > 1000) {
        const iterator = processedEvents.values();
        for (let i = 0; i < 500; i++) {
          processedEvents.delete(iterator.next().value);
        }
      }
      
      // Process event
      await processWebhookEvent(event);
      
      res.json({ success: true, received: true });
      
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  }
);

/**
 * Process webhook event and update subscription
 */
async function processWebhookEvent(event) {
  const eventType = event.type;
  const data = event.data?.object || event.data;
  
  console.log('[Billing] Processing event:', eventType);
  
  switch (eventType) {
    case 'checkout.session.completed': {
      const { subscription: subId, metadata } = data;
      const { userId, workspaceId, plan } = metadata || {};
      
      if (!userId && !workspaceId) {
        console.error('No userId or workspaceId in checkout metadata');
        return;
      }
      
      // Get subscription details from provider
      const provider = getBillingProvider();
      const subStatus = await provider.getSubscriptionStatus(subId);
      
      // Create or update subscription record
      const query = workspaceId ? { workspaceId } : { userId };
      
      await Subscription.findOneAndUpdate(
        query,
        {
          ...query,
          plan: plan || 'PRO',
          status: 'ACTIVE',
          provider: provider.providerName,
          providerSubscriptionId: subId,
          startedAt: new Date(),
          currentPeriodStart: subStatus.currentPeriodStart,
          currentPeriodEnd: subStatus.currentPeriodEnd,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      // Update user/workspace role
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          plan: plan || 'PRO',
          role: plan === 'ENTERPRISE' ? 'ADMIN' : 'PRO'
        });
      }
      
      if (workspaceId) {
        const planConfig = Subscription.PLANS[plan] || Subscription.PLANS.TEAM;
        await Workspace.findByIdAndUpdate(workspaceId, {
          memberLimit: planConfig.maxMembers,
          storageLimit: planConfig.maxStorage
        });
      }
      
      await AuditLog.log({
        action: 'billing.subscription_created',
        userId,
        targetType: workspaceId ? 'workspace' : 'user',
        targetId: workspaceId || userId,
        metadata: { plan, subscriptionId: subId }
      });
      
      break;
    }
    
    case 'customer.subscription.updated': {
      const sub = await Subscription.findByProviderId(
        getBillingProvider().providerName,
        data.id
      );
      
      if (sub) {
        sub.status = data.status === 'active' ? 'ACTIVE' : 
                     data.status === 'past_due' ? 'PAST_DUE' :
                     data.status === 'canceled' ? 'CANCELLED' : sub.status;
        sub.cancelAtPeriodEnd = data.cancel_at_period_end || false;
        sub.currentPeriodEnd = new Date(data.current_period_end * 1000);
        await sub.save();
      }
      break;
    }
    
    case 'customer.subscription.deleted': {
      const sub = await Subscription.findByProviderId(
        getBillingProvider().providerName,
        data.id
      );
      
      if (sub) {
        sub.status = 'CANCELLED';
        sub.cancelledAt = new Date();
        await sub.save();
        
        // Downgrade to free
        if (sub.userId) {
          await User.findByIdAndUpdate(sub.userId, {
            plan: 'FREE',
            role: 'USER'
          });
        }
        
        await AuditLog.log({
          action: 'billing.subscription_cancelled',
          userId: sub.userId,
          targetType: sub.workspaceId ? 'workspace' : 'user',
          targetId: sub.workspaceId || sub.userId
        });
      }
      break;
    }
    
    case 'invoice.payment_succeeded': {
      const sub = await Subscription.findByProviderId(
        getBillingProvider().providerName,
        data.subscription
      );
      
      if (sub) {
        sub.lastPaymentAt = new Date();
        sub.lastPaymentAmount = data.amount_paid;
        sub.status = 'ACTIVE';
        await sub.save();
      }
      break;
    }
    
    case 'invoice.payment_failed': {
      const sub = await Subscription.findByProviderId(
        getBillingProvider().providerName,
        data.subscription
      );
      
      if (sub) {
        sub.status = 'PAST_DUE';
        await sub.save();
        
        await AuditLog.log({
          action: 'billing.payment_failed',
          userId: sub.userId,
          targetType: 'subscription',
          targetId: sub._id
        });
      }
      break;
    }
    
    default:
      console.log('[Billing] Unhandled event type:', eventType);
  }
}

/**
 * @route   GET /api/billing/subscription
 * @desc    Get current subscription status
 * @access  Private
 */
router.get('/subscription', ensureApiAuth, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    
    let subscription;
    
    if (workspaceId) {
      subscription = await Subscription.findForWorkspace(workspaceId);
    } else {
      subscription = await Subscription.getOrCreateForUser(req.user._id);
    }
    
    const planConfig = subscription.planConfig;
    
    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        planName: planConfig.name,
        status: subscription.status,
        provider: subscription.provider,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        limits: {
          maxStorage: subscription.getLimit('maxStorage'),
          maxFiles: subscription.getLimit('maxFiles'),
          maxMembers: subscription.getLimit('maxMembers'),
          maxVersions: subscription.getLimit('maxVersions')
        },
        features: planConfig.features
      }
    });
    
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription'
    });
  }
});

/**
 * @route   POST /api/billing/cancel
 * @desc    Cancel subscription
 * @access  Private
 */
router.post('/cancel', ensureApiAuth, async (req, res) => {
  try {
    const { workspaceId, immediate = false } = req.body;
    
    let subscription;
    
    if (workspaceId) {
      // Verify workspace ownership
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace || !workspace.isOwner(req.user._id)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      }
      subscription = await Subscription.findForWorkspace(workspaceId);
    } else {
      subscription = await Subscription.findForUser(req.user._id);
    }
    
    if (!subscription || subscription.plan === 'FREE') {
      return res.status(400).json({
        success: false,
        error: 'No active subscription to cancel'
      });
    }
    
    const provider = getBillingProvider();
    
    if (subscription.providerSubscriptionId) {
      await provider.cancelSubscription(subscription.providerSubscriptionId, immediate);
    }
    
    subscription.cancelAtPeriodEnd = !immediate;
    if (immediate) {
      subscription.status = 'CANCELLED';
      subscription.cancelledAt = new Date();
    }
    await subscription.save();
    
    await AuditLog.logFromRequest(req, 'billing.cancel_requested', {
      targetType: 'subscription',
      targetId: subscription._id,
      metadata: { immediate }
    });
    
    res.json({
      success: true,
      message: immediate 
        ? 'Subscription cancelled immediately'
        : `Subscription will be cancelled at end of period (${subscription.currentPeriodEnd})`
    });
    
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

module.exports = router;

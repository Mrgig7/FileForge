/**
 * Billing Provider Service
 * 
 * Abstract interface for payment providers with Stripe implementation.
 * Swap implementation for Razorpay/Paddle as needed.
 * 
 * Security Notes:
 * - Webhook signatures MUST be verified
 * - Never trust client-side payment confirmations
 * - Use idempotency keys for all operations
 * - Log all billing events for audit
 */

const crypto = require('crypto');

/**
 * Abstract Billing Provider Interface
 */
class BillingProvider {
  /**
   * Create a checkout session for subscription
   * @param {Object} options - { userId, workspaceId, plan, successUrl, cancelUrl }
   * @returns {Promise<{ sessionId, checkoutUrl }>}
   */
  async createCheckoutSession(options) {
    throw new Error('Not implemented');
  }
  
  /**
   * Verify webhook signature
   * @param {string|Buffer} payload - Raw request body
   * @param {string} signature - Signature header
   * @returns {Object} - Parsed and verified event
   */
  verifyWebhook(payload, signature) {
    throw new Error('Not implemented');
  }
  
  /**
   * Get subscription status from provider
   * @param {string} subscriptionId - Provider subscription ID
   * @returns {Promise<Object>}
   */
  async getSubscriptionStatus(subscriptionId) {
    throw new Error('Not implemented');
  }
  
  /**
   * Cancel subscription
   * @param {string} subscriptionId
   * @param {boolean} immediate - Cancel immediately or at period end
   */
  async cancelSubscription(subscriptionId, immediate = false) {
    throw new Error('Not implemented');
  }
  
  /**
   * Create customer in billing system
   * @param {Object} user - User object with email, name
   */
  async createCustomer(user) {
    throw new Error('Not implemented');
  }
  
  /**
   * Get provider name
   */
  get providerName() {
    return 'unknown';
  }
}

/**
 * Stripe Billing Provider
 * 
 * Requires: npm install stripe
 * ENV: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */
class StripeBillingProvider extends BillingProvider {
  constructor() {
    super();
    this.stripe = null;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    // Lazy init Stripe
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = require('stripe');
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      } catch (err) {
        console.warn('[Billing] Stripe package not installed');
      }
    }
  }
  
  get providerName() {
    return 'stripe';
  }
  
  get isConfigured() {
    return !!this.stripe;
  }
  
  // Price IDs for plans (configure in Stripe dashboard)
  getPriceId(plan) {
    const prices = {
      PRO: process.env.STRIPE_PRICE_PRO,
      TEAM: process.env.STRIPE_PRICE_TEAM,
      ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE
    };
    return prices[plan];
  }
  
  async createCheckoutSession({ userId, workspaceId, plan, email, successUrl, cancelUrl }) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }
    
    const priceId = this.getPriceId(plan);
    if (!priceId) {
      throw new Error(`No price configured for plan: ${plan}`);
    }
    
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      customer_email: email,
      success_url: successUrl || `${process.env.APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.APP_BASE_URL}/billing/cancel`,
      metadata: {
        userId: userId?.toString(),
        workspaceId: workspaceId?.toString(),
        plan
      },
      subscription_data: {
        metadata: {
          userId: userId?.toString(),
          workspaceId: workspaceId?.toString(),
          plan
        }
      }
    });
    
    return {
      sessionId: session.id,
      checkoutUrl: session.url
    };
  }
  
  verifyWebhook(payload, signature) {
    if (!this.stripe || !this.webhookSecret) {
      throw new Error('Stripe webhook not configured');
    }
    
    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret
    );
    
    return event;
  }
  
  async getSubscriptionStatus(subscriptionId) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }
    
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    
    return {
      id: subscription.id,
      status: subscription.status,
      plan: subscription.metadata?.plan,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null
    };
  }
  
  async cancelSubscription(subscriptionId, immediate = false) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }
    
    if (immediate) {
      return this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      return this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    }
  }
  
  async createCustomer(user) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }
    
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user._id.toString()
      }
    });
    
    return customer.id;
  }
}

/**
 * Mock Billing Provider (for development)
 */
class MockBillingProvider extends BillingProvider {
  constructor() {
    super();
    this.sessions = new Map();
    this.subscriptions = new Map();
  }
  
  get providerName() {
    return 'mock';
  }
  
  async createCheckoutSession({ userId, workspaceId, plan, successUrl }) {
    const sessionId = `mock_session_${crypto.randomBytes(16).toString('hex')}`;
    
    this.sessions.set(sessionId, {
      userId,
      workspaceId,
      plan,
      createdAt: new Date()
    });
    
    // In mock mode, return a fake checkout URL that auto-completes
    return {
      sessionId,
      checkoutUrl: `${successUrl}?session_id=${sessionId}&mock=true`
    };
  }
  
  verifyWebhook(payload, signature) {
    // In mock mode, just parse the payload
    const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
    return event;
  }
  
  async getSubscriptionStatus(subscriptionId) {
    const sub = this.subscriptions.get(subscriptionId);
    
    if (!sub) {
      return {
        id: subscriptionId,
        status: 'active',
        plan: 'PRO',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
    }
    
    return sub;
  }
  
  async cancelSubscription(subscriptionId, immediate = false) {
    const sub = this.subscriptions.get(subscriptionId) || {};
    
    if (immediate) {
      sub.status = 'cancelled';
      sub.cancelledAt = new Date();
    } else {
      sub.cancelAtPeriodEnd = true;
    }
    
    this.subscriptions.set(subscriptionId, sub);
    return sub;
  }
  
  async createCustomer(user) {
    return `mock_customer_${user._id}`;
  }
  
  // Mock helper: Simulate successful payment
  simulatePayment(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    const subscriptionId = `mock_sub_${crypto.randomBytes(8).toString('hex')}`;
    
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      status: 'active',
      plan: session.plan,
      userId: session.userId,
      workspaceId: session.workspaceId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    
    return {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          subscription: subscriptionId,
          metadata: {
            userId: session.userId?.toString(),
            workspaceId: session.workspaceId?.toString(),
            plan: session.plan
          }
        }
      }
    };
  }
}

/**
 * Get configured billing provider
 */
function getBillingProvider() {
  if (process.env.STRIPE_SECRET_KEY) {
    return new StripeBillingProvider();
  }
  
  // Fallback to mock
  console.warn('[Billing] Using mock provider. Set STRIPE_SECRET_KEY for production.');
  return new MockBillingProvider();
}

module.exports = {
  BillingProvider,
  StripeBillingProvider,
  MockBillingProvider,
  getBillingProvider
};

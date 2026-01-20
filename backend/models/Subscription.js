/**
 * Subscription Model
 * 
 * Tracks billing subscriptions for users and workspaces.
 * Provider-agnostic design to support Stripe, Razorpay, Paddle, etc.
 * 
 * Plans:
 * - FREE: Default, limited features
 * - PRO: Individual premium features
 * - TEAM: Workspace with multiple members
 * - ENTERPRISE: Custom limits, SLA
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PLANS = {
  FREE: {
    name: 'Free',
    maxStorage: 100 * 1024 * 1024,      // 100MB
    maxFiles: 20,
    maxMembers: 1,
    maxVersions: 3,
    features: ['basic_upload', 'basic_share']
  },
  PRO: {
    name: 'Pro',
    maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
    maxFiles: 1000,
    maxMembers: 1,
    maxVersions: 10,
    features: ['password_share', 'expiry_share', 'download_limits', 'analytics']
  },
  TEAM: {
    name: 'Team',
    maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
    maxFiles: 10000,
    maxMembers: 25,
    maxVersions: 50,
    features: ['password_share', 'expiry_share', 'download_limits', 'analytics', 
               'team_workspace', 'domain_restriction', 'audit_logs']
  },
  ENTERPRISE: {
    name: 'Enterprise',
    maxStorage: Infinity,
    maxFiles: Infinity,
    maxMembers: Infinity,
    maxVersions: Infinity,
    features: ['*']
  }
};

const subscriptionSchema = new Schema({
  // Owner (user or workspace)
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  
  // Plan info
  plan: {
    type: String,
    enum: Object.keys(PLANS),
    default: 'FREE'
  },
  
  status: {
    type: String,
    enum: ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'TRIALING'],
    default: 'ACTIVE'
  },
  
  // Billing provider info
  provider: {
    type: String,
    enum: ['stripe', 'razorpay', 'paddle', 'manual', 'none'],
    default: 'none'
  },
  providerSubscriptionId: { type: String, index: true },
  providerCustomerId: { type: String },
  
  // Billing dates
  startedAt: { type: Date, default: Date.now },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelledAt: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  
  // Trial
  trialStart: { type: Date },
  trialEnd: { type: Date },
  
  // Custom limits override
  customLimits: {
    maxStorage: { type: Number },
    maxFiles: { type: Number },
    maxMembers: { type: Number },
    maxVersions: { type: Number }
  },
  
  // Payment info (minimal, reference only)
  lastPaymentAt: { type: Date },
  lastPaymentAmount: { type: Number },
  currency: { type: String, default: 'USD' },
  
  // Metadata
  metadata: { type: Schema.Types.Mixed },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure one subscription per user/workspace
subscriptionSchema.index({ userId: 1 }, { unique: true, sparse: true });
subscriptionSchema.index({ workspaceId: 1 }, { unique: true, sparse: true });

// Pre-save
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtuals
subscriptionSchema.virtual('isActive').get(function() {
  return this.status === 'ACTIVE' || this.status === 'TRIALING';
});

subscriptionSchema.virtual('planConfig').get(function() {
  return PLANS[this.plan] || PLANS.FREE;
});

// Methods
subscriptionSchema.methods.getLimit = function(limitName) {
  // Custom limit takes precedence
  if (this.customLimits?.[limitName] !== undefined) {
    return this.customLimits[limitName];
  }
  
  return this.planConfig[limitName];
};

subscriptionSchema.methods.hasFeature = function(feature) {
  const features = this.planConfig.features || [];
  return features.includes('*') || features.includes(feature);
};

subscriptionSchema.methods.canRenew = function() {
  return this.status !== 'CANCELLED' && this.status !== 'EXPIRED';
};

// Statics
subscriptionSchema.statics.PLANS = PLANS;

subscriptionSchema.statics.findForUser = function(userId) {
  return this.findOne({ userId });
};

subscriptionSchema.statics.findForWorkspace = function(workspaceId) {
  return this.findOne({ workspaceId });
};

subscriptionSchema.statics.getOrCreateForUser = async function(userId) {
  let subscription = await this.findOne({ userId });
  
  if (!subscription) {
    subscription = new this({
      userId,
      plan: 'FREE',
      status: 'ACTIVE',
      provider: 'none'
    });
    await subscription.save();
  }
  
  return subscription;
};

subscriptionSchema.statics.findByProviderId = function(provider, providerSubscriptionId) {
  return this.findOne({ provider, providerSubscriptionId });
};

module.exports = mongoose.model('Subscription', subscriptionSchema);

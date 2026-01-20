/**
 * ApprovalRequest Model
 * 
 * Implements two-person rule for sensitive operations.
 * Critical config changes require approval from another admin.
 * 
 * Security Notes:
 * - Approver must be different from requester
 * - Requests expire after 24h by default
 * - All approvals/denials are audit logged
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ACTION_TYPES = [
  'sso_config_change',
  'dlp_policy_change',
  'legal_hold_release',
  'user_disable_admin',
  'workspace_delete',
  'scim_token_create',
  'lockdown_disable',
  'break_glass_elevate'
];

const approvalRequestSchema = new Schema({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  // Action details
  actionType: {
    type: String,
    enum: ACTION_TYPES,
    required: true
  },
  
  // Request payload (what will be executed if approved)
  payload: {
    type: Schema.Types.Mixed,
    required: true
  },
  
  // Justification
  reason: {
    type: String,
    required: true
  },
  
  // Requester
  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'EXECUTED'],
    default: 'PENDING'
  },
  
  // Approver (must be different from requester)
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  approvalComment: { type: String },
  
  // Denial
  deniedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deniedAt: { type: Date },
  denialReason: { type: String },
  
  // Execution
  executedAt: { type: Date },
  executionResult: { type: Schema.Types.Mixed },
  
  // Expiry
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  },
  
  createdAt: { type: Date, default: Date.now }
});

// Indexes
approvalRequestSchema.index({ workspaceId: 1, status: 1 });
approvalRequestSchema.index({ requestedBy: 1 });
approvalRequestSchema.index({ expiresAt: 1 });

// Statics
approvalRequestSchema.statics.ACTION_TYPES = ACTION_TYPES;

approvalRequestSchema.statics.createRequest = async function({
  workspaceId,
  actionType,
  payload,
  reason,
  requestedBy,
  expiresInHours = 24
}) {
  const request = new this({
    workspaceId,
    actionType,
    payload,
    reason,
    requestedBy,
    expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
  });
  return request.save();
};

approvalRequestSchema.statics.getPending = function(workspaceId) {
  return this.find({
    workspaceId,
    status: 'PENDING',
    expiresAt: { $gt: new Date() }
  })
  .populate('requestedBy', 'name email')
  .sort({ createdAt: -1 });
};

approvalRequestSchema.statics.expireOld = async function() {
  return this.updateMany(
    {
      status: 'PENDING',
      expiresAt: { $lt: new Date() }
    },
    { status: 'EXPIRED' }
  );
};

// Methods
approvalRequestSchema.methods.canApprove = function(userId) {
  // Cannot self-approve
  if (this.requestedBy.toString() === userId.toString()) {
    return false;
  }
  return this.status === 'PENDING' && this.expiresAt > new Date();
};

approvalRequestSchema.methods.approve = async function(userId, comment = null) {
  if (!this.canApprove(userId)) {
    throw new Error('Cannot approve this request');
  }
  
  this.status = 'APPROVED';
  this.approvedBy = userId;
  this.approvedAt = new Date();
  this.approvalComment = comment;
  return this.save();
};

approvalRequestSchema.methods.deny = async function(userId, reason) {
  if (this.status !== 'PENDING') {
    throw new Error('Request is not pending');
  }
  
  this.status = 'DENIED';
  this.deniedBy = userId;
  this.deniedAt = new Date();
  this.denialReason = reason;
  return this.save();
};

approvalRequestSchema.methods.markExecuted = async function(result = null) {
  this.status = 'EXECUTED';
  this.executedAt = new Date();
  this.executionResult = result;
  return this.save();
};

approvalRequestSchema.methods.toPublicObject = function() {
  return {
    id: this._id,
    actionType: this.actionType,
    reason: this.reason,
    status: this.status,
    requestedBy: this.requestedBy,
    approvedBy: this.approvedBy,
    approvedAt: this.approvedAt,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('ApprovalRequest', approvalRequestSchema);

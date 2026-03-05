/**
 * Invitation Model
 * 
 * Manages workspace invitations with secure tokens.
 * 
 * Flow:
 * 1. Admin creates invitation for email
 * 2. System sends email with invite link
 * 3. User clicks link, creates account if needed
 * 4. Invitation marked accepted, membership created
 * 
 * Security Notes:
 * - Token is cryptographically random
 * - Expires after configurable period
 * - One-time use (marked after acceptance)
 * - Rate limited per workspace
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;

const invitationSchema = new Schema({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  
  role: {
    type: String,
    enum: ['ADMIN', 'MEMBER', 'VIEWER'],
    default: 'MEMBER'
  },
  
  // Secure token for invitation link
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Inviter tracking
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Custom message
  message: {
    type: String,
    maxlength: 500
  },
  
  // Lifecycle
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  acceptedAt: { type: Date },
  acceptedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Revocation
  revokedAt: { type: Date },
  revokedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  createdAt: { type: Date, default: Date.now }
});

// Compound index for email + workspace uniqueness check
invitationSchema.index({ workspaceId: 1, email: 1 });

// TTL index for automatic cleanup of old invitations
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

// Statics
invitationSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('base64url');
};

invitationSchema.statics.createInvitation = async function({
  workspaceId,
  email,
  role,
  invitedBy,
  message,
  expiresInDays = 7
}) {
  // Check for existing pending invitation
  const existing = await this.findOne({
    workspaceId,
    email: email.toLowerCase(),
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });
  
  if (existing) {
    throw new Error('Pending invitation already exists for this email');
  }
  
  const invitation = new this({
    workspaceId,
    email: email.toLowerCase(),
    role,
    invitedBy,
    message,
    token: this.generateToken(),
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
  });
  
  return invitation.save();
};

invitationSchema.statics.findByToken = function(token) {
  return this.findOne({
    token,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }).populate('workspaceId', 'name slug');
};

invitationSchema.statics.getPendingForWorkspace = function(workspaceId) {
  return this.find({
    workspaceId,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  })
  .populate('invitedBy', 'name email')
  .sort({ createdAt: -1 });
};

// Methods
invitationSchema.methods.isValid = function() {
  return !this.acceptedAt && 
         !this.revokedAt && 
         this.expiresAt > new Date();
};

invitationSchema.methods.accept = async function(userId) {
  if (!this.isValid()) {
    throw new Error('Invitation is no longer valid');
  }
  
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

invitationSchema.methods.revoke = async function(userId) {
  this.revokedAt = new Date();
  this.revokedBy = userId;
  return this.save();
};

module.exports = mongoose.model('Invitation', invitationSchema);

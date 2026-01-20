/**
 * ScimToken Model
 * 
 * SCIM (System for Cross-domain Identity Management) tokens
 * for enterprise user provisioning.
 * 
 * Security Notes:
 * - Token is hashed (not stored in plain text)
 * - Single token per workspace
 * - Rate limited + audit logged
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;

const scimTokenSchema = new Schema({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true
  },
  
  // Hashed token
  tokenHash: {
    type: String,
    required: true
  },
  
  // Partial token for display (last 4 chars)
  tokenSuffix: {
    type: String
  },
  
  // Creator
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Usage tracking
  lastUsedAt: { type: Date },
  usageCount: { type: Number, default: 0 },
  
  // Lifecycle
  expiresAt: { type: Date },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  
  createdAt: { type: Date, default: Date.now }
});

// Statics
scimTokenSchema.statics.generateToken = function() {
  return 'scim_' + crypto.randomBytes(32).toString('base64url');
};

scimTokenSchema.statics.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

scimTokenSchema.statics.createForWorkspace = async function(workspaceId, createdBy, expiresInDays = null) {
  // Revoke existing token
  await this.updateOne(
    { workspaceId, revokedAt: null },
    { revokedAt: new Date(), revokedBy: createdBy }
  );
  
  const token = this.generateToken();
  const tokenHash = this.hashToken(token);
  
  const scimToken = new this({
    workspaceId,
    tokenHash,
    tokenSuffix: token.slice(-4),
    createdBy,
    expiresAt: expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null
  });
  
  await scimToken.save();
  
  // Return plain token (only time it's visible)
  return {
    token,
    id: scimToken._id,
    expiresAt: scimToken.expiresAt
  };
};

scimTokenSchema.statics.validateToken = async function(token) {
  const tokenHash = this.hashToken(token);
  
  const scimToken = await this.findOne({
    tokenHash,
    revokedAt: null
  }).populate('workspaceId');
  
  if (!scimToken) {
    return null;
  }
  
  // Check expiry
  if (scimToken.expiresAt && scimToken.expiresAt < new Date()) {
    return null;
  }
  
  // Update usage
  scimToken.lastUsedAt = new Date();
  scimToken.usageCount += 1;
  await scimToken.save();
  
  return scimToken;
};

scimTokenSchema.statics.getForWorkspace = function(workspaceId) {
  return this.findOne({
    workspaceId,
    revokedAt: null
  });
};

// Methods
scimTokenSchema.methods.revoke = async function(revokedBy) {
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  return this.save();
};

scimTokenSchema.methods.toPublicObject = function() {
  return {
    id: this._id,
    tokenSuffix: '****' + this.tokenSuffix,
    lastUsedAt: this.lastUsedAt,
    usageCount: this.usageCount,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('ScimToken', scimTokenSchema);

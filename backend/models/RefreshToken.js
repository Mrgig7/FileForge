/**
 * RefreshToken Model
 * 
 * Security Design:
 * - Store only SHA-256 hash of refresh token (never raw token)
 * - Track token family for rotation and reuse detection
 * - Store metadata for suspicious activity detection (IP, userAgent)
 * 
 * Threat Model:
 * - Token theft: Detected via reuse detection (using familyId)
 * - Brute force: Tokens are 256-bit random, infeasible to guess
 * - Session hijacking: IP/userAgent changes logged for audit
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const RefreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // SHA-256 hash of the refresh token (never store raw token)
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Token family ID for rotation tracking
  // All tokens in a refresh chain share the same familyId
  // If a token is reused after rotation, entire family is revoked
  familyId: {
    type: String,
    required: true,
    index: true
  },
  
  // Token that replaced this one (for audit trail)
  replacedByTokenHash: {
    type: String,
    default: null
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  revokedAt: {
    type: Date,
    default: null
  },
  
  // Revocation reason for audit
  revokedReason: {
    type: String,
    enum: ['logout', 'logout_all', 'token_reuse', 'expired', 'admin_revoke', 'password_change'],
    default: null
  },
  
  // Client metadata for suspicious activity detection
  ip: {
    type: String,
    default: null
  },
  
  userAgent: {
    type: String,
    default: null
  },
  
  // Last used for session activity tracking
  lastUsedAt: {
    type: Date,
    default: null
  }
});

// Index for cleanup of expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method: Hash a refresh token
RefreshTokenSchema.statics.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Static method: Generate a cryptographically secure refresh token
RefreshTokenSchema.statics.generateToken = function() {
  // 256 bits = 32 bytes = 64 hex chars (very strong)
  return crypto.randomBytes(32).toString('hex');
};

// Static method: Find token by raw token value
RefreshTokenSchema.statics.findByToken = async function(rawToken) {
  const tokenHash = this.hashToken(rawToken);
  return this.findOne({ tokenHash, revokedAt: null });
};

// Static method: Revoke all tokens for a user
RefreshTokenSchema.statics.revokeAllForUser = async function(userId, reason = 'logout_all') {
  return this.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: reason }
  );
};

// Static method: Revoke entire token family (for reuse detection)
RefreshTokenSchema.statics.revokeFamily = async function(familyId, reason = 'token_reuse') {
  return this.updateMany(
    { familyId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: reason }
  );
};

// Instance method: Check if token is valid
RefreshTokenSchema.methods.isValid = function() {
  return !this.revokedAt && new Date() < this.expiresAt;
};

// Instance method: Revoke this token
RefreshTokenSchema.methods.revoke = async function(reason = 'logout') {
  this.revokedAt = new Date();
  this.revokedReason = reason;
  return this.save();
};

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);

/**
 * Session Model
 * 
 * Tracks active user sessions for conditional access control.
 * Linked to devices and refresh token families.
 * 
 * Security Notes:
 * - Sessions can be individually revoked
 * - Max sessions per user enforced
 * - All sessions can be revoked (logout all)
 * 
 * Threat Model:
 * - Session hijacking: Mitigated by device binding + IP tracking
 * - Session fixation: Mitigated by rotating refresh tokens
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Device association
  deviceId: {
    type: Schema.Types.ObjectId,
    ref: 'Device',
    index: true
  },
  
  // Refresh token family (for rotation tracking)
  refreshTokenFamilyId: {
    type: String,
    index: true
  },
  
  // Workspace context (if SSO session)
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  
  // SSO session tracking
  ssoSessionId: { type: String },
  identityProviderId: {
    type: Schema.Types.ObjectId,
    ref: 'IdentityProvider'
  },
  
  // Request metadata
  ip: { type: String },
  userAgent: { type: String },
  location: { type: String },
  
  // Activity
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  
  // Revocation
  revokedAt: { type: Date, default: null },
  revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  revokeReason: { type: String }
});

// Indexes
sessionSchema.index({ userId: 1, revokedAt: 1 });
sessionSchema.index({ createdAt: -1 });
sessionSchema.index({ expiresAt: 1 });

// Methods
sessionSchema.methods.isActive = function() {
  if (this.revokedAt) return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  return true;
};

sessionSchema.methods.revoke = async function(revokedBy = null, reason = null) {
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revokeReason = reason;
  return this.save();
};

sessionSchema.methods.touch = async function() {
  this.lastUsedAt = new Date();
  return this.save();
};

sessionSchema.methods.toPublicObject = function() {
  return {
    id: this._id,
    deviceId: this.deviceId,
    ip: this.ip ? this.ip.replace(/\.\d+$/, '.xxx') : null,
    location: this.location,
    createdAt: this.createdAt,
    lastUsedAt: this.lastUsedAt,
    isActive: this.isActive(),
    isSso: !!this.identityProviderId
  };
};

// Statics
sessionSchema.statics.createSession = function({
  userId,
  deviceId,
  refreshTokenFamilyId,
  workspaceId,
  identityProviderId,
  ssoSessionId,
  ip,
  userAgent,
  location,
  expiresIn = 7 * 24 * 60 * 60 * 1000  // 7 days default
}) {
  return this.create({
    userId,
    deviceId,
    refreshTokenFamilyId,
    workspaceId,
    identityProviderId,
    ssoSessionId,
    ip,
    userAgent,
    location,
    expiresAt: new Date(Date.now() + expiresIn)
  });
};

sessionSchema.statics.getUserSessions = function(userId, activeOnly = true) {
  const query = { userId };
  if (activeOnly) {
    query.revokedAt = null;
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];
  }
  return this.find(query)
    .populate('deviceId')
    .sort({ lastUsedAt: -1 });
};

sessionSchema.statics.countActiveSessions = function(userId) {
  return this.countDocuments({
    userId,
    revokedAt: null,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

sessionSchema.statics.revokeAllForUser = async function(userId, revokedBy = null, reason = 'logout_all') {
  return this.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date(), revokedBy, revokeReason: reason }
  );
};

sessionSchema.statics.revokeByFamily = async function(refreshTokenFamilyId, reason = 'token_rotation') {
  return this.updateMany(
    { refreshTokenFamilyId, revokedAt: null },
    { revokedAt: new Date(), revokeReason: reason }
  );
};

sessionSchema.statics.findByFamily = function(refreshTokenFamilyId) {
  return this.findOne({
    refreshTokenFamilyId,
    revokedAt: null
  });
};

// Cleanup stale sessions (for worker)
sessionSchema.statics.cleanupExpired = async function() {
  return this.deleteMany({
    $or: [
      { revokedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },  // Revoked 30+ days ago
      { expiresAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }   // Expired 30+ days ago
    ]
  });
};

module.exports = mongoose.model('Session', sessionSchema);

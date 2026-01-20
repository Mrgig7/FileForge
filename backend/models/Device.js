/**
 * Device Model
 * 
 * Tracks devices that have accessed user accounts.
 * Enables device trust policies and session control.
 * 
 * Security Notes:
 * - Device fingerprint is hashed (not reversible)
 * - Trusted devices can bypass additional verification
 * - Admin can revoke device trust
 * 
 * Threat Model:
 * - Device spoofing: Mitigated by fingerprint hash + IP correlation
 * - Stolen device: User can untrust device remotely
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;

const deviceSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Device identification (hashed fingerprint)
  fingerprintHash: {
    type: String,
    required: true,
    index: true
  },
  
  // Human-readable name (optional, user-set)
  name: {
    type: String,
    default: null
  },
  
  // Device info
  type: {
    type: String,
    enum: ['DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  
  browser: { type: String },
  os: { type: String },
  
  // Trust status
  trusted: {
    type: Boolean,
    default: false
  },
  trustedAt: { type: Date },
  trustedBy: { type: Schema.Types.ObjectId, ref: 'User' },  // null = user, id = admin
  
  // Activity
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  lastIp: { type: String },
  lastLocation: { type: String },  // City, Country (from IP)
  
  // Security
  loginCount: { type: Number, default: 0 },
  suspiciousActivity: { type: Boolean, default: false },
  
  // Lifecycle
  revokedAt: { type: Date, default: null }
});

// Compound index
deviceSchema.index({ userId: 1, fingerprintHash: 1 }, { unique: true });
deviceSchema.index({ lastSeenAt: -1 });

// Statics
deviceSchema.statics.hashFingerprint = function(fingerprint) {
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
};

deviceSchema.statics.findOrCreate = async function(userId, fingerprint, metadata = {}) {
  const fingerprintHash = this.hashFingerprint(fingerprint);
  
  let device = await this.findOne({ userId, fingerprintHash });
  
  if (!device) {
    device = new this({
      userId,
      fingerprintHash,
      ...metadata,
      firstSeenAt: new Date()
    });
    await device.save();
  } else {
    // Update last seen
    device.lastSeenAt = new Date();
    device.loginCount += 1;
    if (metadata.lastIp) device.lastIp = metadata.lastIp;
    if (metadata.browser) device.browser = metadata.browser;
    if (metadata.os) device.os = metadata.os;
    await device.save();
  }
  
  return device;
};

deviceSchema.statics.getUserDevices = function(userId, includeRevoked = false) {
  const query = { userId };
  if (!includeRevoked) {
    query.revokedAt = null;
  }
  return this.find(query).sort({ lastSeenAt: -1 });
};

deviceSchema.statics.countActiveDevices = function(userId) {
  return this.countDocuments({ userId, revokedAt: null });
};

// Methods
deviceSchema.methods.trust = async function(trustedBy = null) {
  this.trusted = true;
  this.trustedAt = new Date();
  this.trustedBy = trustedBy;
  return this.save();
};

deviceSchema.methods.untrust = async function() {
  this.trusted = false;
  this.trustedAt = null;
  this.trustedBy = null;
  return this.save();
};

deviceSchema.methods.revoke = async function() {
  this.revokedAt = new Date();
  this.trusted = false;
  return this.save();
};

deviceSchema.methods.toPublicObject = function() {
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    browser: this.browser,
    os: this.os,
    trusted: this.trusted,
    firstSeenAt: this.firstSeenAt,
    lastSeenAt: this.lastSeenAt,
    lastIp: this.lastIp ? this.lastIp.replace(/\.\d+$/, '.xxx') : null,  // Partial mask
    loginCount: this.loginCount
  };
};

module.exports = mongoose.model('Device', deviceSchema);

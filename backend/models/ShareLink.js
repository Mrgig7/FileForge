/**
 * ShareLink Model
 * 
 * Security Design:
 * - Random token >= 128 bits (using crypto.randomBytes)
 * - Password stored as bcrypt hash
 * - HMAC signature for URL tampering protection
 * - Per-IP rate limiting via accessLog
 * 
 * Threat Model:
 * - Brute force token: 128-bit random, infeasible to guess (2^128 combinations)
 * - Password guessing: bcrypt with cost factor, rate limited
 * - Link tampering: HMAC signature prevents modification
 * - Scraping: Per-IP throttling, max downloads limit
 * - Replay attacks: Expiry timestamp in signed URL
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ShareLinkSchema = new mongoose.Schema({
  // Reference to the file being shared
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true,
    index: true
  },
  
  // Owner of the share link
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Random token for the share URL (128+ bits)
  // Format: 32 bytes = 256 bits = 64 hex chars
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // HMAC signature secret (per-link, for extra security)
  // Combined with server secret for signature
  hmacSalt: {
    type: String,
    required: true
  },
  
  // Optional expiry time
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },
  
  // Optional password protection (bcrypt hash)
  // Select: false means it won't be returned by default in queries
  passwordHash: {
    type: String,
    default: null,
    select: false
  },
  
  // Download limits
  maxDownloads: {
    type: Number,
    default: null // null = unlimited
  },
  
  downloadsCount: {
    type: Number,
    default: 0
  },
  
  // IP-based rate limiting (requests per minute)
  ipThrottlePerMin: {
    type: Number,
    default: 10
  },
  
  // Access log for audit and rate limiting
  // Stored in separate collection for performance if needed
  accessLog: [{
    ip: String,
    timestamp: { type: Date, default: Date.now },
    userAgent: String,
    action: { type: String, enum: ['view', 'download', 'password_attempt'] },
    success: { type: Boolean, default: true }
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  revokedAt: {
    type: Date,
    default: null
  }
});

// Compound index for cleanup
ShareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method: Generate a cryptographically secure token
ShareLinkSchema.statics.generateToken = function() {
  // 256 bits = 32 bytes = 64 hex chars
  return crypto.randomBytes(32).toString('hex');
};

// Static method: Generate HMAC salt
ShareLinkSchema.statics.generateHmacSalt = function() {
  return crypto.randomBytes(16).toString('hex');
};

// Static method: Create HMAC signature for URL
// Uses server secret + link salt for defense in depth
ShareLinkSchema.statics.createSignature = function(token, expiresTimestamp, serverSecret, linkSalt) {
  const data = `${token}:${expiresTimestamp}`;
  const key = crypto.createHmac('sha256', serverSecret).update(linkSalt).digest();
  return crypto.createHmac('sha256', key).update(data).digest('hex');
};

// Static method: Verify HMAC signature (constant-time comparison)
ShareLinkSchema.statics.verifySignature = function(signature, token, expiresTimestamp, serverSecret, linkSalt) {
  const expectedSig = this.createSignature(token, expiresTimestamp, serverSecret, linkSalt);
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
};

// Instance method: Set password (hashes with bcrypt)
ShareLinkSchema.methods.setPassword = async function(plainPassword) {
  const salt = await bcrypt.genSalt(12); // Cost factor 12 for good security/performance balance
  this.passwordHash = await bcrypt.hash(plainPassword, salt);
  return this;
};

// Instance method: Verify password
ShareLinkSchema.methods.verifyPassword = async function(plainPassword) {
  if (!this.passwordHash) return true; // No password set
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Instance method: Check if link is valid
ShareLinkSchema.methods.isValid = function() {
  // Not revoked
  if (this.revokedAt) return false;
  
  // Not expired
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  
  // Not exceeded download limit
  if (this.maxDownloads !== null && this.downloadsCount >= this.maxDownloads) return false;
  
  return true;
};

// Instance method: Check IP throttle
ShareLinkSchema.methods.isIpThrottled = function(ip) {
  if (!this.ipThrottlePerMin) return false;
  
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const recentAccesses = this.accessLog.filter(
    log => log.ip === ip && log.timestamp > oneMinuteAgo
  );
  
  return recentAccesses.length >= this.ipThrottlePerMin;
};

// Instance method: Log access attempt
ShareLinkSchema.methods.logAccess = async function(ip, userAgent, action, success = true) {
  // Keep only last 1000 entries to prevent unbounded growth
  if (this.accessLog.length >= 1000) {
    this.accessLog = this.accessLog.slice(-900);
  }
  
  this.accessLog.push({ ip, userAgent, action, success, timestamp: new Date() });
  return this.save();
};

// Instance method: Increment download count
ShareLinkSchema.methods.incrementDownload = async function() {
  this.downloadsCount += 1;
  return this.save();
};

// Instance method: Revoke the link
ShareLinkSchema.methods.revoke = async function() {
  this.revokedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('ShareLink', ShareLinkSchema);

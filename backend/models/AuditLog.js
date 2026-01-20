/**
 * AuditLog Model (Phase 3 Enhanced)
 * 
 * Records security-relevant events for compliance and forensics.
 * Immutable design with hash-chaining for tamper-evidence.
 * 
 * Hash Chain Design:
 * - Each record stores hash of (prevHash + serialized record)
 * - Enables verification: if any record modified, chain breaks
 * - prevHash = null for first record in chain
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const AuditLogSchema = new mongoose.Schema({
  // Action category (expanded for Phase 3)
  action: {
    type: String,
    required: true,
    index: true
    // Removed strict enum for flexibility
  },
  
  // Workspace scope (Phase 3)
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true
  },
  
  // User who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  // Target resource
  targetType: {
    type: String,
    default: null
  },
  
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  
  // Request metadata
  ip: { type: String, default: null, index: true },
  userAgent: { type: String, default: null },
  
  // Additional context (flexible JSON)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Result
  success: { type: Boolean, default: true },
  errorMessage: { type: String, default: null },
  
  // Hash chain (Phase 3)
  prevHash: { type: String, default: null },
  hash: { type: String, required: true, index: true },
  
  // Timestamp (immutable)
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  }
}, {
  versionKey: false
});

// Indexes
AuditLogSchema.index({ workspaceId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });

/**
 * Compute hash for a record
 */
function computeHash(prevHash, record) {
  const payload = JSON.stringify({
    prevHash,
    action: record.action,
    workspaceId: record.workspaceId?.toString(),
    userId: record.userId?.toString(),
    targetType: record.targetType,
    targetId: record.targetId?.toString(),
    ip: record.ip,
    timestamp: record.timestamp?.toISOString(),
    metadata: record.metadata,
    success: record.success
  });
  
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// Pre-save: Compute hash chain
AuditLogSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Get last log for this workspace (or global)
    const query = this.workspaceId 
      ? { workspaceId: this.workspaceId }
      : { workspaceId: null };
    
    const lastLog = await mongoose.model('AuditLog')
      .findOne(query)
      .sort({ timestamp: -1 })
      .select('hash');
    
    this.prevHash = lastLog?.hash || null;
    this.hash = computeHash(this.prevHash, this);
  }
  next();
});

// Static: Log an event
AuditLogSchema.statics.log = async function(eventData) {
  const log = new this({
    ...eventData,
    timestamp: new Date()
  });
  return log.save();
};

// Static: Log with request context
AuditLogSchema.statics.logFromRequest = async function(req, action, data = {}) {
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
  const userAgent = req.headers['user-agent'];
  const userId = req.user?._id || null;
  const workspaceId = data.workspaceId || req.workspace?._id || null;
  
  return this.log({
    action,
    userId,
    workspaceId,
    ip,
    userAgent,
    ...data
  });
};

// Static: Verify hash chain integrity
AuditLogSchema.statics.verifyChain = async function(workspaceId = null, limit = 1000) {
  const query = workspaceId ? { workspaceId } : { workspaceId: null };
  
  const logs = await this.find(query)
    .sort({ timestamp: 1 })
    .limit(limit)
    .lean();
  
  if (logs.length === 0) {
    return { valid: true, checked: 0, message: 'No logs to verify' };
  }
  
  let prevHash = null;
  let invalidAt = null;
  
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    
    // Check prevHash matches
    if (log.prevHash !== prevHash) {
      invalidAt = { index: i, id: log._id, expected: prevHash, found: log.prevHash };
      break;
    }
    
    // Recompute hash
    const computed = computeHash(log.prevHash, log);
    if (computed !== log.hash) {
      invalidAt = { index: i, id: log._id, reason: 'hash_mismatch' };
      break;
    }
    
    prevHash = log.hash;
  }
  
  if (invalidAt) {
    return {
      valid: false,
      checked: invalidAt.index,
      total: logs.length,
      error: invalidAt
    };
  }
  
  return {
    valid: true,
    checked: logs.length,
    lastHash: prevHash
  };
};

// Static: Get logs with filters
AuditLogSchema.statics.query = function({
  workspaceId,
  userId,
  action,
  from,
  to,
  page = 1,
  limit = 50
}) {
  const query = {};
  
  if (workspaceId) query.workspaceId = workspaceId;
  if (userId) query.userId = userId;
  if (action) query.action = action;
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to) query.timestamp.$lte = new Date(to);
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('userId', 'name email');
};

module.exports = mongoose.model('AuditLog', AuditLogSchema);


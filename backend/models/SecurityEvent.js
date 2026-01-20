/**
 * SecurityEvent Model
 * 
 * Tracks security-relevant events for the Security Center.
 * Used for alerting, dashboards, and incident response.
 * 
 * Event Types:
 * - brute_force_password: Multiple failed login attempts
 * - excessive_downloads: Unusual download volume
 * - share_token_guessing: Multiple invalid share accesses
 * - malware_detected: File quarantined
 * - dlp_violation: DLP policy blocked action
 * - suspicious_geo: Login from unusual location
 * - config_change: Admin configuration modified
 * - lockdown_triggered: Emergency lockdown activated
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SEVERITY_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const EVENT_TYPES = [
  'brute_force_password',
  'excessive_downloads',
  'share_token_guessing',
  'malware_detected',
  'dlp_violation',
  'suspicious_geo',
  'config_change',
  'lockdown_triggered',
  'session_anomaly',
  'privilege_escalation',
  'data_exfiltration_attempt',
  'unauthorized_access'
];

const securityEventSchema = new Schema({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  
  // Event classification
  type: {
    type: String,
    enum: EVENT_TYPES,
    required: true,
    index: true
  },
  
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    required: true,
    index: true
  },
  
  // Actor (may be null for system-detected events)
  actorUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Target
  targetType: { type: String },  // user, file, share, workspace
  targetId: { type: Schema.Types.ObjectId },
  
  // Request context
  ip: { type: String },
  userAgent: { type: String },
  location: { type: String },
  
  // Event details
  title: { type: String, required: true },
  description: { type: String },
  
  // Flexible metadata
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  
  // Resolution
  status: {
    type: String,
    enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'],
    default: 'OPEN'
  },
  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolution: { type: String },
  
  createdAt: { type: Date, default: Date.now, index: true }
});

// Indexes
securityEventSchema.index({ workspaceId: 1, severity: 1, createdAt: -1 });
securityEventSchema.index({ type: 1, createdAt: -1 });

// Statics
securityEventSchema.statics.TYPES = EVENT_TYPES;
securityEventSchema.statics.SEVERITY = SEVERITY_LEVELS;

securityEventSchema.statics.create = async function(eventData) {
  const event = new this(eventData);
  return event.save();
};

securityEventSchema.statics.logBruteForce = function(userId, ip, attempts) {
  return this.create({
    type: 'brute_force_password',
    severity: attempts > 10 ? 'HIGH' : 'MEDIUM',
    actorUserId: userId,
    ip,
    title: `Brute force login attempt detected`,
    description: `${attempts} failed login attempts from IP ${ip}`,
    metadata: { attempts }
  });
};

securityEventSchema.statics.logDlpViolation = function(workspaceId, userId, fileId, policy, action) {
  return this.create({
    workspaceId,
    type: 'dlp_violation',
    severity: 'MEDIUM',
    actorUserId: userId,
    targetType: 'file',
    targetId: fileId,
    title: `DLP policy violation: ${policy}`,
    description: `${action} blocked by policy: ${policy}`,
    metadata: { policy, action }
  });
};

securityEventSchema.statics.logMalwareDetected = function(workspaceId, fileId, threats) {
  return this.create({
    workspaceId,
    type: 'malware_detected',
    severity: 'CRITICAL',
    targetType: 'file',
    targetId: fileId,
    title: 'Malware detected in uploaded file',
    description: `Threats found: ${threats.join(', ')}`,
    metadata: { threats }
  });
};

securityEventSchema.statics.logLockdown = function(workspaceId, userId, enabled) {
  return this.create({
    workspaceId,
    type: 'lockdown_triggered',
    severity: 'CRITICAL',
    actorUserId: userId,
    title: enabled ? 'Lockdown mode ENABLED' : 'Lockdown mode DISABLED',
    metadata: { enabled }
  });
};

securityEventSchema.statics.getSummary = async function(workspaceId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const [bySeverity, byType, total] = await Promise.all([
    this.aggregate([
      { $match: { workspaceId, createdAt: { $gte: since } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { workspaceId, createdAt: { $gte: since } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),
    this.countDocuments({ workspaceId, createdAt: { $gte: since } })
  ]);
  
  return {
    total,
    bySeverity: Object.fromEntries(bySeverity.map(s => [s._id, s.count])),
    topTypes: byType.map(t => ({ type: t._id, count: t.count }))
  };
};

securityEventSchema.statics.getOpenCritical = function(workspaceId) {
  return this.find({
    workspaceId,
    severity: { $in: ['HIGH', 'CRITICAL'] },
    status: 'OPEN'
  }).sort({ createdAt: -1 }).limit(20);
};

// Methods
securityEventSchema.methods.resolve = async function(userId, resolution, status = 'RESOLVED') {
  this.status = status;
  this.resolvedAt = new Date();
  this.resolvedBy = userId;
  this.resolution = resolution;
  return this.save();
};

module.exports = mongoose.model('SecurityEvent', securityEventSchema);

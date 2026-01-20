/**
 * FileVersion Model
 * 
 * Represents a specific version of a file.
 * Enables version history while keeping share links stable.
 * 
 * Design:
 * - File entity is the "root" with metadata + currentVersionId
 * - FileVersion entities contain the actual file data references
 * - Share links can point to latest (null targetVersionId) or frozen version
 * 
 * Retention:
 * - Version count limited by plan
 * - Old versions can be pruned by worker
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileVersionSchema = new Schema({
  fileId: {
    type: Schema.Types.ObjectId,
    ref: 'File',
    required: true,
    index: true
  },
  
  versionNumber: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Storage reference
  cloudinaryId: { type: String },
  cloudinaryUrl: { type: String },
  fileKey: { type: String },  // For multi-region storage
  
  // File metadata
  size: { type: Number, required: true },
  mimeType: { type: String },
  checksum: { type: String },  // SHA-256
  
  // Upload info
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Scanning status (inherited behavior from Phase 2)
  status: {
    type: String,
    enum: ['PENDING', 'SCANNING', 'READY', 'QUARANTINED', 'DELETED'],
    default: 'PENDING'
  },
  
  scanResult: {
    scannedAt: { type: Date },
    clean: { type: Boolean },
    threats: [{ type: String }],
    scannerVersion: { type: String }
  },
  
  // Version notes
  changelog: { type: String, maxlength: 500 },
  
  // Multi-region support
  region: { type: String, default: 'default' },
  
  // Lifecycle
  deletedAt: { type: Date, default: null },
  
  createdAt: { type: Date, default: Date.now }
});

// Compound indexes
fileVersionSchema.index({ fileId: 1, versionNumber: -1 });
fileVersionSchema.index({ fileId: 1, status: 1 });
fileVersionSchema.index({ deletedAt: 1 }, { sparse: true });

// Statics
fileVersionSchema.statics.getLatestVersion = function(fileId) {
  return this.findOne({
    fileId,
    deletedAt: null,
    status: 'READY'
  }).sort({ versionNumber: -1 });
};

fileVersionSchema.statics.getVersionHistory = function(fileId, limit = 10) {
  return this.find({
    fileId,
    deletedAt: null
  })
  .sort({ versionNumber: -1 })
  .limit(limit)
  .populate('uploadedBy', 'name email');
};

fileVersionSchema.statics.getNextVersionNumber = async function(fileId) {
  const latest = await this.findOne({ fileId })
    .sort({ versionNumber: -1 })
    .select('versionNumber');
  
  return (latest?.versionNumber || 0) + 1;
};

fileVersionSchema.statics.countVersions = function(fileId) {
  return this.countDocuments({ fileId, deletedAt: null });
};

// Methods
fileVersionSchema.methods.isDownloadable = function() {
  return this.status === 'READY' && !this.deletedAt;
};

fileVersionSchema.methods.softDelete = async function() {
  this.deletedAt = new Date();
  this.status = 'DELETED';
  return this.save();
};

module.exports = mongoose.model('FileVersion', fileVersionSchema);

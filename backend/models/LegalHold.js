/**
 * LegalHold Model
 * 
 * Implements legal holds for compliance/eDiscovery.
 * Files under legal hold cannot be deleted.
 * 
 * Security Notes:
 * - Only workspace OWNER/ADMIN can manage holds
 * - All hold actions are audit logged
 * - Holds are immutable once created (can only release)
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const legalHoldSchema = new Schema({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  // Hold identification
  name: {
    type: String,
    required: true
  },
  
  reference: {
    type: String  // External case number
  },
  
  // Reason/description
  reason: {
    type: String,
    required: true
  },
  
  // Creator
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Files under hold
  fileIds: [{
    type: Schema.Types.ObjectId,
    ref: 'File'
  }],
  
  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'RELEASED'],
    default: 'ACTIVE'
  },
  
  releasedAt: { type: Date },
  releasedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  releaseReason: { type: String },
  
  // Dates
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
legalHoldSchema.index({ workspaceId: 1, status: 1 });
legalHoldSchema.index({ fileIds: 1 });

// Pre-save
legalHoldSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Statics
legalHoldSchema.statics.isFileUnderHold = async function(fileId) {
  const hold = await this.findOne({
    fileIds: fileId,
    status: 'ACTIVE'
  });
  return !!hold;
};

legalHoldSchema.statics.getHoldsForFile = function(fileId) {
  return this.find({
    fileIds: fileId,
    status: 'ACTIVE'
  }).populate('createdBy', 'name email');
};

legalHoldSchema.statics.getActiveHolds = function(workspaceId) {
  return this.find({
    workspaceId,
    status: 'ACTIVE'
  })
  .populate('createdBy', 'name email')
  .sort({ createdAt: -1 });
};

// Methods
legalHoldSchema.methods.addFile = async function(fileId) {
  if (!this.fileIds.includes(fileId)) {
    this.fileIds.push(fileId);
    await this.save();
  }
  return this;
};

legalHoldSchema.methods.removeFile = async function(fileId) {
  this.fileIds = this.fileIds.filter(id => id.toString() !== fileId.toString());
  await this.save();
  return this;
};

legalHoldSchema.methods.release = async function(userId, reason) {
  this.status = 'RELEASED';
  this.releasedAt = new Date();
  this.releasedBy = userId;
  this.releaseReason = reason;
  return this.save();
};

legalHoldSchema.methods.toPublicObject = function() {
  return {
    id: this._id,
    name: this.name,
    reference: this.reference,
    reason: this.reason,
    status: this.status,
    fileCount: this.fileIds.length,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
    releasedAt: this.releasedAt
  };
};

module.exports = mongoose.model('LegalHold', legalHoldSchema);

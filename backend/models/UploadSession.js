/**
 * UploadSession Model
 * 
 * Tracks multi-chunk upload sessions for resume + dedup support.
 * 
 * Flow:
 * 1. Client calls /uploads/init with file metadata + hash
 * 2. Server checks dedup (existing file with same hash)
 * 3. If new, creates session with INITIATED status
 * 4. Client uploads chunks
 * 5. Client calls /uploads/complete to merge
 * 
 * Security Notes:
 * - uploadId is UUID (non-guessable)
 * - Sessions bound to userId/workspaceId
 * - Expired sessions cleaned by worker
 * 
 * Threat Model:
 * - Upload hijacking: Mitigated by userId binding
 * - DoS via incomplete uploads: Mitigated by expiry + cleanup
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Schema = mongoose.Schema;

const UPLOAD_STATUSES = ['INITIATED', 'UPLOADING', 'MERGING', 'DONE', 'FAILED', 'EXPIRED'];

const uploadSessionSchema = new Schema({
  // Unique upload identifier (UUID)
  uploadId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4(),
    index: true
  },
  
  // Owner
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Optional workspace scope
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  
  // File metadata
  fileName: {
    type: String,
    required: true
  },
  
  mimeType: {
    type: String
  },
  
  fileSize: {
    type: Number,
    required: true
  },
  
  // Chunk configuration
  totalChunks: {
    type: Number,
    required: true,
    min: 1
  },
  
  chunkSize: {
    type: Number,
    required: true
  },
  
  // Dedup: SHA-256 hash of complete file
  fileHashSha256: {
    type: String,
    required: true,
    index: true
  },
  
  // Upload progress tracking
  uploadedChunks: {
    type: [Number],  // Array of chunk indexes
    default: []
  },
  
  // Status
  status: {
    type: String,
    enum: UPLOAD_STATUSES,
    default: 'INITIATED',
    index: true
  },
  
  // Result (set on DONE)
  fileId: {
    type: Schema.Types.ObjectId,
    ref: 'File'
  },
  
  cloudinaryId: { type: String },
  cloudinaryUrl: { type: String },
  
  // Error tracking
  errorMessage: { type: String },
  
  // Lifecycle
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),  // 24h
    index: true
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

// Compound indexes
uploadSessionSchema.index({ userId: 1, status: 1 });
uploadSessionSchema.index({ fileHashSha256: 1, status: 1 });

// Pre-save
uploadSessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtuals
uploadSessionSchema.virtual('progress').get(function() {
  if (this.totalChunks === 0) return 0;
  return Math.round((this.uploadedChunks.length / this.totalChunks) * 100);
});

uploadSessionSchema.virtual('missingChunks').get(function() {
  const all = Array.from({ length: this.totalChunks }, (_, i) => i);
  return all.filter(i => !this.uploadedChunks.includes(i));
});

// Methods
uploadSessionSchema.methods.markChunkUploaded = async function(chunkIndex) {
  if (!this.uploadedChunks.includes(chunkIndex)) {
    this.uploadedChunks.push(chunkIndex);
    this.status = 'UPLOADING';
    await this.save();
  }
  return this;
};

uploadSessionSchema.methods.isComplete = function() {
  return this.uploadedChunks.length === this.totalChunks;
};

uploadSessionSchema.methods.markMerging = async function() {
  this.status = 'MERGING';
  return this.save();
};

uploadSessionSchema.methods.markDone = async function(fileId, cloudinaryData = {}) {
  this.status = 'DONE';
  this.fileId = fileId;
  this.cloudinaryId = cloudinaryData.cloudinaryId;
  this.cloudinaryUrl = cloudinaryData.cloudinaryUrl;
  this.completedAt = new Date();
  return this.save();
};

uploadSessionSchema.methods.markFailed = async function(errorMessage) {
  this.status = 'FAILED';
  this.errorMessage = errorMessage;
  return this.save();
};

uploadSessionSchema.methods.toPublicObject = function() {
  return {
    uploadId: this.uploadId,
    fileName: this.fileName,
    fileSize: this.fileSize,
    totalChunks: this.totalChunks,
    uploadedChunks: this.uploadedChunks,
    missingChunks: this.missingChunks,
    progress: this.progress,
    status: this.status,
    createdAt: this.createdAt,
    expiresAt: this.expiresAt
  };
};

// Statics
uploadSessionSchema.statics.STATUSES = UPLOAD_STATUSES;
uploadSessionSchema.statics.DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;  // 5MB

uploadSessionSchema.statics.findByUploadId = function(uploadId) {
  return this.findOne({ uploadId });
};

uploadSessionSchema.statics.findDuplicate = async function(fileHashSha256) {
  // Find completed upload with same hash
  const session = await this.findOne({
    fileHashSha256,
    status: 'DONE',
    fileId: { $ne: null }
  }).populate('fileId');
  
  return session?.fileId || null;
};

uploadSessionSchema.statics.createSession = async function({
  userId,
  workspaceId,
  fileName,
  mimeType,
  fileSize,
  totalChunks,
  fileHashSha256,
  chunkSize
}) {
  const session = new this({
    userId,
    workspaceId,
    fileName,
    mimeType,
    fileSize,
    totalChunks,
    fileHashSha256,
    chunkSize: chunkSize || this.DEFAULT_CHUNK_SIZE
  });
  
  return session.save();
};

uploadSessionSchema.statics.cleanupExpired = async function() {
  const result = await this.updateMany(
    {
      status: { $in: ['INITIATED', 'UPLOADING'] },
      expiresAt: { $lt: new Date() }
    },
    { status: 'EXPIRED' }
  );
  
  return result.modifiedCount;
};

module.exports = mongoose.model('UploadSession', uploadSessionSchema);

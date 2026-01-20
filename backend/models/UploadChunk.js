/**
 * UploadChunk Model
 * 
 * Tracks individual chunks within a multi-chunk upload session.
 * 
 * Security Notes:
 * - Each chunk has its own SHA-256 hash for integrity
 * - Chunk path is internal only (never exposed to client)
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const uploadChunkSchema = new Schema({
  // Parent upload session
  uploadId: {
    type: String,
    required: true,
    index: true
  },
  
  // Chunk identification
  chunkIndex: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Integrity
  chunkHashSha256: {
    type: String,
    required: true
  },
  
  // Size
  size: {
    type: Number,
    required: true
  },
  
  // Storage location (internal path or object key)
  storagePath: {
    type: String,
    required: true
  },
  
  // Verification status
  verified: {
    type: Boolean,
    default: false
  },
  
  uploadedAt: { type: Date, default: Date.now }
});

// Compound unique index
uploadChunkSchema.index({ uploadId: 1, chunkIndex: 1 }, { unique: true });

// Statics
uploadChunkSchema.statics.findChunksForUpload = function(uploadId) {
  return this.find({ uploadId }).sort({ chunkIndex: 1 });
};

uploadChunkSchema.statics.getUploadedIndexes = async function(uploadId) {
  const chunks = await this.find({ uploadId }).select('chunkIndex');
  return chunks.map(c => c.chunkIndex);
};

uploadChunkSchema.statics.deleteChunksForUpload = function(uploadId) {
  return this.deleteMany({ uploadId });
};

uploadChunkSchema.statics.createChunk = async function({
  uploadId,
  chunkIndex,
  chunkHashSha256,
  size,
  storagePath
}) {
  // Upsert to handle retries
  return this.findOneAndUpdate(
    { uploadId, chunkIndex },
    {
      uploadId,
      chunkIndex,
      chunkHashSha256,
      size,
      storagePath,
      uploadedAt: new Date()
    },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('UploadChunk', uploadChunkSchema);

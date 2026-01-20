/**
 * Chunk Upload Routes
 * 
 * Distributed upload with resume + dedup + integrity verification.
 * 
 * Flow:
 * 1. POST /uploads/init - Start session, check dedup
 * 2. POST /uploads/chunk - Upload individual chunk
 * 3. GET /uploads/status - Check progress
 * 4. POST /uploads/complete - Merge + verify + finalize
 * 
 * Security:
 * - uploadId is UUID (non-guessable)
 * - Session bound to authenticated user
 * - SHA-256 verification at chunk + file level
 */

const router = require('express').Router();
const crypto = require('crypto');
const multer = require('multer');
const UploadSession = require('../models/UploadSession');
const UploadChunk = require('../models/UploadChunk');
const File = require('../models/file');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const { getChunkStore } = require('../services/chunkStore');
const { addPostUploadJob } = require('../config/queue');
const cloudinary = require('cloudinary').v2;

// Multer for chunk upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024  // 10MB max per chunk
  }
});

// All routes require auth
router.use(ensureApiAuth);

/**
 * @route   POST /uploads/init
 * @desc    Initialize chunked upload session
 * @access  Private
 */
router.post('/init', async (req, res) => {
  try {
    const {
      fileName,
      fileSize,
      mimeType,
      totalChunks,
      fileHashSha256,
      chunkSize,
      workspaceId
    } = req.body;
    
    // Validation
    if (!fileName || !fileSize || !totalChunks || !fileHashSha256) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fileName, fileSize, totalChunks, fileHashSha256'
      });
    }
    
    // Validate hash format
    if (!/^[a-f0-9]{64}$/i.test(fileHashSha256)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid fileHashSha256 format (must be 64 hex characters)'
      });
    }
    
    // Check dedup - look for existing file with same hash
    const existingFile = await UploadSession.findDuplicate(fileHashSha256);
    
    if (existingFile && existingFile.status !== 'DELETED' && existingFile.status !== 'QUARANTINED') {
      await AuditLog.logFromRequest(req, 'upload.dedup_hit', {
        targetType: 'file',
        targetId: existingFile._id,
        metadata: { fileHashSha256 }
      });
      
      return res.json({
        success: true,
        isDuplicate: true,
        existingFileId: existingFile._id,
        existingFileUrl: existingFile.cloudinaryUrl,
        message: 'File already exists (dedup match)'
      });
    }
    
    // Check for existing session for same file (resume)
    let session = await UploadSession.findOne({
      userId: req.user._id,
      fileHashSha256,
      status: { $in: ['INITIATED', 'UPLOADING'] }
    });
    
    const defaultChunkSize = chunkSize || UploadSession.DEFAULT_CHUNK_SIZE;
    
    if (session) {
      // Resume existing session
      const uploadedIndexes = await UploadChunk.getUploadedIndexes(session.uploadId);
      session.uploadedChunks = uploadedIndexes;
      await session.save();
      
      return res.json({
        success: true,
        uploadId: session.uploadId,
        chunkSize: session.chunkSize,
        totalChunks: session.totalChunks,
        uploadedChunks: session.uploadedChunks,
        missingChunks: session.missingChunks,
        isDuplicate: false,
        isResume: true
      });
    }
    
    // Create new session
    session = await UploadSession.createSession({
      userId: req.user._id,
      workspaceId,
      fileName,
      mimeType,
      fileSize,
      totalChunks,
      fileHashSha256,
      chunkSize: defaultChunkSize
    });
    
    await AuditLog.logFromRequest(req, 'upload.session_created', {
      targetType: 'uploadSession',
      targetId: session._id,
      metadata: { uploadId: session.uploadId, fileSize, totalChunks }
    });
    
    res.status(201).json({
      success: true,
      uploadId: session.uploadId,
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
      uploadedChunks: [],
      missingChunks: Array.from({ length: totalChunks }, (_, i) => i),
      isDuplicate: false,
      isResume: false
    });
    
  } catch (error) {
    console.error('Upload init error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize upload'
    });
  }
});

/**
 * @route   POST /uploads/chunk
 * @desc    Upload a single chunk
 * @access  Private
 */
router.post('/chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex, chunkHashSha256 } = req.body;
    
    if (!uploadId || chunkIndex === undefined || !chunkHashSha256) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: uploadId, chunkIndex, chunkHashSha256'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No chunk data provided'
      });
    }
    
    // Find session
    const session = await UploadSession.findByUploadId(uploadId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found'
      });
    }
    
    // Security: Check ownership
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Check session status
    if (!['INITIATED', 'UPLOADING'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        error: `Upload session is ${session.status}`
      });
    }
    
    // Check chunk index
    const idx = parseInt(chunkIndex, 10);
    if (idx < 0 || idx >= session.totalChunks) {
      return res.status(400).json({
        success: false,
        error: `Invalid chunk index. Must be 0-${session.totalChunks - 1}`
      });
    }
    
    // Verify chunk hash
    const computedHash = crypto.createHash('sha256')
      .update(req.file.buffer)
      .digest('hex');
    
    if (computedHash.toLowerCase() !== chunkHashSha256.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Chunk hash mismatch. Data corrupted during transfer.',
        expected: chunkHashSha256,
        received: computedHash
      });
    }
    
    // Store chunk
    const chunkStore = getChunkStore();
    const { path: storagePath, size } = await chunkStore.store(
      uploadId,
      idx,
      req.file.buffer
    );
    
    // Record chunk in DB
    await UploadChunk.createChunk({
      uploadId,
      chunkIndex: idx,
      chunkHashSha256,
      size,
      storagePath
    });
    
    // Update session
    await session.markChunkUploaded(idx);
    
    res.json({
      success: true,
      chunkIndex: idx,
      size,
      uploadedChunks: session.uploadedChunks.length,
      totalChunks: session.totalChunks,
      progress: session.progress,
      isComplete: session.isComplete()
    });
    
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload chunk'
    });
  }
});

/**
 * @route   GET /uploads/status/:uploadId
 * @desc    Get upload session status
 * @access  Private
 */
router.get('/status/:uploadId', async (req, res) => {
  try {
    const session = await UploadSession.findByUploadId(req.params.uploadId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found'
      });
    }
    
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      ...session.toPublicObject()
    });
    
  } catch (error) {
    console.error('Upload status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

/**
 * @route   POST /uploads/complete
 * @desc    Complete upload - merge chunks, verify, upload to Cloudinary
 * @access  Private
 */
router.post('/complete', async (req, res) => {
  try {
    const { uploadId } = req.body;
    
    if (!uploadId) {
      return res.status(400).json({
        success: false,
        error: 'uploadId is required'
      });
    }
    
    const session = await UploadSession.findByUploadId(uploadId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found'
      });
    }
    
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    if (session.status === 'DONE') {
      return res.json({
        success: true,
        fileId: session.fileId,
        fileUrl: session.cloudinaryUrl,
        message: 'Upload already completed'
      });
    }
    
    if (!session.isComplete()) {
      return res.status(400).json({
        success: false,
        error: 'Upload not complete. Missing chunks.',
        missingChunks: session.missingChunks
      });
    }
    
    // Mark as merging
    await session.markMerging();
    
    const chunkStore = getChunkStore();
    
    try {
      // Merge chunks
      const chunkIndexes = Array.from(
        { length: session.totalChunks },
        (_, i) => i
      );
      
      const { path: mergedPath, size: mergedSize } = await chunkStore.merge(
        uploadId,
        chunkIndexes
      );
      
      // Verify merged file hash
      const computedHash = await chunkStore.computeHash(uploadId);
      
      if (computedHash.toLowerCase() !== session.fileHashSha256.toLowerCase()) {
        await session.markFailed('Checksum verification failed after merge');
        
        return res.status(400).json({
          success: false,
          error: 'Checksum verification failed',
          expected: session.fileHashSha256,
          computed: computedHash
        });
      }
      
      // Upload to Cloudinary
      const cloudinaryResult = await cloudinary.uploader.upload(mergedPath, {
        resource_type: 'raw',
        public_id: `fileforge/${uploadId}`,
        folder: 'uploads'
      });
      
      // Create File record
      const { v4: uuidv4 } = require('uuid');
      const file = new File({
        filename: session.fileName,
        originalName: session.fileName,
        cloudinaryId: cloudinaryResult.public_id,
        cloudinaryUrl: cloudinaryResult.secure_url,
        size: mergedSize,
        uuid: uuidv4(),
        userId: session.userId,
        workspaceId: session.workspaceId,
        mimeType: session.mimeType,
        checksum: session.fileHashSha256,
        status: 'PENDING'
      });
      
      await file.save();
      
      // Mark session done
      await session.markDone(file._id, {
        cloudinaryId: cloudinaryResult.public_id,
        cloudinaryUrl: cloudinaryResult.secure_url
      });
      
      // Cleanup chunks
      await chunkStore.deleteUploadChunks(uploadId);
      await UploadChunk.deleteChunksForUpload(uploadId);
      
      // Queue for scanning
      if (addPostUploadJob) {
        await addPostUploadJob(file._id);
      }
      
      await AuditLog.logFromRequest(req, 'upload.complete', {
        targetType: 'file',
        targetId: file._id,
        metadata: { uploadId, size: mergedSize, checksum: session.fileHashSha256 }
      });
      
      res.json({
        success: true,
        fileId: file._id,
        fileUrl: cloudinaryResult.secure_url,
        checksumVerified: true,
        size: mergedSize
      });
      
    } catch (mergeError) {
      console.error('Merge error:', mergeError);
      await session.markFailed(mergeError.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to complete upload',
        details: mergeError.message
      });
    }
    
  } catch (error) {
    console.error('Upload complete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete upload'
    });
  }
});

/**
 * @route   DELETE /uploads/:uploadId
 * @desc    Cancel upload and cleanup
 * @access  Private
 */
router.delete('/:uploadId', async (req, res) => {
  try {
    const session = await UploadSession.findByUploadId(req.params.uploadId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found'
      });
    }
    
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Cleanup
    const chunkStore = getChunkStore();
    await chunkStore.deleteUploadChunks(session.uploadId);
    await UploadChunk.deleteChunksForUpload(session.uploadId);
    
    // Mark cancelled
    session.status = 'FAILED';
    session.errorMessage = 'Cancelled by user';
    await session.save();
    
    res.json({
      success: true,
      message: 'Upload cancelled'
    });
    
  } catch (error) {
    console.error('Cancel upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel upload'
    });
  }
});

module.exports = router;

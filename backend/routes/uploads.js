/**
 * Presigned Upload Routes
 * 
 * API endpoints for direct-to-CDN uploads using presigned URLs.
 * 
 * Flow:
 * 1. POST /api/uploads/presign - Get signed upload URL
 * 2. Client uploads directly to Cloudinary
 * 3. POST /api/uploads/complete - Confirm and save metadata
 */

const router = require('express').Router();
const { v4: uuid4 } = require('uuid');
const File = require('../models/file');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const { checkUploadLimits, attachUserLimits } = require('../middleware/rbacMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { 
  validateUploadRequest, 
  generatePresignedUpload, 
  verifyUpload,
  deleteFromCdn 
} = require('../services/presignedService');

/**
 * @route   POST /api/uploads/presign
 * @desc    Generate a presigned URL for direct upload to Cloudinary
 * @access  Private (authenticated users only)
 * 
 * @body    {
 *            fileName: string (required) - Original file name
 *            fileType: string (required) - MIME type (e.g., "image/jpeg")
 *            fileSize: number (required) - File size in bytes
 *            checksum: string (optional) - MD5/SHA256 hash for integrity
 *            folder: string (optional) - Custom subfolder
 *          }
 * 
 * @returns {
 *            success: true,
 *            uploadUrl: string - Cloudinary upload endpoint
 *            uploadParams: object - Parameters to include in upload request
 *            fileKey: string - Unique identifier for this upload
 *            cdnUrl: string - Expected CDN URL after upload
 *            expiresAt: string - ISO timestamp when URL expires
 *          }
 */
router.post('/presign', 
  ensureApiAuth,
  uploadLimiter,
  attachUserLimits,
  async (req, res) => {
    try {
      const { fileName, fileType, fileSize, checksum, folder } = req.body;
      const userId = req.user._id.toString();
      
      // Validate request
      const validation = validateUploadRequest(
        { fileName, fileType, fileSize },
        req.user
      );
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
          code: 'VALIDATION_ERROR'
        });
      }
      
      // Generate presigned upload data
      const presignedData = generatePresignedUpload(
        { userId, fileName, fileType, fileSize, checksum, folder },
        req.user
      );
      
      // Log the presign request
      await AuditLog.logFromRequest(req, 'file.presign_request', {
        metadata: {
          fileName,
          fileType,
          fileSize,
          fileKey: presignedData.fileKey
        }
      });
      
      return res.json({
        success: true,
        uploadUrl: presignedData.uploadUrl,
        uploadParams: presignedData.uploadParams,
        fileKey: presignedData.fileKey,
        publicId: presignedData.publicId,
        cdnUrl: presignedData.cdnUrl,
        expiresAt: presignedData.expiresAt,
        expiresInSeconds: presignedData.expiresInSeconds,
        // Include user limits for frontend UI
        limits: req.userLimits
      });
      
    } catch (error) {
      console.error('Presign error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate upload URL',
        code: 'PRESIGN_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/uploads/complete
 * @desc    Complete an upload by saving file metadata to database
 * @access  Private (authenticated users only)
 * 
 * @body    {
 *            fileKey: string (required) - The fileKey from presign response
 *            publicId: string (required) - Cloudinary public_id after upload
 *            fileName: string (required) - Original file name
 *            fileSize: number (required) - Actual file size
 *            fileType: string (required) - MIME type
 *            cloudinaryUrl: string (required) - Secure URL from Cloudinary response
 *            // Optional security settings:
 *            expiresAfter: string - "1h"|"6h"|"24h"|"7d"|"30d"
 *            maxDownloads: number - Max downloads allowed
 *            isEncrypted: boolean - Client-side encrypted
 *            encryptionIV: string - IV if encrypted
 *            viewOnly: boolean - View only, no download
 *          }
 * 
 * @returns {
 *            success: true,
 *            file: { uuid, fileName, ... }
 *          }
 */
router.post('/complete',
  ensureApiAuth,
  async (req, res) => {
    try {
      const {
        fileKey,
        publicId,
        fileName,
        fileSize,
        fileType,
        cloudinaryUrl,
        // Security options
        expiresAfter = '30d',
        maxDownloads = null,
        isEncrypted = false,
        encryptionIV = null,
        viewOnly = false,
        deleteAfterFirstAccess = false
      } = req.body;
      
      const userId = req.user._id;
      
      // Validate required fields
      if (!publicId || !fileName || !fileSize || !cloudinaryUrl) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: publicId, fileName, fileSize, cloudinaryUrl',
          code: 'VALIDATION_ERROR'
        });
      }
      
      // Optional: Verify upload exists on Cloudinary
      // Uncomment for extra security (adds latency)
      /*
      const verification = await verifyUpload(publicId);
      if (!verification.success) {
        return res.status(400).json({
          success: false,
          error: 'Upload verification failed: ' + verification.error,
          code: 'VERIFICATION_FAILED'
        });
      }
      */
      
      // Calculate expiration
      const expirationMap = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      const expiresAt = new Date(Date.now() + (expirationMap[expiresAfter] || expirationMap['30d']));
      
      // Create file record
      const fileRecord = new File({
        filename: publicId.split('/').pop(),
        originalName: fileName,
        uuid: uuid4(),
        path: null,
        cloudinaryId: publicId,
        cloudinaryUrl: cloudinaryUrl,
        size: parseInt(fileSize, 10),
        userId: userId,
        isEncrypted: isEncrypted === true || isEncrypted === 'true',
        encryptionIV: encryptionIV,
        maxDownloads: maxDownloads ? parseInt(maxDownloads, 10) : null,
        deleteAfterFirstAccess: deleteAfterFirstAccess === true || deleteAfterFirstAccess === 'true',
        expiresAt: expiresAt,
        viewOnly: viewOnly === true || viewOnly === 'true'
      });
      
      const savedFile = await fileRecord.save();
      
      // Update user's storage used
      await req.user.updateOne({
        $inc: { storageUsed: savedFile.size }
      });
      
      // Audit log
      await AuditLog.logFromRequest(req, 'file.upload', {
        targetType: 'file',
        targetId: savedFile._id,
        metadata: {
          uuid: savedFile.uuid,
          fileName: savedFile.originalName,
          size: savedFile.size,
          uploadMethod: 'presigned'
        }
      });
      
      return res.status(201).json({
        success: true,
        file: {
          uuid: savedFile.uuid,
          fileName: savedFile.filename,
          originalName: savedFile.originalName,
          size: savedFile.size,
          isEncrypted: savedFile.isEncrypted,
          viewOnly: savedFile.viewOnly,
          expiresAt: savedFile.expiresAt,
          maxDownloads: savedFile.maxDownloads,
          cloudinaryUrl: savedFile.cloudinaryUrl,
          downloadLink: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/files/${savedFile.uuid}`
        }
      });
      
    } catch (error) {
      console.error('Upload complete error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save file metadata',
        code: 'COMPLETE_ERROR'
      });
    }
  }
);

/**
 * @route   DELETE /api/uploads/:publicId
 * @desc    Cancel/cleanup a failed upload
 * @access  Private (owner only)
 */
router.delete('/:publicId(*)',
  ensureApiAuth,
  async (req, res) => {
    try {
      const publicId = req.params.publicId;
      const userId = req.user._id.toString();
      
      // Security: Ensure publicId belongs to user's folder
      if (!publicId.includes(`users/${userId}`)) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own uploads',
          code: 'FORBIDDEN'
        });
      }
      
      // Delete from Cloudinary
      const result = await deleteFromCdn(publicId);
      
      // Also delete from DB if exists
      await File.deleteOne({ cloudinaryId: publicId, userId });
      
      return res.json({
        success: result.success,
        message: result.success ? 'Upload cleaned up' : 'Cleanup attempted'
      });
      
    } catch (error) {
      console.error('Upload cleanup error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to cleanup upload',
        code: 'CLEANUP_ERROR'
      });
    }
  }
);

module.exports = router;

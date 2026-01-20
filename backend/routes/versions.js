/**
 * File Version Routes
 * 
 * Endpoints for managing file versions:
 * - Upload new version (presign + complete)
 * - List version history
 * - Restore previous version as latest
 * 
 * Behavior:
 * - Share links to "latest" automatically serve new versions
 * - Share links to specific version stay frozen
 */

const router = require('express').Router({ mergeParams: true });
const File = require('../models/file');
const FileVersion = require('../models/FileVersion');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const { addPostUploadJob } = require('../config/queue');
const presignedService = require('../services/presignedService');
const { canModifyWorkspaceFile } = require('../middleware/workspaceMiddleware');

// All routes require auth
router.use(ensureApiAuth);

/**
 * @route   GET /api/files/:fileId/versions
 * @desc    Get version history for a file
 * @access  Private (file owner or workspace member)
 */
router.get('/', async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    
    if (!file || file.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Check access
    const canAccess = await canModifyWorkspaceFile(req.user._id, file);
    if (!canAccess && file.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const limit = parseInt(req.query.limit, 10) || 20;
    const versions = await FileVersion.getVersionHistory(file._id, limit);
    
    res.json({
      success: true,
      file: {
        id: file._id,
        title: file.title || file.originalName,
        currentVersionId: file.currentVersionId
      },
      versions: versions.map(v => ({
        id: v._id,
        versionNumber: v.versionNumber,
        size: v.size,
        mimeType: v.mimeType,
        status: v.status,
        changelog: v.changelog,
        uploadedBy: v.uploadedBy ? {
          id: v.uploadedBy._id,
          name: v.uploadedBy.name
        } : null,
        createdAt: v.createdAt,
        isCurrent: file.currentVersionId?.toString() === v._id.toString()
      }))
    });
    
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get versions'
    });
  }
});

/**
 * @route   POST /api/files/:fileId/versions/presign
 * @desc    Get presigned URL for uploading a new version
 * @access  Private (file owner or workspace admin)
 */
router.post('/presign', async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    
    if (!file || file.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Check modification permission
    const canModify = await canModifyWorkspaceFile(req.user._id, file);
    if (!canModify) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this file'
      });
    }
    
    const { fileName, fileType, fileSize, changelog } = req.body;
    
    if (!fileName || !fileSize) {
      return res.status(400).json({
        success: false,
        error: 'fileName and fileSize are required'
      });
    }
    
    // Get next version number
    const nextVersion = await FileVersion.getNextVersionNumber(file._id);
    
    // Generate presigned URL
    // Validate and generate presigned upload
    const validationResult = await presignedService.validateUploadRequest({
      fileName,
      mimeType: fileType,
      fileSize
    }, req.user);
    
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: validationResult.error
      });
    }
    
    const presignedData = await presignedService.generatePresignedUpload(
      req.user._id,
      fileName,
      fileType
    );
    
    // Store pending version info in session/cache for complete step
    // For simplicity, we'll pass it back and expect it in complete
    
    res.json({
      success: true,
      ...presignedData,
      version: {
        number: nextVersion,
        fileId: file._id
      },
      changelog: changelog || null
    });
    
  } catch (error) {
    console.error('Version presign error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate presigned URL'
    });
  }
});

/**
 * @route   POST /api/files/:fileId/versions/complete
 * @desc    Complete version upload and create new version record
 * @access  Private
 */
router.post('/complete', async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    
    if (!file || file.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    const canModify = await canModifyWorkspaceFile(req.user._id, file);
    if (!canModify) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const {
      cloudinaryId,
      cloudinaryUrl,
      fileKey,
      size,
      mimeType,
      checksum,
      changelog
    } = req.body;
    
    if (!cloudinaryUrl || !size) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Get next version number
    const versionNumber = await FileVersion.getNextVersionNumber(file._id);
    
    // Create new version
    const version = new FileVersion({
      fileId: file._id,
      versionNumber,
      cloudinaryId,
      cloudinaryUrl,
      fileKey,
      size,
      mimeType,
      checksum,
      uploadedBy: req.user._id,
      changelog,
      status: 'PENDING'
    });
    
    await version.save();
    
    // Update file's current version and size
    file.currentVersionId = version._id;
    file.size = size;
    file.mimeType = mimeType;
    file.cloudinaryId = cloudinaryId;
    file.cloudinaryUrl = cloudinaryUrl;
    await file.save();
    
    // Queue for processing
    await addPostUploadJob(version._id, { isVersion: true, fileId: file._id });
    
    // Audit log
    await AuditLog.logFromRequest(req, 'file.version_upload', {
      targetType: 'fileVersion',
      targetId: version._id,
      metadata: {
        fileId: file._id,
        versionNumber,
        size
      }
    });
    
    res.status(201).json({
      success: true,
      version: {
        id: version._id,
        versionNumber: version.versionNumber,
        status: version.status,
        createdAt: version.createdAt
      },
      file: {
        id: file._id,
        currentVersionId: file.currentVersionId
      }
    });
    
  } catch (error) {
    console.error('Version complete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete version upload'
    });
  }
});

/**
 * @route   POST /api/files/:fileId/versions/:versionId/restore
 * @desc    Restore a previous version as the current version
 * @access  Private (file owner or workspace admin)
 */
router.post('/:versionId/restore', async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    
    if (!file || file.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    const canModify = await canModifyWorkspaceFile(req.user._id, file);
    if (!canModify) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const version = await FileVersion.findOne({
      _id: req.params.versionId,
      fileId: file._id,
      deletedAt: null
    });
    
    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }
    
    if (version.status !== 'READY') {
      return res.status(400).json({
        success: false,
        error: 'Can only restore versions with READY status'
      });
    }
    
    // Get new version number for the restore
    const newVersionNumber = await FileVersion.getNextVersionNumber(file._id);
    
    // Create a new version entry (restore creates new version, doesn't modify history)
    const restoredVersion = new FileVersion({
      fileId: file._id,
      versionNumber: newVersionNumber,
      cloudinaryId: version.cloudinaryId,
      cloudinaryUrl: version.cloudinaryUrl,
      fileKey: version.fileKey,
      size: version.size,
      mimeType: version.mimeType,
      checksum: version.checksum,
      uploadedBy: req.user._id,
      changelog: `Restored from version ${version.versionNumber}`,
      status: 'READY',  // Already scanned
      scanResult: version.scanResult
    });
    
    await restoredVersion.save();
    
    // Update file
    file.currentVersionId = restoredVersion._id;
    file.size = restoredVersion.size;
    file.cloudinaryUrl = restoredVersion.cloudinaryUrl;
    await file.save();
    
    await AuditLog.logFromRequest(req, 'file.version_restore', {
      targetType: 'file',
      targetId: file._id,
      metadata: {
        restoredFrom: version._id,
        restoredVersionNumber: version.versionNumber,
        newVersionId: restoredVersion._id
      }
    });
    
    res.json({
      success: true,
      message: `Restored version ${version.versionNumber} as new version ${newVersionNumber}`,
      version: {
        id: restoredVersion._id,
        versionNumber: restoredVersion.versionNumber
      }
    });
    
  } catch (error) {
    console.error('Restore version error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore version'
    });
  }
});

/**
 * @route   DELETE /api/files/:fileId/versions/:versionId
 * @desc    Delete a specific version (soft delete)
 * @access  Private (file owner or workspace admin)
 */
router.delete('/:versionId', async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    
    if (!file || file.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    const canModify = await canModifyWorkspaceFile(req.user._id, file);
    if (!canModify) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const version = await FileVersion.findOne({
      _id: req.params.versionId,
      fileId: file._id,
      deletedAt: null
    });
    
    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }
    
    // Can't delete current version
    if (file.currentVersionId?.toString() === version._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the current version. Upload a new version first.'
      });
    }
    
    await version.softDelete();
    
    res.json({
      success: true,
      message: 'Version deleted'
    });
    
  } catch (error) {
    console.error('Delete version error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete version'
    });
  }
});

module.exports = router;

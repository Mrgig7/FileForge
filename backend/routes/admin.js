/**
 * Admin Routes
 * 
 * Admin-only endpoints for moderation and abuse prevention:
 * - Quarantined file management
 * - User search and disable
 * - Audit log access
 * 
 * All endpoints require ADMIN role
 */

const router = require('express').Router();
const User = require('../models/User');
const File = require('../models/file');
const ShareLink = require('../models/ShareLink');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbacMiddleware');

// All admin routes require authentication + ADMIN role
router.use(ensureApiAuth);
router.use(requireRole('ADMIN'));

/**
 * @route   GET /api/admin/files
 * @desc    List files with filters (status, user, etc.)
 * @access  Admin only
 * 
 * @query   status - PENDING|SCANNING|READY|QUARANTINED|DELETED
 * @query   userId - Filter by user
 * @query   page - Page number
 * @query   limit - Items per page
 */
router.get('/files', async (req, res) => {
  try {
    const { status, userId, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    const [files, total] = await Promise.all([
      File.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      File.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      files: files.map(f => ({
        id: f._id,
        uuid: f.uuid,
        originalName: f.originalName,
        size: f.size,
        status: f.status,
        scanResult: f.scanResult,
        user: f.userId ? {
          id: f.userId._id,
          name: f.userId.name,
          email: f.userId.email
        } : null,
        createdAt: f.createdAt,
        deletedAt: f.deletedAt
      })),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
    
  } catch (error) {
    console.error('Admin files error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch files' });
  }
});

/**
 * @route   DELETE /api/admin/files/:id
 * @desc    Hard delete a file (admin override)
 * @access  Admin only
 */
router.delete('/files/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    // Delete from Cloudinary
    if (file.cloudinaryId) {
      const { cloudinary } = require('../services/cloudinary');
      await cloudinary.uploader.destroy(file.cloudinaryId, {
        resource_type: 'raw'
      }).catch(err => console.error('Cloudinary delete error:', err));
    }
    
    // Hard delete
    await File.findByIdAndDelete(req.params.id);
    
    // Audit log
    await AuditLog.logFromRequest(req, 'admin.file_delete', {
      targetType: 'file',
      targetId: file._id,
      metadata: { fileName: file.originalName }
    });
    
    res.json({ success: true, message: 'File deleted' });
    
  } catch (error) {
    console.error('Admin delete file error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Search users
 * @access  Admin only
 * 
 * @query   search - Search by name or email
 * @query   disabled - Filter disabled users
 */
router.get('/users', async (req, res) => {
  try {
    const { search, disabled, page = 1, limit = 20 } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (disabled === 'true') {
      query.disabled = true;
    } else if (disabled === 'false') {
      query.disabled = { $ne: true };
    }
    
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      User.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      users: users.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        plan: u.plan,
        storageUsed: u.storageUsed,
        storageLimit: u.storageLimit,
        disabled: u.disabled,
        disabledReason: u.disabledReason,
        createdAt: u.createdAt
      })),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
    
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

/**
 * @route   POST /api/admin/users/:id/disable
 * @desc    Disable a user account
 * @access  Admin only
 */
router.post('/users/:id/disable', async (req, res) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Don't allow disabling admins
    if (user.role === 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Cannot disable admin users' });
    }
    
    // Disable
    user.disabled = true;
    user.disabledAt = new Date();
    user.disabledReason = reason || 'Disabled by admin';
    await user.save();
    
    // Revoke all refresh tokens
    const RefreshToken = require('../models/RefreshToken');
    await RefreshToken.revokeAllForUser(user._id, 'admin_revoke');
    
    // Audit log
    await AuditLog.logFromRequest(req, 'admin.user_disable', {
      targetType: 'user',
      targetId: user._id,
      metadata: { reason }
    });
    
    res.json({ success: true, message: 'User disabled' });
    
  } catch (error) {
    console.error('Admin disable user error:', error);
    res.status(500).json({ success: false, error: 'Failed to disable user' });
  }
});

/**
 * @route   POST /api/admin/users/:id/enable
 * @desc    Re-enable a disabled user account
 * @access  Admin only
 */
router.post('/users/:id/enable', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    user.disabled = false;
    user.disabledAt = null;
    user.disabledReason = null;
    await user.save();
    
    // Audit log
    await AuditLog.logFromRequest(req, 'admin.user_enable', {
      targetType: 'user',
      targetId: user._id
    });
    
    res.json({ success: true, message: 'User enabled' });
    
  } catch (error) {
    console.error('Admin enable user error:', error);
    res.status(500).json({ success: false, error: 'Failed to enable user' });
  }
});

/**
 * @route   GET /api/admin/audit
 * @desc    View audit logs
 * @access  Admin only
 * 
 * @query   action - Filter by action type
 * @query   userId - Filter by user
 * @query   since - Filter by date (ISO string)
 */
router.get('/audit', async (req, res) => {
  try {
    const { action, userId, since, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (since) query.timestamp = { $gte: new Date(since) };
    
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('userId', 'name email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      AuditLog.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      logs: logs.map(l => ({
        id: l._id,
        action: l.action,
        user: l.userId ? {
          id: l.userId._id,
          name: l.userId.name,
          email: l.userId.email
        } : null,
        targetType: l.targetType,
        targetId: l.targetId,
        ip: l.ip,
        userAgent: l.userAgent,
        success: l.success,
        errorMessage: l.errorMessage,
        metadata: l.metadata,
        timestamp: l.timestamp
      })),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
    
  } catch (error) {
    console.error('Admin audit error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

/**
 * @route   GET /api/admin/stats
 * @desc    Dashboard statistics
 * @access  Admin only
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      totalFiles,
      quarantinedFiles,
      totalShareLinks
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ disabled: { $ne: true } }),
      User.countDocuments({ disabled: true }),
      File.countDocuments({ deletedAt: null }),
      File.countDocuments({ status: 'QUARANTINED' }),
      ShareLink.countDocuments({ revokedAt: null })
    ]);
    
    // Storage used
    const storageResult = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$storageUsed' } } }
    ]);
    const totalStorageUsed = storageResult[0]?.total || 0;
    
    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          disabled: disabledUsers
        },
        files: {
          total: totalFiles,
          quarantined: quarantinedFiles
        },
        shares: {
          active: totalShareLinks
        },
        storage: {
          usedBytes: totalStorageUsed,
          usedMB: Math.round(totalStorageUsed / 1024 / 1024)
        }
      }
    });
    
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

module.exports = router;

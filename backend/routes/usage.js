/**
 * Usage Routes
 * 
 * GET /me/usage - Current user's usage statistics and limits
 */

const router = require('express').Router();
const File = require('../models/file');
const ShareLink = require('../models/ShareLink');
const { ensureApiAuth } = require('../middleware/auth');
const { getRole, getLimit } = require('../config/rbac');

/**
 * @route   GET /api/usage
 * @desc    Get current user's usage and limits
 * @access  Private
 * 
 * @returns {
 *   plan: string,
 *   storage: { used, limit, percentage },
 *   files: { count, limit },
 *   shares: { today, dailyLimit },
 *   uploads: { today, dailyLimit }
 * }
 */
router.get('/', ensureApiAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role || 'USER';
    const userPlan = req.user.plan || 'FREE';
    
    // Get role limits
    const role = getRole(userRole);
    
    // Count files
    const fileCount = await File.countDocuments({
      userId,
      deletedAt: null,
      status: { $ne: 'DELETED' }
    });
    
    // Storage used (from user model, updated on upload/delete)
    const storageUsed = req.user.storageUsed || 0;
    const storageLimit = req.user.storageLimit || role.limits.maxTotalStorage;
    
    // Today's shares
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sharesToday = await ShareLink.countDocuments({
      ownerId: userId,
      createdAt: { $gte: today }
    });
    
    // Today's uploads
    const uploadResetAt = req.user.dailyUploadResetAt;
    let uploadsToday = req.user.dailyUploadCount || 0;
    
    if (!uploadResetAt || new Date(uploadResetAt) < today) {
      uploadsToday = 0;  // Not reset yet, count is stale
    }
    
    // Plan-based limits
    const limits = {
      maxFileSize: getLimit(userRole, 'maxFileSize'),
      maxFiles: getLimit(userRole, 'maxFiles'),
      maxTotalStorage: getLimit(userRole, 'maxTotalStorage'),
      maxShareLinks: getLimit(userRole, 'maxShareLinks'),
      maxUploadsPerDay: getLimit(userRole, 'maxUploadsPerDay'),
      fileRetentionDays: getLimit(userRole, 'fileRetentionDays')
    };
    
    res.json({
      success: true,
      plan: userPlan,
      role: userRole,
      storage: {
        used: storageUsed,
        usedMB: Math.round(storageUsed / 1024 / 1024 * 100) / 100,
        limit: storageLimit,
        limitMB: Math.round(storageLimit / 1024 / 1024),
        percentage: Math.round((storageUsed / storageLimit) * 100 * 100) / 100
      },
      files: {
        count: fileCount,
        limit: limits.maxFiles,
        percentage: Math.round((fileCount / limits.maxFiles) * 100 * 100) / 100
      },
      shares: {
        today: sharesToday,
        dailyLimit: limits.maxShareLinks
      },
      uploads: {
        today: uploadsToday,
        dailyLimit: limits.maxUploadsPerDay
      },
      limits,
      // Features available for plan
      features: role.features
    });
    
  } catch (error) {
    console.error('Usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage'
    });
  }
});

module.exports = router;

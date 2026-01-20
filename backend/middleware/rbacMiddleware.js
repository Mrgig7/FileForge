/**
 * RBAC Middleware
 * 
 * Express middleware for role-based access control.
 * Enforces permissions and resource limits based on user role.
 */

const { hasPermission, hasFeature, getLimit, isRoleAtLeast } = require('../config/rbac');

/**
 * Middleware: Require authentication
 * Must be used before any RBAC middleware
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
}

/**
 * Middleware: Require specific role (or higher)
 * 
 * Usage: router.get('/admin', requireRole('ADMIN'), handler)
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const userRole = req.user.role || 'USER';
    
    if (!isRoleAtLeast(userRole, role)) {
      return res.status(403).json({
        error: `This action requires ${role} role or higher`,
        code: 'INSUFFICIENT_ROLE',
        required: role,
        current: userRole
      });
    }
    
    next();
  };
}

/**
 * Middleware: Require specific permission
 * 
 * Usage: router.post('/files', requirePermission('files:write'), handler)
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const userRole = req.user.role || 'USER';
    
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({
        error: `You don't have permission: ${permission}`,
        code: 'INSUFFICIENT_PERMISSION',
        required: permission,
        role: userRole
      });
    }
    
    next();
  };
}

/**
 * Middleware: Require specific feature
 * 
 * Usage: router.post('/share/password', requireFeature('passwordProtectedLinks'), handler)
 */
function requireFeature(feature) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const userRole = req.user.role || 'USER';
    
    if (!hasFeature(userRole, feature)) {
      return res.status(403).json({
        error: `Feature '${feature}' requires an upgraded plan`,
        code: 'FEATURE_UNAVAILABLE',
        feature,
        role: userRole,
        upgradeRequired: true
      });
    }
    
    next();
  };
}

/**
 * Middleware: Check upload limits
 * Validates file size against user's role limits
 * 
 * Expected: req.body.fileSize or req.files.myfile.size
 */
function checkUploadLimits(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  const userRole = req.user.role || 'USER';
  
  // Get file size from request
  let fileSize = 0;
  if (req.body && req.body.fileSize) {
    fileSize = parseInt(req.body.fileSize, 10);
  } else if (req.files && req.files.myfile) {
    fileSize = req.files.myfile.size;
  }
  
  if (fileSize <= 0) {
    return res.status(400).json({
      error: 'File size is required',
      code: 'INVALID_FILE_SIZE'
    });
  }
  
  const maxFileSize = getLimit(userRole, 'maxFileSize');
  
  if (fileSize > maxFileSize) {
    const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
    const fileSizeMB = Math.round(fileSize / (1024 * 1024));
    
    return res.status(413).json({
      error: `File size (${fileSizeMB}MB) exceeds your limit (${maxSizeMB}MB)`,
      code: 'FILE_TOO_LARGE',
      maxSize: maxFileSize,
      actualSize: fileSize,
      role: userRole,
      upgradeRequired: userRole === 'USER'
    });
  }
  
  // Attach limit info to request for downstream use
  req.userLimits = {
    maxFileSize,
    maxFiles: getLimit(userRole, 'maxFiles'),
    maxTotalStorage: getLimit(userRole, 'maxTotalStorage'),
    maxShareLinks: getLimit(userRole, 'maxShareLinks'),
    presignedUrlExpiry: getLimit(userRole, 'presignedUrlExpiry')
  };
  
  next();
}

/**
 * Middleware: Attach user limits to request (without validation)
 * Useful for informational purposes
 */
function attachUserLimits(req, res, next) {
  const userRole = req.user?.role || 'USER';
  
  req.userLimits = {
    role: userRole,
    maxFileSize: getLimit(userRole, 'maxFileSize'),
    maxFiles: getLimit(userRole, 'maxFiles'),
    maxTotalStorage: getLimit(userRole, 'maxTotalStorage'),
    maxShareLinks: getLimit(userRole, 'maxShareLinks'),
    presignedUrlExpiry: getLimit(userRole, 'presignedUrlExpiry'),
    fileRetentionDays: getLimit(userRole, 'fileRetentionDays')
  };
  
  next();
}

/**
 * Middleware: Optional authentication
 * Attaches user if token is valid, continues if not
 * Does not require authentication
 */
function optionalAuth(req, res, next) {
  // If user already attached (by other middleware), continue
  if (req.user) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token, continue without user
    return next();
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const { verifyAccessToken } = require('../services/tokenService');
    const decoded = verifyAccessToken(token);
    
    // Attach minimal user info
    req.user = {
      _id: decoded.sub,
      email: decoded.email,
      role: decoded.role || 'USER'
    };
  } catch (error) {
    // Invalid token, continue without user (don't fail)
    console.log('Optional auth: token invalid or expired');
  }
  
  next();
}

module.exports = {
  requireAuth,
  requireRole,
  requirePermission,
  requireFeature,
  checkUploadLimits,
  attachUserLimits,
  optionalAuth
};

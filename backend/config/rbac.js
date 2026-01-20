/**
 * RBAC (Role-Based Access Control) Configuration
 * 
 * Defines roles, permissions, and resource limits for the application.
 * 
 * Design Principles:
 * - Principle of Least Privilege: Users get minimal permissions needed
 * - Defense in Depth: Multiple layers of access control
 * - Explicit over Implicit: All permissions must be explicitly granted
 */

// Role hierarchy (higher index = more privileges)
const ROLE_HIERARCHY = ['USER', 'PRO', 'ADMIN'];

// Role definitions with permissions and limits
const ROLES = {
  USER: {
    name: 'USER',
    level: 0,
    description: 'Free tier user with basic features',
    
    // Resource limits
    limits: {
      maxFileSize: 10 * 1024 * 1024,           // 10MB per file
      maxTotalStorage: 100 * 1024 * 1024,       // 100MB total
      maxFiles: 20,                              // Max 20 files
      maxUploadsPerDay: 10,                      // 10 uploads per day
      maxShareLinks: 10,                         // 10 active share links
      presignedUrlExpiry: 60,                    // 60 seconds (short for security)
      fileRetentionDays: 7                       // Files expire after 7 days
    },
    
    // Feature permissions
    permissions: [
      'files:read',
      'files:write',
      'files:delete',
      'share:create',
      'share:revoke',
      'profile:read',
      'profile:update'
    ],
    
    // Feature restrictions
    features: {
      passwordProtectedLinks: false,
      customExpiry: false,
      downloadLimits: false,
      analytics: false,
      prioritySupport: false
    }
  },
  
  PRO: {
    name: 'PRO',
    level: 1,
    description: 'Premium user with advanced features',
    
    limits: {
      maxFileSize: 100 * 1024 * 1024,          // 100MB per file
      maxTotalStorage: 10 * 1024 * 1024 * 1024, // 10GB total
      maxFiles: 1000,                            // 1000 files
      maxUploadsPerDay: 100,                     // 100 uploads per day
      maxShareLinks: 100,                        // 100 active share links
      presignedUrlExpiry: 300,                   // 5 minutes
      fileRetentionDays: 365                     // 1 year retention
    },
    
    permissions: [
      'files:read',
      'files:write',
      'files:delete',
      'share:create',
      'share:revoke',
      'share:password',
      'share:expiry',
      'share:download_limits',
      'profile:read',
      'profile:update',
      'analytics:read'
    ],
    
    features: {
      passwordProtectedLinks: true,
      customExpiry: true,
      downloadLimits: true,
      analytics: true,
      prioritySupport: true
    }
  },
  
  ADMIN: {
    name: 'ADMIN',
    level: 2,
    description: 'Administrator with full system access',
    
    limits: {
      maxFileSize: Infinity,
      maxTotalStorage: Infinity,
      maxFiles: Infinity,
      maxUploadsPerDay: Infinity,
      maxShareLinks: Infinity,
      presignedUrlExpiry: 600,
      fileRetentionDays: Infinity
    },
    
    permissions: [
      '*' // Wildcard - all permissions
    ],
    
    features: {
      passwordProtectedLinks: true,
      customExpiry: true,
      downloadLimits: true,
      analytics: true,
      prioritySupport: true,
      adminPanel: true,
      userManagement: true,
      auditLogs: true
    }
  }
};

// Permission categories for documentation
const PERMISSION_CATEGORIES = {
  files: ['files:read', 'files:write', 'files:delete'],
  share: ['share:create', 'share:revoke', 'share:password', 'share:expiry', 'share:download_limits'],
  profile: ['profile:read', 'profile:update'],
  analytics: ['analytics:read'],
  admin: ['admin:users:list', 'admin:users:update', 'admin:users:disable', 'admin:audit:read']
};

// MIME type whitelist for uploads
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // Text
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'text/xml',
  
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/gzip',
  'application/x-7z-compressed',
  'application/x-tar',
  
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  
  // Code
  'application/javascript',
  'application/typescript'
];

// File extension to MIME type mapping
const EXTENSION_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.gz': 'application/gzip',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska'
};

/**
 * Get role configuration by role name
 */
function getRole(roleName) {
  return ROLES[roleName] || ROLES.USER;
}

/**
 * Check if a role has a specific permission
 */
function hasPermission(roleName, permission) {
  const role = getRole(roleName);
  
  // Admin wildcard
  if (role.permissions.includes('*')) {
    return true;
  }
  
  return role.permissions.includes(permission);
}

/**
 * Check if a role has a specific feature enabled
 */
function hasFeature(roleName, feature) {
  const role = getRole(roleName);
  return role.features[feature] === true;
}

/**
 * Get limit value for a role
 */
function getLimit(roleName, limitName) {
  const role = getRole(roleName);
  return role.limits[limitName];
}

/**
 * Check if role1 is higher or equal to role2 in hierarchy
 */
function isRoleAtLeast(role1, role2) {
  const level1 = ROLES[role1]?.level ?? -1;
  const level2 = ROLES[role2]?.level ?? -1;
  return level1 >= level2;
}

/**
 * Validate MIME type against whitelist
 */
function isAllowedMimeType(mimeType) {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Get MIME type from file extension
 */
function getMimeFromExtension(extension) {
  const ext = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  return EXTENSION_TO_MIME[ext] || 'application/octet-stream';
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSION_CATEGORIES,
  ALLOWED_MIME_TYPES,
  EXTENSION_TO_MIME,
  getRole,
  hasPermission,
  hasFeature,
  getLimit,
  isRoleAtLeast,
  isAllowedMimeType,
  getMimeFromExtension
};

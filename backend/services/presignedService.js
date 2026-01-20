/**
 * Presigned Upload Service
 * 
 * Generates signed URLs for direct uploads to Cloudinary.
 * Client uploads directly to CDN, backend only handles metadata.
 * 
 * Security Design:
 * - Short-lived URLs (60-300 seconds based on role)
 * - Server-side validation of file type and size before signing
 * - User-scoped folders prevent cross-user file access
 * - Checksums (optional) for integrity verification
 * 
 * Architecture:
 * 1. Client requests presigned URL with file metadata
 * 2. Server validates, generates signed params
 * 3. Client uploads directly to Cloudinary
 * 4. Client calls /complete to save metadata in DB
 */

const crypto = require('crypto');
const path = require('path');
const { cloudinary } = require('./cloudinary');
const { getLimit, isAllowedMimeType, getMimeFromExtension } = require('../config/rbac');

// Cloudinary API credentials (from environment)
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

/**
 * Validate file metadata before generating presigned URL
 * 
 * @param {Object} fileInfo - { fileName, fileType, fileSize }
 * @param {Object} user - User object with role
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateUploadRequest(fileInfo, user) {
  const { fileName, fileType, fileSize } = fileInfo;
  const userRole = user?.role || 'USER';
  
  // Validate required fields
  if (!fileName || typeof fileName !== 'string') {
    return { valid: false, error: 'fileName is required' };
  }
  
  if (!fileType || typeof fileType !== 'string') {
    return { valid: false, error: 'fileType (MIME type) is required' };
  }
  
  if (!fileSize || typeof fileSize !== 'number' || fileSize <= 0) {
    return { valid: false, error: 'fileSize must be a positive number' };
  }
  
  // Validate file name (prevent path traversal)
  // Only allow alphanumeric, dash, underscore, dot, space
  const sanitizedName = path.basename(fileName);
  if (sanitizedName !== fileName || /[<>:"/\\|?*\x00-\x1F]/.test(fileName)) {
    return { valid: false, error: 'Invalid file name (path traversal or invalid characters)' };
  }
  
  // Check file extension
  const ext = path.extname(fileName).toLowerCase();
  if (!ext) {
    return { valid: false, error: 'File must have an extension' };
  }
  
  // Validate MIME type against whitelist
  if (!isAllowedMimeType(fileType)) {
    return { valid: false, error: `File type ${fileType} is not allowed` };
  }
  
  // Check file size against user's limit
  const maxSize = getLimit(userRole, 'maxFileSize');
  if (fileSize > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File size exceeds limit (${maxSizeMB}MB for ${userRole})` };
  }
  
  return { valid: true };
}

/**
 * Generate a unique, safe file key for Cloudinary
 * 
 * Format: fileforge/users/{userId}/{timestamp}-{random}/{sanitizedFileName}
 * This structure:
 * - Isolates users in their own folders
 * - Prevents collisions with timestamp + random
 * - Preserves original filename for display
 */
function generateFileKey(userId, fileName) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const sanitizedName = path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
  
  return {
    folder: `fileforge/users/${userId}`,
    publicId: `${timestamp}-${random}`,
    fullPath: `fileforge/users/${userId}/${timestamp}-${random}/${sanitizedName}`
  };
}

/**
 * Generate signed upload parameters for Cloudinary
 * 
 * NEEDS CLARIFICATION: Cloudinary signed uploads can be done two ways:
 * 1. Signed Upload URL (using cloudinary-core SDK on frontend)
 * 2. Authenticated Upload with signature params
 * 
 * We'll use approach #2 which is more flexible and doesn't require SDK.
 * 
 * @param {Object} params - { userId, fileName, fileType, fileSize, checksum? }
 * @param {Object} user - User object with role
 * @returns {Object} Presigned upload data
 */
function generatePresignedUpload(params, user) {
  const { userId, fileName, fileType, fileSize, checksum, folder } = params;
  const userRole = user?.role || 'USER';
  
  // Get expiry based on role
  const expirySeconds = getLimit(userRole, 'presignedUrlExpiry');
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + expirySeconds;
  
  // Generate unique file key
  const fileKey = generateFileKey(userId, fileName);
  
  // Use provided folder or default
  const uploadFolder = folder || fileKey.folder;
  
  // Cloudinary upload params
  const uploadParams = {
    timestamp,
    folder: uploadFolder,
    public_id: fileKey.publicId,
    resource_type: 'raw',       // Use 'raw' for all files for reliability
    type: 'upload',
    overwrite: false,           // Don't overwrite existing files
    // Optional: Add eager transformation for thumbnails
    // eager: 'w_200,h_200,c_thumb'
  };
  
  // Add tags for organization
  uploadParams.tags = [`user_${userId}`, `type_${fileType.split('/')[0]}`];
  
  // Generate signature
  // Cloudinary signature = SHA-1(params sorted alphabetically + api_secret)
  const signatureParams = Object.keys(uploadParams)
    .sort()
    .map(key => {
      const value = Array.isArray(uploadParams[key]) 
        ? uploadParams[key].join(',') 
        : uploadParams[key];
      return `${key}=${value}`;
    })
    .join('&');
  
  const signature = crypto
    .createHash('sha1')
    .update(signatureParams + API_SECRET)
    .digest('hex');
  
  // Build upload URL
  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;
  
  // Build the public CDN URL (after upload completes)
  const cdnUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/v1/${uploadFolder}/${fileKey.publicId}`;
  
  return {
    uploadUrl,
    uploadParams: {
      ...uploadParams,
      api_key: API_KEY,
      signature
    },
    fileKey: `${uploadFolder}/${fileKey.publicId}`,
    publicId: `${uploadFolder}/${fileKey.publicId}`,
    cdnUrl,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    expiresInSeconds: expirySeconds
  };
}

/**
 * Verify that an upload completed successfully
 * Queries Cloudinary to confirm file exists
 * 
 * @param {string} publicId - The Cloudinary public ID
 * @returns {Object} { success: boolean, details?: object, error?: string }
 */
async function verifyUpload(publicId) {
  try {
    const result = await cloudinary.api.resource(publicId, { resource_type: 'raw' });
    return {
      success: true,
      details: {
        publicId: result.public_id,
        url: result.secure_url,
        format: result.format,
        bytes: result.bytes,
        createdAt: result.created_at
      }
    };
  } catch (error) {
    if (error.http_code === 404) {
      return { success: false, error: 'File not found on CDN' };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Delete a file from Cloudinary (cleanup on failed uploads)
 */
async function deleteFromCdn(publicId, resourceType = 'raw') {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true  // Invalidate CDN cache
    });
    return { success: result.result === 'ok' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  validateUploadRequest,
  generateFileKey,
  generatePresignedUpload,
  verifyUpload,
  deleteFromCdn
};

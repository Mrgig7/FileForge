/**
 * Storage Provider Service
 * 
 * Abstract interface for multi-region storage.
 * Current implementation: Cloudinary (single region)
 * Future: AWS S3, GCS, R2, etc with region-aware routing.
 * 
 * Design:
 * - StorageProvider base class with standard methods
 * - CloudinaryProvider as default implementation
 * - Region metadata stored in file records
 * - Presigned URLs generated for correct region
 */

const path = require('path');

/**
 * Abstract Storage Provider Interface
 */
class StorageProvider {
  /**
   * Upload file to storage
   * @param {string} key - Storage key/path
   * @param {Buffer|Stream} data - File data
   * @param {Object} options - { mimeType, metadata }
   * @returns {Promise<{ key, url, size, region }>}
   */
  async put(key, data, options = {}) {
    throw new Error('Not implemented');
  }
  
  /**
   * Get file from storage
   * @param {string} key
   * @returns {Promise<{ data, mimeType, size }>}
   */
  async get(key) {
    throw new Error('Not implemented');
  }
  
  /**
   * Delete file from storage
   * @param {string} key
   */
  async delete(key) {
    throw new Error('Not implemented');
  }
  
  /**
   * Get presigned URL for upload
   * @param {string} key
   * @param {Object} options - { expires, mimeType }
   * @returns {Promise<{ uploadUrl, fields }>}
   */
  async getPresignedUploadUrl(key, options = {}) {
    throw new Error('Not implemented');
  }
  
  /**
   * Get presigned URL for download
   * @param {string} key
   * @param {Object} options - { expires, filename }
   * @returns {Promise<string>}
   */
  async getPresignedDownloadUrl(key, options = {}) {
    throw new Error('Not implemented');
  }
  
  /**
   * Check if file exists
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    throw new Error('Not implemented');
  }
  
  /**
   * Get file metadata
   * @param {string} key
   * @returns {Promise<Object>}
   */
  async getMetadata(key) {
    throw new Error('Not implemented');
  }
  
  get region() {
    return 'default';
  }
  
  get providerName() {
    return 'unknown';
  }
}

/**
 * Cloudinary Storage Provider
 * 
 * Current default - uses Cloudinary for all storage.
 * Single region, globally distributed CDN.
 */
class CloudinaryProvider extends StorageProvider {
  constructor() {
    super();
    this.cloudinary = null;
    
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
      this.cloudinary = cloudinary;
    }
  }
  
  get providerName() {
    return 'cloudinary';
  }
  
  get region() {
    return 'cloudinary-global';
  }
  
  get isConfigured() {
    return !!this.cloudinary;
  }
  
  async put(key, data, options = {}) {
    if (!this.cloudinary) {
      throw new Error('Cloudinary not configured');
    }
    
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        public_id: key,
        resource_type: 'raw',
        folder: 'fileforge',
        ...options.cloudinaryOptions
      };
      
      if (Buffer.isBuffer(data)) {
        this.cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve({
              key: result.public_id,
              url: result.secure_url,
              size: result.bytes,
              region: this.region
            });
          }
        ).end(data);
      } else {
        // Assume data is a path
        this.cloudinary.uploader.upload(data, uploadOptions, (error, result) => {
          if (error) reject(error);
          else resolve({
            key: result.public_id,
            url: result.secure_url,
            size: result.bytes,
            region: this.region
          });
        });
      }
    });
  }
  
  async delete(key) {
    if (!this.cloudinary) {
      throw new Error('Cloudinary not configured');
    }
    
    return this.cloudinary.uploader.destroy(key, { resource_type: 'raw' });
  }
  
  async getPresignedUploadUrl(key, options = {}) {
    if (!this.cloudinary) {
      throw new Error('Cloudinary not configured');
    }
    
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = options.folder || 'fileforge/uploads';
    
    // Generate signature
    const params = {
      timestamp,
      folder,
      public_id: key
    };
    
    const signature = this.cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET
    );
    
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
      fields: {
        ...params,
        signature,
        api_key: process.env.CLOUDINARY_API_KEY
      },
      expiresAt: new Date((timestamp + 3600) * 1000)
    };
  }
  
  async getPresignedDownloadUrl(key, options = {}) {
    if (!this.cloudinary) {
      throw new Error('Cloudinary not configured');
    }
    
    // Cloudinary URLs are public by default
    // For authenticated URLs, use signed URLs feature
    const url = this.cloudinary.url(key, {
      resource_type: 'raw',
      secure: true,
      sign_url: true,
      type: 'authenticated'
    });
    
    return url;
  }
  
  async exists(key) {
    if (!this.cloudinary) return false;
    
    try {
      await this.cloudinary.api.resource(key, { resource_type: 'raw' });
      return true;
    } catch {
      return false;
    }
  }
  
  async getMetadata(key) {
    if (!this.cloudinary) {
      throw new Error('Cloudinary not configured');
    }
    
    const result = await this.cloudinary.api.resource(key, { resource_type: 'raw' });
    
    return {
      key: result.public_id,
      size: result.bytes,
      mimeType: result.format,
      createdAt: new Date(result.created_at),
      url: result.secure_url
    };
  }
}

/**
 * S3 Storage Provider (Stub)
 * 
 * NEEDS CLARIFICATION: AWS credentials and bucket configuration
 */
class S3Provider extends StorageProvider {
  constructor(options = {}) {
    super();
    this._region = options.region || process.env.AWS_REGION || 'us-east-1';
    this.bucket = options.bucket || process.env.S3_BUCKET;
    this.s3 = null;
    
    // Lazy init S3 client
    // Requires: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
  }
  
  get providerName() {
    return 's3';
  }
  
  get region() {
    return this._region;
  }
  
  get isConfigured() {
    return !!this.bucket && !!process.env.AWS_ACCESS_KEY_ID;
  }
  
  // Stub implementations
  async put(key, data, options = {}) {
    console.warn('[S3Provider] Not fully implemented');
    throw new Error('S3 provider not fully implemented. NEEDS CLARIFICATION.');
  }
  
  async delete(key) {
    console.warn('[S3Provider] Not fully implemented');
    throw new Error('S3 provider not fully implemented');
  }
  
  async getPresignedUploadUrl(key, options = {}) {
    console.warn('[S3Provider] Not fully implemented');
    throw new Error('S3 provider not fully implemented');
  }
}

/**
 * Get storage provider by region/name
 */
function getStorageProvider(region = 'default') {
  // Currently only Cloudinary is fully implemented
  const cloudinary = new CloudinaryProvider();
  
  if (cloudinary.isConfigured) {
    return cloudinary;
  }
  
  // Future: Route by region
  // if (region.startsWith('aws-')) return new S3Provider({ region });
  
  throw new Error('No storage provider configured. Set CLOUDINARY_* environment variables.');
}

/**
 * Get all configured providers
 */
function getAvailableProviders() {
  const providers = [];
  
  const cloudinary = new CloudinaryProvider();
  if (cloudinary.isConfigured) {
    providers.push({ name: 'cloudinary', region: 'global' });
  }
  
  return providers;
}

module.exports = {
  StorageProvider,
  CloudinaryProvider,
  S3Provider,
  getStorageProvider,
  getAvailableProviders
};

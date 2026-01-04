const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Uploads an image to Cloudinary
 * @param {string} imageData - Base64 encoded image data
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadImage = async (imageData, options = {}) => {
  try {
    // Set default options
    const uploadOptions = {
      folder: options.folder || 'fileforge/profile-pics',
      public_id: options.public_id || undefined,
      overwrite: options.overwrite !== undefined ? options.overwrite : true,
      resource_type: 'image',
      ...options
    };

    // Upload the image
    // Note: we don't need to prepend `data:image/jpeg;base64,` since it's already in the imageData
    const result = await cloudinary.uploader.upload(
      imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`,
      uploadOptions
    );

    console.log('Cloudinary upload successful:', result.secure_url);

    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      resource_type: result.resource_type
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
  }
};

/**
 * Deletes an image from Cloudinary
 * @param {string} publicId - Cloudinary public ID of the image
 * @returns {Promise<Object>} Deletion result
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      result: result.result
    };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
  }
};

/**
 * Uploads any file to Cloudinary
 * Supports all file types including PDFs, documents, images, videos, etc.
 * @param {Buffer|string} fileData - File buffer, base64 data URL, or file path
 * @param {Object} options - Upload options including mimetype for proper base64 conversion
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadFile = async (fileData, options = {}) => {
  try {
    // Remove format from options as it can cause issues
    const { format, mimetype, ...cleanOptions } = options;
    
    const uploadOptions = {
      folder: cleanOptions.folder || 'fileforge/files',
      public_id: cleanOptions.public_id || undefined,
      overwrite: cleanOptions.overwrite !== undefined ? cleanOptions.overwrite : true,
      resource_type: cleanOptions.resource_type || 'raw',
      ...cleanOptions
    };

    console.log('Uploading file to Cloudinary with options:', {
      folder: uploadOptions.folder,
      resource_type: uploadOptions.resource_type,
      dataType: typeof fileData === 'string' ? 'string/path' : 'buffer',
      mimetype: mimetype
    });

    let result;

    // For raw type, use upload_stream directly (most reliable)
    if (Buffer.isBuffer(fileData) && uploadOptions.resource_type === 'raw') {
      console.log('Using upload_stream for raw file');
      result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        uploadStream.end(fileData);
      });
    } else if (Buffer.isBuffer(fileData)) {
      // For image/video types, try base64 data URL
      let mimeType = mimetype || 'application/octet-stream';
      if (uploadOptions.resource_type === 'image' && mimeType === 'application/octet-stream') {
        mimeType = 'image/jpeg';
      }
      const base64Data = fileData.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      console.log('Using base64 data URL, mime:', mimeType);
      result = await cloudinary.uploader.upload(dataUrl, uploadOptions);
    } else if (typeof fileData === 'string') {
      // File path or data URL
      let uploadData = fileData;
      if (!uploadData.startsWith('data:') && !uploadData.startsWith('http')) {
        uploadData = uploadData.replace(/\\/g, '/');
      }
      result = await cloudinary.uploader.upload(uploadData, uploadOptions);
    }

    console.log('Cloudinary file upload successful:', result.secure_url);

    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      resource_type: result.resource_type,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Cloudinary file upload error:', error);
    throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
  }
};

/**
 * Deletes any file from Cloudinary
 * @param {string} publicId - Cloudinary public ID of the file
 * @param {string} resourceType - Resource type ('image', 'raw', 'video', 'auto')
 * @returns {Promise<Object>} Deletion result
 */
const deleteFile = async (publicId, resourceType = 'raw') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    console.log('Cloudinary file deletion result:', result);
    return {
      success: result.result === 'ok',
      result: result.result
    };
  } catch (error) {
    console.error('Cloudinary file delete error:', error);
    throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  uploadFile,
  deleteFile
}; 
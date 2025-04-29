const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'drkqoaf08',
  api_key: process.env.CLOUDINARY_API_KEY || '487735558362993',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'ETphSwynAprVeWW9vGNrTMXk9Yw',
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

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage
};
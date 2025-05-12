// Test script for Cloudinary integration
require('dotenv').config();

const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Verify configuration
console.log('Cloudinary Configuration:');
console.log('Cloud name:', cloudinary.config().cloud_name);
console.log('API Key:', cloudinary.config().api_key);

// Simple test upload function
async function testUpload() {
  try {
    console.log('Testing Cloudinary upload...');
    
    // Try to upload a test image
    const result = await cloudinary.uploader.upload(
      path.join(__dirname, 'test-profile-pic.png'),
      {
        folder: 'fileforge/test',
        public_id: 'test-upload-' + Date.now(),
        resource_type: 'image'
      }
    );
    
    console.log('Upload successful!');
    console.log('Image URL:', result.secure_url);
    console.log('Public ID:', result.public_id);
    
    console.log('\nDeleting test image...');
    const deleteResult = await cloudinary.uploader.destroy(result.public_id);
    console.log('Delete result:', deleteResult);
    
    return { success: true, result };
  } catch (error) {
    console.error('Cloudinary test failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
testUpload()
  .then(result => {
    if (result.success) {
      console.log('\nTest completed successfully! Cloudinary integration is working.');
    } else {
      console.log('\nTest failed. Please check your Cloudinary credentials.');
    }
  })
  .catch(err => {
    console.error('Test error:', err);
  }); 
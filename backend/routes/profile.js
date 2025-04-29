const router = require('express').Router();
const User = require('../models/user');
const { ensureApiAuth } = require('../middleware/auth');
const { uploadImage, deleteImage } = require('../services/cloudinary');
const fs = require('fs');
const path = require('path');

// @route   PUT /api/profile/upload-base64
// @desc    Upload profile picture as Base64 to Cloudinary
// @access  Private
router.put('/upload-base64', ensureApiAuth, async (req, res) => {
    try {
        const { imageData, contentType } = req.body;
        
        if (!imageData || !contentType) {
            return res.status(400).json({ error: 'Image data and content type are required' });
        }
        
        // Validate that the image isn't too large
        // Base64 length is approximately 4/3 of the original file size
        // 5MB max file size would be roughly 6.67MB in Base64
        const maxBase64Length = 7 * 1024 * 1024; // ~7MB
        if (imageData.length > maxBase64Length) {
            return res.status(400).json({ error: 'Image too large. Maximum size is 5MB.' });
        }
        
        // Find the user
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Format the data URI correctly for Cloudinary
        const dataUri = imageData.startsWith('data:') 
            ? imageData 
            : `data:${contentType};base64,${imageData}`;
        
        console.log(`Processing profile image upload for user: ${user._id}`);
        
        // Delete previous image from Cloudinary if exists
        if (user.cloudinaryId) {
            try {
                await deleteImage(user.cloudinaryId);
                console.log(`Previous profile image deleted: ${user.cloudinaryId}`);
            } catch (deleteErr) {
                console.error('Failed to delete previous image:', deleteErr);
                // Continue with upload even if delete fails
            }
        }
        
        // Upload to Cloudinary
        const uploadResult = await uploadImage(dataUri, {
            folder: 'fileforge/profile-pics',
            public_id: `user_${user._id}`,
            overwrite: true
        });
        
        console.log('Upload result from Cloudinary:', uploadResult.url);
        
        // Update user profile with Cloudinary URL and ID
        user.profilePic = uploadResult.url;
        user.cloudinaryId = uploadResult.public_id;
        
        // Remove the old base64 data to save space
        user.profilePicData = undefined;
        
        await user.save();
        
        console.log(`Profile picture updated successfully for user: ${user._id}`);
        
        res.json({
            success: true,
            message: 'Profile picture uploaded successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePic: user.profilePic
            }
        });
    } catch (error) {
        console.error('Profile picture upload error:', error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

// @route   GET /api/profile/image/:userId
// @desc    Get user profile image URL
// @access  Public
router.get('/image/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        
        if (!user || !user.profilePic) {
            return res.status(404).json({ error: 'Profile image not found' });
        }
        
        // Return the Cloudinary image URL
        res.json({
            success: true,
            imageUrl: user.profilePic
        });
    } catch (error) {
        console.error('Error fetching profile image:', error);
        res.status(500).json({ error: 'Failed to fetch profile image' });
    }
});

module.exports = router; 
const router = require('express').Router();
const { ensureApiAuth } = require('../middleware/auth');
const File = require('../models/file');
const fs = require('fs');

// @route   GET /api/dashboard
// @desc    Get user's files
// @access  Private
router.get('/', ensureApiAuth, async (req, res) => {
    try {
        console.log('Dashboard API called by user:', req.user._id);
        console.log('User details:', {
            id: req.user._id,
            email: req.user.email,
            name: req.user.name
        });
        
        // Check if this is a test user (created from test-login)
        if (req.user.email && req.user.email.endsWith('@example.com')) {
            console.log('Handling test user with mock data:', req.user.email);
            
            // Generate mock files for test users
            const mockFiles = [
                {
                    _id: '60d21b4667d0d8992e610c85',
                    filename: 'test-document.docx',
                    originalName: 'Important Document.docx',
                    uuid: 'mock-uuid-1234567890',
                    size: 1024 * 1024 * 2, // 2MB
                    formattedSize: '2.00 MB',
                    path: '/uploads/test-document.docx',
                    createdAt: new Date(),
                    sender: req.user.email,
                    receiver: null,
                    userId: req.user._id,
                    downloadLink: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/files/mock-uuid-1234567890`
                },
                {
                    _id: '60d21b4667d0d8992e610c86',
                    filename: 'test-spreadsheet.xlsx',
                    originalName: 'Financial Data.xlsx',
                    uuid: 'mock-uuid-0987654321',
                    size: 1024 * 1024 * 1.5, // 1.5MB
                    formattedSize: '1.50 MB',
                    path: '/uploads/test-spreadsheet.xlsx',
                    createdAt: new Date(Date.now() - 86400000), // 1 day ago
                    sender: req.user.email,
                    receiver: 'colleague@example.com',
                    userId: req.user._id,
                    downloadLink: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/files/mock-uuid-0987654321`
                }
            ];
            
            console.log('Returning mock files for test user:', mockFiles.length);
            return res.json({ files: mockFiles });
        }
        
        // For regular users, find all files uploaded by the user
        console.log('Querying files with userId:', req.user._id);
        
        // Check if there are any files at all in the database
        const totalFiles = await File.countDocuments();
        console.log('Total files in database:', totalFiles);
        
        // Find files associated with this user
        const files = await File.find({ userId: req.user._id })
            .sort({ createdAt: -1 }); // Sort by newest first
        
        console.log('Found files for user:', files.length);
        
        // If no files were found, try a different approach
        if (files.length === 0) {
            console.log('No files found with userId. Checking if files exist with sender email:', req.user.email);
            
            // Try finding files by sender email
            const filesBySender = await File.find({ sender: req.user.email })
                .sort({ createdAt: -1 });
                
            console.log('Files found by sender email:', filesBySender.length);
            
            // If files found by email, associate them with the user
            if (filesBySender.length > 0) {
                console.log('Updating files to associate with user ID');
                
                // Update these files to include the user's ID
                await Promise.all(filesBySender.map(file => {
                    return File.updateOne(
                        { _id: file._id }, 
                        { $set: { userId: req.user._id } }
                    );
                }));
                
                // Use these files instead
                files.push(...filesBySender);
            }
        }
        
        // Helper function for file size formatting
        const formatBytes = (bytes, decimals = 2) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        };
        
        // Map files to include formatted sizes
        const filesWithFormattedSizes = files.map(file => {
            return {
                id: file._id,
                filename: file.filename,
                originalName: file.originalName || file.filename,
                uuid: file.uuid,
                size: file.size,
                formattedSize: formatBytes(file.size),
                path: file.path,
                createdAt: file.createdAt,
                sender: file.sender,
                receiver: file.receiver,
                userId: file.userId,
                downloadLink: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/files/${file.uuid}`
            };
        });
        
        console.log('Returning formatted files:', filesWithFormattedSizes.length);
        res.json({ files: filesWithFormattedSizes });
    } catch (error) {
        console.error('Dashboard API error:', error);
        res.status(500).json({ error: 'Failed to load user files' });
    }
});

// @route   GET /api/dashboard/file/:id
// @desc    Get file details
// @access  Private
router.get('/file/:id', ensureApiAuth, async (req, res) => {
    try {
        // Check if this is a test user (created from test-login)
        if (req.user.email && req.user.email.endsWith('@example.com')) {
            console.log('Handling test user file details with mock data:', req.user.email);
            
            // Generate a mock file for test users
            const mockFile = {
                id: req.params.id,
                filename: 'test-document.docx',
                originalName: 'Important Document.docx',
                uuid: 'mock-uuid-1234567890',
                size: 1024 * 1024 * 2, // 2MB
                formattedSize: '2.00 MB',
                path: '/uploads/test-document.docx',
                createdAt: new Date(),
                sender: req.user.email,
                receiver: null,
                downloadLink: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/files/mock-uuid-1234567890`
            };
            
            return res.json({ file: mockFile });
        }
        
        const file = await File.findOne({ 
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        res.json({
            file: {
                id: file._id,
                filename: file.filename,
                uuid: file.uuid,
                size: file.size,
                formattedSize: formatBytes(file.size),
                path: file.path,
                createdAt: file.createdAt,
                sender: file.sender,
                receiver: file.receiver,
                downloadLink: `${process.env.APP_BASE_URL}/files/${file.uuid}`
            }
        });
    } catch (error) {
        console.error('File details API error:', error);
        res.status(500).json({ error: 'Failed to load file details' });
    }
});

// @route   DELETE /api/dashboard/file/:id
// @desc    Delete a file
// @access  Private
router.delete('/file/:id', ensureApiAuth, async (req, res) => {
    try {
        // Check if this is a test user (created from test-login)
        if (req.user.email && req.user.email.endsWith('@example.com')) {
            console.log('Handling test user file deletion with mock response:', req.user.email);
            
            // For test users, just return success without actually deleting anything
            return res.json({ success: true, message: 'Mock file deleted successfully' });
        }
        
        const file = await File.findOne({ 
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Delete file from filesystem
        fs.unlinkSync(file.path);
        
        // Delete file from database
        await file.deleteOne();
        
        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error('File deletion error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router; 
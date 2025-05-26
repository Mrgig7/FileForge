const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const File = require('../models/file');
const { v4: uuid4 } = require('uuid');
const { ensureApiAuth } = require('../middleware/auth');
const fs = require('fs');
const nodemailer = require('nodemailer');

let storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
})

let upload = multer({
    storage,
    limits: { fileSize: 1000000 * 100 },
}).single('myfile');

// @route   POST /api/files
// @desc    Upload a file
// @access  Private
router.post('/', ensureApiAuth, async (req, res) => {
    console.log('Upload request received');
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('User:', req.user ? req.user.email : 'No user');

    try {
        // Check if files are present in the request
        // The frontend sends the file with the field name 'file' in FormData
        if (!req.files || (!req.files.file && !req.files.myfile)) {
            console.error('No file in request');
            console.log('Available files:', req.files ? Object.keys(req.files) : 'No files object');
            return res.status(400).json({ error: 'No file uploaded. Please select a file.' });
        }

        // Try to get the file from either 'file' or 'myfile' field
        const file = req.files.file || req.files.myfile;
        console.log('File received:', file.name, 'Size:', file.size);

        // Determine user ID from authentication
        let userId = null;
        if (req.isAuthenticated()) {
            // User is authenticated via session
            userId = req.user._id;
            console.log('User authenticated via session, ID:', userId);
        } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            try {
                // Extract and verify JWT token
                const token = req.headers.authorization.split(' ')[1];
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fileforge_jwt_secret');
                userId = decoded.id;
                console.log('User authenticated via JWT, ID:', userId);
            } catch (error) {
                console.error('JWT verification failed:', error);
                // Continue without user association
            }
        }

        // Generate a unique filename
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.name)}`;
        const filePath = path.join(__dirname, '../uploads/', uniqueName);

        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Move the file to uploads directory
        await file.mv(filePath);

        // Save file info to database
        const fileRecord = new File({
            filename: uniqueName,
            uuid: uuid4(),
            path: filePath,
            size: file.size,
            originalName: file.name,
            userId: userId
        });

        const savedFile = await fileRecord.save();
        console.log('File saved to database with uuid:', savedFile.uuid);

        // Return successful response
        return res.json({
            success: true,
            file: {
                uuid: savedFile.uuid,
                fileName: savedFile.filename,
                originalName: file.name,
                size: savedFile.size,
                userId: savedFile.userId,
                downloadLink: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/files/${savedFile.uuid}`
            }
        });
    } catch (error) {
        console.error('File upload error:', error);
        return res.status(500).json({ error: error.message || 'Error uploading file' });
    }
});

// @route   GET /api/files/user-files
// @desc    Get all files for authenticated user
// @access  Private
router.get('/user-files', ensureApiAuth, async (req, res) => {
    try {
        const files = await File.find({ userId: req.user._id }).sort({ createdAt: -1 });

        // Format the response
        const formattedFiles = files.map(file => ({
            id: file._id,
            uuid: file.uuid,
            filename: file.filename,
            originalName: file.originalName || file.filename,
            size: file.size,
            formattedSize: formatBytes(file.size),
            path: file.path,
            createdAt: file.createdAt,
            downloadLink: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/files/${file.uuid}`
        }));

        return res.json({ success: true, files: formattedFiles });
    } catch (error) {
        console.error('Error fetching user files:', error);
        return res.status(500).json({ error: 'Error fetching files' });
    }
});

// @route   GET /api/files/:uuid
// @desc    Get file info and download
// @access  Public
router.get('/:uuid', async (req, res) => {
    try {
        const file = await File.findOne({ uuid: req.params.uuid });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if file exists on filesystem
        if (!fs.existsSync(file.path)) {
            await File.deleteOne({ uuid: req.params.uuid });
            return res.status(404).json({ error: 'File not found' });
        }

        return res.download(file.path, file.originalName || file.filename);
    } catch (error) {
        console.error('Download error:', error);
        return res.status(500).json({ error: 'Error downloading file' });
    }
});

// @route   POST /api/files/send
// @desc    Send file by email
// @access  Public
router.post('/send', async (req, res) => {
    console.log('Email share request received:', req.body);

    const { uuid, emailTo, emailFrom } = req.body;

    // Validation checks with proper error responses
    if (!uuid || !emailTo || !emailFrom) {
        console.log('Missing required fields:', { uuid, emailTo, emailFrom });
        return res.status(422).json({ error: 'All fields are required.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTo) || !emailRegex.test(emailFrom)) {
        console.log('Invalid email format:', { emailTo, emailFrom });
        return res.status(422).json({ error: 'Invalid email format.' });
    }

    // Correct email addresses if needed
    const correctedEmailTo = correctEmailIfNeeded(emailTo);
    const correctedEmailFrom = correctEmailIfNeeded(emailFrom);

    // Use structured error handling
    try {
        console.log('Looking up file with UUID:', uuid);
        // Get data from db
        const file = await File.findOne({ uuid: uuid });

        if (!file) {
            console.log('File not found with UUID:', uuid);
            return res.status(404).json({ error: 'File not found' });
        }

        if (file.sender) {
            console.log('Email already sent for file:', { uuid, sender: file.sender });
            return res.status(422).json({ error: 'Email already sent once.' });
        }

        // Construct the download link with full URL
        const downloadLink = `${process.env.APP_BASE_URL}/files/${file.uuid}`;
        console.log('Generated download link:', downloadLink);

        // Import email services
        const sendMail = require('../services/emailService');
        const emailTemplate = require('../services/emailTemplate');

        // Prepare email data with appropriate size format
        const formattedSize = formatBytes(file.size);
        console.log('File size formatted:', formattedSize);
        console.log('Using corrected emails:', { from: correctedEmailFrom, to: correctedEmailTo });

        // Send response to client BEFORE sending email to prevent timeout
        res.json({
            success: true,
            message: 'Email queued successfully',
            downloadLink
        });

        // AFTER sending response, then process the email (don't await)
        // This prevents connection timeouts
        sendMail({
            from: correctedEmailFrom,
            to: correctedEmailTo,
            subject: 'FileForge file sharing',
            text: `${correctedEmailFrom} shared a file with you.`,
            html: emailTemplate({
                emailFrom: correctedEmailFrom,
                downloadLink,
                size: formattedSize,
                expires: '24 hours'
            })
        }).then(async (info) => {
            console.log('Email sent successfully:', info);

            // Update DB after email is sent
            file.sender = correctedEmailFrom;
            file.receiver = correctedEmailTo;
            await file.save();
            console.log('File record updated successfully');
        }).catch(err => {
            console.error('Email sending failed:', err);
        });

    } catch (error) {
        console.error('General server error:', error);
        return res.status(500).json({
            error: 'Server error occurred',
            details: error.message,
            type: error.name
        });
    }
});

// New email sending endpoint
router.post('/send-email', async (req, res) => {
  try {
    const { from, to, subject, message, fileId, fileName } = req.body;

    if (!from || !to || !fileId) {
      return res.status(400).json({ error: 'Missing required fields: from, to, and fileId' });
    }

    // Get file details to create download link
    const file = await File.findOne({ uuid: fileId });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Create download link with fallback for APP_BASE_URL
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const downloadLink = `${baseUrl}/files/${file.uuid}`;

    // Setup email data with fallback value for MAIL_USER
    const mailUser = process.env.MAIL_USER || from;
    const emailData = {
      from: `FileForge <${mailUser}>`,
      to,
      subject: subject || `${from} shared a file with you`,
      text: `${from} shared a file with you: ${fileName}\n\n${message || ''}\n\nDownload link: ${downloadLink}\n\nThis link will expire in 24 hours.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4F46E5;">FileForge</h1>
          </div>
          <p style="margin-bottom: 15px;"><strong>${from}</strong> shared a file with you:</p>
          <div style="background-color: #f5f5f5; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: bold;">${fileName}</p>
          </div>
          ${message ? `<p style="margin-bottom: 20px;">${message}</p>` : ''}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${downloadLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download File</a>
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 30px; text-align: center;">This link will expire in 24 hours.</p>
        </div>
      `
    };

    // Check if SMTP settings are available
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.warn('Email configuration not complete. Using simulated email sending.');

      // Simulate successful email sending for development
      console.log('Email would have been sent with:', {
        to,
        from: mailUser,
        subject: emailData.subject
      });

      // Update file to record that it was shared
      file.sender = from;
      file.receiver = to;
      await file.save();

      return res.json({
        success: true,
        message: 'Email simulated successfully (email service not configured)'
      });
    }

    // Create transporter with fallbacks for SMTP settings
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    // Send mail
    await transporter.sendMail(emailData);

    // Update file to record that it was shared
    file.sender = from;
    file.receiver = to;
    await file.save();

    return res.json({
      success: true,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Email sending error:', error);
    return res.status(500).json({
      error: 'Error sending email',
      details: error.message
    });
  }
});

// @route   DELETE /api/files/:uuid
// @desc    Delete a file by UUID
// @access  Private
router.delete('/:uuid', ensureApiAuth, async (req, res) => {
    try {
        const file = await File.findOne({ uuid: req.params.uuid });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Make sure the user owns this file
        if (file.userId && file.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not have permission to delete this file' });
        }

        // Delete file from filesystem if it exists
        try {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        } catch (fsError) {
            console.error('Error deleting physical file:', fsError);
            // Continue with database deletion even if filesystem deletion fails
        }

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

// Helper function to correct known email typos
function correctEmailIfNeeded(email) {
    // Specific correction for jnitesh146@gmail.com to jnitesh1406@gmail.com
    if (email === 'jnitesh146@gmail.com') {
        console.log('Correcting email from jnitesh146@gmail.com to jnitesh1406@gmail.com');
        return 'jnitesh1406@gmail.com';
    }

    // Add more corrections as needed

    return email;
}

module.exports = router;
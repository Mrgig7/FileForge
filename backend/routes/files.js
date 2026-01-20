const router = require('express').Router();
const path = require('path');
const File = require('../models/file');
const { v4: uuid4 } = require('uuid');
const { ensureApiAuth } = require('../middleware/auth');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { uploadFile, deleteFile } = require('../services/cloudinary');

const getPublicAppBaseUrl = () => {
    return (
        process.env.FRONTEND_URL ||
        process.env.CLIENT_URL ||
        process.env.WEB_BASE_URL ||
        process.env.PUBLIC_APP_URL ||
        process.env.APP_BASE_URL ||
        'http://localhost:5173'
    );
};

// Note: Using express-fileupload middleware from server.js
// No need for multer configuration here

// Handle CORS preflight requests for file upload
router.options('/', (req, res) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://fileforge-indol.vercel.app',
        'https://fileforge-react.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || 'https://fileforge-indol.vercel.app');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
        console.log('🚨 CORS preflight handled for file upload:', origin);
    }

    res.status(200).end();
});

// @route   POST /api/files
// @desc    Upload a file to Cloudinary
// @access  Public (temporarily for CORS fix)
router.post('/', async (req, res) => {
    // EMERGENCY CORS FIX - Set headers immediately
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://fileforge-indol.vercel.app',
        'https://fileforge-react.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || 'https://fileforge-indol.vercel.app');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
        console.log('🚨 EMERGENCY CORS headers set for file upload:', origin);
    }

    console.log('=== FILE UPLOAD REQUEST START ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Origin:', req.headers.origin);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    console.log('User authenticated:', !!req.user);
    console.log('Files object exists:', !!req.files);

    try {
        // Check if files are present in the request
        if (!req.files) {
            console.error('No files object in request');
            return res.status(400).json({
                error: 'No file data received',
                debug: {
                    contentType: req.headers['content-type'],
                    bodyKeys: Object.keys(req.body || {}),
                    hasFiles: false
                }
            });
        }

        // Try to get the file from 'myfile' field
        const file = req.files.myfile;

        if (!file) {
            console.error('No file found in request.files.myfile');
            console.log('Available files:', Object.keys(req.files));
            return res.status(400).json({
                error: 'No file uploaded. Please select a file.',
                debug: {
                    filesExists: true,
                    availableFields: Object.keys(req.files),
                    bodyFields: Object.keys(req.body || {}),
                    contentType: req.headers['content-type']
                }
            });
        }

        // Validate file object
        if (!file.name || !file.size) {
            console.error('Invalid file object:', file);
            return res.status(400).json({
                error: 'Invalid file data received.',
                debug: {
                    hasFile: true,
                    fileName: file.name || 'N/A',
                    fileSize: file.size || 'N/A'
                }
            });
        }

        console.log('File found:', {
            name: file.name,
            size: file.size,
            mimetype: file.mimetype,
            tempFilePath: file.tempFilePath
        });

        // Determine user ID from authentication
        let userId = null;
        if (req.isAuthenticated()) {
            userId = req.user._id;
            console.log('User authenticated via session, ID:', userId);
        } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fileforge_jwt_secret');
                userId = decoded.id;
                console.log('User authenticated via JWT, ID:', userId);
            } catch (error) {
                console.error('JWT verification failed:', error);
            }
        }

        // Generate a unique filename for Cloudinary
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const fileExtension = path.extname(file.name).toLowerCase();

        // Get file buffer - express-fileupload may use temp files instead of in-memory buffer
        let fileBuffer;
        if (file.data && file.data.length > 0) {
            // Use in-memory buffer if available
            fileBuffer = file.data;
            console.log('Using in-memory file buffer, size:', fileBuffer.length);
        } else if (file.tempFilePath) {
            // Read from temp file (when useTempFiles: true)
            console.log('Reading from temp file:', file.tempFilePath);
            fileBuffer = fs.readFileSync(file.tempFilePath);
            console.log('Read file buffer from temp file, size:', fileBuffer.length);
            // Clean up temp file after reading
            try {
                fs.unlinkSync(file.tempFilePath);
            } catch (e) {
                console.warn('Could not delete temp file:', e.message);
            }
        } else {
            throw new Error('No file data available');
        }

        // Determine the correct resource_type based on file extension/mimetype
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
        const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.webm', '.mkv', '.flv'];
        
        let resourceType = 'raw'; // Default for documents, archives, etc.
        if (imageExtensions.includes(fileExtension) || file.mimetype?.startsWith('image/')) {
            resourceType = 'image';
        } else if (videoExtensions.includes(fileExtension) || file.mimetype?.startsWith('video/')) {
            resourceType = 'video';
        }
        
        console.log('Detected file type:', { 
            extension: fileExtension, 
            mimetype: file.mimetype, 
            resourceType 
        });

        // Determine proper mimetype for base64 encoding
        const mimeTypeMap = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
            '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
            '.webm': 'video/webm', '.pdf': 'application/pdf'
        };
        const detectedMimetype = mimeTypeMap[fileExtension] || file.mimetype || 'application/octet-stream';

        // IMPORTANT: Always use 'raw' resource type for reliability
        // Cloudinary's 'image' type validation is too strict and rejects valid images
        // Files uploaded as 'raw' can still be served via URL and viewed in browser
        const finalResourceType = 'raw';

        // Upload directly to Cloudinary using file buffer
        console.log('Uploading to Cloudinary with resource_type:', finalResourceType);
        const cloudinaryResult = await uploadFile(fileBuffer, {
            folder: 'fileforge/files',
            public_id: uniqueName,
            resource_type: finalResourceType,
            mimetype: detectedMimetype // Pass mimetype for proper base64 conversion
        });

        console.log('Cloudinary upload result:', cloudinaryResult);

        // Parse security options from request body
        const {
            isEncrypted = false,
            encryptionIV = null,
            maxDownloads = null,
            deleteAfterFirstAccess = false,
            expiresAfter = '30d', // Default changed to 30 days
            viewOnly = false
        } = req.body;

        // Calculate expiration time based on option
        const expirationMap = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };
        const expiresAt = new Date(Date.now() + (expirationMap[expiresAfter] || expirationMap['30d']));

        // Save file info to database with Cloudinary details
        const fileRecord = new File({
            filename: uniqueName + fileExtension,
            originalName: file.name,
            uuid: uuid4(),
            path: null, // No longer using local path
            cloudinaryId: cloudinaryResult.public_id,
            cloudinaryUrl: cloudinaryResult.url,
            size: file.size,
            userId: userId,
            // Security & Privacy Options
            isEncrypted: isEncrypted === 'true' || isEncrypted === true,
            encryptionIV: encryptionIV,
            maxDownloads: maxDownloads ? parseInt(maxDownloads, 10) : null,
            deleteAfterFirstAccess: deleteAfterFirstAccess === 'true' || deleteAfterFirstAccess === true,
            expiresAt: expiresAt,
            viewOnly: viewOnly === 'true' || viewOnly === true
        });

        const savedFile = await fileRecord.save();
        console.log('File saved to database with uuid:', savedFile.uuid);
        console.log('Cloudinary URL:', savedFile.cloudinaryUrl);
        console.log('Expires at:', savedFile.expiresAt);

        // Return successful response
        return res.json({
            success: true,
            file: {
                uuid: savedFile.uuid,
                fileName: savedFile.filename,
                originalName: file.name,
                size: savedFile.size,
                userId: savedFile.userId,
                isEncrypted: savedFile.isEncrypted,
                viewOnly: savedFile.viewOnly,
                expiresAt: savedFile.expiresAt,
                cloudinaryUrl: savedFile.cloudinaryUrl,
                downloadLink: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/files/${savedFile.uuid}`
            }
        });
    } catch (error) {
        console.error('=== FILE UPLOAD ERROR ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);

        return res.status(500).json({
            error: error.message || 'Error uploading file',
            debug: {
                errorType: error.name,
                errorMessage: error.message,
                hasFiles: !!req.files,
                hasUser: !!req.user,
                origin: req.headers.origin,
                contentType: req.headers['content-type']
            }
        });
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
// @desc    Get file info and download (redirects to Cloudinary)
// @access  Public
router.get('/:uuid', async (req, res) => {
    try {
        const file = await File.findOne({ uuid: req.params.uuid });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if file has a Cloudinary URL (new system) or local path (legacy)
        const hasCloudinaryUrl = !!file.cloudinaryUrl;
        const hasLocalFile = file.path && fs.existsSync(file.path);

        if (!hasCloudinaryUrl && !hasLocalFile) {
            await File.deleteOne({ uuid: req.params.uuid });
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if file has expired
        if (file.expiresAt && new Date() > file.expiresAt) {
            console.log('File expired:', file.uuid);
            // Delete expired file from Cloudinary
            if (file.cloudinaryId) {
                try {
                    await deleteFile(file.cloudinaryId, file.cloudinaryUrl?.includes('/image/') ? 'image' : 'raw');
                } catch (cloudErr) {
                    console.error('Error deleting expired file from Cloudinary:', cloudErr);
                }
            }
            // Delete from local filesystem if exists (legacy)
            if (file.path && fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { }
            }
            await File.deleteOne({ uuid: req.params.uuid });
            return res.status(410).json({ error: 'This file has expired and is no longer available' });
        }

        // Check if max downloads limit reached
        if (file.maxDownloads !== null && file.downloads >= file.maxDownloads) {
            console.log('Max downloads reached:', file.uuid);
            // Delete file from Cloudinary
            if (file.cloudinaryId) {
                try {
                    await deleteFile(file.cloudinaryId, file.cloudinaryUrl?.includes('/image/') ? 'image' : 'raw');
                } catch (cloudErr) {
                    console.error('Error deleting max-download file from Cloudinary:', cloudErr);
                }
            }
            if (file.path && fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { }
            }
            await File.deleteOne({ uuid: req.params.uuid });
            return res.status(410).json({ error: 'This file has reached its download limit and is no longer available' });
        }

        // Check if view-only mode (don't allow direct download)
        if (file.viewOnly) {
            return res.status(403).json({ 
                error: 'This file is view-only and cannot be downloaded',
                viewOnly: true,
                previewUrl: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/files/${file.uuid}/preview`
            });
        }

        // Increment download count
        file.downloads = (file.downloads || 0) + 1;
        await file.save();

        console.log(`File downloaded: ${file.uuid}, Downloads: ${file.downloads}/${file.maxDownloads || 'unlimited'}`);

        // Handle delete after first access
        if (file.deleteAfterFirstAccess) {
            console.log('Delete after first access triggered:', file.uuid);
            // Schedule deletion after response is sent
            res.on('finish', async () => {
                try {
                    if (file.cloudinaryId) {
                        await deleteFile(file.cloudinaryId, file.cloudinaryUrl?.includes('/image/') ? 'image' : 'raw');
                    }
                    if (file.path && fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                    await File.deleteOne({ uuid: file.uuid });
                    console.log('File deleted after first access:', file.uuid);
                } catch (delErr) {
                    console.error('Error deleting file after first access:', delErr);
                }
            });
        }

        // Handle max downloads reached after this download
        if (file.maxDownloads !== null && file.downloads >= file.maxDownloads) {
            console.log('This is the last download, file will be deleted:', file.uuid);
            res.on('finish', async () => {
                try {
                    if (file.cloudinaryId) {
                        await deleteFile(file.cloudinaryId, file.cloudinaryUrl?.includes('/image/') ? 'image' : 'raw');
                    }
                    if (file.path && fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                    await File.deleteOne({ uuid: file.uuid });
                    console.log('File deleted after reaching max downloads:', file.uuid);
                } catch (delErr) {
                    console.error('Error deleting file after max downloads:', delErr);
                }
            });
        }

        // Fetch from Cloudinary and send to client (new system)
        if (hasCloudinaryUrl) {
            console.log('Fetching file from Cloudinary:', file.cloudinaryUrl);
            try {
                const https = require('https');
                const http = require('http');
                
                // Determine content type from file extension
                const ext = path.extname(file.originalName || file.filename).toLowerCase();
                const mimeTypes = {
                    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                    '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
                    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
                    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
                    '.txt': 'text/plain', '.json': 'application/json', '.xml': 'application/xml',
                    '.zip': 'application/zip', '.rar': 'application/x-rar-compressed'
                };
                const contentType = mimeTypes[ext] || 'application/octet-stream';
                
                // Function to fetch with redirect handling and buffer collection
                const fetchWithRedirects = (url, maxRedirects = 5) => {
                    const fileUrl = new URL(url);
                    const protocol = fileUrl.protocol === 'https:' ? https : http;
                    
                    protocol.get(url, (cloudinaryResponse) => {
                        console.log('Cloudinary response status:', cloudinaryResponse.statusCode);
                        
                        // Handle redirects (301, 302, 307, 308)
                        if ([301, 302, 307, 308].includes(cloudinaryResponse.statusCode)) {
                            const redirectUrl = cloudinaryResponse.headers.location;
                            console.log('Following redirect to:', redirectUrl);
                            if (maxRedirects > 0 && redirectUrl) {
                                return fetchWithRedirects(redirectUrl, maxRedirects - 1);
                            } else {
                                console.error('Too many redirects');
                                return res.status(500).json({ error: 'Too many redirects' });
                            }
                        }
                        
                        if (cloudinaryResponse.statusCode !== 200) {
                            console.error('Cloudinary fetch failed:', cloudinaryResponse.statusCode);
                            return res.status(500).json({ error: 'Error fetching file from storage' });
                        }
                        
                        // Collect data into buffer for reliable transfer
                        const chunks = [];
                        cloudinaryResponse.on('data', (chunk) => {
                            chunks.push(chunk);
                        });
                        
                        cloudinaryResponse.on('end', () => {
                            const buffer = Buffer.concat(chunks);
                            console.log('File fetched successfully, size:', buffer.length, 'bytes');
                            
                            // Set headers and send buffer
                            res.setHeader('Content-Type', contentType);
                            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName || file.filename)}"`);
                            res.setHeader('Content-Length', buffer.length);
                            res.send(buffer);
                        });
                        
                        cloudinaryResponse.on('error', (err) => {
                            console.error('Error reading Cloudinary stream:', err);
                            return res.status(500).json({ error: 'Error reading file data' });
                        });
                    }).on('error', (err) => {
                        console.error('Error fetching from Cloudinary:', err);
                        return res.status(500).json({ error: 'Error fetching file from storage' });
                    });
                };
                
                fetchWithRedirects(file.cloudinaryUrl);
                return;
            } catch (fetchError) {
                console.error('Cloudinary fetch error:', fetchError);
                return res.status(500).json({ error: 'Error fetching file from storage' });
            }
        }

        // Fallback to local file (legacy support)
        return res.download(file.path, file.originalName || file.filename);
    } catch (error) {
        console.error('Download error:', error);
        return res.status(500).json({ error: 'Error downloading file' });
    }
});

// @route   GET /api/files/:uuid/info
// @desc    Get file metadata (for frontend to check encryption, view-only status, etc.)
// @access  Public
router.get('/:uuid/info', async (req, res) => {
    try {
        const file = await File.findOne({ uuid: req.params.uuid });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if file exists (Cloudinary or local)
        const hasCloudinaryUrl = !!file.cloudinaryUrl;
        const hasLocalFile = file.path && fs.existsSync(file.path);

        if (!hasCloudinaryUrl && !hasLocalFile) {
            await File.deleteOne({ uuid: req.params.uuid });
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if file has expired
        if (file.expiresAt && new Date() > file.expiresAt) {
            // Clean up expired file
            if (file.cloudinaryId) {
                try {
                    await deleteFile(file.cloudinaryId, file.cloudinaryUrl?.includes('/image/') ? 'image' : 'raw');
                } catch (e) { console.error('Error deleting expired file from Cloudinary:', e); }
            }
            if (file.path && fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { }
            }
            await File.deleteOne({ uuid: req.params.uuid });
            return res.status(410).json({ error: 'This file has expired' });
        }

        // Check if max downloads limit already reached
        if (file.maxDownloads !== null && file.downloads >= file.maxDownloads) {
            if (file.cloudinaryId) {
                try {
                    await deleteFile(file.cloudinaryId, file.cloudinaryUrl?.includes('/image/') ? 'image' : 'raw');
                } catch (e) { console.error('Error deleting max-download file from Cloudinary:', e); }
            }
            if (file.path && fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { }
            }
            await File.deleteOne({ uuid: req.params.uuid });
            return res.status(410).json({ error: 'This file has reached its download limit' });
        }

        // Determine file MIME type for preview
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mov': 'video/quicktime',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript',
            '.json': 'application/json'
        };
        const ext = path.extname(file.originalName || file.filename).toLowerCase();
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        return res.json({
            success: true,
            file: {
                uuid: file.uuid,
                originalName: file.originalName || file.filename,
                size: file.size,
                formattedSize: formatBytes(file.size),
                mimeType: mimeType,
                isEncrypted: file.isEncrypted || false,
                encryptionIV: file.encryptionIV || null,
                viewOnly: file.viewOnly || false,
                downloads: file.downloads || 0,
                maxDownloads: file.maxDownloads,
                deleteAfterFirstAccess: file.deleteAfterFirstAccess || false,
                expiresAt: file.expiresAt,
                createdAt: file.createdAt,
                cloudinaryUrl: file.cloudinaryUrl || null
            }
        });
    } catch (error) {
        console.error('File info error:', error);
        return res.status(500).json({ error: 'Error fetching file info' });
    }
});

// @route   GET /api/files/:uuid/preview
// @desc    Preview file in browser (redirects to Cloudinary for inline display)
// @access  Public
router.get('/:uuid/preview', async (req, res) => {
    try {
        const file = await File.findOne({ uuid: req.params.uuid });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if file exists (Cloudinary or local)
        const hasCloudinaryUrl = !!file.cloudinaryUrl;
        const hasLocalFile = file.path && fs.existsSync(file.path);

        if (!hasCloudinaryUrl && !hasLocalFile) {
            await File.deleteOne({ uuid: req.params.uuid });
            return res.status(404).json({ error: 'File not found' });
        }

        // Check expiration
        if (file.expiresAt && new Date() > file.expiresAt) {
            if (file.cloudinaryId) {
                try {
                    await deleteFile(file.cloudinaryId, file.cloudinaryUrl?.includes('/image/') ? 'image' : 'raw');
                } catch (e) { console.error('Error deleting expired file from Cloudinary:', e); }
            }
            if (file.path && fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { }
            }
            await File.deleteOne({ uuid: req.params.uuid });
            return res.status(410).json({ error: 'This file has expired' });
        }

        // Note: Preview does NOT increment download count

        // Handle first access deletion for view-only files
        if (file.deleteAfterFirstAccess) {
            res.on('finish', async () => {
                try {
                    if (file.cloudinaryId) {
                        await deleteFile(file.cloudinaryId, file.cloudinaryUrl?.includes('/image/') ? 'image' : 'raw');
                    }
                    if (file.path && fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                    await File.deleteOne({ uuid: file.uuid });
                    console.log('View-only file deleted after first access:', file.uuid);
                } catch (delErr) {
                    console.error('Error deleting view-only file:', delErr);
                }
            });
        }

        // Fetch from Cloudinary and stream for preview (new system)
        if (hasCloudinaryUrl) {
            console.log('Fetching file from Cloudinary for preview:', file.cloudinaryUrl);
            try {
                const https = require('https');
                const http = require('http');
                
                // Determine content type from file extension
                const ext = path.extname(file.originalName || file.filename).toLowerCase();
                const mimeTypes = {
                    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                    '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
                    '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
                    '.ogg': 'audio/ogg', '.txt': 'text/plain', '.json': 'application/json'
                };
                const mimeType = mimeTypes[ext] || 'application/octet-stream';
                
                // Function to fetch with redirect handling
                const fetchWithRedirects = (url, maxRedirects = 5) => {
                    const fileUrl = new URL(url);
                    const protocol = fileUrl.protocol === 'https:' ? https : http;
                    
                    protocol.get(url, (cloudinaryResponse) => {
                        console.log('Cloudinary preview response status:', cloudinaryResponse.statusCode);
                        
                        // Handle redirects (301, 302, 307, 308)
                        if ([301, 302, 307, 308].includes(cloudinaryResponse.statusCode)) {
                            const redirectUrl = cloudinaryResponse.headers.location;
                            console.log('Following preview redirect to:', redirectUrl);
                            if (maxRedirects > 0 && redirectUrl) {
                                return fetchWithRedirects(redirectUrl, maxRedirects - 1);
                            } else {
                                console.error('Too many preview redirects');
                                return res.status(500).json({ error: 'Too many redirects' });
                            }
                        }
                        
                        if (cloudinaryResponse.statusCode !== 200) {
                            console.error('Cloudinary preview fetch failed:', cloudinaryResponse.statusCode);
                            return res.status(500).json({ error: 'Error fetching file for preview' });
                        }
                        
                        // Collect data into buffer for reliable transfer
                        const chunks = [];
                        cloudinaryResponse.on('data', (chunk) => {
                            chunks.push(chunk);
                        });
                        
                        cloudinaryResponse.on('end', () => {
                            const buffer = Buffer.concat(chunks);
                            console.log('Preview file fetched, size:', buffer.length, 'bytes');
                            
                            // Set headers and send buffer
                            res.setHeader('Content-Type', mimeType);
                            res.setHeader('Content-Disposition', 'inline');
                            res.setHeader('Content-Length', buffer.length);
                            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                            res.send(buffer);
                        });
                        
                        cloudinaryResponse.on('error', (err) => {
                            console.error('Error reading preview stream:', err);
                            return res.status(500).json({ error: 'Error reading file data' });
                        });
                    }).on('error', (err) => {
                        console.error('Error fetching preview from Cloudinary:', err);
                        return res.status(500).json({ error: 'Error fetching file for preview' });
                    });
                };
                
                fetchWithRedirects(file.cloudinaryUrl);
                return;
            } catch (fetchError) {
                console.error('Cloudinary preview fetch error:', fetchError);
                return res.status(500).json({ error: 'Error fetching file for preview' });
            }
        }

        // Fallback to local file streaming (legacy support)
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mov': 'video/quicktime',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.txt': 'text/plain'
        };
        const ext = path.extname(file.originalName || file.filename).toLowerCase();
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', file.size);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const fileStream = fs.createReadStream(file.path);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Preview error:', error);
        return res.status(500).json({ error: 'Error previewing file' });
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
        const downloadLink = `${getPublicAppBaseUrl()}/files/${file.uuid}`;
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
                expires: '24 hours',
                appBaseUrl: getPublicAppBaseUrl()
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
    const baseUrl = getPublicAppBaseUrl();
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
// @desc    Delete a file by UUID (from Cloudinary and database)
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

        // Delete file from Cloudinary if it exists there
        if (file.cloudinaryId) {
            try {
                const resourceType = file.cloudinaryUrl?.includes('/image/') ? 'image' : 
                                     file.cloudinaryUrl?.includes('/video/') ? 'video' : 'raw';
                await deleteFile(file.cloudinaryId, resourceType);
                console.log('File deleted from Cloudinary:', file.cloudinaryId);
            } catch (cloudErr) {
                console.error('Error deleting file from Cloudinary:', cloudErr);
                // Continue with database deletion even if Cloudinary deletion fails
            }
        }

        // Delete file from local filesystem if it exists (legacy support)
        if (file.path && fs.existsSync(file.path)) {
            try {
                fs.unlinkSync(file.path);
                console.log('File deleted from local filesystem:', file.path);
            } catch (fsError) {
                console.error('Error deleting physical file:', fsError);
            }
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

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('./config/passport');
const jwt = require('jsonwebtoken');
const fileUpload = require('express-fileupload');
require('dotenv').config();

// CORS - Move this up to be one of the first middleware
const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = [
            'http://127.0.0.1:5173',
            'http://localhost:5173',
            'http://localhost:3000',
            'https://fileforge-react.vercel.app',
            'https://file-forge-react.vercel.app',
            'https://fileforge-backend.vercel.app',
            'https://fileforge-indol.vercel.app'
        ];

        // Add the origin from env file without trailing slash
        if (process.env.ALLOWED_CLIENTS) {
            const envOrigins = process.env.ALLOWED_CLIENTS.split(',');
            envOrigins.forEach(origin => {
                allowedOrigins.push(origin.trim().replace(/\/$/, ''));
            });
        }

        // For null origin (like Postman, mobile apps, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            console.log('CORS allowed origin:', origin);
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            console.log('Allowed origins:', allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With',
        'Origin',
        'Cache-Control',
        'X-File-Name',
        'X-File-Size',
        'X-File-Type'
    ],
    exposedHeaders: ['Authorization', 'Content-Length', 'X-Foo', 'X-Bar'],
    credentials: true,
    optionsSuccessStatus: 200,
    preflightContinue: false
}

// Apply CORS middleware
app.use(cors(corsOptions));

// Additional CORS handling for preflight requests
app.options('*', cors(corsOptions));

// Emergency CORS fix - Add universal CORS headers for all requests
app.use((req, res, next) => {
    const origin = req.headers.origin;

    // List of allowed origins
    const allowedOrigins = [
        'https://fileforge-indol.vercel.app',
        'https://fileforge-react.vercel.app',
        'https://file-forge-react.vercel.app',
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ];

    // Add environment variable origins
    if (process.env.ALLOWED_CLIENTS) {
        const envOrigins = process.env.ALLOWED_CLIENTS.split(',');
        envOrigins.forEach(envOrigin => {
            allowedOrigins.push(envOrigin.trim().replace(/\/$/, ''));
        });
    }

    // Set CORS headers for allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || 'https://fileforge-indol.vercel.app');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-File-Name, X-File-Size, X-File-Type');
        res.header('Access-Control-Expose-Headers', 'Authorization, Content-Length');

        console.log(`Universal CORS headers set for origin: ${origin || 'no-origin'}`);
    }

    // Handle preflight requests immediately
    if (req.method === 'OPTIONS') {
        console.log('Handling universal preflight request');
        return res.status(200).end();
    }

    next();
});

// Special CORS handling for file upload routes
app.use('/api/files', (req, res, next) => {
    // Set CORS headers explicitly for file upload routes
    const origin = req.headers.origin;
    const allowedOrigins = [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://localhost:3000',
        'https://fileforge-react.vercel.app',
        'https://file-forge-react.vercel.app',
        'https://fileforge-backend.vercel.app',
        'https://fileforge-indol.vercel.app'
    ];

    if (process.env.ALLOWED_CLIENTS) {
        const envOrigins = process.env.ALLOWED_CLIENTS.split(',');
        envOrigins.forEach(envOrigin => {
            allowedOrigins.push(envOrigin.trim().replace(/\/$/, ''));
        });
    }

    if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-File-Name, X-File-Size, X-File-Type');
        res.header('Access-Control-Expose-Headers', 'Authorization, Content-Length');

        console.log(`File upload CORS headers set for origin: ${origin}`);
    } else {
        console.log(`File upload CORS blocked for origin: ${origin}`);
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        console.log('Handling preflight request for file upload');
        return res.status(200).end();
    }

    next();
});

// Middleware
app.use((req, res, next) => {
    // Only log essential requests and avoid logging static resource requests
    if (!req.url.includes('/uploads/') && !req.url.includes('/public/')) {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin || 'No origin'}`);
    }
    next();
});

// Detailed request logging for debugging - only for API endpoints
app.use('/api', (req, res, next) => {
    // Skip detailed logging for GET requests to reduce console spam
    if (req.method !== 'GET') {
        console.log('-----------------------------------');
        console.log(`Request URL: ${req.url}`);
        console.log(`Request Method: ${req.method}`);
        // Only log headers for non-GET requests
        if (req.method !== 'GET') {
            console.log(`Request Headers: ${JSON.stringify(req.headers)}`);
        }
        console.log('-----------------------------------');
    }
    next();
});

// API response middleware to ensure proper content-type for all API routes
app.use('/api', (req, res, next) => {
    // Save original res.json function
    const originalJson = res.json;

    // Override json method to always set proper content-type
    res.json = function(body) {
        res.setHeader('Content-Type', 'application/json');
        return originalJson.call(this, body);
    };

    next();
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fileforge_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_CONNECTION_URL,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
    // Get flash messages
    const successMsg = req.flash('success_msg');
    const errorMsg = req.flash('error_msg');
    const infoMsg = req.flash('info_msg');
    const error = req.flash('error');

    // Only set locals for non-empty messages
    if (successMsg.length > 0) res.locals.success_msg = successMsg;
    if (errorMsg.length > 0) res.locals.error_msg = errorMsg;
    if (infoMsg.length > 0) res.locals.info_msg = infoMsg;
    if (error.length > 0) res.locals.error = error;

    res.locals.user = req.user || null;
    next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload middleware
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
    abortOnLimit: true,
    createParentPath: true,
    useTempFiles: true,
    tempFileDir: path.join(__dirname, 'tmp')
}));

// Database connection
const connectDB = require('./config/db');
connectDB();

// API Routes - IMPORTANT: Keep these routes BEFORE static file middleware
// Create a simple test route to verify API is working
app.post('/api/test-auth', (req, res) => {
    console.log('Test auth route hit:', req.body);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        success: true,
        message: 'Test authentication successful',
        receivedData: req.body
    });
});

// Test login route - Disabled in production
// Uncomment for development/testing purposes only
/*
app.post('/api/test-login', (req, res) => {
    console.log('Test login route hit:', req.body);

    // Set proper CORS and content type headers
    res.setHeader('Content-Type', 'application/json');
    // Remove any trailing slash from ALLOWED_CLIENTS to fix CORS issues
    const allowedOrigin = (process.env.ALLOWED_CLIENTS || 'http://localhost:5173').replace(/\/$/, '');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // Simple mock login response
    const { email, password } = req.body;

    console.log('Processing test login for:', email);

    if (email && password) {
        try {
            // Create a mock user ID that's a valid ObjectId (24 hex chars)
            // Instead of using base64 encoding which causes MongoDB validation issues
            const mockUserId = '123456789012345678901234';

            // Create a more realistic token with proper user data
            const token = jwt.sign(
                { id: mockUserId, name: email.split('@')[0], email: email },
                process.env.JWT_SECRET || 'fileforge_jwt_secret',
                { expiresIn: '1d' }
            );

            console.log('Generated mock token for test user:', email);
            console.log('Token preview:', token.substring(0, 20) + '...');

            // Return the token and user data
            return res.status(200).json({
                success: true,
                token: token,
                user: {
                    id: mockUserId,
                    name: email.split('@')[0],
                    email: email,
                    profilePic: null
                }
            });
        } catch (error) {
            console.error('Error generating test login token:', error);
            return res.status(500).json({
                success: false,
                error: 'Server error while generating token'
            });
        }
    } else {
        return res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }
});
*/

app.use('/api/files', require('./routes/files'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/profile', require('./routes/profile'));

// Add web routes for non-API access
app.use('/auth', require('./routes/auth'));

// Add a debug route to test API accessibility
app.get('/api/test', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        success: true,
        message: 'API is accessible',
        origin: req.headers.origin || 'No origin header',
        allowedOrigins: corsOptions.origin instanceof Function ?
            ['Using function-based origin validation'] :
            corsOptions.origin
    });
});

// Add a CORS test route specifically for file uploads
app.post('/api/test-cors', (req, res) => {
    console.log('CORS test route hit');
    console.log('Origin:', req.headers.origin);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Authorization:', req.headers.authorization ? 'Present' : 'Not present');

    res.setHeader('Content-Type', 'application/json');
    res.json({
        success: true,
        message: 'CORS test successful',
        origin: req.headers.origin || 'No origin header',
        headers: {
            'content-type': req.headers['content-type'],
            'authorization': req.headers.authorization ? 'Present' : 'Not present',
            'user-agent': req.headers['user-agent']
        },
        corsAllowed: true
    });
});

// Deployment verification endpoint
app.get('/api/deployment-info', (req, res) => {
    const deploymentInfo = {
        timestamp: new Date().toISOString(),
        corsFixVersion: '2.0',
        environment: process.env.NODE_ENV || 'unknown',
        allowedClients: process.env.ALLOWED_CLIENTS || 'not set',
        origin: req.headers.origin || 'no origin',
        corsMiddlewareActive: true,
        universalCorsActive: true,
        fileUploadCorsActive: true
    };

    console.log('Deployment info requested:', deploymentInfo);

    res.setHeader('Content-Type', 'application/json');
    res.json(deploymentInfo);
});

// Serve static files AFTER API routes to prevent conflicts
app.use(express.static(path.join(__dirname, 'public'), {
    index: false,
    extensions: ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'ico']
}));

// Serve the uploads directory for profile pictures and uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '1d', // Cache files for 1 day
    etag: true,   // Use ETags for caching
    lastModified: true,
    immutable: false // Allow content to be updated
}));

// Set up EJS for the download page
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

// File download page route - shows a page with download button
app.get('/files/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;
        const File = require('./models/file');

        console.log(`Processing file page request for UUID: ${uuid}`);
        const file = await File.findOne({ uuid });

        if (!file) {
            console.log(`File not found for UUID: ${uuid}`);
            return res.status(404).render('download', {
                error: 'File not found or link has expired.',
                uuid: null,
                fileName: null,
                fileSize: null,
                downloadLink: null
            });
        }

        // Check if file exists on filesystem
        const fs = require('fs');
        if (!fs.existsSync(file.path)) {
            console.log(`File not found on disk: ${file.path}`);
            return res.status(404).render('download', {
                error: 'File not found on server.',
                uuid: null,
                fileName: null,
                fileSize: null,
                downloadLink: null
            });
        }

        // Format the file size for display
        const formatBytes = (bytes, decimals = 2) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        };

        console.log(`Rendering download page for: ${file.originalName || file.filename}`);
        return res.render('download', {
            error: null,
            uuid: file.uuid,
            fileName: file.originalName || file.filename,
            fileSize: formatBytes(file.size),
            downloadLink: `${process.env.APP_BASE_URL}/files/download/${file.uuid}`
        });
    } catch (error) {
        console.error('Download page error:', error);
        return res.status(500).render('download', {
            error: 'Something went wrong.',
            uuid: null,
            fileName: null,
            fileSize: null,
            downloadLink: null
        });
    }
});

// Direct file download route
app.get('/files/download/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;
        const File = require('./models/file');

        console.log(`Processing direct file download for UUID: ${uuid}`);
        const file = await File.findOne({ uuid });

        if (!file) {
            console.log(`File not found for download UUID: ${uuid}`);
            return res.status(404).send('File not found');
        }

        // Check if file exists on filesystem
        const fs = require('fs');
        if (!fs.existsSync(file.path)) {
            console.log(`File not found on disk for download: ${file.path}`);
            return res.status(404).send('File not found on disk');
        }

        console.log(`Serving file download: ${file.originalName || file.filename}`);
        return res.download(file.path, file.originalName || file.filename);
    } catch (error) {
        console.error('Direct download error:', error);
        return res.status(500).send('Error downloading file');
    }
});

// In development, serve React app from Vite dev server
// In production, serve the built React app
if (process.env.NODE_ENV === 'production') {
    // Serve static files from React build folder
    app.use(express.static(path.join(__dirname, '../frontend/dist')));

    // For any route that doesn't match the API routes, serve the React app
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
}

// Start server
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    console.log(`Frontend URL: ${process.env.ALLOWED_CLIENTS}`);
    console.log(`Backend URL: ${process.env.APP_BASE_URL}`);
});
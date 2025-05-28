const router = require('express').Router();
const passport = require('passport');
const User = require('../models/User');
const { ensureGuest, ensureAuthenticated, ensureApiAuth } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const path = require('path');

// @route   GET /auth/register
// @desc    Render registration form
// @access  Public (guest only)
router.get('/register', ensureGuest, (req, res) => {
    // Get returnTo parameter or set default
    const returnTo = req.query.returnTo || '/dashboard';

    res.render('auth/register', {
        title: 'Register - FileForge',
        returnTo: returnTo,
        layout: 'layouts/auth',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg'),
        error: req.flash('error')
    });
});

// @route   POST /auth/register
// @desc    Process registration (Web form submission and API)
// @access  Public (guest only for web, public for API)
router.post('/register', async (req, res) => {
    // Check if this is an API request (JSON content-type or Accept header)
    const isApiRequest = req.headers['content-type']?.includes('application/json') ||
                        req.headers['accept']?.includes('application/json') ||
                        req.originalUrl.startsWith('/api/');

    if (isApiRequest) {
        // Handle API registration request
        try {
            // Set the content type explicitly to ensure JSON response
            res.setHeader('Content-Type', 'application/json');

            const { name, email, password, confirmPassword } = req.body;

            console.log('API Registration request for:', email);

            // Validation
            if (!name || !email || !password || !confirmPassword) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            if (password !== confirmPassword) {
                return res.status(400).json({ error: 'Passwords do not match' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            // Check if email exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Email is already registered' });
            }

            // Create new user
            const newUser = new User({
                name,
                email,
                password
            });

            await newUser.save();

            console.log('API Registration successful for:', email);

            res.status(201).json({
                success: true,
                message: 'You are now registered. Please log in.'
            });
        } catch (error) {
            console.error('API Registration error:', error);
            res.status(500).json({ error: 'An error occurred during registration' });
        }
    } else {
        // Handle web form registration request
        // Apply ensureGuest middleware for web requests only
        if (req.isAuthenticated && req.isAuthenticated()) {
            return res.redirect('/dashboard');
        }

        try {
            const { name, email, password, confirmPassword, returnTo } = req.body;
            const redirectUrl = returnTo || '/dashboard';

            // Validation
            let errors = [];

            if (!name || !email || !password || !confirmPassword) {
                errors.push({ msg: 'All fields are required' });
            }

            if (password !== confirmPassword) {
                errors.push({ msg: 'Passwords do not match' });
            }

            if (password.length < 6) {
                errors.push({ msg: 'Password must be at least 6 characters' });
            }

            // Check if email exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                errors.push({ msg: 'Email is already registered' });
            }

            if (errors.length > 0) {
                return res.render('auth/register', {
                    title: 'Register - FileForge',
                    errors,
                    name,
                    email,
                    returnTo: redirectUrl,
                    layout: 'layouts/auth',
                    success_msg: req.flash('success_msg'),
                    error_msg: req.flash('error_msg'),
                    error: req.flash('error')
                });
            }

            // Create new user
            const newUser = new User({
                name,
                email,
                password
            });

            await newUser.save();

            req.flash('success_msg', 'You are now registered. Please log in.');
            res.redirect(`/auth/login?returnTo=${encodeURIComponent(redirectUrl)}`);
        } catch (error) {
            console.error('Registration error:', error);
            req.flash('error_msg', 'An error occurred during registration');
            res.redirect('/auth/register');
        }
    }
});

// @route   GET /auth/login
// @desc    Render login form
// @access  Public (guest only)
router.get('/login', ensureGuest, (req, res) => {
    try {
        // Get returnTo parameter or set default
        const returnTo = req.query.returnTo || '/dashboard';

        res.render('auth/login', {
            title: 'Login - FileForge',
            returnTo: returnTo,
            layout: 'layouts/auth',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
            error: req.flash('error')
        });
    } catch (error) {
        console.error('Login page error:', error);
        res.status(500).send('Error loading login page');
    }
});

// @route   POST /auth/login
// @desc    Process login (Web form submission)
// @access  Public (guest only)
router.post('/login', (req, res, next) => {
    // Check if this is an API request (JSON content-type or Accept header)
    const isApiRequest = req.headers['content-type']?.includes('application/json') ||
                        req.headers['accept']?.includes('application/json') ||
                        req.originalUrl.startsWith('/api/');

    if (isApiRequest) {
        // Handle API login request
        console.log('API login route hit with body:', JSON.stringify(req.body));

        // Ensure the content-type header is set for the response
        res.setHeader('Content-Type', 'application/json');

        // Use passport authenticate method that doesn't automatically redirect
        passport.authenticate('local', (err, user, info) => {
            if (err) {
                console.error('Passport auth error:', err);
                return res.status(500).json({ error: 'Authentication error' });
            }

            if (!user) {
                console.log('Authentication failed:', info.message || 'Invalid credentials');
                return res.status(401).json({ error: info.message || 'Invalid credentials' });
            }

            // Create a new session without redirecting
            req.login(user, { session: true }, (err) => {
                if (err) {
                    console.error('Session creation error:', err);
                    return res.status(500).json({ error: 'Session error' });
                }

                // Create JWT token with consistent field naming
                const token = jwt.sign(
                    {
                        id: user._id.toString(),
                        userId: user._id.toString(),
                        name: user.name,
                        email: user.email
                    },
                    process.env.JWT_SECRET || 'fileforge_jwt_secret',
                    { expiresIn: '1d' }
                );

                // Ensure CORS headers are properly set
                res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
                res.header('Access-Control-Allow-Credentials', 'true');
                res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');

                // Explicitly set content-type to application/json
                res.header('Content-Type', 'application/json');

                console.log('Authentication successful for user:', user.email);

                // IMPORTANT: Don't redirect, just return JSON
                return res.status(200).json({
                    success: true,
                    token,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        profilePic: user.profilePic || null
                    }
                });
            });
        })(req, res, next);
    } else {
        // Handle web form login request
        const returnTo = req.body.returnTo || '/dashboard';

        passport.authenticate('local', {
            successRedirect: returnTo,
            failureRedirect: `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
            failureFlash: true
        })(req, res, next);
    }
});

// @route   GET /auth/logout
// @desc    Logout user
// @access  Private
router.get('/logout', ensureAuthenticated, (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        req.flash('success_msg', 'You are logged out');
        res.redirect('/');
    });
});





// @route   GET /api/auth/user
// @desc    Get current user
// @access  Private
router.get('/user', ensureApiAuth, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        profilePic: req.user.profilePic || null
    });
});

// @route   PUT /api/auth/user
// @desc    Update user profile
// @access  Private
router.put('/user', ensureApiAuth, async (req, res) => {
    try {
        // Check if this is a FormData request with file upload
        const isFormData = req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data');
        let profilePicUrl = null;

        // Handle profile picture upload if this is a form submission
        if (isFormData && req.files && req.files.profilePic) {
            // ALTERNATIVE IMPLEMENTATION: Store profile pictures in a cloud storage service
            // Benefits:
            // 1. Scalability - Cloud services can handle large files and high traffic
            // 2. Reliability - Data redundancy and high availability
            // 3. CDN Integration - Faster image loading globally
            // 4. Storage Management - No need to worry about local disk space
            //
            // Example using AWS S3:
            // 1. Install the AWS SDK: npm install aws-sdk
            // 2. Configure with your credentials
            // 3. Upload the file to S3 bucket
            // 4. Store the S3 URL in the database
            //
            // const AWS = require('aws-sdk');
            // const s3 = new AWS.S3({
            //     accessKeyId: process.env.AWS_ACCESS_KEY,
            //     secretAccessKey: process.env.AWS_SECRET_KEY
            // });
            // const params = {
            //     Bucket: process.env.S3_BUCKET_NAME,
            //     Key: `profile-${req.user._id}-${Date.now()}${path.extname(profilePic.name)}`,
            //     Body: profilePic.data,
            //     ContentType: profilePic.mimetype
            // };
            // const s3Response = await s3.upload(params).promise();
            // profilePicUrl = s3Response.Location;

            const profilePic = req.files.profilePic;

            // Generate a unique filename to prevent conflicts
            const fs = require('fs');
            const crypto = require('crypto');
            const randomHash = crypto.randomBytes(8).toString('hex');
            const fileName = `profile-${req.user._id}-${randomHash}${path.extname(profilePic.name)}`;

            // Create uploads directory if it doesn't exist
            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const uploadPath = path.join(uploadsDir, fileName);

            // Move the uploaded file to our uploads directory
            await profilePic.mv(uploadPath);

            // Create a URL for the profile picture with cache-busting query param
            profilePicUrl = `/uploads/${fileName}?t=${Date.now()}`;
            console.log(`Profile picture uploaded to: ${profilePicUrl}`);
        }

        // Get form data or JSON data
        const { name, email, currentPassword, newPassword } = req.body;

        // Find the user and include password field if password update is requested
        let user;
        if (newPassword && currentPassword) {
            // Include password field for password verification
            user = await User.findById(req.user._id).select('+password');
        } else {
            // Regular user lookup without password field
            user = await User.findById(req.user._id);
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update basic info
        if (name) user.name = name;
        if (email && email !== user.email) {
            // Check if email is already in use
            const existingUser = await User.findOne({ email });
            if (existingUser && existingUser._id.toString() !== user._id.toString()) {
                return res.status(400).json({ error: 'Email already in use' });
            }
            user.email = email;
        }

        // Update profile picture URL if uploaded
        if (profilePicUrl) {
            user.profilePic = profilePicUrl;
        }

        // Update password if provided
        if (newPassword && currentPassword) {
            // Verify current password
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }

            user.password = newPassword;
        }

        await user.save();

        res.setHeader('Content-Type', 'application/json');
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePic: user.profilePic || null
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', ensureApiAuth, (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.json({ success: true, message: 'You are logged out' });
    });
});

module.exports = router;
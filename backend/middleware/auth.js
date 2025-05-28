const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware for web routes
exports.ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    // If not authenticated, redirect to login
    res.redirect('/auth/login');
};

// Guest middleware (only for non-authenticated users)
exports.ensureGuest = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return next();
    }
    // If authenticated, redirect to dashboard
    res.redirect('/dashboard');
};

// API authentication middleware
exports.ensureApiAuth = async (req, res, next) => {
    // Set headers for better CORS handling
    res.setHeader('Content-Type', 'application/json');

    // Check for session authentication first
    if (req.isAuthenticated()) {
        console.log('User authenticated via session');
        return next();
    }

    // Then check for JWT token
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        console.log('Auth failed: No Authorization header');
        return res.status(401).json({ error: 'No authorization header, authentication required' });
    }

    // Check if token format is correct
    if (!authHeader.startsWith('Bearer ')) {
        console.log('Auth failed: Invalid Authorization format');
        return res.status(401).json({ error: 'Invalid token format. Authorization header must start with "Bearer "' });
    }

    try {
        // Extract token (remove 'Bearer ' prefix)
        const token = authHeader.split(' ')[1];

        if (!token || token === 'undefined' || token === 'null') {
            console.log('Auth failed: Empty or invalid token');
            return res.status(401).json({ error: 'Invalid token provided' });
        }

        // Special case for test tokens - Disabled in production
        /*
        if (token === 'test-token-123456') {
            console.log('Using test token authentication');
            // Create a mock user for test token
            req.user = {
                _id: '123456789012345678901234',
                name: 'Test User',
                email: 'test@example.com'
            };
            return next();
        }
        */

        console.log('Verifying token...');

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fileforge_jwt_secret');
        console.log('Token verified successfully');
        console.log('Decoded token data:', {
            id: decoded.id,
            userId: decoded.userId,
            email: decoded.email,
            name: decoded.name
        });

        // Use async/await for cleaner error handling
        const findUser = async () => {
            try {
                // Try to find user by ID first (use either id or userId from token)
                const userId = decoded.id || decoded.userId;

                if (!userId) {
                    console.log('Auth failed: No user ID in token');
                    return res.status(401).json({ error: 'Invalid token: missing user ID' });
                }

                console.log('Looking up user by ID:', userId);
                let user = await User.findById(userId);

                if (user) {
                    console.log('User found by ID:', user.email);
                    req.user = user;
                    return next();
                }

                // If not found by ID and we have email, try email lookup
                if (decoded.email) {
                    console.log('User not found by ID, trying email lookup:', decoded.email);
                    user = await User.findOne({ email: decoded.email });

                    if (user) {
                        console.log('User found by email:', user.email);
                        req.user = user;
                        return next();
                    }
                }

                console.log('Auth failed: User not found in database');
                console.log('Searched for ID:', userId, 'and email:', decoded.email);
                return res.status(401).json({
                    error: 'User not found',
                    details: 'The user associated with this token no longer exists'
                });

            } catch (dbError) {
                console.error('Database error during user lookup:', dbError);
                return res.status(500).json({
                    error: 'Database error',
                    details: 'Unable to verify user credentials'
                });
            }
        };

        // Execute the user lookup
        await findUser();
    } catch (err) {
        console.error('Token verification error:', err);

        // Provide better error messages based on the type of error
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        } else if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token has expired' });
        } else {
            res.status(401).json({ error: 'Authentication failed' });
        }
    }
};
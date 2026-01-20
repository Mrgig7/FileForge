/**
 * Secure Auth Routes (v2)
 * 
 * Production-grade authentication with:
 * - Short-lived access tokens (JWT)
 * - Long-lived refresh tokens (httpOnly cookies)
 * - Token rotation with reuse detection
 * - Rate limiting on login/refresh
 * 
 * Threat Model Protections:
 * - XSS: Refresh token in httpOnly cookie (not accessible by JavaScript)
 * - CSRF: SameSite=Strict + origin validation
 * - Brute force: Rate limiting with exponential backoff
 * - Token theft: Short access token lifetime + rotation + reuse detection
 */

const router = require('express').Router();
const passport = require('passport');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const { loginRateLimiter, authLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  getUserSessions,
  getRefreshTokenCookieOptions
} = require('../services/tokenService');
const {
  loginCaptchaMiddleware,
  trackFailedAttempt,
  resetAttempts,
  getMCaptcha
} = require('../services/mcaptcha');

/**
 * @route   POST /api/auth/v2/register
 * @desc    Register a new user
 * @access  Public
 * 
 * @body    {
 *            name: string (required)
 *            email: string (required)
 *            password: string (required, min 6 chars)
 *          }
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }
    
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if user exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists'
      });
    }
    
    // Create user (password hashed by pre-save hook)
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'USER'
    });
    
    await user.save();
    
    // Audit log
    await AuditLog.logFromRequest(req, 'auth.register', {
      userId: user._id,
      metadata: { email: normalizedEmail }
    });
    
    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please log in.'
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/v2/login
 * @desc    Authenticate user, return access token and set refresh cookie
 * @access  Public (rate limited, CAPTCHA after N failures)
 * 
 * @body    { email: string, password: string, captchaToken?: string }
 * @returns { success, accessToken, user: { id, name, email, role } }
 * @cookie  refreshToken (httpOnly, secure)
 * 
 * Security: CAPTCHA required after 5 failed attempts from same IP+email
 */
router.post('/login', loginRateLimiter, ...loginCaptchaMiddleware(), async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Find user with password for comparison
    const user = await User.findOne({ 
      email: email.toLowerCase().trim() 
    }).select('+password');
    
    if (!user) {
      // Track failed attempt
      await trackFailedAttempt(email, ip);
      
      // Timing-safe: don't reveal if email exists
      await AuditLog.logFromRequest(req, 'auth.login_failed', {
        metadata: { email: email.toLowerCase() },
        success: false,
        errorMessage: 'User not found'
      });
      
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Track failed attempt
      await trackFailedAttempt(email, ip);
      
      await AuditLog.logFromRequest(req, 'auth.login_failed', {
        userId: user._id,
        success: false,
        errorMessage: 'Invalid password'
      });
      
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Reset attempt counter on successful login
    await resetAttempts(email, ip);
    
    // Get client info for token metadata
    const userAgent = req.headers['user-agent'];
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshTokenData = await generateRefreshToken(user, { ip, userAgent });
    
    // Set refresh token cookie
    res.cookie('refreshToken', refreshTokenData.token, getRefreshTokenCookieOptions());
    
    // Audit log
    await AuditLog.logFromRequest(req, 'auth.login', {
      userId: user._id,
      metadata: { familyId: refreshTokenData.familyId }
    });
    
    return res.json({
      success: true,
      accessToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'USER',
        profilePic: user.profilePic
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/v2/refresh
 * @desc    Refresh access token using refresh token from cookie
 * @access  Public (cookie required, rate limited)
 * 
 * Security: Implements token rotation - old token invalidated, new token issued
 * If old token is reused (replay attack), entire session family is revoked
 */
router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token not found',
        code: 'NO_REFRESH_TOKEN'
      });
    }
    
    // Get client info
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
    const userAgent = req.headers['user-agent'];
    
    // Rotate token
    const result = await rotateRefreshToken(refreshToken, { ip, userAgent });
    
    // Handle errors
    if (result.error) {
      // Clear invalid cookie
      res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
      
      const statusCodes = {
        'invalid_token': 401,
        'token_expired': 401,
        'token_reuse': 401,
        'user_not_found': 401
      };
      
      return res.status(statusCodes[result.error] || 401).json({
        success: false,
        error: result.message,
        code: result.error.toUpperCase()
      });
    }
    
    // Set new refresh token cookie
    res.cookie('refreshToken', result.refreshToken, getRefreshTokenCookieOptions());
    
    // Audit log
    await AuditLog.logFromRequest(req, 'auth.token_refresh', {
      userId: result.user.id,
      success: true
    });
    
    return res.json({
      success: true,
      accessToken: result.accessToken,
      expiresIn: 15 * 60,
      user: result.user
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

/**
 * @route   POST /api/auth/v2/logout
 * @desc    Logout current session (revoke current refresh token)
 * @access  Public (cookie required)
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (refreshToken) {
      await revokeRefreshToken(refreshToken, 'logout');
      
      // Best effort audit log
      try {
        const { verifyAccessToken } = require('../services/tokenService');
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const decoded = verifyAccessToken(authHeader.split(' ')[1]);
          await AuditLog.log({
            action: 'auth.logout',
            userId: decoded.sub
          });
        }
      } catch (e) {
        // Token might be expired, that's okay for logout
      }
    }
    
    // Clear cookie
    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
    
    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookie even on error
    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
    
    return res.json({
      success: true,
      message: 'Logged out'
    });
  }
});

/**
 * @route   POST /api/auth/v2/logout-all
 * @desc    Logout from all devices (revoke all refresh tokens)
 * @access  Private (requires valid access token)
 */
router.post('/logout-all', ensureApiAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Revoke all tokens
    await revokeAllUserTokens(userId, 'logout_all');
    
    // Clear current cookie
    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
    
    // Audit log
    await AuditLog.logFromRequest(req, 'auth.logout_all', {
      userId
    });
    
    return res.json({
      success: true,
      message: 'Logged out from all devices'
    });
    
  } catch (error) {
    console.error('Logout all error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to logout from all devices'
    });
  }
});

/**
 * @route   GET /api/auth/v2/sessions
 * @desc    Get all active sessions for current user
 * @access  Private
 */
router.get('/sessions', ensureApiAuth, async (req, res) => {
  try {
    const sessions = await getUserSessions(req.user._id);
    
    return res.json({
      success: true,
      sessions
    });
    
  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get sessions'
    });
  }
});

/**
 * @route   GET /api/auth/v2/me
 * @desc    Get current user info from access token
 * @access  Private
 */
router.get('/me', ensureApiAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'USER',
        profilePic: user.profilePic,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        createdAt: user.createdAt
      }
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user info'
    });
  }
});

module.exports = router;

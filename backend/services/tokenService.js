/**
 * Token Service
 * 
 * Handles access token and refresh token generation, validation, and rotation.
 * 
 * Security Design:
 * - Access tokens: Short-lived JWTs (15 min) - stored in memory on client
 * - Refresh tokens: Long-lived opaque tokens (7 days) - stored in httpOnly cookie
 * - Refresh token rotation: New token issued on each refresh, old invalidated
 * - Family tracking: Detects token reuse (stolen token replay)
 * 
 * Threat Model:
 * - XSS: Access tokens in memory (not localStorage), refresh in httpOnly cookie
 * - CSRF: SameSite=Strict cookie + CORS
 * - Token theft: Short access token lifetime + rotation + reuse detection
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const AuditLog = require('../models/AuditLog');

// Configuration (use environment variables)
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'fileforge_jwt_secret';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);

/**
 * Generate an access token (JWT)
 * Contains minimal claims to reduce token size and information exposure
 */
function generateAccessToken(user) {
  const payload = {
    sub: user._id.toString(),      // Subject (user ID)
    email: user.email,
    role: user.role || 'USER',
    type: 'access'
  };
  
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'fileforge',
    audience: 'fileforge-api'
  });
}

/**
 * Verify an access token
 * Returns decoded payload or throws error
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET, {
    issuer: 'fileforge',
    audience: 'fileforge-api'
  });
}

/**
 * Generate a new refresh token and store in database
 * 
 * @param {Object} user - User document
 * @param {Object} options - Additional options (ip, userAgent, familyId for rotation)
 * @returns {Object} { token, expiresAt }
 */
async function generateRefreshToken(user, options = {}) {
  const { ip, userAgent, familyId = null } = options;
  
  // Generate cryptographically secure random token
  const rawToken = RefreshToken.generateToken();
  
  // Hash it for storage
  const tokenHash = RefreshToken.hashToken(rawToken);
  
  // Generate or use existing family ID
  const tokenFamilyId = familyId || crypto.randomUUID();
  
  // Calculate expiry
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  // Store in database
  const refreshToken = new RefreshToken({
    userId: user._id,
    tokenHash,
    familyId: tokenFamilyId,
    expiresAt,
    ip: ip || null,
    userAgent: userAgent || null
  });
  
  await refreshToken.save();
  
  return {
    token: rawToken,           // Raw token to send to client
    expiresAt,
    familyId: tokenFamilyId
  };
}

/**
 * Rotate a refresh token
 * Invalidates old token, issues new one in same family
 * 
 * Security: If a token is reused after rotation, entire family is revoked
 * (indicates token theft - attacker and victim both have copies)
 * 
 * @param {string} oldRawToken - The current refresh token
 * @param {Object} options - ip, userAgent for new token
 * @returns {Object} { accessToken, refreshToken, expiresAt } or null if invalid
 */
async function rotateRefreshToken(oldRawToken, options = {}) {
  const { ip, userAgent } = options;
  
  // Find the token
  const oldTokenHash = RefreshToken.hashToken(oldRawToken);
  const oldToken = await RefreshToken.findOne({ tokenHash: oldTokenHash });
  
  // Token not found
  if (!oldToken) {
    return { error: 'invalid_token', message: 'Refresh token not found' };
  }
  
  // Token already revoked - SECURITY ALERT: potential token reuse!
  if (oldToken.revokedAt) {
    // Revoke entire family to protect against token theft
    await RefreshToken.revokeFamily(oldToken.familyId, 'token_reuse');
    
    // Log security event
    await AuditLog.log({
      action: 'auth.token_reuse_detected',
      userId: oldToken.userId,
      ip,
      userAgent,
      metadata: {
        familyId: oldToken.familyId,
        originalRevokedAt: oldToken.revokedAt,
        originalRevokedReason: oldToken.revokedReason
      },
      success: false,
      errorMessage: 'Refresh token reuse detected - family revoked'
    });
    
    return { error: 'token_reuse', message: 'Token reuse detected. All sessions revoked for security.' };
  }
  
  // Token expired
  if (new Date() > oldToken.expiresAt) {
    await oldToken.revoke('expired');
    return { error: 'token_expired', message: 'Refresh token has expired' };
  }
  
  // Get user for new tokens
  const User = require('../models/User');
  const user = await User.findById(oldToken.userId);
  
  if (!user) {
    await oldToken.revoke('logout');
    return { error: 'user_not_found', message: 'User no longer exists' };
  }
  
  // Generate new refresh token in same family
  const newRefreshToken = await generateRefreshToken(user, {
    ip,
    userAgent,
    familyId: oldToken.familyId  // Keep same family for tracking
  });
  
  // Mark old token as replaced
  oldToken.revokedAt = new Date();
  oldToken.revokedReason = 'logout';  // Normal rotation
  oldToken.replacedByTokenHash = RefreshToken.hashToken(newRefreshToken.token);
  await oldToken.save();
  
  // Update last used timestamp on new token
  await RefreshToken.findOneAndUpdate(
    { tokenHash: RefreshToken.hashToken(newRefreshToken.token) },
    { lastUsedAt: new Date() }
  );
  
  // Generate new access token
  const accessToken = generateAccessToken(user);
  
  return {
    accessToken,
    refreshToken: newRefreshToken.token,
    expiresAt: newRefreshToken.expiresAt,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role || 'USER'
    }
  };
}

/**
 * Revoke a specific refresh token (logout)
 */
async function revokeRefreshToken(rawToken, reason = 'logout') {
  const token = await RefreshToken.findByToken(rawToken);
  if (token) {
    await token.revoke(reason);
    return true;
  }
  return false;
}

/**
 * Revoke all refresh tokens for a user (logout all devices)
 */
async function revokeAllUserTokens(userId, reason = 'logout_all') {
  return RefreshToken.revokeAllForUser(userId, reason);
}

/**
 * Get all active sessions for a user
 */
async function getUserSessions(userId) {
  const tokens = await RefreshToken.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }).select('createdAt lastUsedAt ip userAgent familyId');
  
  return tokens.map(t => ({
    id: t._id,
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt,
    ip: t.ip,
    userAgent: t.userAgent,
    familyId: t.familyId
  }));
}

/**
 * Get cookie configuration for refresh token
 * 
 * Security settings:
 * - httpOnly: Prevents XSS access to cookie
 * - secure: HTTPS only in production
 * - sameSite: 'Strict' prevents CSRF (cookie only sent for same-site requests)
 * - path: Restrict to /api/auth/refresh to minimize exposure
 */
function getRefreshTokenCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,                              // Prevents XSS access
    secure: isProduction,                        // HTTPS only in production
    sameSite: 'Strict',                          // Strict CSRF protection
    path: '/api/auth',                           // Only sent to auth endpoints
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // Matches token expiry
    // domain: not set, defaults to current domain (more secure)
  };
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  getUserSessions,
  getRefreshTokenCookieOptions,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS
};

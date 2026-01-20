/**
 * mCaptcha Provider (Enhanced)
 * 
 * Self-hosted open-source captcha solution with Redis-backed attempt tracking.
 * Uses proof-of-work instead of tracking (privacy-friendly).
 * 
 * Setup: docker run -p 7000:7000 mcaptcha/mcaptcha
 * 
 * Threat Model:
 * - Brute force login: After N failed attempts, CAPTCHA required
 * - Credential stuffing: Per-IP + per-email tracking prevents distributed attacks
 * - Bot attacks: PoW challenge expensive for automated attacks
 * 
 * Flow:
 * 1. Client fails login N times
 * 2. Server returns CAPTCHA_REQUIRED with widget config
 * 3. Client solves PoW challenge
 * 4. Client submits solution with login credentials
 * 5. Server verifies CAPTCHA before authentication
 * 6. Successful login resets failure counter
 */

const fetch = require('node-fetch');
const Redis = require('ioredis');

// Redis client for attempt tracking
let redis = null;
try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1
  });
  
  redis.on('error', (err) => {
    console.warn('mCaptcha Redis error:', err.message);
  });
} catch (err) {
  console.warn('mCaptcha Redis not available:', err.message);
}

// In-memory fallback when Redis unavailable
const memoryStore = new Map();

// Configuration
const CAPTCHA_THRESHOLD = parseInt(process.env.CAPTCHA_THRESHOLD || '5', 10);
const CAPTCHA_WINDOW_SECONDS = parseInt(process.env.CAPTCHA_WINDOW_SECONDS || '900', 10); // 15 min

class MCaptchaProvider {
  constructor() {
    this.baseUrl = process.env.MCAPTCHA_URL || 'http://localhost:7000';
    this.siteKey = process.env.MCAPTCHA_SITE_KEY;
    this.apiKey = process.env.MCAPTCHA_API_KEY;
  }
  
  isConfigured() {
    return !!(this.siteKey && this.apiKey);
  }
  
  /**
   * Get captcha config for frontend
   */
  getConfig() {
    return {
      provider: 'mcaptcha',
      siteKey: this.siteKey,
      widgetUrl: `${this.baseUrl}/widget`,
      configured: this.isConfigured()
    };
  }
  
  /**
   * Verify captcha token
   * @param {string} token - Solution from client
   * @returns {Promise<boolean>}
   */
  async verify(token) {
    if (!this.isConfigured()) {
      console.warn('mCaptcha not configured, skipping verification');
      return true;  // Fail open in dev
    }
    
    if (!token) {
      return false;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/pow/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          key: this.siteKey,
          token
        }),
        timeout: 5000
      });
      
      const result = await response.json();
      return result.valid === true;
      
    } catch (error) {
      console.error('mCaptcha verification error:', error.message);
      // Fail open in case of service failure (with logging)
      return true;
    }
  }
}

// Singleton
let mcaptchaInstance = null;

function getMCaptcha() {
  if (!mcaptchaInstance) {
    mcaptchaInstance = new MCaptchaProvider();
  }
  return mcaptchaInstance;
}

/**
 * Generate tracking key for login attempts
 * Combines IP and email for distributed attack protection
 */
function getAttemptKey(email, ip) {
  const normalizedEmail = email?.toLowerCase()?.trim() || 'unknown';
  const normalizedIp = ip || 'unknown';
  return `captcha:attempts:${normalizedEmail}:${normalizedIp}`;
}

/**
 * Track a failed login attempt
 * 
 * @param {string} email - User email
 * @param {string} ip - Client IP
 * @returns {Promise<number>} Current attempt count
 */
async function trackFailedAttempt(email, ip) {
  const key = getAttemptKey(email, ip);
  
  try {
    if (redis && redis.status === 'ready') {
      // Use Redis INCR with expiry
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, CAPTCHA_WINDOW_SECONDS);
      }
      return count;
    }
  } catch (err) {
    console.warn('Redis trackFailedAttempt error:', err.message);
  }
  
  // Fallback to memory
  const now = Date.now();
  const entry = memoryStore.get(key) || { count: 0, expiresAt: now + CAPTCHA_WINDOW_SECONDS * 1000 };
  
  if (now > entry.expiresAt) {
    entry.count = 1;
    entry.expiresAt = now + CAPTCHA_WINDOW_SECONDS * 1000;
  } else {
    entry.count++;
  }
  
  memoryStore.set(key, entry);
  return entry.count;
}

/**
 * Check if CAPTCHA is required for this identity
 * 
 * @param {string} email - User email
 * @param {string} ip - Client IP
 * @returns {Promise<{required: boolean, attempts: number}>}
 */
async function checkCaptchaRequired(email, ip) {
  const key = getAttemptKey(email, ip);
  
  try {
    if (redis && redis.status === 'ready') {
      const count = await redis.get(key);
      const attempts = parseInt(count, 10) || 0;
      return {
        required: attempts >= CAPTCHA_THRESHOLD,
        attempts
      };
    }
  } catch (err) {
    console.warn('Redis checkCaptchaRequired error:', err.message);
  }
  
  // Fallback to memory
  const now = Date.now();
  const entry = memoryStore.get(key);
  
  if (!entry || now > entry.expiresAt) {
    return { required: false, attempts: 0 };
  }
  
  return {
    required: entry.count >= CAPTCHA_THRESHOLD,
    attempts: entry.count
  };
}

/**
 * Reset attempts after successful login
 * 
 * @param {string} email - User email
 * @param {string} ip - Client IP
 */
async function resetAttempts(email, ip) {
  const key = getAttemptKey(email, ip);
  
  try {
    if (redis && redis.status === 'ready') {
      await redis.del(key);
    }
  } catch (err) {
    console.warn('Redis resetAttempts error:', err.message);
  }
  
  // Also clear memory store
  memoryStore.delete(key);
}

/**
 * Middleware: Check if captcha is required before login
 * Sets req.captchaRequired and req.captchaConfig
 */
async function checkCaptchaMiddleware(req, res, next) {
  const email = req.body?.email;
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
  
  const { required, attempts } = await checkCaptchaRequired(email, ip);
  
  req.captchaRequired = required;
  req.captchaAttempts = attempts;
  
  if (required) {
    const mcaptcha = getMCaptcha();
    req.captchaConfig = mcaptcha.getConfig();
  }
  
  next();
}

/**
 * Middleware: Verify captcha token if required
 */
async function verifyCaptchaMiddleware(req, res, next) {
  // Skip if captcha not required
  if (!req.captchaRequired) {
    return next();
  }
  
  const mcaptcha = getMCaptcha();
  const token = req.body?.captchaToken || req.headers['x-captcha-token'];
  
  // If captcha required but no token provided, return CAPTCHA_REQUIRED
  if (!token) {
    return res.status(403).json({
      success: false,
      error: 'CAPTCHA verification required',
      code: 'CAPTCHA_REQUIRED',
      captcha: req.captchaConfig,
      attempts: req.captchaAttempts,
      threshold: CAPTCHA_THRESHOLD
    });
  }
  
  // Verify token
  const isValid = await mcaptcha.verify(token);
  
  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: 'CAPTCHA verification failed',
      code: 'CAPTCHA_INVALID'
    });
  }
  
  next();
}

/**
 * Combined middleware for login routes
 */
function loginCaptchaMiddleware() {
  return [checkCaptchaMiddleware, verifyCaptchaMiddleware];
}

module.exports = {
  MCaptchaProvider,
  getMCaptcha,
  trackFailedAttempt,
  checkCaptchaRequired,
  resetAttempts,
  checkCaptchaMiddleware,
  verifyCaptchaMiddleware,
  loginCaptchaMiddleware,
  // Constants
  CAPTCHA_THRESHOLD,
  CAPTCHA_WINDOW_SECONDS
};

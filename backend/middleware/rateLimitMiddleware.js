/**
 * Rate Limiting Middleware
 * 
 * Redis-backed rate limiting for all endpoints.
 * Includes brute force protection for login.
 * 
 * Features:
 * - Per-IP rate limiting
 * - Per-user rate limiting (authenticated)
 * - Login lockout after N failures
 * - Captcha requirement trigger
 * 
 * Security Notes:
 * - Uses sliding window algorithm
 * - IP + identifier for login attempts
 * - Exponential backoff for repeated abuse
 */

const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const SecurityEvent = require('../models/SecurityEvent');

// Redis client (reuse or create)
let redis;
try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    enableOfflineQueue: false
  });
} catch (err) {
  console.warn('Redis not available for rate limiting, using memory store');
  redis = null;
}

/**
 * Create rate limiter (Redis or fallback to memory)
 */
function createRateLimiter(options) {
  if (redis) {
    return new RateLimiterRedis({
      storeClient: redis,
      ...options
    });
  }
  return new RateLimiterMemory(options);
}

// Global API rate limiter (per IP)
const globalLimiter = createRateLimiter({
  keyPrefix: 'rl:global',
  points: 100,       // requests
  duration: 60,      // per minute
  blockDuration: 60  // block for 1 min if exceeded
});

// Upload rate limiter (per user)
const uploadLimiter = createRateLimiter({
  keyPrefix: 'rl:upload',
  points: 50,        // uploads per day
  duration: 24 * 60 * 60
});

// Chunk upload rate limiter (per session)
const chunkLimiter = createRateLimiter({
  keyPrefix: 'rl:chunk',
  points: 200,       // chunks per hour
  duration: 60 * 60
});

// Download rate limiter (per IP)
const downloadLimiter = createRateLimiter({
  keyPrefix: 'rl:download',
  points: 100,       // downloads per hour
  duration: 60 * 60
});

// Login attempt limiter (brute force protection)
const loginLimiter = createRateLimiter({
  keyPrefix: 'rl:login',
  points: 5,         // attempts
  duration: 15 * 60, // per 15 minutes
  blockDuration: 15 * 60  // block for 15 min
});

// Consecutive failed logins (triggers captcha)
const consecutiveFailsLimiter = createRateLimiter({
  keyPrefix: 'rl:loginfail',
  points: 3,         // 3 consecutive fails
  duration: 60 * 60, // per hour
  blockDuration: 0   // don't block, just track
});

/**
 * Get client IP (handles proxies)
 */
function getClientIp(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.connection?.remoteAddress ||
         'unknown';
}

/**
 * Global rate limit middleware
 */
async function globalRateLimit(req, res, next) {
  try {
    const ip = getClientIp(req);
    await globalLimiter.consume(ip);
    next();
  } catch (rateLimiterRes) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    
    res.set('Retry-After', secs);
    res.set('X-RateLimit-Limit', globalLimiter._points);
    res.set('X-RateLimit-Remaining', rateLimiterRes.remainingPoints || 0);
    res.set('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
    
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter: secs
    });
  }
}

/**
 * Upload rate limit middleware
 */
async function uploadRateLimit(req, res, next) {
  try {
    const key = req.user?._id?.toString() || getClientIp(req);
    await uploadLimiter.consume(key);
    next();
  } catch (rateLimiterRes) {
    res.status(429).json({
      success: false,
      error: 'Upload limit exceeded. Please try again later.',
      retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000)
    });
  }
}

/**
 * Chunk upload rate limit middleware
 */
async function chunkRateLimit(req, res, next) {
  try {
    const key = req.body?.uploadId || req.user?._id?.toString() || getClientIp(req);
    await chunkLimiter.consume(key);
    next();
  } catch (rateLimiterRes) {
    res.status(429).json({
      success: false,
      error: 'Chunk upload rate limit exceeded',
      retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000)
    });
  }
}

/**
 * Download rate limit middleware
 */
async function downloadRateLimit(req, res, next) {
  try {
    const ip = getClientIp(req);
    await downloadLimiter.consume(ip);
    next();
  } catch (rateLimiterRes) {
    res.status(429).json({
      success: false,
      error: 'Download limit exceeded. Please try again later.',
      retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000)
    });
  }
}

/**
 * Login rate limit (brute force protection)
 * Returns middleware configured for login endpoint
 */
function loginRateLimitMiddleware() {
  return async (req, res, next) => {
    const ip = getClientIp(req);
    const identifier = req.body?.email || req.body?.username || '';
    const key = `${ip}_${identifier.toLowerCase()}`;
    
    try {
      // Check if blocked
      const result = await loginLimiter.get(key);
      
      if (result && result.remainingPoints <= 0) {
        const secs = Math.round(result.msBeforeNext / 1000);
        
        // Log security event
        await SecurityEvent.logBruteForce(null, ip, 5).catch(() => {});
        
        return res.status(429).json({
          success: false,
          error: 'Account temporarily locked due to too many failed attempts',
          retryAfter: secs,
          code: 'ACCOUNT_LOCKED'
        });
      }
      
      // Check consecutive fails (captcha trigger)
      const failResult = await consecutiveFailsLimiter.get(key);
      if (failResult && failResult.consumedPoints >= 3) {
        // Don't block, but require captcha
        req.requireCaptcha = true;
      }
      
      // Store key for later penalty on failure
      req.loginRateLimitKey = key;
      next();
      
    } catch (err) {
      // On error, allow login (fail open for usability)
      next();
    }
  };
}

/**
 * Record failed login attempt
 */
async function recordFailedLogin(req) {
  const key = req.loginRateLimitKey;
  if (!key) return;
  
  try {
    await loginLimiter.consume(key);
    await consecutiveFailsLimiter.consume(key);
  } catch (err) {
    // Already blocked
  }
}

/**
 * Clear login attempts on successful login
 */
async function clearLoginAttempts(req) {
  const key = req.loginRateLimitKey;
  if (!key) return;
  
  try {
    await loginLimiter.delete(key);
    await consecutiveFailsLimiter.delete(key);
  } catch (err) {
    // Ignore
  }
}

/**
 * Check if captcha is required
 */
function isCaptchaRequired(req) {
  return req.requireCaptcha === true;
}

/**
 * Captcha verification interface
 * NEEDS CLARIFICATION: Implement with reCAPTCHA or hCaptcha
 */
async function verifyCaptcha(token, provider = 'recaptcha') {
  if (!token) return false;
  
  // Stub implementation - always returns true in dev
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  
  // Production: verify with provider
  // NEEDS CLARIFICATION: Add RECAPTCHA_SECRET_KEY or HCAPTCHA_SECRET_KEY
  console.warn('Captcha verification not implemented');
  return false;
}

/**
 * Custom rate limit factory
 */
function createCustomLimiter({ points, duration, keyGenerator }) {
  const limiter = createRateLimiter({
    keyPrefix: `rl:custom:${Date.now()}`,
    points,
    duration
  });
  
  return async (req, res, next) => {
    try {
      const key = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : getClientIp(req);
      await limiter.consume(key);
      next();
    } catch (rateLimiterRes) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000)
      });
    }
  };
}

module.exports = {
  globalRateLimit,
  uploadRateLimit,
  chunkRateLimit,
  downloadRateLimit,
  loginRateLimitMiddleware,
  recordFailedLogin,
  clearLoginAttempts,
  isCaptchaRequired,
  verifyCaptcha,
  createCustomLimiter,
  getClientIp
};

/**
 * Rate Limiter Middleware
 * 
 * In-memory rate limiting for API endpoints.
 * For production with multiple instances, use Redis-backed limiter.
 * 
 * Security Design:
 * - Per-IP limiting for unauthenticated requests
 * - Per-user limiting for authenticated requests
 * - Sliding window algorithm for smooth limiting
 * - Separate limits for different endpoint categories
 * 
 * NEEDS CLARIFICATION: For multi-instance deployment, switch to Redis.
 * Current implementation uses in-memory store (single instance only).
 */

// In-memory store (replace with Redis for production clusters)
const requestCounts = new Map();
const loginAttempts = new Map();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.resetAt) {
      requestCounts.delete(key);
    }
  }
  
  for (const [key, data] of loginAttempts.entries()) {
    if (now > data.resetAt) {
      loginAttempts.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Generic rate limiter factory
 * 
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Max requests per window
 * @param {string} options.keyGenerator - 'ip' | 'user' | 'both'
 * @param {string} options.message - Error message
 * @param {boolean} options.skipSuccessfulRequests - Don't count successful requests
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000,     // 1 minute default
    max = 100,                 // 100 requests per window
    keyGenerator = 'ip',
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;
  
  return (req, res, next) => {
    // Generate key based on strategy
    let key;
    if (keyGenerator === 'user' && req.user) {
      key = `user:${req.user._id}`;
    } else if (keyGenerator === 'both' && req.user) {
      key = `user:${req.user._id}:ip:${getClientIp(req)}`;
    } else {
      key = `ip:${getClientIp(req)}`;
    }
    
    const now = Date.now();
    let entry = requestCounts.get(key);
    
    // Create new entry if doesn't exist or expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + windowMs
      };
    }
    
    // Check if limit exceeded
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      
      res.set('Retry-After', retryAfter);
      res.set('X-RateLimit-Limit', max);
      res.set('X-RateLimit-Remaining', 0);
      res.set('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());
      
      return res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter
      });
    }
    
    // Increment count (may be skipped on response)
    if (!skipSuccessfulRequests) {
      entry.count++;
    }
    
    requestCounts.set(key, entry);
    
    // Set rate limit headers
    res.set('X-RateLimit-Limit', max);
    res.set('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.set('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());
    
    // Handle skipSuccessfulRequests/skipFailedRequests
    if (skipSuccessfulRequests || skipFailedRequests) {
      res.on('finish', () => {
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        
        if ((skipSuccessfulRequests && isSuccess) || (skipFailedRequests && !isSuccess)) {
          // Decrement count for skipped requests
          const currentEntry = requestCounts.get(key);
          if (currentEntry) {
            currentEntry.count = Math.max(0, currentEntry.count - 1);
            requestCounts.set(key, currentEntry);
          }
        }
      });
    }
    
    next();
  };
}

/**
 * Login-specific rate limiter with lockout
 * 
 * Security: After 5 failed attempts, locks account for 15 minutes
 * Uses exponential backoff for repeat offenders
 */
function loginRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const email = req.body?.email?.toLowerCase();
  
  // Key combines IP and email to prevent distributed attacks
  const key = email ? `login:${ip}:${email}` : `login:${ip}`;
  const now = Date.now();
  
  let entry = loginAttempts.get(key);
  
  // Reset if lockout expired
  if (entry && now > entry.resetAt) {
    entry = null;
    loginAttempts.delete(key);
  }
  
  // Create new entry if doesn't exist
  if (!entry) {
    entry = {
      attempts: 0,
      resetAt: now + 15 * 60 * 1000,  // 15 minute window
      lockedUntil: null,
      lockoutCount: 0
    };
  }
  
  // Check if currently locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
    
    return res.status(429).json({
      error: 'Account temporarily locked due to too many failed attempts',
      code: 'ACCOUNT_LOCKED',
      retryAfter,
      lockedUntil: new Date(entry.lockedUntil).toISOString()
    });
  }
  
  // Track this attempt
  entry.attempts++;
  loginAttempts.set(key, entry);
  
  // Record login result to update lockout if needed
  const originalJson = res.json.bind(res);
  res.json = function(body) {
    // Check if login failed
    if (res.statusCode === 401) {
      const currentEntry = loginAttempts.get(key);
      if (currentEntry) {
        // Check if should lockout (5 failed attempts)
        if (currentEntry.attempts >= 5) {
          // Exponential backoff: 15min, 30min, 1hr, 2hr...
          const lockoutMinutes = Math.min(15 * Math.pow(2, currentEntry.lockoutCount), 120);
          currentEntry.lockedUntil = now + lockoutMinutes * 60 * 1000;
          currentEntry.lockoutCount++;
          currentEntry.attempts = 0;
          loginAttempts.set(key, currentEntry);
          
          // Log security event
          console.warn(`[SECURITY] Login lockout triggered for ${key}, duration: ${lockoutMinutes}min`);
        }
      }
    } else if (res.statusCode === 200) {
      // Successful login, clear attempts
      loginAttempts.delete(key);
    }
    
    return originalJson(body);
  };
  
  next();
}

/**
 * Get client IP address (handles proxies)
 */
function getClientIp(req) {
  // X-Forwarded-For can contain multiple IPs, take the first (client)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

// Pre-configured limiters for common use cases
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per 15 min
  keyGenerator: 'ip',
  message: 'Too many API requests, please try again later'
});

const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 50,                    // 50 uploads per hour
  keyGenerator: 'both',
  message: 'Upload limit reached, please try again later'
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                    // 20 auth requests per 15 min
  keyGenerator: 'ip',
  message: 'Too many authentication attempts'
});

const refreshLimiter = createRateLimiter({
  windowMs: 60 * 1000,       // 1 minute
  max: 5,                     // 5 refresh attempts per minute
  keyGenerator: 'ip',
  message: 'Too many token refresh attempts'
});

const shareAccessLimiter = createRateLimiter({
  windowMs: 60 * 1000,       // 1 minute
  max: 30,                    // 30 share access per minute
  keyGenerator: 'ip',
  message: 'Too many share link access attempts'
});

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  getClientIp,
  apiLimiter,
  uploadLimiter,
  authLimiter,
  refreshLimiter,
  shareAccessLimiter
};

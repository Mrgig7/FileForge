/**
 * Cache Service
 * 
 * Redis-based caching with ETag support.
 * 
 * Features:
 * - File metadata caching
 * - ETag generation and validation
 * - Stale-while-revalidate pattern
 * - Cache invalidation
 */

const Redis = require('ioredis');
const crypto = require('crypto');

// Redis client
let redis;
try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    enableOfflineQueue: false
  });
} catch (err) {
  console.warn('Redis not available for caching');
  redis = null;
}

const CACHE_PREFIX = 'cache:';
const DEFAULT_TTL = 5 * 60;  // 5 minutes

/**
 * Generate ETag from data
 */
function generateETag(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Set cache value
 */
async function set(key, value, ttl = DEFAULT_TTL) {
  if (!redis) return false;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const data = JSON.stringify({
      value,
      etag: generateETag(value),
      cachedAt: Date.now()
    });
    
    await redis.setex(cacheKey, ttl, data);
    return true;
  } catch (err) {
    console.error('Cache set error:', err.message);
    return false;
  }
}

/**
 * Get cache value
 */
async function get(key) {
  if (!redis) return null;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const data = await redis.get(cacheKey);
    
    if (!data) return null;
    
    return JSON.parse(data);
  } catch (err) {
    console.error('Cache get error:', err.message);
    return null;
  }
}

/**
 * Delete cache value
 */
async function del(key) {
  if (!redis) return false;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    await redis.del(cacheKey);
    return true;
  } catch (err) {
    console.error('Cache delete error:', err.message);
    return false;
  }
}

/**
 * Delete by pattern
 */
async function delByPattern(pattern) {
  if (!redis) return 0;
  
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length;
  } catch (err) {
    console.error('Cache delete pattern error:', err.message);
    return 0;
  }
}

/**
 * Cache middleware for API responses
 */
function cacheMiddleware({ keyGenerator, ttl = DEFAULT_TTL, revalidate = false }) {
  return async (req, res, next) => {
    // Skip cache for non-GET
    if (req.method !== 'GET') {
      return next();
    }
    
    const cacheKey = typeof keyGenerator === 'function'
      ? keyGenerator(req)
      : `${req.originalUrl}`;
    
    // Check ETag
    const ifNoneMatch = req.headers['if-none-match'];
    
    // Try cache
    const cached = await get(cacheKey);
    
    if (cached) {
      // Check ETag match
      if (ifNoneMatch && ifNoneMatch === `"${cached.etag}"`) {
        return res.status(304).end();
      }
      
      // Return cached response
      res.set('ETag', `"${cached.etag}"`);
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', `public, max-age=${ttl}`);
      
      return res.json(cached.value);
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json to cache response
    res.json = (data) => {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        set(cacheKey, data, ttl).catch(() => {});
        
        const etag = generateETag(data);
        res.set('ETag', `"${etag}"`);
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', `public, max-age=${ttl}`);
      }
      
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * File metadata cache helpers
 */
const fileCache = {
  key: (fileId) => `file:${fileId}`,
  
  async get(fileId) {
    const cached = await get(this.key(fileId));
    return cached?.value || null;
  },
  
  async set(fileId, metadata, ttl = 5 * 60) {
    return set(this.key(fileId), metadata, ttl);
  },
  
  async invalidate(fileId) {
    return del(this.key(fileId));
  }
};

/**
 * User quota cache helpers
 */
const quotaCache = {
  key: (userId) => `quota:${userId}`,
  
  async get(userId) {
    const cached = await get(this.key(userId));
    return cached?.value || null;
  },
  
  async set(userId, quota, ttl = 60) {
    return set(this.key(userId), quota, ttl);
  },
  
  async invalidate(userId) {
    return del(this.key(userId));
  }
};

/**
 * Share link cache helpers
 */
const shareCache = {
  key: (shareId) => `share:${shareId}`,
  
  async get(shareId) {
    const cached = await get(this.key(shareId));
    return cached?.value || null;
  },
  
  async set(shareId, shareData, ttl = 5 * 60) {
    return set(this.key(shareId), shareData, ttl);
  },
  
  async invalidate(shareId) {
    return del(this.key(shareId));
  }
};

module.exports = {
  set,
  get,
  del,
  delByPattern,
  generateETag,
  cacheMiddleware,
  fileCache,
  quotaCache,
  shareCache
};

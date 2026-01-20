/**
 * Health Check Routes
 * 
 * Provides health endpoints for monitoring:
 * - GET /health - Basic liveness check
 * - GET /health/deps - Dependency checks (DB, Redis)
 * - GET /health/metrics - Basic metrics
 */

const router = require('express').Router();
const mongoose = require('mongoose');
const { getQueueStats } = require('../config/queue');

/**
 * @route   GET /health
 * @desc    Basic liveness check
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * @route   GET /health/deps
 * @desc    Check all dependencies (DB, Redis, etc.)
 * @access  Public (consider protecting in production)
 */
router.get('/deps', async (req, res) => {
  const checks = {};
  let healthy = true;
  
  // MongoDB check
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    checks.mongodb = {
      status: mongoState === 1 ? 'ok' : 'error',
      state: mongoStates[mongoState]
    };
    
    if (mongoState !== 1) healthy = false;
  } catch (err) {
    checks.mongodb = { status: 'error', error: err.message };
    healthy = false;
  }
  
  // Redis/Queue check
  try {
    const queueStats = await getQueueStats();
    const hasErrors = Object.values(queueStats).some(q => q.error);
    
    checks.redis = {
      status: hasErrors ? 'error' : 'ok',
      queues: queueStats
    };
    
    if (hasErrors) healthy = false;
  } catch (err) {
    checks.redis = { status: 'unavailable', error: err.message };
    // Redis is optional, don't mark as unhealthy
  }
  
  // Cloudinary check (basic)
  try {
    const cloudinaryConfigured = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY
    );
    
    checks.cloudinary = {
      status: cloudinaryConfigured ? 'ok' : 'not_configured',
      configured: cloudinaryConfigured
    };
  } catch (err) {
    checks.cloudinary = { status: 'error', error: err.message };
  }
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks
  });
});

/**
 * @route   GET /health/metrics
 * @desc    Basic application metrics
 * @access  Public (consider protecting in production)
 */
router.get('/metrics', async (req, res) => {
  // Memory usage
  const memoryUsage = process.memoryUsage();
  
  // Queue stats
  let queueStats = {};
  try {
    queueStats = await getQueueStats();
  } catch (err) {
    queueStats = { error: err.message };
  }
  
  // Response
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      unit: 'MB'
    },
    queues: queueStats,
    nodejs: {
      version: process.version,
      platform: process.platform
    }
  });
});

module.exports = router;

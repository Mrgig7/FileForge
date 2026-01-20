/**
 * Worker Entry Point
 * 
 * Starts all background job workers.
 * Run with: npm run worker (or node workers/index.js)
 * 
 * Workers run separately from the API server for:
 * - Isolation (worker crash doesn't affect API)
 * - Scalability (can run multiple worker instances)
 * - Resource management (separate memory/CPU budgets)
 */

require('dotenv').config();
const { getRedisConnection, scheduleCleanupJobs } = require('../config/queue');
const { logger } = require('../config/logger');

// Import workers
const postUploadWorker = require('./postUploadWorker');
const scanWorker = require('./scanWorker');
const cleanupWorker = require('./cleanupWorker');

const log = logger.child({ component: 'worker-main' });

// Track workers for graceful shutdown
const workers = [];

async function main() {
  log.info('Starting FileForge workers...');
  
  const redisConnection = getRedisConnection();
  
  // Check Redis connection
  try {
    const Redis = require('ioredis');
    const testClient = new Redis(redisConnection);
    await testClient.ping();
    await testClient.quit();
    log.info('Redis connection OK');
  } catch (err) {
    log.error({ err }, 'Redis connection failed');
    process.exit(1);
  }
  
  // Start workers
  try {
    log.info('Starting post-upload worker...');
    workers.push(postUploadWorker.createWorker(redisConnection));
    
    log.info('Starting security scan worker...');
    workers.push(scanWorker.createWorker(redisConnection));
    
    log.info('Starting cleanup worker...');
    workers.push(cleanupWorker.createWorker(redisConnection));
    
    // Schedule repeatable cleanup jobs
    await scheduleCleanupJobs();
    
    log.info(`All ${workers.length} workers started successfully`);
    
  } catch (err) {
    log.error({ err }, 'Failed to start workers');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal) {
  log.info({ signal }, 'Shutdown signal received');
  
  for (const worker of workers) {
    try {
      await worker.close();
    } catch (err) {
      log.error({ err }, 'Error closing worker');
    }
  }
  
  log.info('Workers shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Unhandled errors
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error({ reason }, 'Unhandled rejection');
});

// Database connection (workers need it too)
const connectDB = require('../config/db');

// Start
connectDB();
main().catch(err => {
  log.fatal({ err }, 'Worker startup failed');
  process.exit(1);
});

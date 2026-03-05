/**
 * Queue Configuration (BullMQ + Redis)
 * 
 * Background job processing for:
 * - Post-upload processing (checksum, MIME verification)
 * - Preview generation (thumbnails)
 * - Security scanning (ClamAV/cloud)
 * - Cleanup jobs (expired shares, soft-deleted files)
 * 
 * Architecture:
 * - API → adds job to queue
 * - Worker process → consumes jobs with retry/backoff
 * - Dead letter queue → failed jobs for investigation
 */

const { Queue, Worker, QueueScheduler } = require('bullmq');

// Redis connection config (from environment)
const getRedisConnection = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,  // Required for BullMQ
  enableReadyCheck: false
});

// Default job options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000  // Start with 1s, then 2s, 4s
  },
  removeOnComplete: {
    count: 100,      // Keep last 100 completed jobs
    age: 24 * 3600   // Or jobs younger than 24h
  },
  removeOnFail: {
    count: 500,      // Keep last 500 failed jobs for investigation
    age: 7 * 24 * 3600  // Or jobs younger than 7 days
  }
};

// Queue names
const QUEUE_NAMES = {
  POST_UPLOAD: 'post-upload',
  PREVIEW: 'preview-generation',
  SCAN: 'security-scan',
  CLEANUP: 'cleanup'
};

// Queue instances (lazy initialized)
let queues = {};

/**
 * Get or create a queue
 */
function getQueue(name) {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: getRedisConnection(),
      defaultJobOptions
    });
    
    // Error handling
    queues[name].on('error', (err) => {
      console.error(`[Queue:${name}] Error:`, err.message);
    });
  }
  return queues[name];
}

/**
 * Add a job to a queue
 * 
 * @param {string} queueName - Queue name from QUEUE_NAMES
 * @param {string} jobName - Descriptive name for the job
 * @param {Object} data - Job data
 * @param {Object} opts - Additional job options
 * @returns {Promise<Job>}
 */
async function addJob(queueName, jobName, data, opts = {}) {
  const queue = getQueue(queueName);
  
  // Add idempotency key if provided
  const jobOptions = { ...opts };
  if (data.idempotencyKey) {
    jobOptions.jobId = data.idempotencyKey;
  }
  
  const job = await queue.add(jobName, data, jobOptions);
  console.log(`[Queue:${queueName}] Job added: ${jobName} (${job.id})`);
  return job;
}

/**
 * Add post-upload processing job
 */
async function addPostUploadJob(fileId, options = {}) {
  return addJob(QUEUE_NAMES.POST_UPLOAD, 'process-upload', {
    fileId: fileId.toString(),
    idempotencyKey: `post-upload:${fileId}`,
    ...options
  });
}

/**
 * Add preview generation job
 */
async function addPreviewJob(fileId, mimeType, options = {}) {
  return addJob(QUEUE_NAMES.PREVIEW, 'generate-preview', {
    fileId: fileId.toString(),
    mimeType,
    idempotencyKey: `preview:${fileId}`,
    ...options
  });
}

/**
 * Add security scan job
 */
async function addScanJob(fileId, options = {}) {
  return addJob(QUEUE_NAMES.SCAN, 'scan-file', {
    fileId: fileId.toString(),
    idempotencyKey: `scan:${fileId}`,
    priority: options.priority || 1,  // Lower = higher priority
    ...options
  }, {
    priority: options.priority || 1
  });
}

/**
 * Schedule cleanup job (runs periodically)
 */
async function scheduleCleanupJobs() {
  const queue = getQueue(QUEUE_NAMES.CLEANUP);
  
  // Remove existing repeat jobs to avoid duplicates
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key);
  }
  
  // Schedule jobs
  await queue.add('cleanup-expired-shares', {}, {
    repeat: { cron: '0 * * * *' },  // Every hour
    jobId: 'cleanup-expired-shares'
  });
  
  await queue.add('purge-deleted-files', {}, {
    repeat: { cron: '0 3 * * *' },  // Daily at 3 AM
    jobId: 'purge-deleted-files'
  });
  
  await queue.add('purge-abandoned-uploads', {}, {
    repeat: { cron: '0 4 * * *' },  // Daily at 4 AM
    jobId: 'purge-abandoned-uploads'
  });
  
  console.log('[Queue] Cleanup jobs scheduled');
}

/**
 * Get queue stats for health check
 */
async function getQueueStats() {
  const stats = {};
  
  for (const [name, queueName] of Object.entries(QUEUE_NAMES)) {
    try {
      const queue = getQueue(queueName);
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount()
      ]);
      
      stats[name] = { waiting, active, completed, failed };
    } catch (err) {
      stats[name] = { error: err.message };
    }
  }
  
  return stats;
}

/**
 * Close all queues (for graceful shutdown)
 */
async function closeQueues() {
  for (const queue of Object.values(queues)) {
    await queue.close();
  }
  queues = {};
  console.log('[Queue] All queues closed');
}

module.exports = {
  QUEUE_NAMES,
  getQueue,
  addJob,
  addPostUploadJob,
  addPreviewJob,
  addScanJob,
  scheduleCleanupJobs,
  getQueueStats,
  closeQueues,
  getRedisConnection
};

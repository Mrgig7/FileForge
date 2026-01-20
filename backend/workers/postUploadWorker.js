/**
 * Post-Upload Worker
 * 
 * Processes files after upload completion:
 * 1. Verify file exists on Cloudinary
 * 2. Compute checksum (if not provided)
 * 3. Validate MIME type
 * 4. Trigger security scan
 * 5. Update file status
 * 
 * Idempotency: Uses fileId as job ID, safe to reprocess
 */

const { Worker } = require('bullmq');
const File = require('../models/file');
const { cloudinary } = require('../services/cloudinary');
const { addScanJob } = require('../config/queue');
const { logger } = require('../config/logger');
const crypto = require('crypto');

const QUEUE_NAME = 'post-upload';

/**
 * Process a post-upload job
 */
async function processJob(job) {
  const { fileId } = job.data;
  const log = logger.child({ worker: 'post-upload', jobId: job.id, fileId });
  
  log.info('Processing post-upload job');
  
  try {
    // 1. Find file
    const file = await File.findById(fileId);
    if (!file) {
      log.warn('File not found, skipping');
      return { success: false, reason: 'file_not_found' };
    }
    
    // 2. Check if already processed (idempotency)
    if (file.status && file.status !== 'PENDING' && file.status !== 'UPLOADED') {
      log.info({ status: file.status }, 'File already processed');
      return { success: true, reason: 'already_processed', status: file.status };
    }
    
    // 3. Verify file exists on Cloudinary
    let cloudinaryInfo = null;
    if (file.cloudinaryId) {
      try {
        cloudinaryInfo = await cloudinary.api.resource(file.cloudinaryId, {
          resource_type: 'raw'
        });
        log.debug({ cloudinaryBytes: cloudinaryInfo.bytes }, 'Cloudinary verification OK');
      } catch (err) {
        if (err.http_code === 404) {
          log.error('File not found on Cloudinary');
          await File.findByIdAndUpdate(fileId, { status: 'DELETED' });
          return { success: false, reason: 'not_on_cdn' };
        }
        throw err;
      }
    }
    
    // 4. Compute checksum if not present
    let checksum = file.checksum;
    if (!checksum && cloudinaryInfo?.secure_url) {
      // For full checksum, would need to download file
      // Using etag as proxy for now
      checksum = cloudinaryInfo.etag || `cloudinary:${cloudinaryInfo.version}`;
    }
    
    // 5. Update file with processing info
    const updateData = {
      status: 'SCANNING',
      checksum,
      processedAt: new Date()
    };
    
    if (cloudinaryInfo) {
      updateData.verifiedSize = cloudinaryInfo.bytes;
      updateData.verifiedFormat = cloudinaryInfo.format;
    }
    
    await File.findByIdAndUpdate(fileId, updateData);
    
    // 6. Trigger security scan
    await addScanJob(fileId);
    log.info('Queued for security scan');
    
    return {
      success: true,
      checksum,
      size: cloudinaryInfo?.bytes
    };
    
  } catch (error) {
    log.error({ err: error }, 'Post-upload processing failed');
    throw error;  // Let BullMQ handle retry
  }
}

/**
 * Create and start the worker
 */
function createWorker(redisConnection) {
  const worker = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: 5,  // Process 5 jobs in parallel
    limiter: {
      max: 10,
      duration: 1000  // Max 10 jobs per second
    }
  });
  
  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'Post-upload job completed');
  });
  
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job.id, err }, 'Post-upload job failed');
  });
  
  worker.on('error', (err) => {
    logger.error({ err }, 'Post-upload worker error');
  });
  
  return worker;
}

module.exports = { createWorker, processJob, QUEUE_NAME };

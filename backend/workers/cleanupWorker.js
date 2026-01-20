/**
 * Cleanup Worker
 * 
 * Scheduled maintenance jobs:
 * - cleanupExpiredShares: Disable shares past expiry
 * - purgeDeletedFiles: Hard delete soft-deleted files after retention
 * - purgeAbandonedUploads: Remove incomplete uploads
 * 
 * Runs on schedule (cron) via BullMQ repeatable jobs
 */

const { Worker } = require('bullmq');
const File = require('../models/file');
const ShareLink = require('../models/ShareLink');
const { cloudinary } = require('../services/cloudinary');
const { logger } = require('../config/logger');

const QUEUE_NAME = 'cleanup';

// Retention periods (in days)
const RETENTION = {
  SOFT_DELETED_FILES: parseInt(process.env.RETENTION_SOFT_DELETE_DAYS || '30', 10),
  ABANDONED_UPLOADS: parseInt(process.env.RETENTION_ABANDONED_HOURS || '24', 10) / 24,
  QUARANTINED_FILES: parseInt(process.env.RETENTION_QUARANTINE_DAYS || '7', 10)
};

/**
 * Cleanup expired share links
 */
async function cleanupExpiredShares(job) {
  const log = logger.child({ worker: 'cleanup', job: 'expired-shares' });
  log.info('Running expired shares cleanup');
  
  const now = new Date();
  
  // Find and revoke expired shares
  const result = await ShareLink.updateMany(
    {
      expiresAt: { $lte: now },
      revokedAt: null
    },
    {
      revokedAt: now
    }
  );
  
  log.info({ count: result.modifiedCount }, 'Expired shares revoked');
  return { revokedCount: result.modifiedCount };
}

/**
 * Purge soft-deleted files after retention period
 */
async function purgeDeletedFiles(job) {
  const log = logger.child({ worker: 'cleanup', job: 'purge-deleted' });
  log.info('Running deleted files purge');
  
  const cutoffDate = new Date(Date.now() - RETENTION.SOFT_DELETED_FILES * 24 * 60 * 60 * 1000);
  
  // Find files ready for hard delete
  const filesToDelete = await File.find({
    deletedAt: { $lte: cutoffDate }
  }).select('_id cloudinaryId cloudinaryUrl').limit(100);
  
  log.info({ count: filesToDelete.length }, 'Files to purge');
  
  let deletedCount = 0;
  let errorCount = 0;
  
  for (const file of filesToDelete) {
    try {
      // Delete from Cloudinary
      if (file.cloudinaryId) {
        await cloudinary.uploader.destroy(file.cloudinaryId, {
          resource_type: 'raw',
          invalidate: true
        });
      }
      
      // Hard delete from DB
      await File.findByIdAndDelete(file._id);
      deletedCount++;
      
    } catch (err) {
      log.error({ err, fileId: file._id }, 'Failed to purge file');
      errorCount++;
    }
  }
  
  log.info({ deletedCount, errorCount }, 'Purge completed');
  return { deletedCount, errorCount };
}

/**
 * Purge abandoned uploads (PENDING status for too long)
 */
async function purgeAbandonedUploads(job) {
  const log = logger.child({ worker: 'cleanup', job: 'purge-abandoned' });
  log.info('Running abandoned uploads purge');
  
  const cutoffDate = new Date(Date.now() - RETENTION.ABANDONED_UPLOADS * 24 * 60 * 60 * 1000);
  
  // Find abandoned files (PENDING status, old)
  const abandonedFiles = await File.find({
    status: 'PENDING',
    createdAt: { $lte: cutoffDate }
  }).select('_id cloudinaryId').limit(100);
  
  log.info({ count: abandonedFiles.length }, 'Abandoned uploads to purge');
  
  let deletedCount = 0;
  let errorCount = 0;
  
  for (const file of abandonedFiles) {
    try {
      // Cleanup from Cloudinary
      if (file.cloudinaryId) {
        await cloudinary.uploader.destroy(file.cloudinaryId, {
          resource_type: 'raw'
        }).catch(() => {});  // Ignore if not found
      }
      
      // Hard delete
      await File.findByIdAndDelete(file._id);
      deletedCount++;
      
    } catch (err) {
      log.error({ err, fileId: file._id }, 'Failed to purge abandoned upload');
      errorCount++;
    }
  }
  
  log.info({ deletedCount, errorCount }, 'Abandoned purge completed');
  return { deletedCount, errorCount };
}

/**
 * Purge quarantined files after retention
 */
async function purgeQuarantinedFiles(job) {
  const log = logger.child({ worker: 'cleanup', job: 'purge-quarantined' });
  log.info('Running quarantined files purge');
  
  const cutoffDate = new Date(Date.now() - RETENTION.QUARANTINED_FILES * 24 * 60 * 60 * 1000);
  
  const quarantinedFiles = await File.find({
    status: 'QUARANTINED',
    'scanResult.scannedAt': { $lte: cutoffDate }
  }).select('_id cloudinaryId userId').limit(50);
  
  log.info({ count: quarantinedFiles.length }, 'Quarantined files to purge');
  
  let deletedCount = 0;
  
  for (const file of quarantinedFiles) {
    try {
      if (file.cloudinaryId) {
        await cloudinary.uploader.destroy(file.cloudinaryId, {
          resource_type: 'raw'
        }).catch(() => {});
      }
      
      await File.findByIdAndDelete(file._id);
      deletedCount++;
      
    } catch (err) {
      log.error({ err, fileId: file._id }, 'Failed to purge quarantined file');
    }
  }
  
  log.info({ deletedCount }, 'Quarantined purge completed');
  return { deletedCount };
}

/**
 * Process cleanup job (router for different job types)
 */
async function processJob(job) {
  switch (job.name) {
    case 'cleanup-expired-shares':
      return cleanupExpiredShares(job);
    case 'purge-deleted-files':
      return purgeDeletedFiles(job);
    case 'purge-abandoned-uploads':
      return purgeAbandonedUploads(job);
    case 'purge-quarantined-files':
      return purgeQuarantinedFiles(job);
    default:
      logger.warn({ jobName: job.name }, 'Unknown cleanup job type');
      return { skipped: true };
  }
}

/**
 * Create and start the worker
 */
function createWorker(redisConnection) {
  const worker = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: 1,  // Run cleanup jobs sequentially
  });
  
  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, jobName: job.name, result }, 'Cleanup job completed');
  });
  
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job.id, jobName: job.name, err }, 'Cleanup job failed');
  });
  
  return worker;
}

module.exports = { createWorker, processJob, QUEUE_NAME };

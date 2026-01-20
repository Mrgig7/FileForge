/**
 * Security Scan Worker
 * 
 * Scans files for malware/viruses:
 * 1. Download file from Cloudinary
 * 2. Run through scanner (ClamAV/Mock)
 * 3. Update status: READY or QUARANTINED
 * 4. Log scan result for audit
 * 
 * Security: Quarantined files cannot be shared or downloaded
 */

const { Worker } = require('bullmq');
const File = require('../models/file');
const AuditLog = require('../models/AuditLog');
const { cloudinary } = require('../services/cloudinary');
const { scanFile } = require('../services/scannerService');
const { logger } = require('../config/logger');
const https = require('https');
const http = require('http');

const QUEUE_NAME = 'security-scan';

/**
 * Download file from URL to buffer
 */
async function downloadToBuffer(url, maxSize = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      let size = 0;
      
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxSize) {
          res.destroy();
          reject(new Error('File too large for scanning'));
          return;
        }
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Process a scan job
 */
async function processJob(job) {
  const { fileId } = job.data;
  const log = logger.child({ worker: 'security-scan', jobId: job.id, fileId });
  
  log.info('Processing security scan job');
  
  try {
    // 1. Find file
    const file = await File.findById(fileId);
    if (!file) {
      log.warn('File not found');
      return { success: false, reason: 'file_not_found' };
    }
    
    // 2. Check if already scanned (idempotency)
    if (file.status === 'READY' || file.status === 'QUARANTINED') {
      log.info({ status: file.status }, 'File already scanned');
      return { success: true, reason: 'already_scanned', status: file.status };
    }
    
    // 3. Get file content
    let fileBuffer;
    if (file.cloudinaryUrl) {
      log.debug('Downloading from Cloudinary');
      fileBuffer = await downloadToBuffer(file.cloudinaryUrl);
    } else if (file.path) {
      const fs = require('fs').promises;
      fileBuffer = await fs.readFile(file.path);
    } else {
      log.error('No file source available');
      await File.findByIdAndUpdate(fileId, { status: 'DELETED' });
      return { success: false, reason: 'no_file_source' };
    }
    
    log.debug({ size: fileBuffer.length }, 'File downloaded');
    
    // 4. Run scan
    const scanResult = await scanFile(fileBuffer, {
      fileName: file.originalName || file.filename,
      mimeType: file.mimeType,
      size: file.size
    });
    
    log.info({
      clean: scanResult.clean,
      threats: scanResult.threats,
      scanner: scanResult.scannerName,
      duration: scanResult.duration
    }, 'Scan completed');
    
    // 5. Update file status
    const newStatus = scanResult.clean ? 'READY' : 'QUARANTINED';
    
    await File.findByIdAndUpdate(fileId, {
      status: newStatus,
      scanResult: {
        scannedAt: scanResult.scannedAt,
        clean: scanResult.clean,
        threats: scanResult.threats,
        scannerVersion: `${scanResult.scannerName}/${scanResult.scannerVersion}`,
        duration: scanResult.duration
      }
    });
    
    // 6. Audit log
    await AuditLog.log({
      action: scanResult.clean ? 'file.scan_clean' : 'file.scan_infected',
      targetType: 'file',
      targetId: file._id,
      userId: file.userId,
      metadata: {
        scanner: scanResult.scannerName,
        threats: scanResult.threats,
        duration: scanResult.duration
      },
      success: true
    });
    
    // 7. If infected, notify (future: send email/webhook)
    if (!scanResult.clean) {
      log.warn({
        threats: scanResult.threats,
        userId: file.userId
      }, 'SECURITY: Infected file quarantined');
    }
    
    return {
      success: true,
      status: newStatus,
      scanResult: scanResult.toObject()
    };
    
  } catch (error) {
    log.error({ err: error }, 'Security scan failed');
    
    // Mark as pending retry
    await File.findByIdAndUpdate(fileId, {
      status: 'SCANNING',
      scanResult: {
        scannedAt: new Date(),
        clean: false,
        threats: [`SCAN_ERROR: ${error.message}`],
        scannerVersion: 'error'
      }
    });
    
    throw error;  // Let BullMQ handle retry
  }
}

/**
 * Create and start the worker
 */
function createWorker(redisConnection) {
  const worker = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: 2,  // Limit concurrent scans (memory intensive)
    limiter: {
      max: 5,
      duration: 1000  // Max 5 scans per second
    }
  });
  
  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, status: result?.status }, 'Scan job completed');
  });
  
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job.id, err }, 'Scan job failed');
  });
  
  return worker;
}

module.exports = { createWorker, processJob, QUEUE_NAME };

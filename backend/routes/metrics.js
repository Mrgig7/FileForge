/**
 * Prometheus Metrics Routes
 * 
 * Expose /metrics endpoint for Prometheus scraping.
 * 
 * Metrics include:
 * - HTTP request latency (histogram)
 * - Request count by method/endpoint/status
 * - Upload metrics
 * - Download metrics
 * - Error counters
 */

const router = require('express').Router();
const client = require('prom-client');

// Create registry
const register = new client.Registry();

// Default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics

// HTTP request duration
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});
register.registerMetric(httpRequestDuration);

// HTTP request counter
const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});
register.registerMetric(httpRequestTotal);

// Upload metrics
const uploadDuration = new client.Histogram({
  name: 'upload_duration_seconds',
  help: 'Duration of file uploads in seconds',
  labelNames: ['status'],
  buckets: [1, 5, 10, 30, 60, 120, 300]
});
register.registerMetric(uploadDuration);

const uploadTotal = new client.Counter({
  name: 'uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['status']
});
register.registerMetric(uploadTotal);

const uploadSize = new client.Histogram({
  name: 'upload_size_bytes',
  help: 'Size of uploaded files in bytes',
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600]  // 1KB to 100MB
});
register.registerMetric(uploadSize);

// Chunk upload metrics
const chunkUploadDuration = new client.Histogram({
  name: 'chunk_upload_duration_seconds',
  help: 'Duration of chunk uploads in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});
register.registerMetric(chunkUploadDuration);

const chunkUploadTotal = new client.Counter({
  name: 'chunk_uploads_total',
  help: 'Total number of chunk uploads',
  labelNames: ['status']
});
register.registerMetric(chunkUploadTotal);

// Download metrics
const downloadTotal = new client.Counter({
  name: 'downloads_total',
  help: 'Total number of file downloads',
  labelNames: ['type']  // direct, share
});
register.registerMetric(downloadTotal);

// Error counter
const errorTotal = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint']
});
register.registerMetric(errorTotal);

// Active sessions gauge
const activeSessions = new client.Gauge({
  name: 'active_sessions',
  help: 'Number of active user sessions'
});
register.registerMetric(activeSessions);

// Active uploads gauge
const activeUploads = new client.Gauge({
  name: 'active_uploads',
  help: 'Number of active upload sessions'
});
register.registerMetric(activeUploads);

// Rate limit hits
const rateLimitHits = new client.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint']
});
register.registerMetric(rateLimitHits);

// File types distribution
const fileTypes = new client.Counter({
  name: 'file_types_total',
  help: 'Distribution of uploaded file types',
  labelNames: ['mime_type']
});
register.registerMetric(fileTypes);

/**
 * @route   GET /metrics
 * @desc    Prometheus metrics endpoint
 * @access  Public (consider adding auth for production)
 */
router.get('/', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

/**
 * Metrics middleware for Express
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status: res.statusCode
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
    
    // Track rate limit hits
    if (res.statusCode === 429) {
      rateLimitHits.inc({ endpoint: route });
    }
    
    // Track errors
    if (res.statusCode >= 400) {
      errorTotal.inc({
        type: res.statusCode >= 500 ? 'server' : 'client',
        endpoint: route
      });
    }
  });
  
  next();
}

/**
 * Record upload metrics
 */
function recordUpload(status, size, durationSec) {
  uploadTotal.inc({ status });
  if (size) uploadSize.observe(size);
  if (durationSec) uploadDuration.observe({ status }, durationSec);
}

/**
 * Record chunk upload metrics
 */
function recordChunkUpload(status, durationSec) {
  chunkUploadTotal.inc({ status });
  if (durationSec) chunkUploadDuration.observe(durationSec);
}

/**
 * Record download metrics
 */
function recordDownload(type = 'direct') {
  downloadTotal.inc({ type });
}

/**
 * Record file type
 */
function recordFileType(mimeType) {
  if (mimeType) {
    fileTypes.inc({ mime_type: mimeType });
  }
}

/**
 * Update gauges (call periodically)
 */
async function updateGauges({ sessions = 0, uploads = 0 }) {
  activeSessions.set(sessions);
  activeUploads.set(uploads);
}

// Export metrics helpers
router.metricsMiddleware = metricsMiddleware;
router.recordUpload = recordUpload;
router.recordChunkUpload = recordChunkUpload;
router.recordDownload = recordDownload;
router.recordFileType = recordFileType;
router.updateGauges = updateGauges;
router.register = register;

module.exports = router;

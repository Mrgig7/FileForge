/**
 * Pino Structured Logging
 * 
 * Production-grade logging with:
 * - JSON format for log aggregation
 * - Request ID correlation
 * - User ID where applicable
 * - Safe error serialization (no stack traces in prod)
 * - Log levels: trace, debug, info, warn, error, fatal
 */

const pino = require('pino');

// Environment-based configuration
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Base logger configuration
const loggerConfig = {
  level: logLevel,
  
  // Base fields included in all logs
  base: {
    service: 'fileforge-api',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development'
  },
  
  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Format log level as string
  formatters: {
    level: (label) => ({ level: label })
  },
  
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'refreshToken',
      'accessToken',
      '*.password',
      '*.token',
      '*.secret'
    ],
    censor: '[REDACTED]'
  },
  
  // Error serializer (safe for production)
  serializers: {
    err: (err) => ({
      type: err.constructor.name,
      message: err.message,
      code: err.code,
      stack: isProduction ? undefined : err.stack
    }),
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path || req.url?.split('?')[0],
      query: req.query,
      requestId: req.id,
      userId: req.user?.id || req.user?._id
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      responseTime: res.responseTime
    })
  }
};

// Pretty print in development
const transport = isProduction ? undefined : {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname,service,version,env'
  }
};

// Create logger
const logger = pino(loggerConfig, transport ? pino.transport(transport) : undefined);

/**
 * Create a child logger with context
 * @param {Object} bindings - Context to add to all logs
 */
function createChildLogger(bindings) {
  return logger.child(bindings);
}

/**
 * Create request-scoped logger
 * @param {Object} req - Express request
 */
function createRequestLogger(req) {
  return logger.child({
    requestId: req.id || req.headers['x-request-id'],
    userId: req.user?.id || req.user?._id,
    ip: req.ip || req.headers['x-forwarded-for']?.split(',')[0]
  });
}

/**
 * Log audit event (security-relevant)
 * These are always logged at info level for compliance
 */
function logAudit(action, data = {}) {
  logger.info({
    audit: true,
    action,
    ...data
  }, `Audit: ${action}`);
}

/**
 * Log security event (potential threat)
 */
function logSecurity(event, data = {}) {
  logger.warn({
    security: true,
    event,
    ...data
  }, `Security: ${event}`);
}

/**
 * Log metrics event (for aggregation)
 */
function logMetric(name, value, tags = {}) {
  logger.info({
    metric: true,
    name,
    value,
    tags
  }, `Metric: ${name}=${value}`);
}

module.exports = {
  logger,
  createChildLogger,
  createRequestLogger,
  logAudit,
  logSecurity,
  logMetric
};

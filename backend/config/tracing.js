/**
 * OpenTelemetry Configuration
 * 
 * Distributed tracing with Grafana Tempo (production) or Jaeger (dev).
 * 
 * Setup:
 * - Production: Use Grafana Tempo with OTLP receiver
 * - Development: docker run -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one
 * 
 * Initialize BEFORE requiring any other modules:
 *   require('./config/tracing');
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Check if tracing is enabled
const TRACING_ENABLED = process.env.OTEL_TRACING_ENABLED === 'true';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'fileforge-api';

// Exporter endpoint (Tempo or Jaeger)
const EXPORTER_URL = process.env.OTEL_EXPORTER_URL || 'http://localhost:4318/v1/traces';

let sdk = null;

function initTracing() {
  if (!TRACING_ENABLED) {
    console.log('OpenTelemetry tracing disabled');
    return;
  }
  
  console.log(`Initializing OpenTelemetry tracing -> ${EXPORTER_URL}`);
  
  const exporter = new OTLPTraceExporter({
    url: EXPORTER_URL
  });
  
  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0'
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Instrument Express
        '@opentelemetry/instrumentation-express': { enabled: true },
        // Instrument HTTP
        '@opentelemetry/instrumentation-http': { enabled: true },
        // Instrument MongoDB
        '@opentelemetry/instrumentation-mongodb': { enabled: true },
        // Instrument Redis (ioredis)
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
        // Skip noisy instrumentations
        '@opentelemetry/instrumentation-fs': { enabled: false }
      })
    ]
  });
  
  sdk.start();
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch(err => console.error('Error shutting down tracing', err));
  });
  
  console.log('OpenTelemetry tracing initialized');
}

/**
 * Create custom span for specific operations
 */
function createSpan(name, fn) {
  if (!TRACING_ENABLED || !sdk) {
    return fn();
  }
  
  const { trace } = require('@opentelemetry/api');
  const tracer = trace.getTracer(SERVICE_NAME);
  
  return tracer.startActiveSpan(name, async span => {
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (error) {
      span.recordException(error);
      span.end();
      throw error;
    }
  });
}

/**
 * Add custom attributes to current span
 */
function addSpanAttributes(attributes) {
  if (!TRACING_ENABLED) return;
  
  const { trace } = require('@opentelemetry/api');
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Get current trace ID (for correlation)
 */
function getTraceId() {
  if (!TRACING_ENABLED) return null;
  
  const { trace } = require('@opentelemetry/api');
  const span = trace.getActiveSpan();
  return span?.spanContext()?.traceId || null;
}

module.exports = {
  initTracing,
  createSpan,
  addSpanAttributes,
  getTraceId,
  TRACING_ENABLED
};

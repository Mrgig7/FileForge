# FileForge Grafana Dashboard

## Overview

This directory contains Grafana dashboard configurations for monitoring FileForge.

## Prerequisites

- Grafana 9.0+ 
- Prometheus data source configured
- (Optional) Tempo/Jaeger for distributed tracing

## Dashboard Setup

### 1. Import Dashboard

1. Open Grafana → Dashboards → Import
2. Upload `fileforge-dashboard.json` or paste the contents
3. Select your Prometheus data source
4. Click Import

### 2. Configure Data Sources

**Prometheus** (Required)
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'fileforge'
    static_configs:
      - targets: ['localhost:3000']  # Your backend API
    metrics_path: '/api/metrics'
```

**Tempo/Jaeger** (Optional - for traces)
```yaml
# Configure OTLP endpoint in backend .env
OTEL_TRACING_ENABLED=true
OTEL_EXPORTER_URL=http://localhost:4318/v1/traces
```

## Dashboard Panels

| Panel | Description | Metrics Used |
|-------|-------------|--------------|
| **Request Rate** | HTTP requests per second | `http_requests_total` |
| **Error Rate** | 4xx/5xx responses | `http_requests_total{status=~"4..|5.."}` |
| **Response Time** | P50, P95, P99 latency | `http_request_duration_seconds` |
| **Upload Stats** | Upload count and size | `uploads_total`, `upload_size_bytes` |
| **Active Sessions** | Current active users | `active_sessions` |
| **Rate Limit Hits** | Blocked requests | `rate_limit_hits_total` |
| **Queue Depth** | BullMQ pending jobs | Custom metric from queue |

## Screenshots

> **TODO**: Add screenshots after deploying to staging.
> 
> To capture screenshots:
> 1. Deploy FileForge with Prometheus metrics enabled
> 2. Generate some traffic (use k6 load tests)
> 3. Open Grafana dashboard
> 4. Use Grafana's built-in snapshot feature
> 5. Export and save to this directory

## Alerting

Example alert rules for Grafana:

```yaml
groups:
  - name: fileforge
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High 5xx error rate detected"
          
      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 response time exceeds 2 seconds"
```

## Docker Compose Setup

For local development with full observability:

```yaml
# docker-compose.observability.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:v2.45.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:10.0.0
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./grafana:/var/lib/grafana

  tempo:
    image: grafana/tempo:2.2.0
    ports:
      - "4318:4318"  # OTLP HTTP
```

Run with:
```bash
docker-compose -f docker-compose.observability.yml up -d
```

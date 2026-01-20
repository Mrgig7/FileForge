# Load Testing with k6

## Overview

This directory contains k6 load test scripts for FileForge API performance testing.

## Prerequisites

Install k6: https://k6.io/docs/get-started/installation/

```bash
# Windows (Chocolatey)
choco install k6

# macOS
brew install k6

# Docker
docker run --rm -i grafana/k6 run - <script.js
```

## Test Scripts

| Script | Description | Target Endpoints |
|--------|-------------|------------------|
| `auth-flow.js` | Authentication performance | `/auth/v2/login`, `/auth/v2/refresh`, `/auth/v2/me` |
| `upload-chunks.js` | Chunked upload performance | `/chunked-uploads/init`, `/chunk`, `/complete` |
| `download-share.js` | Share link download | `/share/:token`, `/share/:token/download` |

## Running Tests

### Basic Run
```bash
k6 run auth-flow.js
```

### With Custom Configuration
```bash
# 50 virtual users for 60 seconds
k6 run --vus 50 --duration 60s auth-flow.js

# Custom API URL
K6_BASE_URL=https://api.example.com k6 run auth-flow.js
```

### Output to JSON
```bash
k6 run --out json=results.json auth-flow.js
```

### Grafana Cloud Integration
```bash
K6_CLOUD_TOKEN=xxx k6 cloud auth-flow.js
```

## Expected Results

> ⚠️ **TODO**: These are placeholder targets. Update with actual benchmark results.

| Metric | Target | Notes |
|--------|--------|-------|
| Login p95 | < 500ms | Single user auth |
| Token Refresh p95 | < 200ms | Cookie-based |
| Chunk Upload p95 | < 2s | 1MB chunks |
| Download p95 | < 1s | Cached CDN |
| Error Rate | < 5% | All endpoints |

## Test Scenarios

### Smoke Test (Quick Validation)
```bash
k6 run --vus 1 --iterations 10 auth-flow.js
```

### Load Test (Normal Traffic)
```bash
k6 run --vus 50 --duration 5m auth-flow.js
```

### Stress Test (Peak Traffic)
```bash
k6 run --vus 200 --duration 2m auth-flow.js
```

### Spike Test (Sudden Traffic)
```bash
k6 run --stage 0:10s --stage 100:1m --stage 0:10s auth-flow.js
```

## Grafana Dashboard

Import the dashboard from `../docs/grafana/fileforge-dashboard.json` to visualize k6 results alongside application metrics.

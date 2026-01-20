# Phase 2 API Documentation

## Health Endpoints

### GET /health
Basic liveness check.

```bash
curl http://localhost:3000/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T12:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

---

### GET /health/deps
Check all dependencies (DB, Redis, Cloudinary).

```bash
curl http://localhost:3000/health/deps
```

**Response (200):**
```json
{
  "status": "ok",
  "checks": {
    "mongodb": { "status": "ok", "state": "connected" },
    "redis": { "status": "ok", "queues": { ... } },
    "cloudinary": { "status": "ok", "configured": true }
  }
}
```

---

### GET /health/metrics
Application metrics.

```bash
curl http://localhost:3000/health/metrics
```

---

## Usage Endpoint

### GET /api/usage
Get current user's usage and limits.

**Headers:** `Authorization: Bearer <token>`

```bash
curl -H "Authorization: Bearer eyJ..." http://localhost:3000/api/usage
```

**Response (200):**
```json
{
  "success": true,
  "plan": "FREE",
  "storage": {
    "used": 52428800,
    "usedMB": 50,
    "limit": 104857600,
    "limitMB": 100,
    "percentage": 50
  },
  "files": { "count": 15, "limit": 20 },
  "shares": { "today": 3, "dailyLimit": 10 },
  "limits": {
    "maxFileSize": 10485760,
    "maxFiles": 20,
    "maxTotalStorage": 104857600
  }
}
```

---

## Admin Endpoints

All admin endpoints require `ADMIN` role.

### GET /api/admin/files
List files with filters.

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:3000/api/admin/files?status=QUARANTINED&page=1&limit=20"
```

### DELETE /api/admin/files/:id
Hard delete a file.

```bash
curl -X DELETE -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/admin/files/60d5ecb54...
```

### GET /api/admin/users
Search users.

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:3000/api/admin/users?search=john"
```

### POST /api/admin/users/:id/disable
Disable a user account.

```bash
curl -X POST -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Violation of terms"}' \
  http://localhost:3000/api/admin/users/60d5ecb54.../disable
```

### POST /api/admin/users/:id/enable
Re-enable a user account.

### GET /api/admin/audit
View audit logs.

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:3000/api/admin/audit?action=auth.login&page=1"
```

### GET /api/admin/stats
Dashboard statistics.

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/admin/stats
```

---

## File Status Lifecycle

```
PENDING → SCANNING → READY → DELETED
                  ↘ QUARANTINED → DELETED
```

| Status | Description | Can Download | Can Share |
|--------|-------------|--------------|-----------|
| PENDING | Just uploaded | ❌ | ❌ |
| SCANNING | Being scanned | ❌ | ❌ |
| READY | Scan passed | ✅ | ✅ |
| QUARANTINED | Malware detected | ❌ | ❌ |
| DELETED | Soft deleted | ❌ | ❌ |

---

## Worker Commands

**Start workers:**
```bash
npm run worker
# Or: node workers/index.js
```

**Worker types:**
- `post-upload`: Verifies uploads, triggers scan
- `security-scan`: Runs virus scanning
- `cleanup`: Scheduled maintenance (hourly/daily)

---

## Environment Variables (Phase 2)

```env
# Redis (for queues)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Scanner
SCANNER_TYPE=auto  # auto|mock|clamav|cloud
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# Retention (days)
RETENTION_SOFT_DELETE_DAYS=30
RETENTION_ABANDONED_HOURS=24
RETENTION_QUARANTINE_DAYS=7

# Logging
LOG_LEVEL=info  # debug|info|warn|error
```

---

## Security Checklist (Phase 2)

- [x] File scanning before availability
- [x] Quarantine infected files
- [x] Soft delete with retention
- [x] Admin-only moderation endpoints
- [x] Audit logging for all actions
- [x] Plan-based quota enforcement
- [x] User disable functionality
- [x] Health checks for monitoring

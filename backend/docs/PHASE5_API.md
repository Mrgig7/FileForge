# Phase 5-6 API Documentation

## (5) Chunked Uploads

### POST /api/uploads/init
Initialize chunked upload with dedup check.

```bash
curl -X POST http://localhost:3000/api/uploads/init \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "large-file.zip",
    "fileSize": 104857600,
    "mimeType": "application/zip",
    "totalChunks": 20,
    "fileHashSha256": "abc123..."
  }'
```

**Response:**
```json
{
  "success": true,
  "uploadId": "uuid-here",
  "chunkSize": 5242880,
  "totalChunks": 20,
  "missingChunks": [0, 1, 2, ...],
  "isDuplicate": false
}
```

---

### POST /api/uploads/chunk
Upload a single chunk.

```bash
curl -X POST http://localhost:3000/api/uploads/chunk \
  -H "Authorization: Bearer eyJ..." \
  -F "uploadId=uuid-here" \
  -F "chunkIndex=0" \
  -F "chunkHashSha256=sha256-of-chunk" \
  -F "chunk=@chunk_0.bin"
```

---

### GET /api/uploads/status/:uploadId
Check upload progress.

---

### POST /api/uploads/complete
Merge chunks, verify checksum, upload to Cloudinary.

---

## (7) Rate Limiting

Applied automatically. Headers returned:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2026-01-20T12:00:00Z
```

---

## (9) Prometheus Metrics

### GET /metrics
Prometheus scrape endpoint.

---

## (17) WebRTC P2P Transfer

### POST /api/p2p/room
Create P2P transfer room.

```bash
curl -X POST http://localhost:3000/api/p2p/room \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"fileName": "myfile.zip", "fileSize": 1048576}'
```

**Response:**
```json
{
  "success": true,
  "roomCode": "ABC123",
  "expiresAt": "2026-01-20T12:30:00Z",
  "iceServers": [{"urls": "stun:stun.l.google.com:19302"}]
}
```

---

## Environment Variables (Phase 5-6)

```env
# Chunk Storage
CHUNK_STORE_PATH=/tmp/fileforge/chunks

# Rate Limiting (uses existing Redis)
# Already configured: REDIS_HOST, REDIS_PORT

# Prometheus
# No additional config needed

# WebRTC TURN (optional, for NAT traversal)
TURN_URL=turn:your-turn-server.com:3478
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-credential

# Captcha (NEEDS CLARIFICATION)
# RECAPTCHA_SECRET_KEY=
# HCAPTCHA_SECRET_KEY=
```

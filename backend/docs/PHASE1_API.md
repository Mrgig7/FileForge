# Phase 1 API Documentation

## Authentication API (v2)

Base URL: `/api/auth/v2`

### POST /register
Create a new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please log in."
}
```

**Errors:** 400 (validation), 409 (duplicate email)

---

### POST /login
Authenticate and receive tokens.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER"
  }
}
```

**Cookie Set:** `refreshToken` (httpOnly, secure, sameSite=Strict)

---

### POST /refresh
Refresh access token using refresh token cookie.

**Request:** (Cookie required)
```bash
curl -X POST http://localhost:3000/api/auth/v2/refresh \
  -H "Cookie: refreshToken=abc123..."
```

**Response (200):**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": { ... }
}
```

---

### POST /logout
Logout current session.

```bash
curl -X POST http://localhost:3000/api/auth/v2/logout \
  -H "Cookie: refreshToken=abc123..."
```

---

### POST /logout-all
Logout from all devices.

```bash
curl -X POST http://localhost:3000/api/auth/v2/logout-all \
  -H "Authorization: Bearer eyJhbGc..."
```

---

## Presigned Upload API

Base URL: `/api/uploads`

### POST /presign
Get a presigned URL for direct CDN upload.

**Request:**
```json
{
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "fileSize": 1048576
}
```

**Response (200):**
```json
{
  "success": true,
  "uploadUrl": "https://api.cloudinary.com/v1_1/...",
  "uploadParams": {
    "timestamp": 1705760000,
    "folder": "fileforge/users/507f1f...",
    "public_id": "1705760000-abc123",
    "signature": "abcdef123456..."
  },
  "fileKey": "fileforge/users/507f.../1705760000-abc123",
  "cdnUrl": "https://res.cloudinary.com/...",
  "expiresAt": "2025-01-20T17:00:00Z"
}
```

**Frontend Upload Example:**
```javascript
// 1. Get presigned URL
const presignRes = await fetch('/api/uploads/presign', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size })
});
const { uploadUrl, uploadParams } = await presignRes.json();

// 2. Upload directly to Cloudinary
const formData = new FormData();
Object.entries(uploadParams).forEach(([key, val]) => formData.append(key, val));
formData.append('file', file);

const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
const cloudinaryResult = await uploadRes.json();

// 3. Confirm upload
await fetch('/api/uploads/complete', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  body: JSON.stringify({
    fileKey: uploadParams.folder + '/' + uploadParams.public_id,
    publicId: cloudinaryResult.public_id,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    cloudinaryUrl: cloudinaryResult.secure_url
  })
});
```

---

### POST /complete
Confirm upload and save file metadata.

**Request:**
```json
{
  "fileKey": "fileforge/users/.../123-abc",
  "publicId": "fileforge/users/.../123-abc",
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "fileType": "application/pdf",
  "cloudinaryUrl": "https://res.cloudinary.com/...",
  "expiresAfter": "7d",
  "maxDownloads": 10
}
```

---

## Share Link API

Base URL: `/api/share`

### POST /create
Create a share link for a file.

**Request:**
```json
{
  "fileId": "file-uuid-here",
  "expiresIn": "7d",
  "password": "optional-password",
  "maxDownloads": 10
}
```

**Response (201):**
```json
{
  "success": true,
  "shareLink": {
    "id": "...",
    "token": "abc123def456...",
    "url": "https://app.com/s/abc123?sig=xyz&exp=1705760000",
    "expiresAt": "2025-01-27T12:00:00Z",
    "hasPassword": true,
    "maxDownloads": 10
  }
}
```

---

### GET /:token
Access share link info.

**Query Params:** `sig` (HMAC signature), `exp` (expiry timestamp)

**Response:**
```json
{
  "success": true,
  "requiresPassword": true,
  "file": {
    "name": "document.pdf",
    "size": 1048576,
    "createdAt": "..."
  }
}
```

---

### POST /:token/verify-password
Verify password for protected link.

**Request:**
```json
{
  "password": "secret123"
}
```

**Response (200):**
```json
{
  "success": true,
  "downloadToken": "xyz789...",
  "downloadAuth": {
    "sig": "abc...",
    "exp": 1705760300
  }
}
```

---

### GET /:token/download
Download file through share link.

**Query Params:**
- `downloadToken` - From password verification
- `downloadAuth` - JSON with sig and exp

---

## Environment Variables

Add to `.env`:

```env
# Phase 1: Auth
JWT_SECRET=your-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY_DAYS=7
SESSION_SECRET=your-session-secret

# Phase 1: Share Links
SHARE_LINK_SECRET=your-share-secret-min-32-chars

# Existing
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

---

## Security Checklist

- [x] Access tokens short-lived (15 min)
- [x] Refresh tokens in httpOnly cookies
- [x] Refresh token rotation
- [x] Token reuse detection
- [x] RBAC roles: USER, PRO, ADMIN
- [x] Permission-based access control
- [x] File size limits by role
- [x] MIME type whitelist
- [x] Path traversal prevention
- [x] HMAC-signed share links
- [x] Password-protected links (bcrypt)
- [x] Download limits
- [x] IP-based rate limiting
- [x] Audit logging

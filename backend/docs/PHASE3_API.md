# Phase 3 API Documentation

## A) Workspaces

### POST /api/workspaces
Create a new workspace.

**Headers:** `Authorization: Bearer <token>`

```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"name": "My Team", "description": "Team workspace"}'
```

**Response (201):**
```json
{
  "success": true,
  "workspace": {
    "id": "...",
    "name": "My Team",
    "slug": "my-team-abc123",
    "role": "OWNER"
  }
}
```

---

### GET /api/workspaces
List user's workspaces.

```bash
curl http://localhost:3000/api/workspaces \
  -H "Authorization: Bearer eyJ..."
```

---

### POST /api/workspaces/:id/invite
Invite user to workspace.

```bash
curl -X POST http://localhost:3000/api/workspaces/abc123/invite \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "role": "MEMBER"}'
```

---

### POST /api/workspaces/invite/accept
Accept invitation.

```bash
curl -X POST http://localhost:3000/api/workspaces/invite/accept \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123..."}'
```

---

### PATCH /api/workspaces/:id/members/:userId/role
Change member role.

```bash
curl -X PATCH http://localhost:3000/api/workspaces/abc/members/xyz/role \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

---

### DELETE /api/workspaces/:id/members/:userId
Remove member.

---

## B) File Versioning

### GET /api/files/:fileId/versions
List version history.

```bash
curl http://localhost:3000/api/files/abc123/versions \
  -H "Authorization: Bearer eyJ..."
```

---

### POST /api/files/:fileId/versions/presign
Get presigned URL for new version.

```bash
curl -X POST http://localhost:3000/api/files/abc123/versions/presign \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"fileName": "doc.pdf", "fileSize": 1024}'
```

---

### POST /api/files/:fileId/versions/complete
Complete version upload.

---

### POST /api/files/:fileId/versions/:versionId/restore
Restore version as current.

---

## C) Billing

### POST /api/billing/checkout
Create checkout session.

```bash
curl -X POST http://localhost:3000/api/billing/checkout \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"plan": "PRO"}'
```

**Response:**
```json
{
  "success": true,
  "sessionId": "cs_...",
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

---

### POST /api/billing/webhook
Stripe webhook endpoint.

---

### GET /api/billing/subscription
Get subscription status.

---

### POST /api/billing/cancel
Cancel subscription.

---

## D) Audit Log Verification

### GET /api/admin/audit/verify
Verify hash chain integrity (Admin only).

```bash
curl http://localhost:3000/api/admin/audit/verify \
  -H "Authorization: Bearer <admin-token>"
```

---

## Workspace Roles

| Role | Permissions |
|------|-------------|
| OWNER | Everything (*) |
| ADMIN | Manage members, settings, all files |
| MEMBER | Upload, share, manage own files |
| VIEWER | Read-only access |

---

## Subscription Plans

| Plan | Storage | Files | Members | Versions |
|------|---------|-------|---------|----------|
| FREE | 100MB | 20 | 1 | 3 |
| PRO | 10GB | 1000 | 1 | 10 |
| TEAM | 100GB | 10000 | 25 | 50 |
| ENTERPRISE | ∞ | ∞ | ∞ | ∞ |

---

## Environment Variables (Phase 3)

```env
# Stripe Billing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...

# Workspace defaults
DEFAULT_WORKSPACE_MEMBER_LIMIT=5
DEFAULT_WORKSPACE_STORAGE_LIMIT=1073741824

# Multi-region (future)
# AWS_REGION=us-east-1
# S3_BUCKET=fileforge-uploads
```

---

## Security Checklist

- [x] Workspace isolation (files scoped by workspaceId)
- [x] Role-based access control per workspace
- [x] Invitation tokens are cryptographically random
- [x] Billing webhook signature verification
- [x] Hash-chained audit logs for tamper-evidence
- [x] Version access respects file permissions

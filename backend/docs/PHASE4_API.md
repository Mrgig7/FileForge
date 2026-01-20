# Phase 4 API Documentation

## A) SSO Configuration

### POST /api/workspaces/:id/sso/config
Configure OIDC SSO for workspace.

**Headers:** `Authorization: Bearer <token>` (OWNER only)

```bash
curl -X POST http://localhost:3000/api/workspaces/abc123/sso/config \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "type": "OIDC",
    "name": "Google Workspace",
    "issuerUrl": "https://accounts.google.com",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "autoProvision": true
  }'
```

### POST /api/auth/sso/:workspaceId/start
Initiate SSO flow (returns authorization URL).

### GET /api/auth/sso/:workspaceId/callback
OIDC callback (handled by IdP).

---

## B) SCIM Provisioning

### GET /scim/v2/Users
List workspace users.

**Headers:** `Authorization: Bearer scim_...`

```bash
curl http://localhost:3000/scim/v2/Users \
  -H "Authorization: Bearer scim_abc123..."
```

### POST /scim/v2/Users
Provision new user.

```bash
curl -X POST http://localhost:3000/scim/v2/Users \
  -H "Authorization: Bearer scim_..." \
  -H "Content-Type: application/json" \
  -d '{"userName": "user@example.com", "name": {"formatted": "John Doe"}}'
```

### PATCH /scim/v2/Users/:id
Update user (typically active status).

### DELETE /scim/v2/Users/:id
Deprovision user.

---

## C) Session Management

### GET /api/me/sessions
List active sessions.

```bash
curl http://localhost:3000/api/me/sessions \
  -H "Authorization: Bearer eyJ..."
```

### POST /api/me/sessions/:id/revoke
Revoke specific session.

### POST /api/me/sessions/revoke-all
Revoke all sessions.

---

## D) DLP Policy

### PUT /api/workspaces/:id/dlp
Update DLP policy.

```bash
curl -X PUT http://localhost:3000/api/workspaces/abc123/dlp \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "blockExternalSharing": true,
    "requirePasswordForConfidential": true
  }'
```

### DLP Classifications
- `PUBLIC` - No restrictions
- `INTERNAL` - Workspace members preferred
- `CONFIDENTIAL` - Password/login required
- `RESTRICTED` - Workspace-only, admin approval

---

## E) Legal Hold

### POST /api/admin/security/legal-holds
Create legal hold.

```bash
curl -X POST http://localhost:3000/api/admin/security/legal-holds \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": "abc", "name": "Case 2026-01", "reason": "Litigation hold"}'
```

### POST /api/admin/security/legal-holds/:id/add-file
Add file to hold.

### POST /api/admin/security/legal-holds/:id/release
Release legal hold.

---

## F) Security Center

### GET /api/admin/security/summary
Get security dashboard.

```bash
curl http://localhost:3000/api/admin/security/summary?workspaceId=abc \
  -H "Authorization: Bearer eyJ..."
```

### GET /api/admin/security/events
List security events.

---

## G) Lockdown Mode

### POST /api/admin/security/workspaces/:id/lockdown/enable
Enable emergency lockdown.

```bash
curl -X POST http://localhost:3000/api/admin/security/workspaces/abc/lockdown/enable \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"reason": "Security incident detected"}'
```

### POST /api/admin/security/workspaces/:id/lockdown/disable
Disable lockdown.

---

## Environment Variables (Phase 4)

```env
# SSO Encryption
IDP_ENCRYPTION_KEY=32-character-encryption-key-here

# SCIM Rate Limiting
SCIM_RATE_LIMIT_MAX=100
SCIM_RATE_LIMIT_WINDOW_MS=60000

# Break-Glass Token Expiry
BREAK_GLASS_TOKEN_EXPIRY_MINUTES=30
```

---

## Security Checklist

| Control | Implementation |
|---------|----------------|
| SSO issuer validation | IdentityProvider.isActive() |
| SCIM token hashing | ScimToken.hashToken() |
| DLP policy evaluation | dlpEngine.evaluateDlpPolicies() |
| Legal hold enforcement | LegalHold.isFileUnderHold() |
| Tamper-proof audit | AuditLog hash-chain (Phase 3) |
| Session binding | Device fingerprint hash |
| Lockdown mode | lockdownMiddleware.js |

---

## NEEDS CLARIFICATION

| Item | Details |
|------|---------|
| **SAML** | Interface only; needs xml-crypto, saml2-js |
| **Geo-IP** | External service (MaxMind) required |
| **MFA** | Not implemented; could use TOTP/WebAuthn |
| **eDiscovery Export** | Async job queue integration pending |

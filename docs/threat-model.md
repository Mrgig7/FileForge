# FileForge Threat Model

> Security analysis of assets, threats, and mitigations.

---

## 1. Asset Inventory

| Asset | Sensitivity | Storage Location | Access Control |
|-------|-------------|------------------|----------------|
| **User Files** | High | Cloudinary CDN | Owner + Share Link |
| **Access Tokens (JWT)** | Critical | Client memory/localStorage | Per-user |
| **Refresh Tokens** | Critical | httpOnly cookies + MongoDB | Per-user, per-device |
| **Share Link Tokens** | Medium-High | MongoDB | Public (token-based) |
| **User Passwords** | Critical | MongoDB (bcrypt hashed) | Never exposed |
| **API Keys** | Critical | Environment variables | Server-only |
| **Audit Logs** | High | MongoDB (hash-chained) | Admin-only |
| **Subscription Data** | High | MongoDB | Per-user |

---

## 2. Threat Categories & Mitigations

### 2.1 Authentication Threats

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| **Brute Force Login** | High | Rate limiting (5 attempts → lockout) | ✅ Implemented |
| **Credential Stuffing** | High | Per-IP + per-email tracking, CAPTCHA | ✅ Implemented |
| **Password Guessing** | Medium | Minimum 6 chars, bcrypt cost factor 12 | ✅ Implemented |
| **Session Hijacking** | High | httpOnly cookies, SameSite=Strict | ✅ Implemented |
| **Token Theft** | High | Short-lived access tokens (15 min), rotation | ✅ Implemented |
| **Token Replay** | High | Refresh token reuse detection → revoke family | ✅ Implemented |

### 2.2 Authorization Threats

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| **Privilege Escalation** | High | RBAC middleware checks on every request | ✅ Implemented |
| **IDOR (Insecure Direct Object Reference)** | High | Owner validation before file access | ✅ Implemented |
| **Share Link Enumeration** | Medium | Cryptographic random tokens (32 bytes) | ✅ Implemented |
| **Expired Token Access** | Medium | TTL indexes on MongoDB, expiry checks | ✅ Implemented |

### 2.3 Upload/Download Threats

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| **Malware Upload** | Critical | ClamAV scanning queue | ✅ Implemented |
| **Path Traversal** | Critical | Filename sanitization, no user-controlled paths | ✅ Implemented |
| **MIME Type Spoofing** | Medium | Magic byte validation, MIME whitelist | ✅ Implemented |
| **Storage Quota Abuse** | Medium | Per-role limits enforced server-side | ✅ Implemented |
| **Denial of Service (large files)** | Medium | Chunked uploads, size limits | ✅ Implemented |

### 2.4 Share Link Threats

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| **Link Guessing** | High | 32-byte cryptographic tokens | ✅ Implemented |
| **Unauthorized Access** | Medium | Password protection option | ✅ Implemented |
| **Expired Link Access** | Low | TTL expiry with MongoDB indexes | ✅ Implemented |
| **Download Farming** | Medium | Download limits per link | ✅ Implemented |
| **Link Sharing Abuse** | Low | IP-based throttling | ✅ Implemented |
| **Signature Tampering** | High | HMAC-SHA256 signed links | ✅ Implemented |
| **Timing Attacks** | Low | Constant-time comparison for signatures | ✅ Implemented |

### 2.5 Infrastructure Threats

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| **DDoS** | High | Rate limiting, Cloudflare (recommended) | ⚠️ Partial |
| **Database Injection** | Critical | Mongoose ODM, parameterized queries | ✅ Implemented |
| **XSS** | High | React auto-escaping, CSP headers | ✅ Implemented |
| **CSRF** | High | SameSite cookies, origin validation | ✅ Implemented |
| **Log Tampering** | Medium | Hash-chained audit logs | ✅ Implemented |
| **Key Exposure** | Critical | Environment variables, no hardcoded secrets | ✅ Implemented |

### 2.6 P2P Transfer Threats

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| **MITM in P2P** | High | DataChannel encrypted by WebRTC (DTLS) | ✅ Implemented |
| **Signaling Tampering** | Medium | Auth required for signaling | ✅ Implemented |
| **NAT Traversal Failure** | Medium | STUN/TURN servers, cloud fallback | ✅ Implemented |
| **Large File DoS** | Low | Chunked transfer, progress tracking | ✅ Implemented |

---

## 3. Security Controls Matrix

| Control | Layer | Implementation |
|---------|-------|----------------|
| Authentication | Application | JWT + Refresh Tokens |
| Authorization | Application | RBAC Middleware |
| Rate Limiting | Application | Express middleware (Redis-backed) |
| Input Validation | Application | Joi/Express-validator |
| Output Encoding | Application | React auto-escaping |
| Encryption at Rest | Database | MongoDB Atlas encryption + Field-level AES |
| Encryption in Transit | Network | HTTPS (TLS 1.2+) |
| Malware Detection | Application | ClamAV scanning queue |
| Logging | Application | Pino structured logging |
| Audit Trail | Application | Hash-chained audit logs |
| Monitoring | Infrastructure | Prometheus + Grafana |
| Tracing | Infrastructure | OpenTelemetry → Tempo/Jaeger |

---

## 4. Known Gaps & Roadmap

| Gap | Priority | Planned Mitigation |
|-----|----------|-------------------|
| DDoS protection at edge | High | Add Cloudflare or similar WAF |
| CSP headers hardening | Medium | Implement strict Content-Security-Policy |
| Subresource Integrity (SRI) | Low | Add SRI hashes for CDN scripts |
| Security.txt | Low | Add /.well-known/security.txt |
| Bug bounty program | Low | Consider HackerOne/Bugcrowd |

---

## 5. Incident Response

### Detection
- Prometheus alerts on error rate spikes
- Audit log monitoring for suspicious patterns
- Rate limit breach notifications

### Response
1. Identify affected scope from logs
2. Revoke compromised tokens (`revokeAllUserTokens`)
3. Reset affected credentials
4. Notify affected users
5. Post-incident review

---

## 6. Security Testing Recommendations

| Type | Tool | Frequency |
|------|------|-----------|
| Dependency Audit | `npm audit`, Snyk | Every PR |
| SAST | ESLint security plugin | Every PR |
| DAST | OWASP ZAP | Monthly |
| Penetration Testing | Manual | Annually |
| Secret Scanning | GitGuardian, truffleHog | Every PR |

---

*Last updated: 2026-01-20*
*Document owner: Security Team*

---
name: security-hardening
description: Security hardening patterns for Zidney — CSRF, CSP, input sanitization, dependency scanning, and rate limiting implementation
metadata:
  category: security
  scope: all-services
  capabilities:
    - CSRF protection patterns
    - CSP header configuration
    - input sanitization
    - dependency vulnerability scanning
    - rate limiting implementation
    - secret management practices
---

# Security Hardening Skill

This skill codifies common security patterns for Zidney. While the Security Auditor agent reviews code, this skill provides the implementation reference.

---

## Input Sanitization

All user input must be validated via Zod schemas (`packages/validation`) before processing.

Additional rules:
- HTML in user input must be escaped or stripped (no raw HTML rendering)
- SQL injection is prevented by Drizzle ORM's parameterized queries — never use string interpolation for SQL
- File uploads must validate MIME type, file size, and extension server-side
- URL parameters must be validated against expected patterns

```typescript
// ✅ Safe — parameterized via Drizzle
const result = await db.select().from(users).where(eq(users.id, validatedId));

// ❌ Dangerous — string interpolation
const result = await db.execute(sql`SELECT * FROM users WHERE id = ${unsafeInput}`);
```

---

## CSRF Protection

For state-changing requests (POST, PUT, PATCH, DELETE):

- API uses token-based auth (Bearer JWT) — inherently CSRF-resistant for API calls
- Cookie-based sessions (if any) must include `SameSite=Strict` and CSRF token validation
- Frontend forms using cookies must embed a CSRF token in a hidden field
- CSRF tokens must be per-session and validated server-side

---

## Content Security Policy (CSP)

API must set CSP headers for any HTML-serving endpoints:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';
```

Rules:
- No `'unsafe-eval'` in script-src
- No wildcard (`*`) in any directive
- `frame-ancestors 'none'` prevents clickjacking
- Report violations to a monitoring endpoint when available

---

## Rate Limiting

Mandatory limits per AGENTS.md:

| Endpoint | Limit |
|----------|-------|
| Login | 5 attempts/minute per IP |
| Submission | Idempotent — 1 per attempt |
| WebSocket | 1 connection per user per attempt |
| Public endpoints | Rate limited (configurable) |
| Password reset | 3 requests/hour per email |

Implementation via Redis-backed sliding window:

```typescript
import { checkRateLimit } from '@zidney/redis-utils';

const allowed = await checkRateLimit({
  key: `login:${clientIp}`,
  limit: 5,
  window: 60, // seconds
});

if (!allowed) {
  return c.json({
    success: false,
    data: null,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
  }, 429);
}
```

---

## Secret Management

- **No secrets in code** — always use environment variables or Docker secrets
- **No secrets in logs** — redact tokens, passwords, API keys
- **No secrets in frontend bundles** — server-side config only
- **No `.env` in production** — use Docker secrets or equivalent
- **Rotate secrets periodically** — JWT signing keys, API keys, database passwords

Environment variable naming:
```
DATABASE_URL, REDIS_URL, JWT_SECRET, API_KEY_*
```

---

## Dependency Security

Before adding a dependency:
1. Check for known CVEs (npm audit / Snyk)
2. Verify the package is actively maintained
3. Prefer packages with TypeScript types
4. Minimize dependency tree depth

```bash
bun audit    # Check for known vulnerabilities
```

---

## Authentication Security

- JWT tokens must have reasonable expiration (e.g., 15 min access, 7 day refresh)
- Refresh tokens must be stored securely (httpOnly cookie)
- Password hashing must use bcrypt or argon2
- Never store plaintext passwords
- Session invalidation must be supported (logout, password change)

---

## Response Headers

Every API response should include:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-XSS-Protection: 0  (rely on CSP instead)
```

---

## Verdict Protocol

```
VERDICT: PASS   — security patterns correctly implemented
VERDICT: BLOCKED — security vulnerability detected (specify which OWASP category)
```

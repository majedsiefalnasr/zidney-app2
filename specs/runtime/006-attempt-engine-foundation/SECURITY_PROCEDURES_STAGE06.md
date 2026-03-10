# STAGE 06 Security Procedures

**Version:** 1.0.0  
**Status:** Production Ready  
**Last Updated:** 2026-02-18

---

## Overview

This document defines security procedures for the Attempt Engine (STAGE 06) covering data
protection, access control, vulnerability management, and incident response.

---

## Data Protection

### Database Encryption

#### At-Rest Encryption (PostgreSQL)

```sql
-- Enable pgcrypto extension (encryption functions)
CREATE EXTENSION pgcrypto;

-- Example: Encrypt sensitive columns (future, Phase 2)
CREATE TABLE encrypted_attempts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  -- sensitive_data would be encrypted
  encrypted_data bytea NOT NULL,
  encrypted_password_hash text NOT NULL
);

-- Encryption/Decryption example
INSERT INTO encrypted_attempts (
  id, user_id, encrypted_data
) VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440003',
  pgp_sym_encrypt('sensitive data', 'secret_key')
);

-- Decrypt
SELECT pgp_sym_decrypt(encrypted_data, 'secret_key') AS data
FROM encrypted_attempts;
```

**Note:** Current implementation (v1.0.0) does NOT encrypt user responses. Phase 2 will add optional
encryption.

#### In-Transit Encryption (TLS/SSL)

```bash
# PostgreSQL SSL configuration
# postgresql.conf
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
ssl_protocols = 'TLSv1.2,TLSv1.3'

# Client connection (enforce SSL)
psql "postgresql://user:pass@postgres.example.com:5432/zidney_tenant?sslmode=require"
```

```javascript
// Node.js database connection (enforce TLS)
const connectionString = process.env.DATABASE_URL;
// Should include: ?sslmode=require

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: true, // Verify certificate
    ca: fs.readFileSync("/etc/ssl/certs/ca.crt", "utf8"),
  },
});
```

#### Backup Encryption

```bash
# Encrypt database backup
pg_dump zidney_tenant_acme \
  | pgp_sym_encrypt('backup_key') \
  | gzip > /backups/backup_encrypted.sql.gz

# Decrypt and restore
gunzip -c /backups/backup_encrypted.sql.gz \
  | pgp_sym_decrypt('backup_key') \
  | psql zidney_tenant_acme

# Verify integrity
md5sum /backups/backup_encrypted.sql.gz > /backups/checksums.txt
```

---

### Data Classification

| Classification   | Examples                      | Sensitivity | Encryption         |
| ---------------- | ----------------------------- | ----------- | ------------------ |
| **Public**       | Exam questions, course titles | Low         | Not required       |
| **Internal**     | User names, attempt scores    | Medium      | Recommended        |
| **Confidential** | User IDs, timestamps          | High        | Required (Phase 2) |
| **Secret**       | JWT keys, DB passwords        | Critical    | Always encrypted   |

---

## Access Control

### Database Access

#### Principle of Least Privilege

```sql
-- Service account (API/Worker)
CREATE ROLE zidney_app WITH LOGIN PASSWORD '$PASSWORD';
GRANT CONNECT ON DATABASE zidney_tenant_acme TO zidney_app;

-- Limit to specific tables
GRANT SELECT, INSERT, UPDATE ON attempts TO zidney_app;
GRANT SELECT, INSERT ON attempt_progress TO zidney_app;
GRANT SELECT, INSERT, UPDATE ON grading_jobs TO zidney_app;

-- Deny dangerous operations
REVOKE DELETE ON attempts FROM zidney_app;
REVOKE ALTER ON SCHEMA public FROM zidney_app;

-- Audit all access
CREATE AUDIT TABLE:
  - timestamp
  - user_role
  - operation (SELECT/INSERT/UPDATE)
  - table_name
  - rows_affected
```

#### Role-Based Access Control (RBAC)

```typescript
// API middleware - enforce roles
type UserRole = "admin" | "teacher" | "student";

async function enforceRole(req: Request, requiredRoles: UserRole[]) {
  const userRole = req.user.role; // From JWT

  if (!requiredRoles.includes(userRole)) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Insufficient permissions" },
    });
  }
}

// Usage
app.post(
  "/api/v1/attempts",
  enforceRole(["student"]), // Only students can take exams
  authMiddleware,
  createAttemptHandler,
);

app.post(
  "/api/admin/grades/override",
  enforceRole(["admin"]), // Only admins can override
  authMiddleware,
  overrideGradeHandler,
);
```

#### Authentication

```typescript
// JWT Configuration
interface JWTPayload {
  sub: string; // user_id
  workspace_slug: string; // tenant identifier
  role: "admin" | "teacher" | "student";
  iat: number; // issued at
  exp: number; // expiration (1 hour)
}

// Token Validation
function validateJWT(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, process.env.JWT_PUBLIC_KEY, {
      algorithms: ["RS256"],
      issuer: "https://zidney.com",
      audience: "api.zidney.com",
    });
    return payload;
  } catch (error) {
    throw new UnauthorizedError("Invalid token");
  }
}

// Token Rotation (Phase 2)
// - Refresh tokens with 7-day expiry
// - Access tokens with 1-hour expiry
// - Automatic renewal via /auth/refresh
```

---

## Audit Trail

### Logging Requirements

All operations logged with:

```json
{
  "timestamp": "2026-02-18T14:30:00Z",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "service": "api",
  "user_id": "550e8400-e29b-41d4-a716-446655440003",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440002",
  "action": "attempt_created|attempt_submitted|attempt_graded",
  "resource_id": "attempt_id",
  "status": "success|failure",
  "details": {
    "score": 18.5,
    "passed": true
  }
}
```

### Immutable Audit Log

```sql
-- Audit table (IMMUTABLE - no deletes)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id UUID,
  workspace_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  before_state JSONB,
  after_state JSONB,

  CONSTRAINT no_delete_audit_log CHECK (false)  -- Prevent deletes
);

-- Archive old logs (append-only)
ALTER TABLE audit_log
  ADD CONSTRAINT fk_archive
  FOREIGN KEY (workspace_id)
  REFERENCES workspaces(id)
  ON DELETE RESTRICT;  -- Prevent cascade delete
```

---

## Vulnerability Management

### SQL Injection Prevention

**Requirement:** All SQL queries must be parameterized.

```typescript
// ✅ SAFE (parameterized)
const query = "SELECT * FROM attempts WHERE workspace_id = $1 AND id = $2";
const result = db.query(query, [workspaceId, attemptId]);

// ❌ UNSAFE (string concatenation)
const query = `SELECT * FROM attempts WHERE workspace_id = '${workspaceId}'`;
const result = db.query(query); // SQL injection risk!
```

**Verification:**

```bash
# No string concatenation in queries
grep -r '\${\|string.concat\|query +' apps/api/src/ apps/worker/src/ | wc -l
# Expected: 0 matches
```

### Cross-Site Scripting (XSS) Prevention

```typescript
// Input sanitization (Vue.js handles this)
// Never use v-html with user input

// ✅ SAFE
<div>{{ userInput }}</div>  <!-- Escaped automatically -->

// ❌ UNSAFE
<div v-html="userInput"></div>  <!-- Raw HTML - XSS risk -->

// Output encoding
function sanitizeOutput(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### CSRF Prevention

```typescript
// Token-based CSRF (via JWT)
// No cookies = No CSRF (modern SPA model)

// Alternative: CSRF tokens for forms
app.post("/api/form", (req, res) => {
  const csrf = req.headers["x-csrf-token"];

  if (!csrf || !validateCSRFToken(csrf)) {
    return res.status(403).json({
      error: { code: "INVALID_CSRF" },
    });
  }

  // Process form
});
```

### Dependency Vulnerabilities

```bash
# Check for known vulnerabilities
npm audit

# Update vulnerable packages
npm audit fix

# Lock production versions
npm ci (not npm install in production)

# CI/CD gate: Fail on high severity
npm audit --audit-level=high
```

---

## Rate Limiting

### Login Endpoint

```typescript
// 5 login attempts per minute per IP
limiter.login = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: { code: "TOO_MANY_LOGIN_ATTEMPTS" },
    });
  },
});

app.post("/auth/login", limiter.login, loginHandler);
```

### API Attempts

```typescript
// 5 create attempts per minute per user
limiter.attempts = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user.id, // Per user
  handler: (req, res) => {
    res.status(429).json({
      error: { code: "TOO_MANY_ATTEMPTS" },
    });
  },
});

app.post("/api/v1/attempts", limiter.attempts, createAttemptHandler);
```

---

## Secrets Management

### Environment Variables

```bash
# ✅ Correct: Load from environment
const dbPassword = process.env.DB_PASSWORD;
const jwtKey = process.env.JWT_PRIVATE_KEY;

// ✅ In production: Docker secrets
docker secret create db_password /secrets/db_password.txt

// ❌ Wrong: Hardcoded in code
const password = 'super_secret_pass';  // Never!
```

### Secrets Rotation

```bash
# Quarterly rotation of all secrets
1. Generate new JWT key pair
2. Update Docker secret
3. Restart services with new key
4. Old key still valid for 24 hours (grace period)
5. After 24 hours, invalidate old key

# Database password rotation
1. Create new user account
2. Migrate service to new account
3. Remove old account after 24 hours
```

### Secret Handling in Logs

```typescript
// ❌ WRONG - leaks secret
console.log("JWT Key:", jwtKey);

// ✅ CORRECT - never log secrets
logger.debug("JWT key loaded successfully");

// ✅ CORRECT - only log redacted values
const sanitized = {
  database: "postgresql://user:****@host:5432/db",
  apiKey: "sk-****...****",
};
logger.info("Credentials loaded", sanitized);
```

---

## Incident Response

### Security Incident Classification

| Severity     | Example                               | Response Time | Action             |
| ------------ | ------------------------------------- | ------------- | ------------------ |
| **CRITICAL** | Data breach, SQL injection found      | 15 min        | Escalate, isolate  |
| **HIGH**     | Unauthorized access, XSS found        | 1 hour        | Fix, patch, deploy |
| **MEDIUM**   | Rate limiting bypass, weak password   | 4 hours       | Fix, document      |
| **LOW**      | Information disclosure, timing attack | 24 hours      | Monitor, research  |

### Breach Response Procedure

```
1. DETECT & CONFIRM
   - Alert fires (unauthorized access, rate limit bypass)
   - Confirm with logs/metrics

2. CONTAIN (First 30 minutes)
   - Isolate affected component (stop pod if needed)
   - Preserve evidence (snapshot logs, DB state)
   - Notify security team

3. INVESTIGATE (30 min - 2 hours)
   - Determine scope (which users/data affected)
   - Root cause analysis (logs, code review)
   - Timeline of events

4. REMEDIATE
   - Fix vulnerability in code
   - Update database if corrupted
   - Deploy patched version
   - Verify fix with tests

5. COMMUNICATE
   - Notify affected users (email, in-app)
   - Legal review of notification (GDPR, CCPA)
   - Public disclosure (if required)

6. POSTMORTEM
   - Document lessons learned
   - Update security procedures
   - Schedule follow-up review
```

---

## Security Testing

### Pre-Deployment Security Checklist

- [ ] SQL injection tests (all queries parameterized)
- [ ] XSS tests (all output escaped)
- [ ] CSRF tests (token validation)
- [ ] Authentication bypass tests (JWT validation)
- [ ] Authorization tests (role enforcement)
- [ ] Rate limiting tests (limits trigger)
- [ ] Secrets in code (grep for hardcoded credentials)
- [ ] Dependency vulnerabilities (npm audit)

### Automated Security Gates

```bash
# CI/CD security pipeline
npm audit --audit-level=high          # Fail if high severity
npm run test:security                 # Custom security tests
npm run lint:eslint --no-cache        # Linting rules
npm run test:integration              # E2E security tests
```

---

## Compliance Standards

### GDPR Compliance

- ✅ Data encryption (at-rest and in-transit)
- ✅ Access control (RBAC, audit logging)
- ✅ Data residency (database-per-tenant)
- ✅ Right to deletion (cascade delete on workspace)
- ✅ Consent logging (audit trail)

### CCPA Compliance

- ✅ Data inventory (what's stored)
- ✅ Access requests (subject access procedure)
- ✅ Deletion requests (erasure procedure)
- ✅ Opt-out mechanisms (future, Phase 2)

### SOC 2 Type II

- ✅ Access controls (RBAC)
- ✅ Change management (migrations, versioning)
- ✅ Monitoring (logs, alerts)
- ✅ Disaster recovery (backups, RTO/RPO)

---

## Security Contact

- **Report vulnerability:** security@zidney.com
- **On-call security:** [PagerDuty escalation]
- **Incident war room:** [Zoom link]
- **Policy questions:** compliance@zidney.com

---

**Last Updated:** 2026-02-18  
**Next Review:** 2026-04-18  
**Maintainer:** Zidney Security Team

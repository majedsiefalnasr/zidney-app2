# SPEC – Authentication System (STAGE_03)

**Phase:** 1 – Platform Foundation  
**Stage:** STAGE_03_AUTHENTICATION_SYSTEM  
**Status:** Specification  
**Priority:** Critical  
**Feature Area:** Workspace-isolated authentication, JWT governance, access enforcement

---

## Feature Overview

### What Is Being Built

A secure, strictly isolated authentication system across three independent domains (MMC, Backoffice, Frontoffice) that guarantees:

- Zero cross-workspace token leakage via workspace_id validation
- License-aware login enforcement (SOFT_LOCKED, ARCHIVED blocks)
- Schema-version-aware session validation (426 on mismatch)
- RBAC enforcement at API layer (no frontend security checks)
- Forced token invalidation capability via token_version
- Audit-grade traceability (structured JSON logging)

Authentication is Zidney's second layer of institutional trust after tenant isolation.

### Phase & Stage Mapping

- **Phase:** 1 – Platform Foundation
- **Stage:** STAGE_03_AUTHENTICATION_SYSTEM
- **Prerequisite Stages:** STAGE_02A (Master DB), STAGE_02B (Tenant baseline), STAGE_02C (Versioning)
- **Provides foundation for:** All user-bound routes, license enforcement, runtime security
- **Reference:** [STAGE_03_AUTHENTICATION_SYSTEM.md](../../../phases/01_PLATFORM_FOUNDATION/STAGE_03_AUTHENTICATION_SYSTEM.md)

### Affected Architectural Layers

- **Isolation:** Core enforcement — workspace_id in all tenant tokens, no cross-workspace reuse
- **License Enforcement:** Mandatory — ACTIVE required for token issuance, checked on every request
- **Attempt Engine:** Optional — token_version affects session invalidation
- **Worker:** Not in scope for Phase 1
- **Runtime:** Session lifecycle owns expiration, version compatibility
- **Frontoffice:** Receives JWT token only, no auth logic

---

## Constitutional Compliance Declaration

**Mandatory Compliance Confirmations:**

✓ **No cross-tenant access** — workspace_id in token compared against resolved workspace on every request  
✓ **No middleware bypass** — Correlation ID → Tenant Resolver → License Enforcement → Schema Validation → Route  
✓ **No grading outside worker** — Auth is stateless, no grading involvement  
✓ **No direct DB instantiation** — All queries execute within tenant resolver context  
✓ **No snapshot integrity weakening** — Not applicable (auth is not attempt-related)  
✓ **No transaction boundary weakening** — Login atomic, token version atomic, failures serialized  
✓ **No version enforcement weakening** — schema_version and product_version checked on every request

**Governance References:**

- ADR-0001: Database-per-tenant isolation
- ADR-0006: Runtime authoritative time (server NOW(), never client time)
- ADR-0007: Product version compatibility
- ADR-0008: Semantic versioning policy

**Status:** COMPLIANT — No architectural exceptions required.

---

## Isolation Impact Analysis

### Database Layer Access

| Domain      | Database  | Tenant Scope   | Resolver Used | Connection Pool    |
| ----------- | --------- | -------------- | ------------- | ------------------ |
| MMC         | master_db | N/A (platform) | No            | Global pool        |
| Backoffice  | tenant_db | Per workspace  | Yes           | Tenant-scoped pool |
| Frontoffice | tenant_db | Per workspace  | Yes           | Tenant-scoped pool |

### Authentication Domain Boundaries

**Three completely isolated domains:**

1. **MMC (Platform)**
   - Users: Platform admins, operators
   - Database: master_db only
   - Token scope: "MMC" (no workspace_id)
   - Routes: /mmc/\* endpoints
   - Token must reject if workspace_id present

2. **Backoffice (Staff)**
   - Users: Staff, instructors, workspace admins
   - Database: Tenant database
   - Token scope: "BACKOFFICE" + workspace_id + user_id
   - Routes: /backoffice/\* endpoints
   - Token includes: schema_version, product_version

3. **Frontoffice (Students)**
   - Users: Students (one per workspace, one per division)
   - Database: Tenant database
   - Token scope: "FRONTOFFICE" + workspace_id + user_id + division_id
   - Routes: /frontoffice/\* endpoints
   - Token includes: schema_version, product_version, subscription_status

**Isolation Rules:**

- MMC token → Cannot access tenant endpoints (401)
- Backoffice token → Cannot access frontoffice endpoints (401)
- Frontoffice token → Cannot access backoffice endpoints (401)
- Workspace A token → Cannot access Workspace B endpoints (401)

### Tenant Resolution Flow

```
Request arrives
  ↓
Correlation ID middleware (generate or extract)
  ↓
Tenant resolver (extract slug from subdomain/path)
  ↓
Resolve workspace_id from master_db
  ↓
Obtain tenant-scoped connection pool
  ↓
License enforcement middleware (validate license status)
  ↓
Schema validation middleware (check schema_version)
  ↓
Route handler (with DB access via tenant pool)
```

### Connection Pool Management

- **Master DB:** Single global connection pool (initialized on startup)
- **Tenant DB:** In-memory map of pools keyed by workspace_slug
- **Pool lifetime:** Created on first tenant request, destroyed on workspace deletion
- **Pool reuse:** Shared across all requests for same workspace

### Isolation Guarantees

✓ No shared user tables across workspaces  
✓ No cross-tenant JWT validation (token.workspace_id != resolved.workspace_id → 401)  
✓ All auth queries scoped to resolved workspace  
✓ Token version enforcement at user row level (no global counter)  
✓ Audit logs include workspace_slug and correlation_id for traceability

---

## License & Version Enforcement

### License Middleware Integration

**Login endpoint (before token issuance):**

```
IF license.status == ACTIVE
  → Proceed to authentication
ELSE IF license.status == SOFT_LOCKED
  → Return 423 Locked (token not issued)
ELSE IF license.status == ARCHIVED or DELETED
  → Return 403 Forbidden (token not issued)
```

**On every authenticated request:**

```
IF token.workspace_id != resolved.workspace_id
  → Return 401 Unauthorized (token scope violation)
ELSE IF license.status != ACTIVE
  → Return 423 Locked or 403 Forbidden
```

### Schema Version Enforcement

**On token issuance (login):**

- JWT includes current tenant.schema_version

**On every authenticated request:**

- JWT.schema_version compared against current tenant.schema_version
- IF mismatch: Return 426 Upgrade Required
- Effect: Old sessions become invalid after schema upgrade

### Product Version Enforcement

**On token issuance (login):**

- JWT includes current license.product_version

**On every authenticated request:**

- JWT.product_version compatibility checked against current license.product_version
- IF incompatible: Return 426 Upgrade Required

### Version Validation Example

```
Token issued: schema_version=1.0.0, product_version=2.0.0
Workspace upgraded to: schema_version=1.1.0
Request with old token → 426 Upgrade Required
User must re-login to get new token with schema_version=1.1.0
```

### Limit Enforcement

- Not applicable in Phase 1 (auth is not metered by license limits)
- Future phases may enforce login attempt limits

---

## Data Model Changes

### New Tables (tenant_db)

#### 1. users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STAFF', 'INSTRUCTOR', 'STUDENT')),
  token_version INTEGER NOT NULL DEFAULT 0,
  subscription_status TEXT CHECK (subscription_status IN ('ACTIVE', 'EXPIRED', 'PENDING')),
  division_id UUID NULL REFERENCES divisions(id),
  locked_until TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP NULL,

  CONSTRAINT single_role_per_workspace CHECK (
    (role IN ('ADMIN', 'STAFF', 'INSTRUCTOR') AND division_id IS NULL) OR
    (role = 'STUDENT' AND division_id IS NOT NULL)
  )
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

#### 2. user_roles

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
```

#### 3. roles

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (name IN ('ADMIN', 'INSTRUCTOR', 'STAFF')),
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### 4. role_permissions

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(role_id, permission)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
```

#### 5. login_attempts

```sql
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  error_reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email_created_at ON login_attempts(email, created_at);
CREATE INDEX idx_login_attempts_success_created_at ON login_attempts(success, created_at);
```

#### 6. audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_success', 'login_failed', 'account_locked',
    'token_invalid', 'token_version_mismatch', 'workspace_mismatch',
    'license_blocked', 'role_changed', 'password_changed'
  )),
  user_id UUID NULL REFERENCES users(id),
  workspace_id UUID NOT NULL,
  correlation_id TEXT NOT NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE')),
  details JSONB NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id_timestamp ON audit_logs(user_id, timestamp);
CREATE INDEX idx_audit_logs_workspace_id_timestamp ON audit_logs(workspace_id, timestamp);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id);
```

### New Tables (master_db)

#### 1. mmc_users

```sql
CREATE TABLE mmc_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR')),
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP NULL
);

CREATE INDEX idx_mmc_users_email ON mmc_users(email);
```

### Modified Tables

- None in Phase 1 (clean schema addition)

### Migration Impact

**Version bump required:** YES

- Schema version increments: MAJOR.0.0 → MAJOR.MINOR.0+1
- All new tables forward-only
- No data migrations needed
- All indexes created in same transaction

**Backward Compatibility:** Forward-only upgrade

- No rollback path except snapshot restore
- Old code cannot access new tables safely
- New code requires all new tables present

---

## Transaction Boundaries

### Login Operation (Atomic)

**Semantics:** All-or-nothing token issuance

```
BEGIN TRANSACTION (SERIALIZABLE isolation)
  1. SELECT user WHERE email = $1 FOR UPDATE (row lock)
  2. Verify password_hash matches input
  3. Check license.status == ACTIVE
  4. Check users.locked_until is NULL or < NOW()
  5. Check JWT expiration format compatibility
  6. Generate JWT:
     - Claims: {scope, workspace_id, user_id, role, token_version,
                schema_version, product_version, issued_at, expires_at}
     - Signature: HS256(JWT_SECRET)
  7. UPDATE users SET last_login = NOW()
  8. RESET users.failed_attempts = 0
  9. INSERT INTO audit_logs(...) VALUES (event='login_success', ...)
COMMIT

ON FAILURE → ROLLBACK (no token issued, no audit log for success)
```

**Key Points:**

- Row lock prevents concurrent login race conditions
- Token generation happens inside transaction
- Audit log inserted before commit
- If any step fails, entire transaction rolls back

**Error Handling:**

```
IF password mismatch → ROLLBACK, throw InvalidCredentials
IF license SOFT_LOCKED → ROLLBACK, return 423
IF account locked → ROLLBACK, return 429
IF schema incompatible → ROLLBACK, return 426
```

### Token Version Invalidation (Logout-All)

**Semantics:** Invalidate all existing tokens for user

```
BEGIN TRANSACTION
  1. SELECT users WHERE id = $1 FOR UPDATE
  2. users.token_version = users.token_version + 1
  3. UPDATE users SET token_version = token_version + 1
  4. INSERT INTO audit_logs(...) VALUES (event='token_version_mismatch', ...)
COMMIT

EFFECT: All tokens with old token_version rejected on next request
```

**Idempotency:** Calling twice increments version twice

- First call: token_version 5 → 6
- Second call: token_version 6 → 7
- Effect: All old tokens become invalid (idempotent outcome)

### Failed Login Tracking (Serialized)

**Semantics:** Prevent brute force attacks with account lock

```
BEGIN TRANSACTION
  1. INSERT INTO login_attempts (email, success=false, reason, ...) VALUES (...)
  2. SELECT COUNT(*) FROM login_attempts
       WHERE email = $1
       AND created_at > NOW() - INTERVAL '15 minutes'
       AND success = false
  3. IF count >= 5:
       UPDATE users SET locked_until = NOW() + INTERVAL '30 minutes'
       INSERT INTO audit_logs(...) VALUES (event='account_locked', ...)
COMMIT
```

**Concurrency:** Database serialization handles lock threshold atomically

- Request 1: Count = 4 → increment to 5, OK
- Request 2: Count = 5 → lock user
- Both succeed atomically

### Idempotency Properties

| Operation       | Idempotent | Reason                                                      |
| --------------- | ---------- | ----------------------------------------------------------- |
| Login           | NO         | Multiple calls = multiple unique tokens                     |
| Logout-all      | YES        | Second call re-increments version, effect same              |
| Account unlock  | YES        | If already unlocked, sets locked_until to past time (no-op) |
| Password change | YES        | Re-hashing same input = same hash                           |

---

## Authoritative Time Usage

### Server Clock as Source of Truth

**All timestamps use:** PostgreSQL NOW()

**Client timestamps:** NEVER TRUSTED

- Client cannot set token.issued_at
- Client cannot set token.expires_at
- Client cannot override session timeout
- Client-provided timestamps logged for debugging, not validated

### Token Lifetime Logic

```
On login:
  issued_at = NOW()                    (server time)
  expires_at = NOW() + 15 minutes      (server time + TTL)
  JWT = sign({ ..., issued_at, expires_at })

On subsequent request:
  IF NOW() > token.expires_at
    → Return 401 Unauthorized
    → User must re-login
```

### Drift Prevention

- All servers must run NTP sync (DevOps responsibility)
- No clock skew tolerance (±0 seconds in Phase 1)
- If server clocks drift > 1 second, tokens may fail validation
- Operator alarm on NTP drift

### Account Lock Duration (Authoritative Server Time)

```
On 5th failed attempt:
  locked_until = NOW() + 30 minutes

On next login attempt:
  IF NOW() < users.locked_until
    → Return 429 Too Many Attempts
  ELSE
    → Allow retry
```

---

## Idempotency Strategy

### Login Endpoint

**Idempotent:** NO (by design)

- Calling login twice = two different tokens issued
- Client responsible for single-submit UI enforcement
- Each token valid independently
- Allows multiple active sessions per user (acceptable)

### Logout Endpoint

**Idempotent:** YES (via token_version)

```
Call 1: user.token_version 5 → 6
Call 2: user.token_version 6 → 7

Result: Any tokens with version ≤ 5 invalid (same outcome)
```

### Logout-All (Invalidate All User Tokens)

**Idempotent:** YES

- Increments token_version by 1
- Re-running increments again
- Effect: Old tokens always invalid (idempotent)

### Account Unlock

**Idempotent:** YES (via locked_until timestamp)

```
Call 1: locked_until = NOW() - 1 hour (already in past)
Call 2: locked_until = NOW() - 1 hour (same value, already unlocked)

Result: Account unlocked (idempotent)
```

### Unique Constraints for Idempotency

- **users.email:** UNIQUE per workspace → One user per email
- **user_roles(user_id, role_id):** UNIQUE → Prevent duplicate assignments

### Double-Submission Protection

**Not required for auth** because:

- Login is not idempotent (multiple tokens OK)
- Logout is idempotent (version increment)
- No financial transactions involved

---

## Observability Requirements

### Structured Logging (Pino JSON Format)

**All auth events must log:**

```json
{
  "timestamp": "2024-02-17T10:30:00.000Z",
  "level": "info",
  "service": "auth",
  "correlation_id": "req-abc123-def456",
  "workspace_slug": "demo-school",
  "workspace_id": "ws-uuid-12345",
  "user_id": "user-uuid-67890",
  "event_type": "login_success",
  "domain": "backoffice",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "result": "SUCCESS",
  "duration_ms": 125,
  "details": {
    "token_version": 3,
    "schema_version": "1.0.0",
    "product_version": "2.1.0"
  }
}
```

### Required Fields by Event Type

| Event                  | User ID   | Workspace | Reason                  | IP  | Token Version |
| ---------------------- | --------- | --------- | ----------------------- | --- | ------------- |
| login_success          | ✓         | ✓         | Given                   | ✓   | New           |
| login_failed           | ✗ (email) | ✓         | Invalid credentials     | ✓   | N/A           |
| account_locked         | ✗ (email) | ✓         | Too many attempts       | ✓   | N/A           |
| token_invalid          | ✓         | ✓         | Expired/corrupt         | ✓   | Old           |
| token_version_mismatch | ✓         | ✓         | Logout-all triggered    | ✓   | New != DB     |
| workspace_mismatch     | ✓         | ✓         | Cross-workspace attempt | ✓   | ✓             |
| license_blocked        | N/A       | ✓         | SOFT_LOCKED state       | N/A | N/A           |

### Error Contract Compliance

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect"
  }
}
```

**HTTP Status Codes:**

- 200: Login successful
- 400: Malformed request
- 401: Invalid credentials / workspace mismatch / token expired
- 403: Archived license / insufficient permissions
- 423: Soft-locked license / account locked
- 426: Schema version mismatch / product version incompatible
- 429: Too many login attempts
- 500: Server error

### Metrics (Critical Path)

Recommended prometheus metrics:

- `auth_login_attempts_total{result,workspace}` — Counter
- `auth_login_duration_seconds` — Histogram
- `auth_token_validation_total{valid,workspace}` — Counter
- `auth_account_lock_total{workspace}` — Counter

### Correlation ID Propagation

- Extract JWT.correlation_id or generate new UUID
- Pass to all domain function calls
- Include in all audit logs
- Pass to downstream services (worker, etc.)

---

## Rate Limiting & Abuse Protection

### Login Rate Limiting

**Per email (failed attempts):**

- Count failures in last 15 minutes
- Threshold: 5 consecutive failures
- Punishment: Lock account for 30 minutes
- Reset counter on successful login

**Query:**

```sql
SELECT COUNT(*) FROM login_attempts
  WHERE email = $1
  AND created_at > NOW() - INTERVAL '15 minutes'
  AND success = false
```

**Implementation:**

```
IF count >= 5 AND user.locked_until > NOW()
  → Return 429 Too Many Attempts
ELSE IF count >= 5
  → Set user.locked_until = NOW() + 30 minutes
  → Return 429 Too Many Attempts
```

### Per-IP Rate Limiting (Optional)

- Not required in Phase 1
- Recommended: Gateway/WAF layer
- Not auth service responsibility

### Token Endpoint Protection

- Refresh token endpoint (Phase 2+): 100 calls/hour per user
- Logout endpoint: No rate limit (idempotent)

### WebSocket Protection (Phase 4+)

- One connection per user per workspace
- Disconnect old connection if new login
- Prevents session hijacking

### DDoS Protection

- Gateway rate limiting (not auth layer)
- IP-based blocking at load balancer

---

## Layer Separation Confirmation

### Frontend (No Auth Logic)

**Allowed:**

- ✓ Display login form
- ✓ Send email/password to API
- ✓ Receive JWT token
- ✓ Store token in memory (not localStorage)
- ✓ Include token in Authorization header

**Forbidden:**

- ✗ Validate JWT signature on client
- ✗ Check token expiration on client (advisory only)
- ✗ Check user permissions on client
- ✗ Generate or hash passwords
- ✗ Access user database directly

### API Layer (Routing & Validation)

**Allowed:**

- ✓ Parse JWT from Authorization header
- ✓ Validate JWT signature (verify against secret)
- ✓ Extract claims (user_id, workspace_id, scope)
- ✓ Call domain auth functions
- ✓ Call license middleware
- ✓ Call tenant resolver
- ✓ Return standard error contract
- ✓ Log structured events

**Forbidden:**

- ✗ Embed password hashing
- ✗ Embed token generation logic
- ✗ Embed RBAC evaluation
- ✗ Instantiate database directly
- ✗ Access user tables without tenant resolver

### Domain Auth Package (Pure Functions)

**Allowed:**

- ✓ Hash passwords (bcrypt, scrypt)
- ✓ Verify password against hash
- ✓ Generate JWT claims
- ✓ Evaluate RBAC rules
- ✓ Determine account lock status
- ✓ Pure functions (no HTTP, no IO side effects)

**Forbidden:**

- ✗ Import HTTP framework (Hono)
- ✗ Access request/response directly
- ✗ Instantiate database connection
- ✗ Emit audit logs directly (return for API layer)

### Worker (Not in Scope)

- Not involved in authentication Phase 1
- Future phase may handle async token cleanup

---

## Failure Modes & Recovery

### Database Connection Failure

| Symptoms               | Behavior                | Recovery                       | User Impact       |
| ---------------------- | ----------------------- | ------------------------------ | ----------------- |
| Cannot reach tenant DB | 500 Service Unavailable | Automatic retry (pool)         | Login unavailable |
| Connection timeout     | 504 Gateway Timeout     | Retry with exponential backoff | Login slow/fails  |
| Pool exhausted         | 503 Service Unavailable | Wait for connection release    | Login blocked     |

### Invalid JWT Signature

| Scenario                       | Behavior         | Recovery          | User Impact  |
| ------------------------------ | ---------------- | ----------------- | ------------ |
| Token signed with wrong secret | 401 Unauthorized | Re-login required | Session lost |
| Token corrupted                | 401 Unauthorized | Re-login required | Session lost |
| Token from different service   | 401 Unauthorized | Re-login required | Session lost |

### Schema Version Mismatch

| Scenario                         | Behavior             | Recovery                            | User Impact               |
| -------------------------------- | -------------------- | ----------------------------------- | ------------------------- |
| Workspace upgraded, old token    | 426 Upgrade Required | User re-logs in, receives new token | Upgrade requires re-login |
| Platform downgrade (not allowed) | Undefined            | N/A                                 | Should never happen       |

### License State Changed

| Scenario                        | Behavior                    | Recovery              | User Impact    |
| ------------------------------- | --------------------------- | --------------------- | -------------- |
| License SOFT_LOCKED after login | Next request: 423 Locked    | Admin reactivates     | Access revoked |
| License ARCHIVED after login    | Next request: 403 Forbidden | Restore from snapshot | Access revoked |

### Account Locked During Session

| Scenario                       | Behavior                        | Recovery             | User Impact  |
| ------------------------------ | ------------------------------- | -------------------- | ------------ |
| Too many failed login attempts | Lock account 30 minutes         | Wait or admin unlock | Cannot login |
| Concurrent failed attempts     | First 5 fail, 6th triggers lock | All get locked       | Expected     |

### Token Version Mismatch

| Scenario                                          | Behavior                       | Recovery          | User Impact                    |
| ------------------------------------------------- | ------------------------------ | ----------------- | ------------------------------ |
| Admin incremented user.token_version (logout-all) | Next request: 401 Unauthorized | User re-logs in   | Session lost (admin-initiated) |
| Password changed                                  | user.token_version incremented | Next request: 401 | Security measure OK            |

---

## Test Strategy

### Unit Tests Required

**Password Layer:**

- Hash generation (deterministic for same input)
- Hash verification (correct password matches)
- Hash verification (wrong password rejected)
- Slow hash attack resistance (bcrypt rounds)

**Token Generation:**

- JWT claims correct for MMC domain (no workspace_id)
- JWT claims correct for Backoffice (workspace_id present)
- JWT claims correct for Frontoffice (division_id present)
- JWT signature verified with secret
- Claims expire correctly

**Token Validation:**

- Expired token rejected
- Invalid signature rejected
- Workspace_id mismatch detected
- Token version mismatch detected
- Schema version mismatch detected

**RBAC:**

- Permission check for ADMIN role succeeds
- Permission check for STAFF role partially succeeds
- Permission check for STUDENT fails appropriately
- Role-based access control enforced

**Account Lock:**

- Failed attempts counted correctly
- Lock triggered after threshold
- Lock duration respected
- Counter reset on successful login

### Integration Tests Required

**End-to-End Flows:**

- [ ] MMC login → token issued → access MMC endpoint → success
- [ ] Backoffice login → token issued → access backoffice endpoint → success
- [ ] Frontoffice login → token issued → access frontoffice endpoint → success
- [ ] Login with invalid credentials → failure logged
- [ ] Workspace mismatch → 401 Unauthorized
- [ ] Token version mismatch → 401 Unauthorized
- [ ] Schema version mismatch → 426 Upgrade Required
- [ ] License SOFT_LOCKED → 423 Locked
- [ ] Account locked → 429 Too Many Attempts
- [ ] RBAC permission denied → 403 Forbidden

**Concurrency Tests:**

- 10 concurrent logins from same user → all succeed
- 10 concurrent failed attempts → first 5 succeed, 6-10 get account_locked
- Concurrent token version increments → atomically serialized
- Concurrent DB updates don't cause race conditions

### Transaction Rollback Tests

- Login fails at password check → No audit log, DB unchanged
- Login fails at license check → No token, audit log with reason
- Token version increment with DB error → Transaction rolled back

### Version Compatibility Tests

- Token from schema 1.0.0 in schema 1.1.0 workspace → 426
- Token from product 2.0.0 in product 1.9.0 workspace → 426

### Isolation Tests

- Workspace A token → Cannot access Workspace B endpoint
- MMC token → Cannot access tenant endpoint
- Backoffice token → Cannot access Frontoffice endpoint

---

## What Is Strictly Forbidden

- ✗ Shared auth tables across workspaces
- ✗ Token without workspace_id claim (for tenant domains)
- ✗ Long-lived tokens (TTL > 15 minutes Phase 1)
- ✗ Frontend-only permission checks
- ✗ Silent token reuse after role change
- ✗ Skipping schema_version validation
- ✗ Issuing tokens for SOFT_LOCKED workspace
- ✗ Storing JWT in localStorage (memory only)
- ✗ Client-set expiration timestamps
- ✗ Bypassing license middleware
- ✗ Cross-workspace joins in queries
- ✗ Global database singleton (must use resolver)
- ✗ Row-based multi-tenancy in auth tables

---

## Explicit Non-Goals (Phase 1)

- Multi-factor authentication (Phase 2+)
- Refresh token rotation (Phase 2+)
- Social login (Phase 3+)
- SSO / SAML (Phase 3+)
- API key authentication (Phase 2+)
- CAPTCHA integration (Phase 3+)
- OAuth2 support (future)
- Account recovery / password reset (Phase 2+)
- Email verification (Phase 2+)
- IP whitelisting (Phase 3+)
- Geofencing (Phase 3+)
- Passwordless auth (Phase 3+)
- Biometric auth (Phase 3+)

---

## Final Constitutional Compliance Statement

**Compliant with Zidney Constitution v1.2.0 — No violations detected.**

✅ Multi-tenancy: workspace_id in all tenant tokens, validated every request  
✅ License enforcement: Mandatory middleware, SOFT_LOCKED blocks login, checked every request  
✅ Isolation boundaries: Three separate domains, no shared tables, scope validation  
✅ Transaction integrity: Login atomic, token version atomic, serialized locks  
✅ Authoritative time: Server NOW() only, no client timestamps trusted  
✅ Idempotency: Token invalidation idempotent, login not idempotent (correct)  
✅ Audit compliance: Structured JSON, correlation_id, workspace_slug, user tracking  
✅ Error handling: Standard contract, proper HTTP status codes  
✅ Rate limiting: Failed login throttling, account lock  
✅ Layer separation: No frontend logic, no HTTP in domain, pure functions  
✅ Version enforcement: schema_version and product_version checked every request

**Specification Status:** ✅ READY FOR PLANNING PHASE

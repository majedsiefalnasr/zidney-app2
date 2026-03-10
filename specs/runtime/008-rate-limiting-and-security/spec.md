# STAGE 08 Specification: Rate Limiting & Security Baseline

**Phase:** 01_PLATFORM_FOUNDATION  
**Stage:** STAGE_08_RATE_LIMITING_AND_SECURITY  
**Branch:** `008-rate-limiting-and-security`  
**Date:** 2026-02-19

---

## Feature Overview

This specification establishes enforceable security and abuse-prevention mechanisms to protect:

- **Authentication endpoints** from brute force attacks
- **Exam attempt lifecycle endpoints** from spam and double-submission
- **WebSocket connections** from unauthorized access and resource exhaustion
- **Public APIs** from availability attacks
- **Worker processing** from failure cascades and poisoned jobs
- **Sensitive administrative actions** from unauthorized or rate-limited abuse

This stage is critical to platform stability and institutional trust. It's a foundational
requirement before progressing to Phase 2 (MMC) and beyond.

**Scope Phase:** 01_PLATFORM_FOUNDATION  
**Affects:** Authentication, Attempt Engine, WebSocket, Worker, API Gateway, Observability

---

## Constitutional Compliance Declaration

✅ **Isolation:** No cross-tenant rate limit state sharing. Each workspace's attempt limits are
tracked separately via tenant-aware Redis keys.

✅ **License Enforcement:** Rate limiting is applied AFTER license middleware validates status.
Soft-locked workspaces receive 423 before rate limits are checked.

✅ **Grading Authority:** No grading changes. Worker remains sole authority. Rate limiting only
prevents submission spam—doesn't change grading logic.

✅ **Direct DB Instantiation:** Rate limiter uses centralized Redis pool (initialized at platform
boot), not tenant-specific connections. Tenant context is in Redis key prefix only.

✅ **Snapshot Integrity:** Idempotent submission mechanism protects attempt snapshot. Double
submissions return cached result without re-grading.

✅ **Transaction Boundaries:** Submission idempotency enforced via DB transaction with FOR UPDATE
lock + Redis cache verification.

✅ **Version Enforcement:** Rate limits and idempotency patterns activate only when schema_version
and product_version are compatible.

**Compliance Status:** ✅ **Compliant with Zidney Constitution v1.2.0 — No violations detected.**

---

## Clarifications

### Session 2026-02-19

- Q1: Cache Coherence (Redis vs Database Authority) → A: Database is authoritative source, Redis is
  performance cache only

---

## Isolation Impact Analysis

### Database Access Pattern

| Component             | Database        | Tenant Scope        | Key Discovery                                                |
| --------------------- | --------------- | ------------------- | ------------------------------------------------------------ |
| Rate Limiter (Auth)   | Redis           | Per-tenant + Per-IP | Key: `rate:auth:{ip}` + `rate:auth:user:{user_id}`           |
| Attempt Submission    | Master DB       | Per-workspace       | SELECT with workspace_id filter + FOR UPDATE                 |
| Attempt Submission    | Redis           | Per-tenant          | Key: `idempotent:attempt:{attempt_id}`                       |
| WebSocket Handler     | JWT             | Per-tenant          | workspace_id extracted from JWT, cross-checked with resolver |
| Cross-Workspace Check | Request context | Per-tenant          | workspace_id from JWT vs. resolved workspace_id              |

### Tenant Isolation Guarantees

1. **Rate limit keys are namespaced:** `rate:{endpoint}:{key}` never crosses workspace boundaries
2. **Submission idempotency is per-attempt:** `idempotent:attempt:{attempt_id}` is unique per
   attempt (which is tenant-scoped)
3. **JWT validation includes workspace_id:** Tokens without matching workspace_id are rejected at
   middleware
4. **All rate limit checks happen AFTER tenant resolver:** No tenant bypass possible
5. **No shared rate limit bucket across tenants:** Each `/workspace/admin` or
   `/workspace/{id}/submit` has workspace-specific counter

### Resolver Middleware Usage

- ✅ Rate limiting middleware executes AFTER tenant resolver
- ✅ Workspace context is injected into request state
- ✅ Rate limit keys include workspace_id or tenant slug where applicable
- ✅ No global rate limits that ignore workspace context

---

## License & Version Enforcement

### License Middleware Integration

Rate limiting is enforced at this sequence:

```
1. Correlation ID middleware
2. Tenant resolver middleware
3. License enforcement middleware ← checks ACTIVE/SOFT_LOCKED/ARCHIVED
   ↓ returns 423 or 403 if invalid
4. Schema version enforcement ← checks schema_version compatibility
   ↓ returns 426 if schema too old
5. Rate limiting middleware
   ↓ returns 429 if limit exceeded
6. Route handler
```

### License States Allowed

- **ACTIVE:** Full rate limiting applied normally
- **SOFT_LOCKED:** Request fails at license middleware (423) before rate limiter executes
- **ARCHIVED:** Request fails at license middleware (403) before rate limiter executes
- **DELETED:** Request fails at license middleware (404) before rate limiter executes

### Version Enforcement

- **schema_version:** Rate limiter validates schema version supports idempotent submission (requires
  `idempotent_submission_key` column in `attempts` table)
- **product_version:** Rate limiter respects product version; older clients may have different rate
  limits applied

If schema incompatible → Return 426 at schema enforcement middleware (not rate limiter).

---

## Data Model Changes

### New Tables/Columns

#### For Idempotent Submission

**Table:** `attempts` (existing, modified)

New columns to add:

```sql
-- Per-attempt idempotency tracking
idempotent_submission_key UUID NOT NULL DEFAULT gen_random_uuid(),
submission_cached_result JSONB, -- stores response from first successful submission
submission_cached_at TIMESTAMP WITH TIME ZONE, -- timing of cached result
```

**Constraint:** `UNIQUE(idempotent_submission_key)` — ensures no duplicate processing

#### For Rate Limit Audit

No new tables required. Rate limiting state lives in:

- **Redis:** In-memory sliding window counters (ephemeral, no persistence)
- **Audit log:** Structured logs (existing observability system)

### Migration Requirements

1. **Version bump:** MINOR version bump (schema_version incremented)
2. **Backward compatibility:** Old attempts without `idempotent_submission_key` are populated via
   migration with unique UUIDs
3. **Safe rollback:** Schema version tied to feature flag; old API versions can ignore columns

---

## Rate Limiting Architecture

### Implementation Strategy

**Technology:** Redis (centralized, shared across all instances)

**Algorithm:** Sliding window with token bucket burst support

**Storage:** Redis keys expire automatically (TTL per endpoint)

**Connection:** Reuse platform's centralized Redis pool initialized at boot

### Per-Endpoint Rate Limits

#### Authentication Endpoints

**Endpoint:** `POST /auth/login`

- Per-IP: **5 attempts / 60 seconds**
- Per-user: **5 attempts / 60 seconds**
- Per-workspace: **10 attempts / 60 seconds**
- On violation: Return **429** with `Retry-After` header

**Exponential Backoff:** After 3rd failure within window, lock user account for:

- 1st occurrence: 1 minute
- 2nd occurrence: 5 minutes
- 3rd occurrence: 15 minutes

Error response must not reveal whether user exists or password was wrong.

**Endpoint:** `POST /auth/password-reset`

- Per-IP: **2 attempts / 60 seconds**
- Per-user: **1 attempt / 60 seconds**
- On violation: Return **429** with `Retry-After` header

#### Attempt Lifecycle Endpoints

**Endpoint:** `POST /attempt/start`

- Per-user: **5 attempts / 60 seconds** (prevents restart spam)
- Per-workspace: **20 attempts / 60 seconds**
- On violation: Return **429** with `Retry-After` header

**Endpoint:** `POST /attempt/{id}/submit`

- Per-attempt: **1 submission counted + idempotent replay** (see Idempotency Strategy)
- On violation: Return **429** with `Retry-After` header

#### WebSocket Connections

**Connection:** `GET /ws/attempt/{id}`

- Per-user: **1 active connection per attempt** (additional connections rejected immediately)
- Per-connection: **100 messages / 60 seconds** (burst: 10 messages/second)
- Heartbeat: **30-second timeout** (auto-disconnect if no heartbeat)
- On violation: WebSocket closed with **4029** (custom rate limit close code)

#### Admin & Sensitive Endpoints

**Endpoint:** `POST /admin/workspace/*`

- Per-IP: **10 requests / 60 seconds**
- Per-user: **20 requests / 60 seconds**
- Per-workspace: **50 requests / 60 seconds**
- On violation: Return **429**

### Redis Key Structure

```
# Authentication per-IP (24h TTL)
rate:auth:ip:{ip_address}

# Authentication per-user (24h TTL)
rate:auth:user:{user_id}:{workspace_slug}

# Attempt start per-user (24h TTL)
rate:attempt:start:user:{user_id}

# Attempt submission per-attempt (attempt lifetime)
rate:attempt:submit:{attempt_id}

# WebSocket per-user (connection lifetime)
rate:ws:{user_id}:connections

# Admin actions (24h TTL)
rate:admin:{user_id}:{workspace_slug}
```

### HTTP Response Format

**Success responses** (no rate limit):

```json
{
  "success": true,
  "data": {
    /* payload */
  },
  "error": null
}
```

**Rate limit exceeded:**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-Rate-Limit-Limit: 5
X-Rate-Limit-Remaining: 0
X-Rate-Limit-Reset: 1645215600
Content-Type: application/json
```

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again after 45 seconds."
  }
}
```

---

## Idempotency Strategy

### Design Pattern

**Hybrid dual-layer idempotency:**

1. **Fast path (Redis):** Check if submission_key seen before → return cached result (24h TTL)
2. **Safe path (DB):** Use UNIQUE constraint + FOR UPDATE lock to prevent race conditions
3. **Long-term record (DB):** Persist result for audit trail

### Implementation

#### Client Side

Client sends idempotency key with each submission:

```json
POST /attempt/{id}/submit
{
  "answers": [...],
  "idempotency_key": "uuid-v4-from-sdk"
}
```

#### Server Side (Submission Handler)

```pseudocode
1. Extract idempotency_key from request body
2. Validate workspace_id matches JWT
3. Query Redis for key `idempotent:attempt:{attempt_id}:{idempotency_key}`
   IF found → return cached response [FAST PATH]
4. Start DB transaction
5. SELECT * FROM attempts WHERE id = attempt_id FOR UPDATE (acquires row lock)
6. Verify attempt status = 'IN_PROGRESS'
7. Check UNIQUE constraint on (attempt_id, idempotency_key)
   IF constraint violated → another request with same key in-flight
      → Wait for lock release → retry step 3
8. Execute submission (grade, update status)
9. Store result in submission_cached_result column
10. COMMIT transaction
11. Cache result in Redis with 24h TTL
12. Return response
```

### Duplicate Submission Handling

**First submission:**

- Processed normally
- Result cached in DB (`submission_cached_result`) and Redis
- Response: `200 OK` with grading result

**Duplicate submission (same `idempotency_key`):**

- Redis cache hit → Return 200 with cached result (fast)
- OR DB transaction detects UNIQUE constraint → return 200 with stored `submission_cached_result`
- **Never re-grades**
- **Never creates duplicate audit entries**

### Required Indexes

```sql
CREATE UNIQUE INDEX idx_attempt_idempotent_key
  ON attempts(id, idempotent_submission_key)
  WHERE submission_cached_at IS NOT NULL;

CREATE INDEX idx_attempt_submit_time
  ON attempts(workspace_id, created_at DESC)
  WHERE status = 'COMPLETED';
```

---

## Attempt Lifecycle Security

### Attempt Start

- Rate limited per user (5/min)
- Rate limited per workspace (20/min)
- Must validate: user has permission to see exam
- Must validate: exam start_time has arrived (server time authoritative)
- Rejects early access even if user submits with manipulated client time
- Returns: `403` if not yet started, `409` if already started

### Scheduled Exam Timing

**Server-Authoritative Time Enforcement:**

1. **Start window validation:**
   - Compare server time with `exam.scheduled_start_time`
   - Reject if early: `403 Too Early`
   - Allow if within tolerance ±2 minutes (configurable)

2. **Reconnection timeout:**
   - If websocket disconnects, user has 30 seconds to reconnect
   - After 30 seconds: attempt auto-finalizes
   - Reconnect attempts beyond 30 second window: `410 Gone`

3. **End time validation:**
   - Compare server time with `exam.scheduled_end_time`
   - Late submissions: validate against grace period (0-5 minutes configurable per exam)
   - Beyond grace period: `410 Gone` or mark as late

### Submission Validation

- Must include attempt_id, workspace_id
- Must verify attempt in `IN_PROGRESS` state
- Must verify user = attempt.user_id (identical to who started attempt)
- Must verify time window (haven't exceeded scheduled_end_time + grace period)
- Must execute idempotent submission (see Idempotency Strategy section)
- Must return grading result from worker-finalized score (not client input)

---

## WebSocket Security

### Connection Handshake

```
1. Client sends upgrade request with Authorization header:
   GET /ws/attempt/123
   Authorization: Bearer jwt_token

2. Server validates:
   - JWT signature valid
   - JWT not expired
   - JWT workspace_id = resolved workspace_id
   - JWT attempt_id claim = URL path attempt_id
   - User has access to this attempt

3. If validation fails:
   - Close with 1008 (policy violation)
   - Log security incident

4. If validation passes:
   - Accept connection
   - Track in active connections map: user_id → { attempt_id, socket }
```

### Per-Connection Rate Limiting

- **Message rate:** 100 messages / 60 seconds
- **Burst:** Allow 10 consecutive messages, then throttle
- **Heartbeat:** Require heartbeat every 30 seconds
  - Client sends: `{ type: "ping" }`
  - Server responds: `{ type: "pong" }`
  - If no heartbeat for 30+ seconds: auto-disconnect

### One Connection Per Attempt

- Enforce: Only 1 active WebSocket connection per (user_id, attempt_id) pair
- If client connects while prior connection active:
  - Terminate old connection with `4000` (going away)
  - Accept new connection
  - Log reconnection event

### Token Expiration

- When JWT expires, server detects on next message
- Close connection with `4001` (token expired)
- Client must re-authenticate and reconnect

### Message Validation

Each incoming message must:

```json
{
  "type": "event_type", // "ping", "answer_change", etc.
  "attempt_id": "...",  // match URL
  "timestamp": 1645215600000,  // client timestamp (for logging only, not authoritative)
  "data": {...}
}
```

Server validates:

- `attempt_id` matches URL
- `type` is recognized
- `data` is valid for this event type
- Ignore client `timestamp`, use server time for recording

---

## Cross-Workspace Protection

### Middleware Rule

Every authenticated request:

1. Extract `workspace_id` from JWT claims
2. Resolve workspace via subdomain/path → `resolved_workspace_id`
3. IF `workspace_id !== resolved_workspace_id` → Return **403 Forbidden**
4. Proceed to handler

### Enforcement Points

**Workspace ID sources (by priority):**

1. ✅ **From JWT** (authoritative)
2. ❌ **From request body** (forbidden)
3. ❌ **From query string** (forbidden)
4. ✅ **From resolver** (for validation cross-check only)

### Violation Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "WORKSPACE_MISMATCH",
    "message": "Your token is not valid for this workspace."
  }
}
```

**HTTP Status:** `403 Forbidden`  
**Audit:** Log workspace mismatch incident with workspace_id, user_id, resolved_workspace_id

---

## JWT Security Requirements

### Token Claims

```json
{
  "sub": "user_id",
  "workspace_id": "workspace_id",
  "workspace_slug": "slug",
  "token_version": "1", // to enable token rotation
  "iat": 1645215600,
  "exp": 1645215900, // short-lived: 5 minutes for access token
  "type": "access" // or "refresh"
}
```

### Validation Rules

Every token must pass:

- ✅ Signature valid (HMAC-SHA256 or RSA, depending on deployment)
- ✅ Expiration not exceeded
- ✅ workspace_id present
- ✅ token_version matches current version (for token rotation)
- ✅ `iat` not in future (clock skew tolerance: ±60 seconds)

### Token Issuance

**Access tokens:**

- Validity: 5 minutes
- Issued on login
- Issued on refresh

**Refresh tokens:**

- Validity: 30 days
- HttpOnly cookie (no JS access)
- Secure flag set (HTTPS only)
- SameSite=Strict

### Token Rotation Pattern

When token_version increments (security rotation):

1. All old tokens immediately invalidated
2. Users must login again or use refresh token
3. Old refresh tokens still valid if within expiry window
4. Audit logs token rotation event

---

## HTTP Security Headers

### Mandatory Headers (All Responses)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'
```

### CORS Policy

**Development:**

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

**Production:**

```
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

**Never allow:** `Access-Control-Allow-Origin: *` with credentials

---

## CSRF Protection

### Required For

- ✅ MMC endpoints (admin panel)
- ✅ Backoffice endpoints (institution admin)
- ❌ Pure JWT-Bearer APIs (no cookies)
- ❌ Frontoffice with stateless attempts (JWT-only)

### Implementation (For MMC/Backoffice)

#### Cookie-Based CSRF

1. **Token issuance:**
   - On login, generate CSRF token: `csrf_token = random(32 bytes).hex()`
   - Store in secure HTTPOnly cookie: `__csrf_token`
   - Send token in response body for client to use

2. **Token validation:**
   - Client includes token in custom header: `X-CSRF-Token: <token>`
   - Server compares header token with cookie token
   - If mismatch → Return `403 Forbidden`

3. **Cookie attributes:**
   ```http
   Set-Cookie: __csrf_token=<token>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600
   ```

#### SameSite Cookies

All cookies must include:

```http
; SameSite=Strict
```

This prevents CSRF attacks by default (browser won't send cookie on cross-origin requests).

---

## Payload & Resource Protection

### Request Body Size Limits

| Endpoint               | Max Size | Rationale                  |
| ---------------------- | -------- | -------------------------- |
| `/auth/*`              | 10 KB    | User credentials only      |
| `/attempt/*/submit`    | 1 MB     | Large answer sets possible |
| `/admin/*`             | 50 KB    | Configuration updates      |
| `/upload/*` (if added) | 100 MB   | File attachment limit      |
| Default                | 256 KB   | Fallback for all others    |

### JSON Structure Limits

- Max nesting depth: 10 levels
- Max array length: 10,000 items
- Max object keys: 100

Exceeding limits → **400 Bad Request**

### File Upload Limits (Future Feature)

- Max file size: 100 MB per upload
- Max files per request: 10
- Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf` (configurable per workspace)

### Query Complexity Limits

- Max query string length: 4 KB
- Max filters: 20
- Max sort fields: 5

---

## Worker Failure & Dead Letter Policy

### Attempt Grading Jobs

**Retry strategy:**

- Max retries: **3**
- Backoff: **Exponential** (1s, 5s, 30s)

**Failure handling:**

```
1. Job dequeued from queue
2. Attempt grading executed
3. IF error → increment retry count
   - If retries < 3 → re-enqueue with backoff
   - If retries >= 3 → move to dead_letter_queue
4. Log error with correlation_id, workspace_slug, attempt_id
```

**Dead letter queue inspection:**

- All failed jobs preserved in DLQ with full metadata
- Manual analysis window: 30 days (then purged)
- DLQ triggers alert to ops team after 10 failed jobs in 1 hour

### Required Metadata in Job

```json
{
  "job_id": "uuid",
  "type": "grade_attempt",
  "workspace_id": "...",
  "workspace_slug": "...",
  "attempt_id": "...",
  "user_id": "...",
  "correlation_id": "...",
  "retry_count": 0,
  "created_at": "2026-02-19T10:00:00Z",
  "data": {
    /* job-specific */
  }
}
```

### Worker Logging

Every worker job must log:

```json
{
  "timestamp": "2026-02-19T10:00:00Z",
  "level": "info",
  "service": "worker",
  "job_id": "...",
  "job_type": "grade_attempt",
  "workspace_id": "...",
  "workspace_slug": "...",
  "attempt_id": "...",
  "user_id": "...",
  "correlation_id": "...",
  "status": "completed|failed",
  "duration_ms": 245,
  "error": null
}
```

---

## Audit & Abuse Monitoring

### Security Events to Log

| Event                                             | Severity | Action                           |
| ------------------------------------------------- | -------- | -------------------------------- |
| Failed login (5+ in 1 min)                        | HIGH     | Lock user account + log IP       |
| Cross-workspace access attempt                    | CRITICAL | Log incident, alert ops          |
| Rate limit exceeded (100+ times per user per day) | MEDIUM   | Temporary IP throttle            |
| Invalid JWT signature                             | MEDIUM   | Log attempt, continue            |
| Token expired repeatedly                          | LOW      | No action (user re-login)        |
| WebSocket unauthorized attempt                    | MEDIUM   | Close connection, log            |
| Attempt submission anomaly (timestamp mismatch)   | HIGH     | Log for analysis                 |
| Duplicate submission with different answers       | CRITICAL | Log incident, alert grading team |

### Automatic Abuse Response

#### IP-Based Bans (Time-Bound)

```pseudocode
IF failed_login_attempts[ip] >= 10 in 5 minutes:
  → Add to temporary_ip_ban list (10 minutes)
  → Return 429 for all requests from this IP
  → Alert security team
  → Auto-remove ban after 10 minutes
```

#### User-Based Locks

```pseudocode
IF user_failed_login_attempts >= 5 in 10 minutes:
  → Lock user account (read-only mode)
  → Force password reset on next login
  → Send email notification to user
  → Alert workspace admins
  → Auto-unlock after 1 hour (or admin unlock)
```

### Audit Log Storage

Audit logs are stored in:

- **Primary:** Structured JSON logs (via observability system)
- **Secondary:** Optional audit trail table in master DB (if enabled)

```sql
-- Optional: audit_trail table
CREATE TABLE audit_trail (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID,
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20),  -- LOW, MEDIUM, HIGH, CRITICAL
  details JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  INDEX (workspace_id, created_at DESC)
);
```

---

## Secret Management

### Development Environment

✅ **Allowed:**

```
.env – local file (git-ignored)
.env.example – safe template (committed)
```

**Content of `.env`:**

```
JWT_SECRET=development-only-secret-key
REDIS_PASSWORD=dev-password
DB_PASSWORD=postgres
```

**Content of `.env.example`:**

```
JWT_SECRET=<generated-on-setup>
REDIS_PASSWORD=<generated-on-setup>
DB_PASSWORD=<generated-on-setup>
```

### Production Environment

✅ **Required:**

```
Docker Secrets (volume-mounted)
Environment variables (from secure vault)
```

❌ **Forbidden:**

```
Secrets in git (even with history rewrite)
Secrets in Docker image layers
Secrets in console logs
Secrets in error messages
Secrets returned in API responses
Secrets visible in process inspection
```

### Secret Rotation

1. **JWT Secret rotation:**
   - Generate new secret
   - Deploy with old + new secrets temporarily (multi-secret validation)
   - Verify all old tokens validated
   - Remove old secret after 24 hours

2. **Database password rotation:**
   - Database credentials live in Docker secrets only
   - Rotation via infrastructure team (not application code)
   - Connection pools automatically refresh on new pool initialization

### No Secrets in Frontend

✅ Allowed in frontend:

- Public API endpoints
- Workspace slug
- Feature flags (non-sensitive)
- UI configuration (logos, colors)

❌ Never send to frontend:

- JWT secrets
- Database credentials
- API keys
- Grading algorithms
- Encryption keys

---

## Rate Limiting Key Metrics

Instrumentation required:

| Metric                      | Type    | Frequency           |
| --------------------------- | ------- | ------------------- |
| `rate_limit:requests_total` | Counter | Per-request         |
| `rate_limit:rejected_total` | Counter | When rate limit hit |
| `rate_limit:active_limits`  | Gauge   | Per-minute          |
| `idempotent:cache_hits`     | Counter | Per-submission      |
| `idempotent:db_checks`      | Counter | Per-submission      |
| `auth:failed_attempts`      | Counter | Per-failure         |
| `auth:user_locks`           | Gauge   | Real-time           |

---

## Observability Requirements

### Structured Logging (Mandatory)

Every security-related log entry must include:

```json
{
  "timestamp": "ISO8601",
  "level": "info|warn|error|critical",
  "service": "api|worker|auth",
  "correlation_id": "uuid-v4",
  "workspace_id": "uuid",
  "workspace_slug": "string",
  "user_id": "uuid (if authenticated)",
  "attempt_id": "uuid (if applicable)",
  "event": "rate_limit_exceeded|invalid_token|...",
  "message": "Human-readable description",
  "details": {
    /* additional context */
  }
}
```

### Forbidden in Logs

❌ Never log:

- Passwords
- JWT tokens
- Database credentials
- API keys
- Credit cards
- Personal identification numbers
- Complete email addresses (use masked: user+\*\*\*@domain)

### Critical Path Metrics

Emit metrics for:

1. **Authentication:**
   - Login attempts (succeeded + failed)
   - User account locks
   - Token generation + validation time

2. **Attempt Submission:**
   - Submission count per hour
   - Idempotent cache hit rate
   - Duplicate submission rate
   - Grading latency (by attempt type)

3. **Rate Limiting:**
   - Limit violations by endpoint
   - Rejected request rate
   - IP ban duration + frequency

---

## Test Strategy

### Unit Tests Required

- ✅ Rate limiter: sliding window counter increments correctly
- ✅ Rate limiter: expiration clears counters
- ✅ Rate limiter: multiple endpoints have separate counters
- ✅ Idempotency: duplicate key returns cached result
- ✅ Idempotency: different key processed normally
- ✅ JWT validation: expired token rejected
- ✅ JWT validation: workspace mismatch rejected
- ✅ JWT validation: signature mismatch rejected
- ✅ CSRF: missing token rejected
- ✅ CSRF: invalid token rejected
- ✅ Cross-workspace: mismatch returns 403
- ✅ Header validation: payload size limit enforced

### Integration Tests Required

- ✅ Rate limit: 5 failed logins in 1 minute lock user
- ✅ Rate limit: 6th login attempt returns 429
- ✅ Rate limit: different IP not limited by same user's lock
- ✅ Attempt submission: duplicate submission returns cached result (end-to-end)
- ✅ Attempt submission: duplicate with different answer returns original grading
- ✅ WebSocket: unauthorized attempt rejected
- ✅ WebSocket: one connection per attempt enforced
- ✅ WebSocket: message rate limit enforced (100/min)
- ✅ WebSocket: heartbeat timeout disconnects after 30s
- ✅ Attempt start: early access rejected
- ✅ Attempt start: late submission checked against grace period
- ✅ Cross-workspace: token from workspace A rejected on workspace B endpoint
- ✅ CSRF: valid form submission passes
- ✅ CSRF: missing CSRF token rejected

### Load Testing Required

- ✅ Rate limiter: performance under 10x concurrent login attempts
- ✅ Redis memory usage: stable under sustained rate limiting
- ✅ Idempotency cache: hit rate > 90% for bulk submissions
- ✅ WebSocket: 1000 concurrent connections, 100 msgs/connection/min

### Security Testing Required

- ✅ Rate limit bypass attempts: all deflected
- ✅ JWT manipulation: invalid signatures rejected
- ✅ Cross-tenant injection attempts: all blocked
- ✅ DDoS simulation: rate limiter throttles gracefully

---

## Explicit Non-Goals

This specification does NOT:

- ❌ Redesign the attempt engine architecture
- ❌ Modify grading logic or scoring algorithms
- ❌ Change database schema beyond idempotency keys
- ❌ Introduce multi-master replication
- ❌ Add new authentication methods (OAuth2, SAML, etc.)
- ❌ Implement IP geolocation blocking
- ❌ Add user behavior analytics
- ❌ Modify worker job scheduling algorithm
- ❌ Change tenant provisioning process

---

## Success Criteria

Feature is complete and successful when:

1. ✅ **Login brute force is blocked:** 5 failed attempts lock user for 1+ minute
2. ✅ **Duplicate submissions rejected safely:** Duplicate attempt submit returns cached result in <
   100ms
3. ✅ **Attempt restart spam blocked:** User cannot restart same attempt >5 times/min
4. ✅ **WebSocket authenticated and throttled:** Unauthorized connections rejected; message rate
   enforced
5. ✅ **Cross-workspace requests rejected:** Token workspace_id mismatch returns 403
6. ✅ **Rate limiter tested under load:** Handles 10x concurrent requests without performance
   degradation
7. ✅ **Dead-letter queue tested:** Failed worker jobs move to DLQ correctly; ops can inspect
   failures
8. ✅ **No secrets visible in logs:** Audit reveals zero credential leaks
9. ✅ **All rate-limited endpoints return 429 with Retry-After:** HTTP contract enforced
10. ✅ **Idempotency latency < 100ms:** Cache hits achieve sub-100ms response time
11. ✅ **Redis memory stable over 24 hours:** No memory leaks under sustained traffic
12. ✅ **Audit trail captures all security events:** Cross-tenant attempts logged with full context

---

## Assumptions

This specification assumes:

1. **Redis is available** at boot time (not optional). If Redis is unavailable, API cannot start
   (fail-fast).
2. **Database schema version incremented** before code deployment. Migration runs before feature
   activation.
3. **JWT secrets already implemented** from Phase 1. This stage adds JWT validation rules only.
4. **Attempt table already exists** with `id`, `user_id`, `workspace_id`, `status` columns.
5. **Observability (structured logging) already implemented** from STAGE_07. Logs use existing Pino
   abstraction.
6. **Tenant resolver middleware already exists** from STAGE_02. All endpoints use it.
7. **License enforcement already exists** from STAGE_04. All endpoints validate license status.
8. **Token expiration already enforced** in authentication middleware. Rate limiter assumes valid
   JWT before checking limits.

---

## Constitutional Compliance Checklist

- ✅ Database-per-tenant isolation preserved
- ✅ License middleware enforced before rate limiting
- ✅ No grading logic changes
- ✅ No cross-tenant rate limit state sharing
- ✅ All writes transactional (idempotent submission via FOR UPDATE)
- ✅ Idempotency enforced (UNIQUE constraint + Redis cache)
- ✅ Version compatibility enforced
- ✅ Worker remains sole grading authority
- ✅ Attempt snapshot integrity preserved
- ✅ Server time authoritative (client time ignored for deadlines)
- ✅ All secrets excluded from logs and responses
- ✅ Audit trail comprehensive

**Final Declaration:** ✅ **Compliant with Zidney Constitution v1.2.0 — No violations detected.**

---

## Next Steps

This specification is **READY FOR CLARIFICATION** phase:

- ✅ All mandatory sections completed
- ✅ Constitutional compliance verified
- ✅ No architecture violations detected
- ✅ Security principles clearly defined
- ✅ Test strategy detailed
- ✅ Success criteria measurable

**Proceed to:** `/speckit.clarify` phase

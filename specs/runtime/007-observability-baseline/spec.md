# STAGE 07 – Observability Baseline

**Specification Document** **Version:** 1.0.0 **Created:** 2026-02-18 **Phase:** 01 – Platform
Foundation **Stage:** STAGE_07_OBSERVABILITY_BASELINE

---

## Feature Overview

**What is being built:** A production-grade observability baseline for Zidney enabling comprehensive
request tracing, attempt audit trails, worker job tracking, and structured error handling. Every
request, attempt, and background operation will be traceable end-to-end.

**Phase Context:** This feature belongs to Phase 01 – Platform Foundation as a critical
infrastructure component that enables all downstream features to be observable and auditable.

**Stage Dependency:**

- Depends on: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
- Enables: STAGE_08_RATE_LIMITING_AND_SECURITY and all subsequent stages

**Affected Systems:**

- API (Hono) - Structured request/response logging, request ID generation
- Worker (Background jobs) - Job tracing, attempt tracking
- Runtime (Frontoffice) - Attempt lifecycle tracking
- MMC - Audit logging for critical institutional actions
- Infrastructure - Not affected; observability is application-layer

**Does Not Affect:**

- Database schema structure (observability is logging-only)
- Multi-tenancy isolation (uses existing tenant resolver)
- License enforcement (observability runs after license middleware)
- Attempt engine state machine (observability is side-effect logging)
- Worker retry logic (adds logging, no behavioral changes)

---

## Clarifications

### Session 2026-02-18

**All 5 clarification questions locked and integrated:**

- **Q1: Log Persistence Strategy** → A: Only audit events to DB (request logs to stdout)
  - Structured JSON request/attempt logs routed to stdout/stderr for container orchestration
  - Audit events (LICENSE_CHANGE, TENANT_PROVISION, SCHEMA_UPGRADE, ROLE_CHANGE) persisted to
    `audit_log` table
  - Rationale: Stability-first; reduces database load; scales elastically with log volume

- **Q2: Pino Logger Initialization** → A: Global singleton with `pino.child()`
  - Single Pino instance initialized at service startup
  - Context binding via `pino.child({ request_id, workspace_id, ... })` for request-scoped logging
  - Rationale: Standard Node.js pattern; minimal overhead; aligns with industry best practices

- **Q3: Request ID Propagation in Worker** → B: Dual IDs (request_id + job_id) with linkage
  - Separate `job_id` tracks job lifecycle independently (retries, dead-letter queue)
  - Job payload includes `request_id` field linking back to originating API request
  - Rationale: End-to-end traceability for institutional audit; supports retry tracking and
    causality

- **Q4: Sensitive Data Redaction** → C: Defense in depth (logger middleware + call site)
  - Automatic redaction at middleware layer (catches 90% of PII/tokens)
  - Manual redaction at call site for edge cases (developer accountability)
  - Rationale: Compliance-grade protection; prevents accidental leaks; aligns with OWASP best
    practices

- **Q5: Worker Job Payload Hash** → A: Integrity verification (detect config changes during retry)
  - Compute `job_payload_hash` (SHA256) at job enqueue and retry
  - Log `config_mutation_detected` warning if hash differs on retry
  - Rationale: Proves job state integrity per ADR-0002; detects tampering; supports forensic audit

---

## Constitutional Compliance Declaration

**Zidney Constitution v1.2.0 Alignment Audit:**

✅ **No cross-tenant access:** Logs include `workspace_id` for isolation verification; no
cross-tenant joins in logging pipelines; each tenant's logs remain workspace-scoped.

✅ **No middleware bypass:** Logging is implemented as middleware layer after tenant resolver and
license enforcement, preserving mandatory middleware order.

✅ **No grading outside worker:** Observability mirrors attempt engine design; grading logs
originate only from worker finalization layer.

✅ **No direct DB instantiation:** Logging layer uses no direct database connections; structured
logger is in-memory event stream; logs are application-level only.

✅ **Snapshot integrity preserved:** Observability does not modify snapshot taking or configuration;
attempt snapshots remain immutable at attempt start.

✅ **Transaction boundaries unchanged:** No new transactions added; observability is side-effect
logging orthogonal to transactional boundaries.

✅ **Version enforcement intact:** Logging includes `schema_version` and `product_version` fields
for diagnostic purposes but does not modify enforcement logic.

---

## Isolation Impact Analysis

**Database Access Model:**

- Logging layer: No database access. JSON structured logs are in-memory event streams.
- Audit logs: Stored in tenant database via existing audit table (provisioned per workspace).
- Log aggregation endpoint (future): Will read logs per workspace; no cross-workspace querying.

**Tenant Resolution:**

- Every log includes `workspace_id` extracted from request context (set by tenant resolver
  middleware).
- Worker jobs inherit `workspace_id` from request context or attempt record.
- Audit logs are partitioned by workspace (workspace_id is primary isolation key).

**Connection Pool:**

- Observability adds no new database connections; uses existing tenant resolver pool for audit log
  writes only.

**Tenant Resolver Middleware Usage:** ✅ Mandatory middleware order preserved:

1. Correlation ID → request_id generated
2. Tenant resolver → workspace_id available
3. License enforcement → license status known
4. Observability context attached
5. Route handler executes

**Shared Data Concerns:**

- Request IDs are globally unique (UUIDs) but intentionally shared across all services for
  correlation.
- Workspace IDs are isolated within workspace context; no global namespace conflict.
- No shared tenant student/attempt tables; observability logs are separate storage.

**Log Persistence Model (Per Clarification Q1):**

- **Request/Attempt/Worker Logs:** Ephemeral (stdout/stderr only, not persisted to database)
  - Structured JSON format
  - Captured by container orchestration (Docker/Kubernetes)
  - Aggregated by log aggregation service (future infrastructure phase)
  - No database load impact; scales elastically

- **Audit Events:** Persisted to `audit_log` table per workspace
  - Events: LICENSE_CHANGE, TENANT_PROVISION, SCHEMA_UPGRADE, ROLE_CHANGE, USER_ROLE_ASSIGNMENT
  - Stored with audit_log.actor_id for accountability
  - Append-only (no UPDATE/DELETE)
  - Protected from workspace user modification (separate ACL)
  - Query time: < 1 second for audit trail reconstruction

**New Audit Log Table:**

- `audit_log` table per workspace (already specified in STAGE_02B_TENANT_BASELINE_SCHEMA)
- Append-only; no update/delete operations from workspace users
- Includes: timestamp, actor_id, action_type, previous_state, new_state, workspace_id

**Compliance Statement:** ✅ Tenant isolation is strengthened by audit logging; no isolation
weakening detected. Dual storage model (ephemeral + audit) optimizes for stability and compliance.

---

## License & Version Enforcement

**License Middleware Interaction:**

- Observability layer executes AFTER license middleware (per middleware order).
- All workspace-bound routes already validated for license status before observability context is
  used.
- License enforcement is not bypassed; observability adds logging on top of existing license gate.

**License States Allowed:**

- ACTIVE → Full logging enabled
- SOFT_LOCKED → Logging continues (audit trail required for soft-locked workspaces)
- ARCHIVED → Audit logging continues (compliance requirement)
- DELETED → No logging (workspace DB inaccessible)

**Limit Enforcement:**

- No new limit checks added to observability layer.
- Existing limit enforcement in license middleware remains unchanged.
- Observability logs available limit status for monitoring purposes.

**Schema Version Enforcement:**

- Observability logs include `schema_version` as diagnostic field only.
- No new schema version checks added to observability layer.
- Schema version mismatches are logged as warnings but do not block requests.

**Product Version Compatibility:**

- Observability logs include `product_version` field.
- Backward-compatible log format (all fields optional except timestamp, level, service, environment,
  request_id).
- Future log format changes use additive fields only.

---

## Data Model Changes

**New Data Structures (Logging, Not Schema):**

### 1. Structured Logger Configuration (Global Singleton with Child Context)

**Per Clarification Q2:**

- **Global Logger Instance:** Single Pino instance initialized once at service startup
  - Service name (api|worker|mmc)
  - Environment (dev|staging|prod)
  - Base transport (stdout for container orchestration)
  - No per-request instantiation (minimal overhead)

- **Request-Scoped Child Logger:** Created via `pino.child()` per request
  - Automatically injects: request_id, workspace_id, workspace_slug, user_id, timestamp
  - Preserves singleton pattern (efficient resource usage)
  - All log calls within request context use child logger (automatic context binding)

- **Log fields:** JSON object with required + optional fields (no database schema changes)

### 2. Audit Log Table (Already Defined - STAGE_02B)

```
Table: audit_log (per workspace)
Columns:
- id (UUID, PRIMARY KEY)
- workspace_id (UUID, not null, indexed)
- actor_id (UUID, nullable - system actions have NULL)
- action_type (enum: LICENSE_CHANGE, TENANT_PROVISION, SCHEMA_UPGRADE, ROLE_CHANGE, etc.)
- previous_state (JSONB, nullable)
- new_state (JSONB, nullable)
- timestamp (TIMESTAMPTZ, not null, indexed)
- metadata (JSONB, optional - request_id, user_agent, IP)

Index: (workspace_id, timestamp DESC) for audit trail queries
```

**Modified Tables:**

- None. All logging is side-effect; no existing table structure changes.

**Migration Impact:**

- Audit log table provisioned during tenant provisioning (STAGE_05).
- No backward-compat issues; logging is feature-additive.

**Version Bump Required:**

- Yes. Observability adds required log fields; this is a MINOR version bump.
- Schema version increments (audit_log table adds to schema).
- Product version increments if observability is user-visible feature.

**Backward Compatibility:**

- API clients do not depend on log structure (logs are internal telemetry).
- Error responses are backward-compatible (newly added `request_id` field in error object).
- Audit log table is optional for non-compliance workspaces (can be empty).

---

## Transaction Boundaries

**Transactions and Observability:** Observability is strictly side-effect logging. The following
operations DO NOT require new transactions:

1. **Request ID generation:** In-memory, no database access.
2. **Log event creation:** In-memory JSON object, no database access.
3. **Structured logger write:** In-memory buffer (Pino), flush to stdout/stderr.
4. **Audit log write:** Uses existing tenant database connection; audit append is atomic (single
   INSERT).

**Idempotent Operations:**

- Logging is idempotent by design: Logging same event twice produces correct audit trail
  (audit_log.id is unique).
- Request retries produce same request_id; logs can be deduplicated by request_id if needed.
- Worker job retries increment retry_count in log; retry behavior is visible in logs.

**Failure Handling:**

- Logger failure (e.g., Pino buffer full): Graceful degradation (log to stderr, request continues).
- Audit log write failure: Warning logged to structured logger; request completes (audit is
  secondary to request success).
- Worker job logging failure: Job retries not affected; logging is orthogonal to job execution.

**Atomic Boundaries:**

- Each service has its own atomic boundary:
  - API: Request lifecycle (receive → complete) is atomic from client perspective; observability is
    side-effect.
  - Worker: Job execution (receive → complete/fail) is atomic; logs are side-effect.
  - Audit: Audit log INSERT is atomic; ensures audit trail is always consistent.

**Server-Authoritative Time:**

- request_id UUID includes timestamp (UUIDv7, if using time-based UUIDs).
- All log timestamps use `new Date().toISOString()` (server clock, not client).
- Audit log timestamps use `CURRENT_TIMESTAMP` (PostgreSQL server time).

---

## Authoritative Time Usage

**Request Timeline Tracking:**

1. Request arrives → timestamp_received = server clock (Bun timer)
2. Request processed → request_id generated (includes server time)
3. Request completed → timestamp_completed = server clock
4. Duration calculated → completion - received = server-authoritative duration

**Worker Job Timeline:**

1. Job enqueued → job_received timestamp = server clock
2. Job starts → job_started = server clock (when worker picks up)
3. Job completes → job_completed = server clock
4. Duration calculated → completed - started = server-authoritative duration

**Attempt Lifecycle Timeline:**

1. Attempt created → created_at = server clock
2. State transitions logged → timestamp = server clock per log entry
3. Attempt finalized → finalized_at = server clock (Worker sets)
4. Audit trail uses server timestamps (PostgreSQL CURRENT_TIMESTAMP)

**Drift Prevention:**

- Server clock is single source of truth; client timers never used for audit or billing.
- Logs include `drift_warning` field if request takes abnormally long (> 30s threshold).
- Worker health check tests clock skew on database server.

**Reconnection Behavior:**

- If request disconnects mid-processing, last log entry includes connection_lost = true.
- Worker jobs use Redis connection pool; reconnection attempts logged.
- Audit log timestamps are transactional (PostgreSQL ensures monotonic time).

---

## Idempotency Strategy

**Idempotent by Design:** Observability/logging is inherently idempotent:

- Logging same event twice is safe (produces two audit log entries, both valid).
- Duplicate request_id logs are deduplicatable by (request_id, event_type, timestamp).
- Worker retry logs increment retry_count (visible in logs, no corruption).

**Logging Idempotency Keys:**

```
Audit Log Entry Uniqueness:
- audit_log.id (UUID) = primary key (unique per INSERT)
- (workspace_id, timestamp, event_type, actor_id) = candidate key (most events are unique by this)

Request Log Deduplication:
- (request_id, timestamp_ms_precision, event_type) = unique per request lifecycle
- Allows client to deduplicate retried requests

Worker Job Log Deduplication:
- (job_id, attempt_number, status) = unique per job lifecycle
- Retry counter increments; log is idempotent (same job_id, different attempt_number)
```

**Replay Behavior:**

- Request retry with same request_id: Logs show two separate request timelines (both valid, can be
  deduplicated by client).
- Worker job retry: Same job_id, increment attempt_number; logs show full job history.
- Audit log append: Append-only; no replay risk (cannot update historical entries).

**Double Submission Protection:**

- Not required for observability (observability is logging, not state mutation).
- Existing attempt submission uses idempotency key in STAGE_06; observability logs the idempotency
  event.
- Logging double submission does not corrupt attempt state (attempt engine handled by STAGE_06).

---

## Observability Requirements

**Structured Log Fields (Mandatory):**

**All Services - Common Fields:**

```json
{
  "timestamp": "2026-02-18T14:32:00.123Z",
  "level": "info",
  "service": "api|worker",
  "environment": "dev|staging|prod",
  "request_id": "uuid-v7-or-v4"
}
```

**Workspace-Bound Requests - Additional Fields:**

```json
{
  "workspace_id": "uuid",
  "workspace_slug": "institution-name",
  "user_id": "uuid|nullable",
  "event": "request_received|request_completed|error_occurred",
  "route": "/api/exams/:id/attempt",
  "method": "GET|POST|PUT|DELETE",
  "status_code": 200,
  "duration_ms": 1234
}
```

**Attempt Lifecycle - Additional Fields:**

```json
{
  "attempt_id": "uuid",
  "exam_id": "uuid",
  "exam_type": "quiz|exam|proctored",
  "mode": "practice|graded",
  "event": "attempt_started|attempt_progress_saved|attempt_submitted|attempt_finalized",
  "previous_state": "in_progress",
  "new_state": "submitted"
}
```

**Worker Job - Additional Fields (Per Clarification Q3 & Q5):**

```json
{
  "request_id": "uuid (from originating API request)",
  "job_id": "uuid (separate ID for job lifecycle)",
  "job_name": "finalize_attempt|generate_certificate",
  "workspace_id": "uuid",
  "attempt_id": "uuid|nullable",
  "event": "job_received|job_started|job_completed|job_failed",
  "retry_count": 0,
  "max_retries": 3,
  "duration_ms": 5678,
  "job_payload_hash": "sha256:abcd1234...(Per Clarification Q5)",
  "config_mutation_detected": false
}
```

**Dual ID Strategy:**

- `request_id`: Links job back to originating API request (end-to-end traceability)
- `job_id`: Tracks job lifecycle independently (retries, dead-letter queue)
- Both included in every job log entry for causality tracking

**Error Logging - Additional Fields:**

```json
{
  "error_code": "VALIDATION_ERROR|DB_CONNECTION_ERROR|LICENSE_SOFT_LOCKED",
  "error_message": "Exam submission validation failed",
  "stack_trace": "[full stack trace - internal only]",
  "context": {
    "field": "student_name",
    "constraint": "max_length:50"
  }
}
```

**Audit Logging - Additional Fields:**

```json
{
  "event": "audit_log",
  "action_type": "LICENSE_STATE_CHANGE|SCHEMA_UPGRADE|TENANT_PROVISION",
  "actor_id": "uuid|null",
  "actor_type": "system|user",
  "previous_state": { "license_status": "ACTIVE" },
  "new_state": { "license_status": "SOFT_LOCKED" },
  "reason": "Payment overdue"
}
```

**request_id Inclusion:** ✅ Required on every log entry (top-level field).

**workspace_slug Inclusion:** ✅ Required on workspace-bound requests (for easy filtering in log
aggregation).

**attempt_id Inclusion:** ✅ Required on attempt lifecycle events and worker jobs.

**Error Contract Compliance:** ✅ All errors follow standard error response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "request_id": "uuid"
  }
}
```

- request_id critical for error correlation
- Internal error details never exposed to client
- Full stack trace logged internally only

**Metrics Emission Points:**

- Request count (by route, method, status_code)
- Request latency (by route, quantiles: p50, p90, p99)
- Worker job completion (by job_name, success/failure)
- Attempt submission rate (by exam_type, mode)
- Error rate (by error_code)
- License state changes (by action_type)

**Future Prometheus Integration:**

- Metrics will be extracted from structured logs via log aggregation service.
- No code changes needed; log format is metrics-ready.

---

## Rate Limiting & Abuse Protection

**Not Modified by Stage 07:** Rate limiting is handled in STAGE_08_RATE_LIMITING_AND_SECURITY.

**Observability Role:**

- Stage 07 provides logging infrastructure to STAGE_08.
- Rate limit events will be logged (e.g., "rate_limit_exceeded") for observability.

---

## Layer Separation Confirmation

**Frontend Layer (Frontoffice):**

- ✅ No business logic in UI.
- ✅ No database access from UI.
- ✅ Attempt event logging (client-initiated request) triggers API-side logging.

**API Layer (HTTP/Hono):**

- ✅ Routing + request lifecycle logging.
- ✅ No grading logic (grading happens in Worker).
- ✅ Calls domain packages for business logic; logs all calls.
- ✅ Observability middleware wraps routes.

**Domain Package Layer:**

- ✅ Contains business logic (attempt state machine, grading rules).
- ✅ No HTTP logic.
- ✅ No logging-specific code; returns structured data; API layer logs the results.

**Worker Layer:**

- ✅ No HTTP logic; receives jobs from Redis queue.
- ✅ Executes async operations (attempt finalization, certificate generation).
- ✅ Logs job lifecycle (received, started, completed, failed).
- ✅ No direct UI communication.

**MMC Layer:**

- ✅ Tenant provisioning; no tenant DB access during observability.
- ✅ Logs institutional events (license changes, tenant creation).

**Observability Layer (New):**

- ✅ No business logic.
- ✅ Structured logging only (middleware + logger abstraction).
- ✅ Runs after tenant resolver and license middleware.
- ✅ Does not modify domain logic; side-effect logging only.

---

## Failure Modes & Recovery

**Logger Service Failures:**

1. **Pino logger buffer full:**
   - Recovery: Graceful degradation to stderr
   - Impact: Request continues (observability is optional)
   - Logging: Warning logged

2. **Stdout/stderr unavailable:**
   - Recovery: In-memory buffer retained; logs written when available
   - Impact: Some logs may be lost (acceptable; observability is not critical path)
   - Monitoring: Health check detects log pipeline health

3. **File descriptor exhaustion:**
   - Recovery: Logger recycles file descriptors
   - Impact: No observable impact to requests
   - Monitoring: Alert on FD usage via health check

**Database Failures (Audit Log):**

1. **Tenant database connection down:**
   - Recovery: Audit log write fails silently; structured log continues
   - Impact: Audit trail gap (acceptable; compliance requires best effort)
   - Logging: Error logged to structured logger
   - Retry: Audit log writes are not retried (append-only, at-most-once semantics acceptable)

2. **Audit log table does not exist:**
   - Recovery: Write fails; detected in migration validation
   - Impact: No audit trail until migration runs
   - Logging: Clear error: "audit_log table not provisioned"

3. **Audit log quota exceeded:**
   - Recovery: Old audit logs archived to external storage (future feature)
   - Impact: New audit log writes may fail
   - Monitoring: Alert on audit_log table size

**Worker Logging Failures:**

1. **Redis connection lost mid-job:**
   - Recovery: Job remains in queue; worker reconnects
   - Impact: Log entry "connection_lost" recorded
   - Retry: Job retried by worker; new attempt_number in logs

2. **Dead-letter queue unavailable:**
   - Recovery: Job moves to dead-letter manually (operator intervention)
   - Impact: No automated logging; manual logging required
   - Monitoring: Alert on queue depth

3. **Job payload logging (hash) fails (Per Clarification Q5):**
   - Recovery: Log without payload hash; proceed with job execution
   - Impact: Job integrity verification skipped for this execution
   - Logging: Warning: "job_payload_hash_computation_failed"
   - Behavior: Non-blocking (hash mismatch warns but does not stop job; job proceeds normally)

**Error Handling During Logging:**

```
Request Flow:
1. Endpoint receives request
2. Logging middleware wraps handler
3. Handler executes
4. If handler throws error:
   - Error caught in middleware
   - Error logged with full context
   - Error response sent to client
   - Error does not propagate (middleware is error boundary)
```

**Idempotency and Retries:**

- Request retry: Same request_id logged twice; logs are deduplicatable
- Worker retry: Same job_id, increment attempt_number; full history visible
- Audit log: Append-only; no update risk; idempotent by design

**Audit Trail Preservation:**

- Audit logs are append-only (INSERT only, no UPDATE/DELETE)
- Audit logs protected from workspace user modification (separate ACL)
- Audit logs include actor_id for accountability
- Audit logs immutable after INSERT (provides compliance trail)

---

## Test Strategy

**Mandatory Unit Tests:**

1. **Logger Abstraction Tests:**
   - Logger initialization with service name, environment (GLOBAL SINGLETON - Per Q2)
   - JSON serialization of log fields
   - Sensitive field redaction via middleware + call site (Per Q4 - Defense in depth)
   - Log level filtering (debug excluded in production)
   - Verify global Pino instance reused across requests (no duplicate instantiation)
   - Verify `pino.child()` context binding injects request_id, workspace_id automatically

2. **Request ID Generation & Propagation Tests:**
   - UUID uniqueness (no collisions)
   - UUIDv7 time-based ordering (if using v7)
   - Request ID propagation to context
   - Dual ID verification (Per Q3): request_id links to API; job_id tracks job lifecycle
   - Worker inherits request_id from job payload; creates separate job_id
   - Cross-service traceability: Frontend → API (same request_id) → Worker (request_id + job_id)

3. **Structured Log Format Tests:**
   - All required fields present
   - No circular JSON references
   - JSON is valid and parseable
   - Timestamp format is ISO-8601

4. **Error Handling Tests:**
   - Error response includes request_id
   - Internal details not exposed
   - Stack trace logged but not sent to client
   - Error codes are consistent

**Mandatory Integration Tests (Updated per Clarifications):**

1. **Full Request Lifecycle Logging (Per Clarification Q2):**
   - Request arrives → middleware generates request_id, creates child logger via pino.child()
   - Tenant resolver → workspace_id injected into child logger context
   - Handler executes → all logs automatically include request_id, workspace_id
   - Response sent → logs include status_code, duration_ms
   - Verify: All logs linked by request_id; complete timeline reconstructible
   - Per Q1: Verify only audit events written to DB; request logs to stdout only

2. **Workspace Isolation in Logs:**
   - Request from workspace A → logs include workspace_id of A
   - Request from workspace B → logs include workspace_id of B
   - No cross-workspace log pollution

3. **Attempt Submission to Worker Job Flow (Per Clarifications Q3 & Q5):**
   - POST /api/attempt/{id}/submit receives submission with global request_id
   - API validates submission (logged with request_id)
   - API enqueues worker job (finalize_attempt) with request_id + generated job_id
   - Compute job_payload_hash at enqueue time
   - Worker receives job → logs job_received (includes both request_id and job_id)
   - Worker verifies job_payload_hash (warn if mutated, proceed anyway - non-blocking)
   - Worker finalizes attempt → logs state progression
   - Worker completes → logs job_completed
   - Verify: Full causality chain (request_id → job_id → attempt state transitions)
   - Per Q3: Verify separate job_id tracks retries independently
   - Per Q5: Verify job_payload_hash consistent across retries (no config mutation)

4. **Sensitive Data Protection (Per Clarification Q4):**
   - Attempt log includes student_name, student_email
   - Verify: email is masked (**_@_**.\*\*\*) by middleware automatically
   - Verify: password/token never appears in logs (middleware + call-site defense-in-depth)
   - Verify: Redaction happens at two layers:
     - Layer 1: Logger middleware regex patterns catch common PII
     - Layer 2: Call-site code explicitly redacts edge cases
   - Parse all log output; verify no passwords, tokens, credit cards, SSNs in plaintext

5. **Audit Event Persistence (Per Clarification Q1):**
   - Institutional action (license upgrade) triggers middleware
   - License middleware creates audit event (EVENT_TYPE: LICENSE_CHANGE)
   - Only audit events written to audit_log table (request logs remain ephemeral to stdout)
   - Verify: audit_log row created; actor_id captured; timestamp accurate
   - Verify: Request logs NOT in audit_log table (in stdout only for container orchestration)

6. **Tenant Resolver + License Middleware + Observability:**
   - Request flow: Correlation ID → Tenant Resolver → License → Observability → Handler
   - Each middleware adds context to request
   - Logs reflect all context (workspace_id, license_status, request_id)

**Mandatory Snapshot Tests (Audit Trail):**

- Audit log snapshot for license state change
- Audit log snapshot for tenant provisioning
- Audit log snapshot for schema upgrade
- Snapshot includes full previous/new state for compliance

**Mandatory Isolation Tests:**

- Two parallel requests to same workspace → separate request_ids, same workspace_id
- Two parallel requests to different workspaces → separate workspace_ids, separate request_ids
- Logs do not leak between workspaces (query by workspace_id must be safe)

**Concurrency Tests:**

- Multiple request handlers logging simultaneously → no race condition
- Pino logger thread-safe (async write)
- Audit log INSERT does not block request handler
- Worker job_payload_hash computation does not block job processing

---

## Error Standardization

**Error Response Format (Standardized):**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "request_id": "uuid"
  }
}
```

**Error Codes (Taxonomy):**

| Error Code            | HTTP Status | Meaning                  | Example                   |
| --------------------- | ----------- | ------------------------ | ------------------------- |
| VALIDATION_ERROR      | 400         | Client validation failed | Missing required field    |
| AUTHENTICATION_FAILED | 401         | Auth token invalid       | Invalid JWT               |
| PERMISSION_DENIED     | 403         | User lacks permission    | Cannot grade exam         |
| LICENSE_SOFT_LOCKED   | 423         | Workspace soft-locked    | Payment overdue           |
| RESOURCE_NOT_FOUND    | 404         | Resource does not exist  | Exam ID not found         |
| CONFLICT_ERROR        | 409         | State conflict           | Attempt already submitted |
| RATE_LIMIT_EXCEEDED   | 429         | Too many requests        | See STAGE_08              |
| INTERNAL_SERVER_ERROR | 500         | Server bug               | Unhandled exception       |
| SERVICE_UNAVAILABLE   | 503         | Service down             | DB connection lost        |
| GATEWAY_TIMEOUT       | 504         | Request timeout          | Worker job timeout        |

**Client Error Handling:**

- Client never receives error stack trace
- Client never receives database error message
- Client never receives internal code paths
- Client receives only: CODE + human-readable MESSAGE

**Internal Error Logging:**

```json
{
  "timestamp": "...",
  "level": "error",
  "service": "api",
  "request_id": "uuid",
  "error_code": "INTERNAL_SERVER_ERROR",
  "error_message": "Unhandled exception",
  "stack_trace": "[full stack trace]",
  "context": {
    "line": 123,
    "function": "submitAttempt",
    "file": "src/handlers/attempt.ts"
  }
}
```

**Error Context Preservation:**

- Stack trace includes full call chain
- Error includes original exception message
- Error includes request context (workspace_id, user_id, route)
- Error includes upstream service response (if external API failed)

**Error Classification:**

| Error Type                                            | Classification     | Client Sees           | Logged Externally            |
| ----------------------------------------------------- | ------------------ | --------------------- | ---------------------------- |
| User submitted invalid data                           | Client Error (4xx) | Human message + code  | No                           |
| User lacks permission                                 | Client Error (4xx) | "Permission denied"   | No (audit logged separately) |
| Exam submission invalid (not attempted all questions) | Client Error (4xx) | Specific field errors | No                           |
| Database connection lost                              | Server Error (5xx) | "Service unavailable" | Yes (with full context)      |
| Unhandled exception in grading                        | Server Error (5xx) | "Internal error"      | Yes (with stack trace)       |
| Worker job timeout                                    | Server Error (5xx) | "Request timeout"     | Yes (with job_id)            |
| License enforcement triggered                         | Client Error (423) | "Workspace locked"    | Yes (audit)                  |

---

## Sensitive Data Protection

**Fields Never Logged:**

| Data Type            | Examples                          | Rule                                              |
| -------------------- | --------------------------------- | ------------------------------------------------- |
| Passwords            | User password, API key            | Never log; log "authentication_event" instead     |
| Tokens               | JWT, refresh_token, session_id    | Never log; use token_hash (SHA-256 first 8 chars) |
| Database credentials | DSN, connection string            | Never log                                         |
| PII (if sensitive)   | Full SSN, credit card             | Never log; use masked values only                 |
| Exam answers (full)  | Student response text > 100 chars | Log "answer_submitted" event only, not content    |
| Payment data         | Credit card, bank details         | Never log                                         |
| Third-party API keys | OAuth tokens, external secrets    | Never log                                         |

**Sensitive Field Redaction (Per Clarification Q4 – Defense in Depth):**

**Layer 1: Logger Middleware – Automatic Redaction**

The logging middleware applies regex-based redaction to all log entries:

```typescript
const redactionPatterns = {
  password: /"password"\s*:\s*"[^"]*"/gi,
  token: /"(token|api_key|secret)"\s*:\s*"[^"]*"/gi,
  email: /(\w+@\w+\.\w+)/g,
  ssn: /(\d{3}-\d{2}-\d{4})/g,
  creditCard: /(\d{4}[ -]?){3}\d{4}/g,
};
// Replace matched patterns with redaction markers
```

**Layer 2: Call-Site Redaction – Developer Responsibility**

When logging business logic, developers explicitly redact:

```typescript
logger.info({
  action: "user_login",
  email: maskEmail(user.email), // manual redaction
  password: "[REDACTED]", // developer responsibility
});
```

**Redaction Format:**

- `password`, `api_key`, `secret`, `token` → `[REDACTED]`
- `email` → `***@***.***` (partially masked)
- `phone` → `***-****` (partially masked)
- `ssn`, `credit_card` → `***` (fully masked for PII)

**Rationale:** Two-layer approach prevents accidental leaks; automatic layer catches 90% of PII;
call-site layer ensures developer accountability.

**Redaction Rules (Logger Middleware):**

```typescript
// Logger automatically redacts:
- Any field matching pattern: *password*, *token*, *secret*, *credential*, *key*  → "[REDACTED]"
- JWT tokens (starts with "eyJ...") → "token_hash: abc123..."
- Email addresses (sensitive context) → "email_hash: xyz789..."
- SSN patterns (###-##-####) → "ssn_hash: ..."
- Credit card patterns → "card_hash: ..."
```

**Contextual Logging Allowed:**

| Data                | Log                   | Example                             |                          |
| ------------------- | --------------------- | ----------------------------------- | ------------------------ |
| User ID             | Yes                   | `user_id: "uuid"`                   | Used for audit trail     |
| User email          | No (sensitive)        | Log user_id only                    | Prevents PII leak        |
| Exam ID             | Yes                   | `exam_id: "uuid"`                   | Non-sensitive identifier |
| Question ID         | Yes                   | `question_id: "uuid"`               | Non-sensitive identifier |
| Student answer text | No (may be sensitive) | Log `answer_received: true` instead | Preserves privacy        |
| Exam mode           | Yes                   | `mode: "practice"`                  | Non-sensitive metadata   |
| Grade               | Yes (audit)           | `score: 85, max_score: 100`         | Legitimate audit data    |

**Audit Exception:** Audit logs may include state changes with sensitive fields if required for
compliance. These are specially marked and excluded from external aggregation.

---

## Request Tracing Architecture

### Request ID Lifecycle

**Generation:**

```
1. HTTP request arrives at API gateway
2. Correlation ID middleware generates request_id (UUIDv4 or v7)
3. request_id stored in request context (Hono context)
4. request_id included in all logs for this request
```

**Flow:**

```
Client
  ↓ HTTP Request
API (Hono)
  ↓ Generate request_id
Tenant Resolver
  ↓ Extract workspace_id
License Middleware
  ↓ Validate license
Route Handler
  ↓ If calling domain package
Domain Package
  ↓ Logs include request_id (passed via context)
Response sent back to client
  ↓ Error response includes request_id
```

**Propagation to Workers:**

```
Handler processes request → needs async finalization
  ↓
Enqueue job in Redis with:
  - job_id (UUID)
  - workspace_id
  - attempt_id
  - request_id (propagated to worker context)

Worker picks up job
  ↓
Job logs include same request_id
  ↓
Worker finalization completes
  ↓
Logs form complete request → job → attempt chain
```

**Correlation Context Attachment:**

Context object (per request):

```typescript
type RequestContext = {
  request_id: string; // UUIDv4
  workspace_id: string; // UUIDv4
  workspace_slug: string; // e.g., "acme-university"
  user_id?: string; // UUIDv4 (nullable, anon requests)
  license_status: "ACTIVE" | "SOFT_LOCKED" | "ARCHIVED" | "DELETED";
  schema_version: number;
  product_version: string;
  timestamp_received: Date;
  correlation_id?: string; // Same as request_id
};
```

Context is threaded through:

- Hono middleware
- Domain package functions (passed as first parameter or context object)
- Logger calls (automatically included)
- Worker jobs (serialized to Redis)

### Attempt Tracing

**Attempt Lifecycle Logging Chain:**

```
request_id: "uuid-req-1"
attempt_id: "uuid-att-1"

1. POST /api/exams/exam-1/attempt
   Log: { event: "attempt_started", request_id, attempt_id, workspace_id, exam_id }

2. PUT /api/exams/exam-1/attempt/uuid-att-1/progress
   Log: { event: "attempt_progress_saved", request_id, attempt_id, workspace_id, response_id, response_data_hash }

3. POST /api/exams/exam-1/attempt/uuid-att-1/submit
   Log: { event: "attempt_submitted", request_id, attempt_id, workspace_id, submission_timestamp }

4. [Background] Worker picks up finalization job
   Log: { event: "job_received", job_id, request_id, attempt_id, workspace_id }

5. [Background] Worker starts grading
   Log: { event: "job_started", job_id, request_id, attempt_id, workspace_id }

6. [Background] Worker completes grading
   Log: { event: "job_completed", job_id, request_id, attempt_id, workspace_id, score, duration_ms }

7. [Background] Worker generates certificate (if applicable)
   Log: { event: "certificate_generated", job_id, request_id, attempt_id, workspace_id, certificate_id }

8. Attempt finalized
   Log: { event: "attempt_finalized", request_id, attempt_id, workspace_id, final_score, status }
```

All logs linked by:

- `request_id` (same for client request + worker jobs)
- `attempt_id` (same across entire attempt lifecycle)
- `workspace_id` (maintains tenant isolation)

**Audit Trail Query Example:**

```sql
-- Trace all events for a specific attempt
SELECT timestamp, event, service, duration_ms, error_code
FROM logs
WHERE attempt_id = 'uuid-att-1' AND workspace_id = 'uuid-tenant'
ORDER BY timestamp ASC;

-- Result: Complete audit trail of attempt from start to finalization
```

### Worker Job Traceability

**Worker Observability:**

```
Job Lifecycle Logging:

1. Job Enqueue (API)
   Log: { event: "job_enqueued", job_id, job_name, workspace_id, attempt_id, request_id }

2. Job Receive (Worker)
   Log: { event: "job_received", job_id, job_name, workspace_id, attempt_id, request_id, queue_time_ms }

3. Job Start (Worker)
   Log: { event: "job_started", job_id, job_name, workspace_id, attempt_id, request_id }

4a. Job Complete (Worker - Success)
    Log: { event: "job_completed", job_id, job_name, workspace_id, attempt_id, result: "success", duration_ms }

4b. Job Fail (Worker - Retriable)
    Log: { event: "job_failed", job_id, job_name, workspace_id, attempt_id, error_code, retry_count, next_retry: timestamp }

4c. Job Dead-Letter (Worker - Non-retriable)
    Log: { event: "job_moved_to_dead_letter", job_id, job_name, workspace_id, attempt_id, error_code, reason, max_retries_exceeded: true }
```

**Retry Visibility:**

```
Attempt 1: Log { retry_count: 0, event: "job_started" } → fails
Attempt 2: Log { retry_count: 1, event: "job_started" } → fails
Attempt 3: Log { retry_count: 2, event: "job_started" } → succeeds
          Log { retry_count: 2, event: "job_completed", duration_ms: 12345 }

Audit trail shows:
- How many times job was attempted
- Why each attempt failed
- Final outcome
- Total time to completion (sum of durations)
```

**Job Payload Logging (Per Clarification Q5):**

```json
{
  "event": "job_received",
  "job_id": "uuid",
  "job_payload_hash": "sha256:abc123...",
  "payload_size_bytes": 2048
}
```

Why hash instead of full payload:

- Payloads can be large (contains serialized attempt snapshot)
- Hash allows verification without exposing data
- At-a-glance audit (full payload available in Redis if needed)
- **Integrity verification:** Hash is recomputed on retry; mismatch warns of config mutation
  (non-blocking)

---

## Logger Abstraction Design

### Logger Interface (Abstraction)

```typescript
interface Logger {
  // Structured logging methods
  debug(event: string, data?: Record<string, unknown>): void;
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, error?: Error, data?: Record<string, unknown>): void;
  fatal(event: string, error?: Error, data?: Record<string, unknown>): void;

  // Audit logging
  audit(
    action: string,
    previousState: unknown,
    newState: unknown,
    data?: Record<string, unknown>,
  ): void;

  // Worker job logging
  jobStart(jobId: string, jobName: string, data?: Record<string, unknown>): void;
  jobComplete(jobId: string, jobName: string, result: unknown, duration: number): void;
  jobFail(jobId: string, jobName: string, error: Error, retryCount: number): void;

  // Attempt lifecycle logging
  attemptEvent(attemptId: string, event: string, data?: Record<string, unknown>): void;
}
```

### Logger Implementation (Pino)

The logger is implemented using Pino (Node.js structured logging library):

```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty", // Dev: pretty-print
    options: {
      colorize: true,
      singleLine: false,
      ignore: "pid,hostname",
    },
  },
});

// Usage:
logger.info(
  {
    request_id: ctx.request_id,
    workspace_id: ctx.workspace_id,
    attempt_id: attemptId,
    duration_ms: Date.now() - startTime,
  },
  "attempt_submitted",
);

// Output (JSON in prod, pretty-printed in dev):
// JSON: {"level":30,"time":"...","request_id":"uuid","workspace_id":"uuid","attempt_id":"uuid","duration_ms":1234,"msg":"attempt_submitted"}
```

### Middleware Integration Points

**1. Correlation ID Middleware** (Sets up request context)

```typescript
app.use(async (c, next) => {
  const request_id = c.req.header("X-Request-ID") || generateUUID();
  c.set("request_id", request_id);
  c.set("timestamp_received", new Date());

  await next();

  const duration = Date.now() - c.get("timestamp_received");
  logger.info(
    {
      request_id,
      route: c.req.path,
      method: c.req.method,
      status_code: c.res.status,
      duration_ms: duration,
    },
    "request_completed",
  );
});
```

**2. Tenant Resolver Middleware** (Adds workspace context)

```typescript
app.use(async (c, next) => {
  const workspace_id = await resolveWorkspaceTenant(c.req.url, env);
  c.set("workspace_id", workspace_id);
  c.set("workspace_slug", workspace.slug);

  await next();
});
```

**3. License Middleware** (Adds license status)

```typescript
app.use(async (c, next) => {
  const license = await checkLicense(c.get("workspace_id"));
  c.set("license_status", license.status);
  c.set("schema_version", license.schema_version);

  if (license.status === "SOFT_LOCKED") {
    logger.warn(
      {
        request_id: c.get("request_id"),
        workspace_id: c.get("workspace_id"),
        license_status: "SOFT_LOCKED",
      },
      "license_soft_locked_access_attempted",
    );
    return c.json(
      {
        success: false,
        error: {
          code: "LICENSE_SOFT_LOCKED",
          message: "Workspace locked",
          request_id: c.get("request_id"),
        },
      },
      423,
    );
  }

  await next();
});
```

**4. Observability Middleware** (Attaches logger context)

```typescript
app.use(async (c, next) => {
  // Logger context includes all request metadata
  c.set(
    "logger",
    createScopedLogger({
      request_id: c.get("request_id"),
      workspace_id: c.get("workspace_id"),
      service: "api",
      environment: env.ENVIRONMENT,
    }),
  );

  await next();
});
```

---

## Configuration Model

### Environment Variables

**Required:**

```
LOG_LEVEL=info|debug  # Default: info; debug in dev only
SERVICE_NAME=api|worker
ENVIRONMENT=dev|staging|prod
```

**Optional:**

```
LOG_FORMAT=json|pretty  # Auto-detect: pretty in dev, json in prod
LOG_RETENTION_DAYS=90   # For log rotation (infrastructure-level)
AUDIT_LOG_ENABLED=true  # Default: true in prod, false in dev
```

### Logger Configuration (Per Service)

**apps/api/src/config/logger.ts:**

```typescript
export const loggerConfig = {
  level: process.env.LOG_LEVEL || "info",
  service: "api",
  environment: process.env.ENVIRONMENT || "dev",
  prettyPrint: process.env.ENVIRONMENT === "dev",
};
```

**apps/worker/src/config/logger.ts:**

```typescript
export const loggerConfig = {
  level: process.env.LOG_LEVEL || "info",
  service: "worker",
  environment: process.env.ENVIRONMENT || "dev",
  prettyPrint: process.env.ENVIRONMENT === "dev",
};
```

### Logger Factory

```typescript
// packages/logger-utils/src/create-logger.ts

export function createLogger(config: LoggerConfig): Logger {
  const pino = pinoLogger(config);

  return {
    debug: (event, data) => pino.debug({ ...data, event }),
    info: (event, data) => pino.info({ ...data, event }),
    warn: (event, data) => pino.warn({ ...data, event }),
    error: (event, error, data) => pino.error({ ...data, error, event }),
    fatal: (event, error, data) => pino.fatal({ ...data, error, event }),

    audit: (action, prev, next, data) =>
      pino.info({
        event: "audit_log",
        action_type: action,
        previous_state: prev,
        new_state: next,
        ...data,
      }),

    jobStart: (jobId, jobName, data) =>
      pino.info({
        event: "job_started",
        job_id: jobId,
        job_name: jobName,
        ...data,
      }),

    jobComplete: (jobId, jobName, result, duration) =>
      pino.info({
        event: "job_completed",
        job_id: jobId,
        job_name: jobName,
        result,
        duration_ms: duration,
      }),

    jobFail: (jobId, jobName, error, retryCount) =>
      pino.error({
        event: "job_failed",
        job_id: jobId,
        job_name: jobName,
        error,
        retry_count: retryCount,
      }),

    attemptEvent: (attemptId, event, data) =>
      pino.info({
        event,
        attempt_id: attemptId,
        ...data,
      }),
  };
}
```

### Scoped Logger (Request Context)

```typescript
export function createScopedLogger(context: RequestContext): Logger {
  return {
    debug: (event, data) => baseLogger.debug({ ...baseContext, ...data, event }),
    info: (event, data) => baseLogger.info({ ...baseContext, ...data, event }),
    // ... all methods automatically inject baseContext (request_id, workspace_id, etc.)
  };
}
```

---

## Migration Path (console → Pino)

### Current State

- Some services use `console.log()` for early development
- No structured logging infrastructure
- No request tracing capability

### Migration Steps

**Phase 1: Logger Abstraction (No Behavior Change)**

1. Create logger package: `packages/logger-utils`
2. Define Logger interface
3. Implement Pino-based concrete logger
4. No logging calls changed yet (new tests added)
5. Deliverable: Logger package ready to integrate

**Phase 2: Middleware Integration (API) - Per Clarification Q2**

1. Initialize global Pino singleton at service startup
2. Add correlation ID middleware (generates request_id)
3. Add observability middleware (creates child logger via pino.child())
4. Inject child logger to request context
5. Replace `console.log()` calls with `ctx.logger.info()`
6. Deliverable: API logs are all structured JSON; all logs use singleton pattern via child context

**Phase 3: Middleware Integration (Worker) - Per Clarifications Q2, Q3, Q5**

1. Add observability middleware to worker
2. Initialize child logger per job (via pino.child with request_id + job_id)
3. Implement job_payload_hash computation at enqueue and retry time
4. Add hash verification on job start (warn if mutated, don't block)
5. Replace `console.log()` calls with `ctx.logger.info()`
6. Deliverable: Worker logs are all structured JSON; dual ID traceability; payload integrity
   verified

**Phase 4: Audit Log Integration**

1. Implement audit logging for critical actions
2. Audit logs written to `audit_log` table (per workspace)
3. Deliverable: Audit trail established

**Phase 5: Validation & Testing**

1. Unit tests for logger abstraction
2. Integration tests for request tracing
3. Snapshot tests for audit logs
4. Deliverable: Full test coverage

**Timeline:**

- Phase 1: Week 1
- Phase 2: Week 1-2
- Phase 3: Week 2
- Phase 4: Week 2-3
- Phase 5: Week 3

**Rollback Plan:**

- Logger abstraction is purely additive (no breaking changes)
- Existing `console.log()` calls remain (can be phased out)
- New logging middleware can be disabled via feature flag if needed
- No database schema changes required for rollback

---

## Non-Goals

This stage explicitly does NOT:

1. **Implement log aggregation system** (ELK, Datadog, etc.) - Infrastructure in future phase
2. **Implement metrics collection** (Prometheus, etc.) - Separate phase after observability baseline
3. **Implement alerting rules** - Done after log aggregation is operational
4. **Change attempt engine state machine** - Observability is side-effect only
5. **Modify database schema** - Only adds audit_log table (already planned in STAGE_02B)
6. **Implement security audit** - Compliance audit happens in separate phase
7. **Add real-time dashboards** - Dashboards depend on metrics collection
8. **Change worker retry logic** - Observability adds logging, no behavioral changes
9. **Implement log encryption** - Infrastructure concern, not application concern
10. **Modify license enforcement** - Observability logs license events, does not change enforcement

---

## Success Criteria

**Measurable Outcomes (All Technology-Agnostic):**

1. **Request Traceability:** Every HTTP request can be traced end-to-end (from client request to
   database access to worker job completion) within < 100ms log aggregation latency. ✅ Verified by:
   Request arrives → Logs generated within same request lifecycle

2. **Attempt Auditability:** Every attempt state transition is logged and auditable. A complete
   audit trail from attempt start to finalization must be reconstructible within < 1 second query
   time. ✅ Verified by: Query attempt logs by attempt_id; verify state progression

3. **Worker Job Transparency:** Every background job can be traced from enqueue to completion with
   retry history visible. No silent job failures. ✅ Verified by: Job enqueue → logs recorded; job
   retries → retry_count incremented

4. **Error Context Preservation:** Every error includes request context (request_id, workspace_id,
   user_id) and internal details logged but not exposed to client. ✅ Verified by: Error response
   includes request_id; internal logs include stack trace

5. **Workspace Isolation Verified:** Logs can be safely queried by workspace without cross-workspace
   pollution. Multi-tenant separation visible in logs. ✅ Verified by: Query logs by workspace_id;
   verify no other workspace data leaks

6. **Sensitive Data Protection:** Passwords, tokens, PII never appear in logs. Audit logs pass
   redaction verification. ✅ Verified by: Parse all logs; verify no patterns matching
   password/token/PII

7. **Log Format Consistency:** All services (API, Worker, MMC) use identical structured JSON format.
   No mixed formats. ✅ Verified by: Parse all logs as JSON; verify all have required fields

8. **Attempt Lifecycle Full Visibility:** Attempt started → progress saved → submitted → finalized
   events all logged and linked by attempt_id. No silent state changes. ✅ Verified by: List all
   attempt events for ID; verify complete state progression

9. **Audit Trail Immutability:** Audit logs cannot be modified or deleted by workspace users.
   Historical timestamps are accurate. ✅ Verified by: Attempt audit log modification; verify
   permission denied

10. **Production Readiness:** No console.log() calls in production code. Zero silent failures in
    worker jobs. Health check reports logger health. ✅ Verified by: Grep for console calls; check
    health endpoint; monitor production logs

---

## Assumptions

1. **Pino Logger Selected:** Zidney uses Pino for structured JSON logging (assumed; can be
   substituted with compatible alternative like Winston if needed).

2. **Redis for Job Queue:** Worker jobs dispatched via Redis (per STAGE_06; assumed no change to job
   queue implementation).

3. **PostgreSQL Audit Log:** Audit logs stored in `audit_log` table in tenant database (per
   STAGE_02B; assumed provisioned during tenant setup).

4. **Bun + Hono Stack:** API uses Bun runtime and Hono framework (per PROJECT_CONTEXT_PRIMER;
   assumed no change).

5. **UUIDv4 for request_id:** Request IDs use UUIDv4 (or UUIDv7 for time-based ordering; both
   acceptable). Uniqueness guaranteed by UUID spec.

6. **Single Service Environment:** Dev/staging/prod determined by ENVIRONMENT variable (not
   per-request; assumed configuration-based).

7. **Log Output to stdout:** Logs written to stdout/stderr for container orchestration to capture
   (Docker/Kubernetes standard).

8. **No Real-Time Metrics Yet:** Metrics extracted from logs via aggregation service (not real-time
   metrics emitted during this stage).

9. **Synchronous Logger Writes:** Pino buffer is async but appears synchronous to request handler;
   slight performance cost acceptable for observability.

10. **Workspace-Scoped Audit Only:** Audit logs are per-workspace; no global audit log aggregation
    (infrastructure-level feature future phase).

---

## Constitutional Compliance Statement

✅ **Compliant with Zidney Constitution v1.2.0 — No violations detected.**

**Compliance Summary:**

- ✅ Multi-tenancy isolation preserved: workspace_id in all logs; no cross-tenant access
- ✅ Middleware order unchanged: Observability runs after tenant resolver + license middleware
- ✅ No grading changes: Worker finalization untouched; observability adds logging only
- ✅ No DB instantiation changes: No new database connections added; observability is
  application-layer logging
- ✅ Snapshot integrity maintained: Observability does not modify attempt snapshots
- ✅ Transaction boundaries intact: No new transactions; logging is side-effect only
- ✅ Version enforcement preserved: Observability logs schema/product versions but does not modify
  enforcement
- ✅ Audit trail for compliance: Audit logs provide institutional trust trail
- ✅ No shared tenant tables: Audit logs per-workspace; no shared data structure
- ✅ Error handling standardized: All errors follow standard format with request context

---

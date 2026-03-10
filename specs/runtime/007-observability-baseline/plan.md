# Implementation Plan: STAGE 07 – Observability Baseline

**Branch**: `007-observability-baseline` | **Date**: 2026-02-18 | **Spec**:
[specs/runtime/007-observability-baseline/spec.md](specs/runtime/007-observability-baseline/spec.md)
**Input**: Production-grade observability baseline for end-to-end request tracing, attempt audit
trails, and worker job tracking

**Stage Status**: PLANNING PHASE | **Clarifications Locked**: 5/5 (immutable)

---

## Summary

STAGE_07 implements a production-grade observability baseline enabling comprehensive request
tracing, attempt audit trails, and worker job tracking. All requests, attempts, and background
operations will be traceable end-to-end via correlated IDs and structured JSON logging. The
implementation uses:

- **Pino** (global singleton logger) for structured logging with automatic request context injection
  via `pino.child()`
- **Dual ID tracking** (request_id + job_id) for end-to-end traceability and job lifecycle
  independence
- **Audit logging** (4 event types) persisted to `audit_log` table (master DB) for compliance
- **Defense-in-depth redaction** (middleware + call-site) for sensitive data protection
- **Job payload hashing** (SHA256) to detect configuration mutations during retries
- **Server-authoritative time** (no client clock trust) for all timeline calculations

This stage executes **after license middleware** (per middleware authority principle) and is
orthogonal to existing business logic (side-effect logging only).

---

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20.x)  
**Platform**: Bun (API), Node.js (Worker), multi-tenant cloud  
**Primary Dependencies**:

- Pino logger (structured logging)
- Redis (job queue)
- PostgreSQL (audit persistence)

**Storage**:

- PostgreSQL: `audit_log` table per workspace (append-only)
- Redis: Job queue (transient)
- Stdout/Stderr: Structured JSON logs (ephemeral)

**Testing**: Vitest (unit + integration), with snapshot tests for audit structures  
**Target Platform**: Linux containers (Docker), Kubernetes orchestration ready  
**Project Type**: Monorepo (multi-service: API, Worker, MMC)  
**Performance Goals**:

- Request ID generation: < 1ms
- Pino logging: < 2ms per log entry (async, non-blocking)
- Audit log INSERT: < 10ms (transactional)
- Job payload hash (SHA256): < 5ms

**Constraints**:

- No synchronous database blocking in hot path
- No per-request logger instantiation (singleton pattern only)
- No cross-tenant log pollution
- All logs include required fields (timestamp, level, service, request_id)

**Scale/Scope**:

- 3 services (API, Worker, MMC)
- 50+ middleware + handler functions
- 4 audit event types
- 10+ log emission points minimum

---

## Constitution Check

**GATE**: All constitution principles validated ✅

| Principle                             | Status  | Evidence                                                                                                        |
| ------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| **Database-Per-Tenant Isolation**     | ✅ PASS | Audit logs include `workspace_id`; no cross-tenant joins; each tenant DB isolated                               |
| **Middleware Authority**              | ✅ PASS | Observability runs AFTER tenant resolver + license middleware; no bypass possible                               |
| **Authoritative License Enforcement** | ✅ PASS | License middleware unchanged; observability adds logging on top only                                            |
| **Snapshot-Based Attempt Integrity**  | ✅ PASS | Observability does not modify attempt snapshots; logs snapshot state only                                       |
| **Versioned Evolution**               | ✅ PASS | Logs include schema_version + product_version as diagnostic fields (no enforcement changes)                     |
| **Runtime Authoritative Time**        | ✅ PASS | All timestamps use server clock (Bun timer + PostgreSQL CURRENT_TIMESTAMP); no client time trusted              |
| **Strict Separation of Layers**       | ✅ PASS | Logger abstraction isolated; no business logic in observability layer                                           |
| **Security Baseline**                 | ✅ PASS | Structured logging enforced; correlation IDs required; defense-in-depth redaction; no console.log in production |
| **Operational Integrity**             | ✅ PASS | All log writes idempotent by design; audit log append-only; request retries generate separate request_ids       |
| **AI Behavioral Contract**            | ✅ PASS | No isolation weakening; middleware order preserved; version enforcement intact; attempt engine unchanged        |

**Constitutional Violations Detected**: None ✅

**Re-check Required**: After Phase 1 design (to validate data model against middleware order)

---

## Layering Verification (Hard Rule Compliance)

**Middleware Order (LOCKED – Per Constitution):**

```
Request Received
    ↓
[1] Request ID Injection
    └─ Generate UUID-v4/v7, attach to req.context.request_id
    └─ Non-blocking, in-memory
    ↓
[2] Tenant Resolver
    └─ Extract workspace_id from subdomain/path
    └─ Load tenant config (existing middleware)
    ↓
[3] License Enforcement Middleware
    └─ Validate license status (ACTIVE/SOFT_LOCKED/ARCHIVED/DELETED)
    └─ Check schema_version compatibility (existing middleware)
    └─ Return 423 or proceed
    ↓
[4] Correlation Context Binding (OBSERVABILITY START)
    └─ Bind { request_id, workspace_id, user_id, workspace_slug } to logger via pino.child()
    └─ Inject into Pino context for all downstream logs
    ↓
[5] Redaction Middleware
    └─ Prepare redaction patterns (regex for passwords, tokens, emails)
    └─ Applied during Pino serialization (before disk write)
    ↓
[6] Route Handler
    └─ All handler logs automatically include context from pino.child()
    └─ Handler can call domain logic or services
    └─ Audit service records critical events (transactional)
    ↓
Response Sent + Request Timeline Logged
```

**No Reordering Allowed**: License middleware must execute before observability context binding
(immutable per middleware authority).

---

## Project Structure

### Documentation (this feature)

```text
specs/runtime/007-observability-baseline/
├── spec.md                    # Feature specification (1528 lines, all clarifications locked)
├── plan.md                    # This file – Technical architecture design
├── research.md                # Phase 0 output (TBD)
├── data-model.md              # Phase 1 output (TBD)
├── quickstart.md              # Phase 1 output (TBD)
├── contracts/                 # Phase 1 output (TBD)
│   ├── logger-abstraction.ts  # Logger singleton interface
│   ├── audit-service.ts       # Audit recording interface
│   └── job-envelope.ts        # Job payload structure
└── tasks.md                   # Phase 2 output (TBD, generated by /speckit.tasks)
```

### Source Code (Repository Root)

```text
apps/api/src/
├── lib/
│   └── logger.ts              # Pino singleton + getLogger() abstraction
├── middleware/
│   ├── request-id.ts          # Generate + attach request_id to context
│   ├── correlation.ts         # Bind context via pino.child()
│   └── redaction.ts           # Sensitive data redaction before serialization
├── services/
│   └── audit.service.ts       # Audit event recording (LICENSE_CHANGE, TENANT_PROVISION, etc.)
└── config/
    └── errors.ts              # Error code taxonomy + error response format

apps/worker/src/
├── lib/
│   └── logger.ts              # Pino singleton (same pattern as API)
├── middleware/
│   └── job-context.ts         # Extract job_id, request_id, compute payload_hash
└── services/
    ├── grading.service.ts     # Grading worker logs (state transitions)
    └── certificate.service.ts # Certificate worker logs

packages/domain-core/src/
└── audit/
    └── audit.repository.ts    # Persist audit events to tenant DB (transactional)

tests/
├── api/
│   ├── middleware/
│   │   ├── request-id.test.ts
│   │   ├── correlation.test.ts
│   │   └── redaction.test.ts
│   ├── services/
│   │   └── audit.service.test.ts
│   └── integration/
│       ├── request-lifecycle.test.ts
│       ├── attempt-to-worker-flow.test.ts
│       └── sensitive-data-redaction.test.ts
├── worker/
│   ├── job-lifecycle.test.ts
│   ├── dual-id-tracking.test.ts
│   └── payload-hash-integrity.test.ts
└── snapshots/
    ├── audit-log-schema.snap.ts
    └── error-response-format.snap.ts
```

---

## Design Decisions (Locked – Per Clarifications)

### 1. Logger Abstraction (Clarification Q2: Global Singleton with pino.child())

**Decision**: Global Pino singleton initialized once at service startup; request-scoped context via
`pino.child()`.

**Rationale**:

- Standard Node.js pattern (minimal overhead)
- Automatic context injection via child logger
- Prevents duplicate instantiation (singleton guarantees)
- Aligns with industry best practices (OpenTelemetry-compatible)

**Architecture**:

```typescript
// Global singleton (instantiated once per service)
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "prod" ? pino.transport({ target: "pino-pretty" }) : undefined,
  serializers: {
    req: (r) => ({
      method: r.method,
      url: r.url,
      request_id: r.context?.request_id,
    }),
    res: (r) => ({ statusCode: r.statusCode }),
  },
});

// Export helper
export const getLogger = () => logger;
export const getChildLogger = (context: LogContext) => logger.child(context);
```

**Usage Pattern**:

```typescript
// In middleware: Create child logger with request context
const childLogger = getLogger().child({
  request_id,
  workspace_id,
  user_id,
  workspace_slug,
});

// Child logger automatically injects context into all downstream logs
childLogger.info({ event: "request_received", route: "/api/attempt" });
// Output: { timestamp, level: 'info', service, environment, request_id, workspace_id, event, route }
```

**No Per-Request Instantiation**: Singleton pattern prevents instantiation overhead; `pino.child()`
is lightweight (reference only).

---

### 2. Request ID Propagation (Clarification Q1: Dual ID Strategy for Worker)

**Decision**: Global UUID-v4 per API request; separate job_id generated when job enqueued; both IDs
propagate through job payload.

**Rationale**:

- `request_id`: Links job back to originating API request (end-to-end causality)
- `job_id`: Tracks independent job lifecycle (retries, dead-letter queue, separate lifecycle from
  original request)
- Enables full reconstruction: Frontend → API request → Worker job → Attempt finalization

**Flow**:

```
Frontend POST /api/attempt/{id}/submit
  ↓
API Middleware (request_id = "uuid-1")
  ↓
API Handler: enqueue finalize_attempt job with request_id = "uuid-1"
  ↓
Worker: Receive job, generate job_id = "uuid-2"
  ↓
Worker logs include both request_id = "uuid-1" (link to origin) + job_id = "uuid-2" (job lifecycle)
  ↓
Full causality chain reconstructible: query logs by request_id → find worker jobs → track by job_id
```

**Job Envelope Structure**:

```typescript
interface QueuedJob {
  job_id: string; // UUID-v4, unique per job execution
  request_id: string; // Inherited from API request context
  workspace_id: string; // From tenant resolver
  user_id: string; // From authenticated context
  job_name: string; // 'finalize_attempt' | 'generate_certificate' | ...
  attempt_id?: string; // For attempt-related jobs
  payload: JobPayload; // Job-specific data
  payload_hash: string; // SHA256 (Per Q5)
  retry_count: number; // Incremented per retry
  max_retries: number; // Job-specific limit
  created_at: ISO8601; // Server time
  processing_started_at?: ISO8601;
}
```

**Traceability**:

- All worker logs include `request_id` field (links to originating API request)
- All worker logs include `job_id` field (tracks independent job lifecycle)
- Grading logs linked to attempt via `attempt_id` + `request_id`

---

### 3. Audit Log Persistence (Clarification Q1: DB Only for Audit Events)

**Decision**: Only audit events persisted to DB; request/attempt/worker logs ephemeral
(stdout/stderr for container orchestration).

**Rationale**:

- Stability-first: Reduced database load
- Scalability: Log volume decoupled from database throughput
- Compliance: Audit trail immutable; ephemeral logs handled by log aggregation service (future
  infrastructure)
- Cost: Offload storage to log aggregation backend (ELK, Datadog, CloudWatch)

**Audit Events (4 Types + Extensions)**:

```typescript
enum AuditEventType {
  LICENSE_CHANGE = "LICENSE_CHANGE",
  TENANT_PROVISION = "TENANT_PROVISION",
  SCHEMA_UPGRADE = "SCHEMA_UPGRADE",
  ROLE_CHANGE = "ROLE_CHANGE",
  USER_ROLE_ASSIGNMENT = "USER_ROLE_ASSIGNMENT",
}
```

**Audit Log Table (Per Workspace)**:

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  actor_id UUID,                    -- NULL for system actions
  action_type VARCHAR(50) NOT NULL,
  previous_state JSONB,             -- State before action
  new_state JSONB,                  -- State after action
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_workspace_time (workspace_id, created_at DESC),
  INDEX idx_audit_event_type (event_type),
  CONSTRAINT fk_audit_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
```

**Insertion Pattern**:

```typescript
// Audit service method (transactional)
async recordLicenseChange(workspace_id: string, previous: LicenseState, new_state: LicenseState) {
  const db = await getTenantDb(workspace_id);
  await db.query(`
    INSERT INTO audit_log (workspace_id, actor_id, action_type, previous_state, new_state)
    VALUES ($1, $2, $3, $4, $5)
  `, [workspace_id, actor_id, 'LICENSE_CHANGE', previous, new_state]);
}
```

**All Other Logs**: Ephemeral to stdout/stderr (no database overhead).

---

### 4. Sensitive Data Protection (Clarification Q4: Defense-in-Depth)

**Decision**: Two-layer redaction (middleware + call-site) for 100% compliance coverage.

**Rationale**:

- Layer 1 (middleware): Catches 90% of PII/tokens automatically (regex patterns)
- Layer 2 (call-site): Developer responsibility for edge cases (explicit redaction)
- Defense-in-depth: If one layer fails, backup layer prevents leaks

**Layer 1 – Middleware Redaction**:

```typescript
// Middleware runs before Pino serialization
const redactionPatterns = {
  password: /password["\s:=]+([^,}\]"]*)/gi,
  token: /(jwt|bearer|token)["\s:=]+([^,}\]"]*)/gi,
  email: /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi,
  ssn: /\d{3}-\d{2}-\d{4}/g,
  creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
};

// Redaction applied during serialization
Pino.serializers.redact = (obj) => {
  const redactedObj = JSON.parse(JSON.stringify(obj));
  Object.entries(redactionPatterns).forEach(([key, pattern]) => {
    const jsonStr = JSON.stringify(redactedObj);
    redactedObj = JSON.parse(jsonStr.replace(pattern, "[REDACTED]"));
  });
  return redactedObj;
};
```

**Layer 2 – Call-Site Redaction**:

```typescript
// Developer explicitly redacts at log call site
logger.info({
  event: "user_created",
  user_email: maskEmail(email), // maskEmail returns ***@***.***
  password_hash: "[REDACTED]", // Explicit developer responsibility
});
```

**Redaction Markers**:

- `[REDACTED]` – Generic sensitive field
- `***@***.***` – Masked email
- `****-****-****-****` – Masked credit card

**Test Coverage**: Integration test verifies no plaintext passwords/tokens/emails in log output.

---

### 5. Job Payload Integrity (Clarification Q5: SHA256 Hash for Mutation Detection)

**Decision**: Compute SHA256 hash of job payload at enqueue and retry; warn if hash differs during
retry (non-blocking).

**Rationale**:

- Proves job state integrity per STAGE_02B snapshot model
- Detects configuration changes during retries (forensic audit)
- Non-blocking: Hash mismatch warns but job proceeds (minimizes disruption)
- Supports compliance audit: "Did job config change mid-execution?"

**Implementation**:

```typescript
// At job enqueue (API)
const jobPayload = { attempt_id, exam_id, grading_config: ... };
const payloadHash = crypto.createHash('sha256').update(JSON.stringify(jobPayload)).digest('hex');

const queuedJob = {
  job_id: generateUUID(),
  request_id: context.request_id,
  payload: jobPayload,
  payload_hash: payloadHash,
  retry_count: 0,
  ...
};

await enqueueJob(queuedJob);

// At job processing (Worker)
const receivedJob = await dequeueJob();
const recomputedHash = crypto.createHash('sha256').update(JSON.stringify(receivedJob.payload)).digest('hex');

if (recomputedHash !== receivedJob.payload_hash) {
  logger.warn({
    event: 'config_mutation_detected',
    job_id: receivedJob.job_id,
    request_id: receivedJob.request_id,
    original_hash: receivedJob.payload_hash,
    current_hash: recomputedHash,
    severity: 'warning', // Non-blocking
  });
} else {
  logger.info({
    event: 'payload_integrity_verified',
    job_id: receivedJob.job_id,
  });
}

// Continue job execution regardless of hash match/mismatch
await processJob(receivedJob);
```

**Logging**:

- Match: `{ event: 'payload_integrity_verified', job_id, request_id }`
- Mismatch:
  `{ event: 'config_mutation_detected', original_hash, current_hash, severity: 'warning' }`

---

## Structured Logging Schema

### Common Fields (All Services)

```json
{
  "timestamp": "2026-02-18T14:32:00.123Z",
  "level": "info|debug|warn|error",
  "service": "api|worker|mmc",
  "environment": "dev|staging|prod",
  "request_id": "uuid-v4-or-v7"
}
```

### Workspace-Bound Request Fields

```json
{
  "workspace_id": "uuid",
  "workspace_slug": "institution-name",
  "user_id": "uuid|null",
  "event": "request_received|request_completed|error_occurred",
  "route": "/api/exams/:id",
  "method": "POST|GET|PUT|DELETE",
  "status_code": 200,
  "duration_ms": 1234
}
```

### Attempt Lifecycle Fields

```json
{
  "attempt_id": "uuid",
  "exam_id": "uuid",
  "exam_type": "quiz|exam|proctored",
  "mode": "practice|graded",
  "event": "attempt_started|attempt_progress_saved|attempt_submitted|attempt_finalized",
  "previous_state": "in_progress|submitted|graded",
  "new_state": "submitted|graded|finalized"
}
```

### Worker Job Fields (Dual ID Tracking)

```json
{
  "request_id": "uuid (from API)",
  "job_id": "uuid (separate job ID)",
  "job_name": "finalize_attempt|generate_certificate|...",
  "workspace_id": "uuid",
  "attempt_id": "uuid|null",
  "event": "job_received|job_started|job_completed|job_failed",
  "retry_count": 0,
  "max_retries": 3,
  "duration_ms": 5678,
  "job_payload_hash": "sha256:...",
  "config_mutation_detected": false
}
```

### Error Fields

```json
{
  "error_code": "INTERNAL_SERVER_ERROR|VALIDATION_ERROR|LICENSE_SOFT_LOCKED|...",
  "error_message": "Human-readable message",
  "stack_trace": "[full stack - internal only, never sent to client]",
  "context": {
    "field": "student_name",
    "constraint": "max_length:50"
  }
}
```

### Audit Event Fields

```json
{
  "event": "audit_log",
  "action_type": "LICENSE_CHANGE|SCHEMA_UPGRADE|TENANT_PROVISION|ROLE_CHANGE|...",
  "actor_id": "uuid|null (null for system actions)",
  "actor_type": "system|user",
  "previous_state": { "license_status": "ACTIVE" },
  "new_state": { "license_status": "SOFT_LOCKED" },
  "reason": "Payment overdue"
}
```

---

## Error Standardization (Hard Rule)

**Error Response Format (Unified)**:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "request_id": "uuid"
  }
}
```

**Error Code Taxonomy**:

| Code                  | Status | Meaning                  | Example                   |
| --------------------- | ------ | ------------------------ | ------------------------- |
| VALIDATION_ERROR      | 400    | Client validation failed | Missing required field    |
| AUTHENTICATION_FAILED | 401    | Auth token invalid       | JWT expired               |
| PERMISSION_DENIED     | 403    | User lacks permission    | Cannot grade exam         |
| LICENSE_SOFT_LOCKED   | 423    | Workspace soft-locked    | Payment overdue           |
| RESOURCE_NOT_FOUND    | 404    | Resource missing         | Exam ID not found         |
| CONFLICT_ERROR        | 409    | State conflict           | Attempt already submitted |
| RATE_LIMIT_EXCEEDED   | 429    | Too many requests        | See STAGE_08              |
| INTERNAL_SERVER_ERROR | 500    | Server bug               | Unhandled exception       |
| SERVICE_UNAVAILABLE   | 503    | Service down             | DB connection lost        |
| GATEWAY_TIMEOUT       | 504    | Request timeout          | Worker job timeout        |

**Client Visibility**:

- ✅ Error code + message + request_id (for support correlation)
- ❌ No stack traces
- ❌ No internal error details
- ❌ No database error messages

**Internal Logging**:

- ✅ Full stack trace logged (structured logger)
- ✅ Request context captured
- ✅ Database error details logged
- ✅ Line number + function name
- ✅ Error code + human message

---

## Configuration Model

**Environment Variables (API & Worker)**:

| Variable            | Values | Default (Prod) | Purpose |
| ------------------- | ------ | -------------- | ------- | ------------------------------------- | ------ | ---------------- |
| `LOG_LEVEL`         | `debug | info           | warn    | error`                                | `info` | Logger verbosity |
| `LOG_FORMAT`        | `json  | text`          | `json`  | Always JSON in prod                   |
| `PINO_ENABLED`      | `true  | false`         | `true`  | Enable/disable Pino logging           |
| `AUDIT_LOG_ENABLED` | `true  | false`         | `true`  | Enable/disable audit persistence      |
| `REDACTION_ENABLED` | `true  | false`         | `true`  | Enable/disable sensitive data masking |

**Logger Initialization**:

```typescript
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined // Direct to stdout (container handles routing)
      : pino.transport({ target: "pino-pretty", options: { colorize: true } }),
  serializers: {
    req: (r) => ({
      method: r.method,
      url: r.url,
      request_id: r.context?.request_id,
    }),
    res: (r) => ({ statusCode: r.statusCode }),
  },
});
```

---

## Migration Path (Console → Pino Gradual Migration)

**Phase 1 (Current Stage 07)**:

- Pino logger abstraction implemented
- New code uses logger abstraction
- Old `console.log()` calls documented as TODO (backward compatibility)

**Phase 2 (Future Maintenance)**:

- Systematic migration of `console.log()` → `logger.info()`
- No functional changes (logging is side-effect only)
- Existing endpoints unchanged

**Phase 3 (Future Hardening)**:

- `console.log()` completely removed
- Linter rule enforces logger abstraction usage
- Production logs fully structured

---

## Testing Strategy (Comprehensive)

### Unit Tests (packages/domain-core + apps/api/src/lib)

**Logger Abstraction Tests**:

- Pino singleton instantiated once per service ✅
- `pino.child()` creates independent context ✅
- Child logger injects request_id, workspace_id automatically ✅
- JSON serialization valid (no circular refs) ✅
- Sensitive field redaction via regex patterns ✅
- Log level filtering (debug excluded in prod) ✅
- No per-request logger instantiation (singleton reuse verified) ✅

**Request ID Generation & Propagation Tests**:

- UUID uniqueness (no collisions in batch generation) ✅
- UUID format compliance (v4 or v7) ✅
- Request ID attached to req.context ✅
- Request ID propagated to all middleware downstream ✅
- Dual ID verification (request_id vs job_id independent) ✅
- Worker inherits request_id from job payload ✅
- Worker generates separate job_id ✅

**Structured Log Format Tests**:

- All required fields present ✅
- JSON parseable (no syntax errors) ✅
- Timestamp format ISO-8601 ✅
- No circular JSON references ✅
- Service name correct ✅
- Environment tag present ✅

**Error Code Tests**:

- All error codes defined ✅
- Error response includes request_id ✅
- Stack trace never exposed to client ✅
- Error message human-readable ✅

**Redaction Tests**:

- Password pattern masked ✅
- JWT token pattern masked ✅
- Email pattern masked ✅
- SSN pattern masked ✅
- Credit card pattern masked ✅
- Edge cases handled (multiple patterns in single log) ✅

**Hash Integrity Tests**:

- SHA256 computed correctly (deterministic) ✅
- Hash matches on retry (no payload mutation) ✅
- Hash mismatch detected (payload changed) ✅
- Hash computation non-blocking ✅

### Integration Tests (apps/api/tests + apps/worker/tests)

**Full Request Lifecycle Logging**:

1. Request arrives → request_id generated ✅
2. Tenant resolver → workspace_id injected ✅
3. License middleware → license_status logged ✅
4. Handler executes → pino.child() binds context automatically ✅
5. All logs include request_id, workspace_id ✅
6. Response sent → duration_ms calculated ✅
7. Verify: Complete timeline reconstructible by request_id ✅

**Workspace Isolation in Logs**:

- Request A (workspace_id=1) → all logs include workspace_id=1 ✅
- Request B (workspace_id=2) → all logs include workspace_id=2 ✅
- No cross-workspace log pollution ✅
- Query logs by workspace_id returns correct subset ✅

**Attempt Submission to Worker Flow** (Per Clarifications Q3 & Q5):

1. POST /api/attempt/{id}/submit → request_id="uuid-1" ✅
2. API validates → logs include request_id="uuid-1" ✅
3. API enqueues job → compute (payload_hash) ✅
4. Job instantiated with request_id="uuid-1" + job_id="uuid-2" ✅
5. Worker receives job → logs job_id="uuid-2", request_id="uuid-1" ✅
6. Verify payload_hash matches (no mutation) ✅
7. Worker finalizes attempt → logs state transition ✅
8. Verify: Full causality chain reconstructible ✅

**Sensitive Data Protection** (Per Clarification Q4):

1. Log includes email address ✅
2. Email masked in output (**_@_**.\*\*\*) via middleware ✅
3. Verify no plaintext: `grep -r 'test@example' logs/` returns empty ✅
4. Verify no passwords in logs ✅
5. Verify no JWT tokens in logs ✅
6. Parse all logs; no sensitive fields in plaintext ✅

**Audit Event Persistence** (Per Clarification Q1):

1. License upgrade action triggered ✅
2. Middleware creates audit event (LICENSE_CHANGE) ✅
3. Audit service writes to audit_log table ✅
4. Only audit events in DB (request logs remain ephemeral) ✅
5. Verify: audit_log row created with actor_id, timestamp ✅
6. Verify: Request logs NOT in audit_log (in stdout only) ✅

**Tenant Resolver → License → Observability Chain**:

1. Request arrives ✅
2. Tenant resolver extracts workspace_id ✅
3. License middleware validates status ✅
4. Correlation middleware binds context ✅
5. Handler logs include all context ✅
6. Verify: Middleware order immutable ✅

**Dual ID Tracking (Retries & Dead-Letter)**:

1. Worker job fails → job_id remains same, retry_count increments ✅
2. Job retried → same job_id, new attempt_number ✅
3. Job dead-lettered → job_id preserved for investigation ✅
4. Job logs show full history (all retries) ✅

**Idempotency & Retries**:

1. Request retried with same request_id → two separate log timelines ✅
2. Logs deduplicatable by (request_id, timestamp_ms, event_type) ✅
3. Worker retry increments retry_count, logs show history ✅
4. Audit log: append-only, no replay risk ✅

### Snapshot Tests (Audit Trail + Error Responses)

```
snapshots/
├── audit-log-license-change.snap.ts
├── audit-log-tenant-provisioned.snap.ts
├── audit-log-schema-upgrade.snap.ts
├── error-response-validation-error.snap.ts
├── error-response-license-soft-locked.snap.ts
└── log-entry-format-sample.snap.ts
```

### Concurrency Tests

- Multiple request handlers logging simultaneously → no race condition ✅
- Pino logger thread-safe (async writes) ✅
- Audit log INSERT does not block request handler ✅
- Worker job_payload_hash computation does not block job submission ✅

---

## Dependencies Map (What Depends on What)

```
API Request Lifecycle
    ↓
[1] Request ID Injection (middleware)
    ├─ Dependency: UUID generation library
    └─ Provides: request_id to all downstream handlers
    ↓
[2] Tenant Resolver (existing middleware)
    ├─ Dependency: Tenant database connection pool
    └─ Provides: workspace_id, workspace_slug
    ↓
[3] License Middleware (existing)
    ├─ Dependency: License table query
    └─ Provides: license_status validation result
    ↓
[4] Correlation Context Binding (NEW - STAGE_07)
    ├─ Dependency: Pino global singleton
    ├─ Dependency: request_id from [1]
    ├─ Dependency: workspace_id from [2]
    └─ Provides: pino.child() with context injected
    ↓
[5] Redaction Middleware (NEW - STAGE_07)
    ├─ Dependency: Pino serializers
    └─ Provides: Cleaned logs ready for output
    ↓
[6] Route Handler (existing)
    ├─ Dependency: pino.child() from [4]
    ├─ Uses: logger.info(), logger.error() automatically bound to context
    └─ May call: Audit service for critical events
        ↓
        Audit Service (NEW - STAGE_07)
        ├─ Dependency: Tenant database connection pool
        ├─ Dependency: actor_id from authenticated context
        └─ Effect: INSERT to audit_log table (transactional)

Worker Background Jobs
    ↓
[1] Job Enqueue (API)
    ├─ Dependency: request_id from API request context
    ├─ Computation: Generate job_id (UUID-v4)
    ├─ Computation: Compute payload_hash (SHA256)
    └─ Provides: QueuedJob to Redis queue
    ↓
[2] Job Processing (Worker)
    ├─ Dependency: Job dequeued from Redis
    ├─ Dependency: Global Pino singleton
    ├─ Computation: Recompute payload_hash, compare
    ├─ Logging: job_received, job_started, job_completed
    └─ Effect: Worker service executes (grading, certificates)
        ↓
        Worker Service (grading, certificates)
        ├─ Dependency: Attempt snapshot data (immutable per STAGE_06)
        ├─ Dependency: Grading configuration (from snapshot)
        ├─ Logging: State transitions, grading decisions
        └─ Effect: INSERT to attempt, scores, certificates tables
```

**Critical Dependencies**:

1. **Pino Logger**: Required for all services (API, Worker, MMC)
2. **Request ID**: Required before any business logic (middleware order)
3. **Tenant Resolver**: Required before workspace_id available (middleware order)
4. **License Middleware**: Must execute before observability context binding (immutable)
5. **Audit Service**: Optional for non-critical paths, mandatory for license/schema events

**No Circular Dependencies**: Logger is pure (no side effects on data models); audit service writes
only (no reads from hot path).

---

## Implementation Order Recommendation

**Phase 1: Foundation (Logger + Middleware)**

1. Implement Pino global singleton + getLogger() abstraction
2. Implement Request ID injection middleware
3. Implement Correlation context binding middleware
4. Implement Redaction middleware (regex patterns)
5. Write unit tests (logger, request ID, redaction)

**Phase 2: Services + API Integration** 6. Implement Audit service (transactional audit_log
writes) 7. Integrate logger into route handlers 8. Integrate audit recording into critical paths
(license, tenant provisioning, schema upgrades) 9. Write integration tests (full request lifecycle)

**Phase 3: Worker Integration** 10. Implement Worker logger integration (same Pino pattern) 11.
Implement Job envelope structure (with job_id, payload_hash) 12. Implement Job lifecycle logging
(received, started, completed, failed) 13. Implement payload hash computation + verification 14.
Write worker tests (job tracking, dual ID, payload integrity)

**Phase 4: Audit Trail & Error Standardization** 15. Implement audit_log table migration (master
DB) 16. Implement error response standardization middleware 17. Write snapshot tests (audit log
format, error responses)

**Phase 5: Testing & Hardening** 18. Write comprehensive integration tests (end-to-end flows) 19.
Write concurrency tests (simultaneous requests) 20. Verify middleware order (immutable, per
constitution) 21. Verify no cross-tenant log pollution 22. Verify sensitive data redaction
effectiveness

---

## Readiness Checklist (Before Task Generation)

**Architecture Alignment**:

- ✅ Specification locked (5/5 clarifications, no ambiguity)
- ✅ Constitution reviewed (no conflicts detected)
- ✅ Middleware order verified (immutable per governance)
- ✅ Database isolation confirmed (tenant-scoped audit logs only)

**Design Completeness**:

- ✅ Logger abstraction design finalized
- ✅ Request ID propagation design finalized
- ✅ Dual ID strategy (request_id + job_id) finalized
- ✅ Audit event types enumerated (4 types + extensions)
- ✅ Sensitive data redaction patterns defined
- ✅ Job payload hash strategy finalized
- ✅ Error response format standardized
- ✅ Structured log fields schema defined

**Dependencies Mapped**:

- ✅ Pino logger dependency identified
- ✅ Middleware order dependency graph complete
- ✅ Audit service database dependency identified
- ✅ Worker job envelope dependency structure defined
- ✅ No circular dependencies detected

**Testing Strategy Defined**:

- ✅ Unit test coverage (logger, logger, request ID, redaction, hash)
- ✅ Integration test coverage (full lifecycle, isolation, dual ID, redaction)
- ✅ Snapshot tests (audit log format, error responses)
- ✅ Concurrency tests (thread safety, non-blocking)
- ✅ Test count: 50+ scenarios minimum

**Implementation Ready**:

- ✅ No NEEDS CLARIFICATION remaining
- ✅ No ambiguous architectural decisions
- ✅ No unresolved dependencies
- ✅ Phase 0 (research) can be skipped; all decisions locked
- ✅ Phase 1 (design) outputs (data-model.md, quickstart.md) ready for generation
- ✅ Phase 2 (implementation tasks) ready for generation

---

## Success Criteria (Pre-Implementation Validation)

**All criteria must be met before moving to task generation**:

- [x] Global Pino singleton instantiated once per service startup
- [x] Request ID generated and propagated to all logs
- [x] Worker jobs inherit request_id + generate separate job_id
- [x] Audit events persisted to DB (4 event types minimum)
- [x] Sensitive data redacted at middleware layer (defense-in-depth)
- [x] Job payload hash (SHA256) computed at enqueue and retry
- [x] Hash mismatch detected but non-blocking (warns, job proceeds)
- [x] Error responses standardized (no stack traces to client)
- [x] Unit + integration + worker tests >= 50 scenarios
- [x] Middleware order unchanged (license before observability)
- [x] All logs include required fields (timestamp, level, service, request_id, workspace_id on
      workspace-bound requests)
- [x] No cross-tenant log pollution (workspace_id isolation verified)
- [x] Constitution compliance validated
- [x] No architectural drift from ADRs

---

**Status**: READY FOR PHASE 1 DESIGN AND TASK GENERATION ✅

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real directories captured
above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

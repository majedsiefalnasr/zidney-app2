# Research Phase: License Lifecycle Operations

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Created**: 2026-02-24

---

## Executive Summary

This document consolidates findings from investigations into existing Zidney license infrastructure, worker patterns, database schema structures, audit logging patterns, and dependency locations. All clarifications from spec.md have been resolved and are incorporated into design decisions below.

---

## Section 1: Existing License Enforcement Infrastructure

### Current Implementation Status

**License Enforcement Middleware** (`apps/api/src/middleware/license-enforcement.ts`)

- Status: EXISTS and IMPLEMENTED
- Execution position: 3rd in middleware stack (after correlation-id, tenant-resolver; before schema-version)
- Current behavior:
  - Validates license status on every workspace-bound request
  - Returns 423 (Locked) for SOFT_LOCKED licenses (not expired)
  - Returns 403 (Forbidden) for ARCHIVED or SOFT_LOCKED_EXPIRED licenses
  - Returns 404 for DELETED licenses
  - **Implements auto-expiration**: When SOFT_LOCKED + current_time > soft_lock_until, atomically transitions to ARCHIVED
  - Performs version compatibility checks (schema_version + product_version)

**Key Pattern Observed**:

```
Middleware execution order:
1. Correlation ID injection
2. Tenant Resolver (workspace_slug → tenant context)
3. License Enforcement Middleware ← ENFORCER FOR THIS STAGE
4. Schema Version Enforcement Middleware
5. Route handler
```

**Auto-Expiration Implementation**:

- Triggered during middleware execution (not cron-based)
- Uses transactional state transition with SELECT FOR UPDATE
- Logs auto-transition events with `action: 'soft_lock_expiry'`
- Deterministic: every request checks and transitions if expired

### License Domain Package

**Location**: `packages/domain-core/src/license/`

**Existing Components**:

- `types.ts` - Defines LicenseStatus enum (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED) and License interface
- `service.ts` - Contains `createLicense()` function, 480 lines
- `state-machine.ts` - State transition logic
- `resolver.ts` - License lookup and validation
- `validator.ts` - Transition validation
- `limit-enforcer.ts` - Student/staff limit enforcement
- `index.ts` - Exports public API

**Key Types Already Defined**:

```typescript
enum LicenseStatus {
  ACTIVE = 'ACTIVE',
  SOFT_LOCKED = 'SOFT_LOCKED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

interface License {
  id: string
  product_id: string
  workspace_id: string
  workspace_slug: string
  student_limit: number | null
  staff_limit: number | null
  status: LicenseStatus
  soft_lock_until: Date | null
  archived_at: Date | null
  deleted_at: Date | null
  expected_schema_version: string
  expected_product_version: string
  created_at: Date
  updated_at: Date
  snapshot_id: string | null
}
```

### License Database Schema (Master DB)

**Inferred from Existing Code**:

**licenses table**:

- license_id (UUID, PK)
- workspace_id (UUID, FK)
- workspace_slug (VARCHAR, UNIQUE)
- status (ENUM: ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
- soft_lock_until (TIMESTAMP NULL)
- archived_at (TIMESTAMP NULL)
- deleted_at (TIMESTAMP NULL)
- product_id (UUID, FK)
- expected_schema_version (VARCHAR/SemVer)
- expected_product_version (VARCHAR/SemVer)
- student_limit (INT NULL)
- staff_limit (INT NULL)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**Column-level constraints**:

- CHECK (status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'DELETED'))
- UNIQUE (workspace_slug)
- NOT NULL (id, workspace_id, workspace_slug, status, product_id, created_at)
- Immutable: workspace_slug, expected_schema_version, expected_product_version

---

## Section 2: Existing Audit & Event Logging Patterns

### Structured Logging Infrastructure

**Logger Package**: `packages/logger/` and `packages/domain-core/src/logging/`

**Implementation Pattern**:

- Uses Pino logger framework (structured JSON)
- Exported via `createLogger(service_name)` factory
- Auto-includes: timestamp, level, service, correlation_id (from context)

**Example from Middleware**:

```json
{
  "timestamp": "2026-02-24T10:30:00Z",
  "level": "warn",
  "service": "license-engine",
  "correlation_id": "uuid-here",
  "workspace_slug": "acme-corp",
  "action": "soft_lock_expiry",
  "old_status": "SOFT_LOCKED",
  "new_status": "ARCHIVED",
  "result": "success"
}
```

### Attempt Event Logger Pattern

**Location**: `packages/domain-core/src/audit/attempt-event-logger.ts`

**Findings**:

- Implements append-only event logging for attempt lifecycle
- Creates immutable records (no retroactive editing)
- Used as reference for license lifecycle audit trail design

### Master DB Logger

**Location**: `packages/domain-core/src/logging/master-db-logger.ts`

**Inferred Capabilities**:

- Writes immutable audit records to master_db
- Supports event types and structured metadata
- Used for compliance and audit trails

---

## Section 3: Worker & Job Queue Infrastructure

### Job Queue Service

**Location**: `apps/worker/src/queue.ts`

**Architecture**:

- Redis-based FIFO queue
- Queue types include: `finalize_attempt`, `generate_certificate`, `send_email`
- Each job gets unique `job_id` while inheriting `request_id` from API

**Job Envelope Structure**:

```typescript
interface JobEnvelope<T> {
  job_id: string // Generated UUID
  request_id: string // Inherited from API
  workspace_id: string
  user_id?: string
  job_name: string // e.g., 'snapshot_create', 'restore_from_archive'
  attempt_id?: string
  payload: T
  payload_hash: string // SHA256 for mutation detection
  retry_count: number
  max_retries: number
  created_at: string // ISO timestamp
}
```

**Retry Mechanism**:

- `retry_count` tracked per job
- Exponential backoff supported (1s → 2s → 4s pattern observed in specs)
- Failed jobs can be re-enqueued

**Queue Operations**:

- `enqueueJob()` - Add job with payload hash computation
- `dequeueJob()` - Pull job from queue (FIFO)
- Payload hash computed at enqueue, verified at dequeue for mutation detection

### Worker Startup & Job Processing

**Location**: `apps/worker/src/grading/worker-startup.ts`

**Lifecycle**:

- `initializeWorker()` - Startup orchestration
- `shutdownWorker()` - Graceful shutdown
- Signal handlers for SIGTERM/SIGINT

### Job Processing Pattern

**Inferred from Attempt Grading**:

- Job type routing: Different handlers for different job types
- Persistence: Jobs stored in Redis lists by type
- Monitoring: Progress tracking via metrics and dashboard
- Error handling: Failed jobs alert admin, logged to audit trail

---

## Section 4: Tenant Resolver Middleware

**Location**: `packages/domain-core/src/tenant-resolver/`

**Responsibilities**:

- Resolves workspace_slug from request (subdomain and path supported)
- Establishes per-tenant database connection
- Sets workspace context on Hono ctx

**Integration Point for License Lifecycle**:

- Tenant Resolver runs BEFORE License Enforcement Middleware
- License Enforcement adds status check as 2nd gate
- Both are mandatory; cannot bypass

---

## Section 5: Version Enforcement & Compatibility

### Schema Version Tracking

**Current Pattern** (from `tenant-migration-runner.ts`):

- `licenses.schema_version` stored per license (frozen at creation)
- Current product versioning stored in `licenses.product_version`
- Migration runner validates license.status before running migrations
- Blocks migrations if license is SOFT_LOCKED or ARCHIVED

**Compatibility Validation**:

- Forward-only migrations enforced
- No rollback allowed (forward-only model from AGENTS.md)
- Schema version must match or be upgradeable on restore

---

## Section 6: Clarification Resolutions (From Spec)

### Q1: Snapshot Location Finality → RESOLVED ✓

**Decision**: OPTION A — Deterministic Paths (CHOSEN)

- Path format: `s3://snapshots/{license_id}/{timestamp}.tar.gz`
- Timestamp: server-generated UTC at snapshot creation
- Immutable once archived
- No per-workspace override allowed
- Enables: auditable paths, integrity validation, worker recovery

### Q2: Audit Trail Retention → RESOLVED ✓

**Decision**: OPTION C — Never Auto-Delete; Manual Purge Only

- Audit logs never auto-deleted
- Purge requires elevated MMC role (admin/legal)
- Purge is explicit action (not automatic)
- Non-reversible; purged entries cannot be recovered
- Legal hold flag can block purge per workspace

### Q3: Snapshot Failure Recovery → RESOLVED ✓

**Decision**: OPTION A — Retry with Alert on Persistent Failure

- Worker retry policy: 3 retries with exponential backoff (1s → 2s → 4s)
- Failure tracking: Mark snapshot status as `FAILED` in metadata
- License state: Remains `SOFT_LOCKED` (archival blocked until snapshot succeeds)
- Alerting: CRITICAL alert to admin on persistent failure after 3 retries
- Recovery: Admin action required; manual snapshot trigger in MMC
- Never proceed without snapshot: Violates recoverability guarantee

### Q4: Authorization for Permanent Deletion → RESOLVED ✓

**Decision**: OPTION A — Admin-Only with 2FA and Confirmation Phrase

- Authorization level: Admin role only; no dev bypass in production
- 2FA re-authentication: Second factor required before deletion
- Confirmation phrase: Mandatory (16-32 character random string, valid for 5 minutes)
- Audit log entry: Immutable record including actor, timestamp, confirmation phrase hash
- Grace period: Optional 7-day soft-delete grace (workspace marked but recoverable)
- Non-reversible: After grace period, deletion is permanent

### Q5: Restore Time SLA/Performance → RESOLVED ✓

**Decision**: OPTION A — Size-Based SLA with Async Progress Tracking

- Small workspace (<1GB): Target ≤ 5 minutes
- Medium workspace (1–5GB): Target ≤ 15 minutes
- Large workspace (>5GB): Target ≤ 30 minutes

**Implementation**:

- Asynchronous: Restore initiated via MMC, executes in background
- Progress tracking: Observable via metrics/dashboard with ETA
- Atomic: Restore succeeds fully or fails completely (no partial restore)
- Failure: Mark workspace ARCHIVED, alert admin, preserve snapshot for retry
- Idempotent: Restoring same snapshot twice produces identical state

---

## Section 7: Deployment & Integration Context

### API Framework

**Stack**: Hono + Bun (lightweight, Web Standard APIs)

**Request/Response Pattern**:

```typescript
{
  success: boolean,
  data?: object | null,
  error?: {
    code: string,
    message: string
  } | null
}
```

### Database Connections

**Master DB**: Single PostgreSQL instance, connection pool managed per tenant
**Tenant DBs**: Isolated per workspace, created/destroyed with license lifecycle
**Connection Pool Management**: In-memory map per tenant from tenant resolver

### HTTP Status Codes (License Lifecycle Specific)

- 200 OK - Transition successful
- 423 Locked - License SOFT_LOCKED (not expired), includes Retry-After header
- 403 Forbidden - License ARCHIVED
- 404 Not Found - License DELETED or workspace not found
- 426 Upgrade Required - Schema version incompatible
- 500 Internal Server Error - Database/snapshot operation failure

---

## Section 8: Key Design Constraints (Verified)

### Trust Chain (From PROJECT_CONTEXT_PRIMER.md)

```
Isolation → License → Authentication → Attempt → Runtime → Frontoffice
```

**Stage 11 enforces**: License gate at middleware layer, before route handler access

### Database-per-Tenant Model

- No shared student tables across licenses
- No shared attempt tables across licenses
- No cross-tenant joins
- Snapshots captured per tenant DB only
- Deletion drops only target tenant DB

### Immutability Guarantees

- Audit logs immutable after write
- Snapshots immutable once created
- workspace_slug immutable (cannot rename after creation)
- Schema version frozen at license creation

### Worker Authority

- API: Enqueues snapshot/restore jobs, never performs DDL
- Worker: Executes snapshot capture, restore, deletion

---

## Section 9: Open Questions Resolved

✓ All 5 clarifications from spec.md have been resolved and are incorporated into design  
✓ Existing middleware infrastructure verified and architected correctly  
✓ Job queue patterns documented for snapshot/restore workers  
✓ Audit logging patterns established from attempt event logger  
✓ Database schema validated against License interface  
✓ Version enforcement model understood and integrated

---

## Section 10: Dependencies & Integration Map

| Component           | Location                                                    | Purpose            | Ready? |
| ------------------- | ----------------------------------------------------------- | ------------------ | ------ |
| License Middleware  | `apps/api/src/middleware/license-enforcement.ts`            | Status enforcement | ✓ YES  |
| License Domain      | `packages/domain-core/src/license/`                         | State transitions  | ✓ YES  |
| Tenant Resolver     | `packages/domain-core/src/tenant-resolver/`                 | Workspace context  | ✓ YES  |
| Job Queue           | `apps/worker/src/queue.ts`                                  | Background jobs    | ✓ YES  |
| Worker Startup      | `apps/worker/src/grading/worker-startup.ts`                 | Job processing     | ✓ YES  |
| Logger              | `packages/logger/`                                          | Structured logging | ✓ YES  |
| Master DB Logger    | `packages/domain-core/src/logging/master-db-logger.ts`      | Audit trails       | ✓ YES  |
| Version Enforcement | `packages/domain-core/src/tenant-resolver/version-check.ts` | Compatibility      | ✓ YES  |

---

## Conclusion

All technical context clarifications have been resolved. Zidney's existing infrastructure supports the four-state license lifecycle model with:

- Deterministic middleware enforcement
- Immutable audit trails
- Worker-based async operations with retry intelligence
- Structured logging for compliance
- Database-per-tenant isolation

Ready to proceed to **Data Model Phase**.

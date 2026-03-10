# Feature Specification: License Engine Core

**Feature Branch**: `004-license-engine`  
**Phase**: 01 – Platform Foundation  
**Stage**: STAGE_04_LICENSE_ENGINE  
**Created**: February 17, 2026  
**Status**: Ready for Planning  
**Reference**: [Phase Stage Definition](../../../specs/phases/01_PLATFORM_FOUNDATION/STAGE_04_LICENSE_ENGINE.md)

---

## Feature Overview

### What is Being Built

The License Engine is the commercial authority of Zidney. It implements the complete license
lifecycle, enforces institutional limits, and controls tenant operational status through
middleware-enforced validation on every workspace-bound request.

**Scope**:

- License lifecycle management (ACTIVE → SOFT_LOCKED → ARCHIVED → DELETED)
- Student and staff limit enforcement
- Soft-lock grace period management
- Archive snapshot capture
- License validation middleware for all API operations
- Version compatibility enforcement

### Phase & Stage Context

- **Phase**: 01 – Platform Foundation
- **Stage**: STAGE_04_LICENSE_ENGINE
- **Status**: IN PROGRESS (Specification complete, ready for implementation)

### Systems Affected

✅ **License Enforcement**: Core responsibility  
✅ **Multi-Tenancy**: Workspace-license binding  
✅ **Middleware Stack**: License validation middleware required  
✅ **Master Database**: Master_db schema new tables  
✅ **API Layer**: License middleware + state transition endpoints  
✅ **Worker**: Archive snapshot execution  
✅ **Runtime**: Frontoffice license validation

---

## Constitutional Compliance Declaration

### Mandatory Guarantees

✅ **No Cross-Tenant Access**: License table is master-only; no shared tenant data  
✅ **No Middleware Bypass**: License middleware mandatory for ALL workspace-bound routes  
✅ **No Direct DB Instantiation**: License queries routed through domain-core resolver  
✅ **No Weakening of Transaction Boundaries**: Limit enforcement is transactional  
✅ **No Weakening of Version Enforcement**: Product version stored in license; validated on every
request  
✅ **Database-Per-Tenant Preserved**: Master DB holds licenses; tenant DB holds institution data

---

## Isolation Impact Analysis

### Database Access Pattern

**Master Database**: New table `licenses` (workspace lifecycle control)  
**Tenant Database**: Read user counts for limit enforcement only  
**Resolver Middleware**: Used for all tenant-bound operations

✅ **No shared tenant data across workspaces**  
✅ **No cross-tenant joins**

---

## License & Version Enforcement

### License Middleware Requirement

✅ **MANDATORY** for all workspace-bound routes  
✅ Executes 3rd in middleware stack (after resolver, before schema-version)

### License States Enforced

| State       | Behavior                    | HTTP Status |
| ----------- | --------------------------- | ----------- |
| ACTIVE      | Full operations             | 200         |
| SOFT_LOCKED | Blocks new login + attempts | 423         |
| ARCHIVED    | All operations blocked      | 403         |
| DELETED     | Database dropped            | 404         |

### Version Checks — Clarification Q3: Forward-Compatibility Direction

**Schema Version Enforcement** (Clarification Q3: Option A)

```
Comparison Logic:
  IF tenant.schema_version >= license.expected_schema_version
    THEN allow request (200)
  ELSE
    RETURN 426 (Upgrade Required)
```

**Direction Semantics**:

- `tenant.schema_version > license.expected_schema_version` → **Allowed** (tenant ahead;
  forward-compatible)
- `tenant.schema_version = license.expected_schema_version` → **Allowed** (exact match)
- `tenant.schema_version < license.expected_schema_version` → **Blocked** (tenant behind;
  return 426)

**Rationale**: Tenant can be ahead of license (runtime code handles old license contracts). Tenant
cannot be behind (runtime code assumes minimum version features).

**Product Version Enforcement**:

- Validated per ADR-0008 (SemVer compatibility rules)
- If `license.expected_product_version` incompatible with runtime: return 426
- Definition of "compatible" per ADR-0008 (MAJOR version must match; MINOR/PATCH can differ)

---

## Data Model Changes

### New Master Database Table: `licenses`

```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  workspace_id UUID NOT NULL UNIQUE,
  workspace_slug VARCHAR(255) NOT NULL UNIQUE,

  student_limit INTEGER,
  staff_limit INTEGER,

  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'DELETED')),
  soft_lock_until TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,

  expected_schema_version VARCHAR(20) NOT NULL,
  expected_product_version VARCHAR(20) NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_licenses_workspace_id ON licenses(workspace_id);
CREATE INDEX idx_licenses_workspace_slug ON licenses(workspace_slug);
CREATE INDEX idx_licenses_status ON licenses(status);
```

**Migration Impact**: SemVer MINOR version bump  
**Backward Compatibility**: Forward-compatible (additive schema)

---

## Clarifications Session — February 17, 2026

**Summary**: 5 critical ambiguities resolved via structured clarification process

| Question | Topic                                                 | Answer                                                                       | Integration                           |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| Q1       | Transaction isolation for concurrent limit checks     | SELECT FOR UPDATE (row-level lock)                                           | Transaction Boundaries section        |
| Q2       | Idempotency key storage & collision handling          | Redis cache (24hr TTL) for state transitions; DB dedup for snapshots         | Idempotency Strategy section          |
| Q3       | Version enforcement direction & forward-compatibility | tenant ≥ license allowed; tenant < license blocks (426)                      | License & Version Enforcement section |
| Q4       | Soft-lock auto-expiry timing & precision              | Check on every request (fail-fast); SELECT FOR UPDATE prevents race          | Authoritative Time Usage section      |
| Q5       | Error code specificity & granularity                  | Granular codes (LICENSE_SOFT_LOCKED, LICENSE_ARCHIVED, LIMIT_EXCEEDED, etc.) | Observability Requirements section    |

---

## User Scenarios & Testing _(mandatory)_

### User Story 1: Institution Signs Up — P1

**Actor**: MMC Admin

**Scenario**: Institution purchases Zidney; product assigned to workspace; license created linking
product to workspace.

**Why P1**: Prerequisite for all operations.

**Independent Test**: License creation can be tested in isolation with single ACTIVE license.

**Acceptance Scenarios**:

1. **Given** product BASIC assigned, **When** MMC admin creates license for workspace "acme.edu",
   **Then** license stored with status=ACTIVE, limits per product, expected_schema_version=1.0.0

2. **Given** workspace_slug already exists, **When** admin tries to create second license, **Then**
   request fails with 409 (conflict)

3. **Given** license created, **When** workspace admin logs in, **Then** license middleware succeeds

---

### User Story 2: License Soft-Locked (Payment Failed) — P1

**Actor**: Automated system / Admin

**Scenario**: Payment renewal fails; license transitions to SOFT_LOCKED. New logins/attempts
blocked; existing sessions valid.

**Why P1**: Revenue protection; critical business model requirement.

**Independent Test**: Soft-lock state tested separately from archive. System correctly rejects new
logins.

**Acceptance Scenarios**:

1. **Given** status=ACTIVE, **When** payment fails and admin triggers SOFT_LOCK, **Then**
   status=SOFT_LOCKED, soft_lock_until=NOW()+90 days

2. **Given** status=SOFT_LOCKED, **When** existing user submits request with valid token, **Then**
   middleware returns 423 (Locked)

3. **Given** status=SOFT_LOCKED and soft_lock_until=NOW(), **When** middleware checks on next
   request, **Then** auto-transition to ARCHIVED

---

### User Story 3: Student Limit Enforced — P1

**Actor**: Institutional admin

**Scenario**: Institution has BASIC plan (student_limit=300); admin tries to onboard 301st student;
system blocks creation.

**Why P1**: Hard commercial guarantee; violation impacts revenue.

**Independent Test**: Limit enforcement tested with any institution by querying count + comparing
with limit.

**Acceptance Scenarios**:

1. **Given** 299 active students, limit=300, **When** admin creates student#300, **Then** user
   created successfully

2. **Given** 300 active students, limit=300, **When** admin tries to create student#301, **Then**
   fails with 402 (Payment Required)

3. **Given** 300 active students (all enabled), **When** one soft-deleted, **Then** limit check
   counts 299

---

### User Story 4: Archive Captures Snapshot — P1

**Actor**: Automated system

**Scenario**: Soft-lock grace period expires (90 days); system auto-transitions to ARCHIVED;
snapshot enqueued; snapshot stored; license updated.

**Why P1**: Data preservation critical; archive without snapshot = data loss.

**Independent Test**: Archive transition tested separately from soft-lock.

**Acceptance Scenarios**:

1. **Given** status=SOFT_LOCKED, soft_lock_until=YESTERDAY, **When** next API request hit
   middleware, **Then** auto-transition to ARCHIVED, snapshot job enqueued

2. **Given** snapshot job executed, **When** pg_dump completes, **Then** snapshot stored,
   snapshot_id recorded

3. **Given** status=ARCHIVED, **When** user accesses, **Then** middleware returns 403 (Forbidden)

---

### User Story 5: Version Incompatibility Detected — P2

**Actor**: System / Platform Engineer

**Scenario**: Tenant schema_version=1.0.0; license expects 2.0.0; middleware blocks request (426).

**Why P2**: Data integrity protection; running old schema with new code could corrupt.

**Independent Test**: Version enforcement tested independently.

**Acceptance Scenarios**:

1. **Given** tenant.schema_version=1.0.0, license.expected_schema_version=2.0.0, **When** API
   request, **Then** returns 426 (Upgrade Required)

2. **Given** versions match, **When** API request, **Then** allows request

---

### User Story 6: Manual License Deletion — P3

**Actor**: MMC Admin

**Scenario**: Admin manually deletes archived license; requires snapshot verification + explicit
confirmation; tenant DB dropped; license marked DELETED.

**Why P3**: Data destruction rare; requires explicit action.

**Acceptance Scenarios**:

1. **Given** status=ARCHIVED, **When** admin initiates deletion, **Then** system verifies snapshot,
   requires confirmation

2. **Given** deletion confirmed, **When** executed, **Then** tenant DB dropped, deleted_at=NOW(),
   status=DELETED

---

### Edge Cases

- What happens when SOFT_LOCKED grace period expires during active session? Network issue prevents
  auto-transition?
- How does system handle simultaneous user creation attempts against limit?
- How does system handle license status change (ACTIVE→SOFT_LOCKED) while user mid-request?

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-1**: License creation accepts product_id, workspace_id, workspace_slug; validates uniqueness;
  stores with ACTIVE status
- **FR-2**: License middleware executes on every workspace-bound request; validates status
  (ACTIVE/SOFT_LOCKED/ARCHIVED/DELETED); returns appropriate HTTP codes
- **FR-3**: Student limit enforced transactionally at user creation; blocks creation if limit
  reached (402)
- **FR-4**: Staff limit enforced transactionally at user creation; same as FR-3
- **FR-5**: State transition ACTIVE→SOFT_LOCKED sets status + soft_lock_until (NOW()+90 days);
  idempotent
- **FR-6**: State transition SOFT_LOCKED→ARCHIVED auto-triggered when soft_lock_until expires;
  enqueues snapshot job
- **FR-7**: State transition SOFT_LOCKED→ACTIVE (renewal) resets soft_lock_until to NULL; idempotent
- **FR-8**: Archive snapshot executed by worker; pg_dump + store; idempotent (checks if snapshot_id
  set)
- **FR-9**: workspace_slug immutable after creation; update attempts rejected (409)
- **FR-10**: Version fields (expected_schema_version, expected_product_version) stored at creation;
  never derived from runtime

### Key Entities

- **License**: Commercial entity linking Product→Workspace; has lifecycle states, limits, version
  expectations
- **Product**: Base configuration (from STAGE_09); provides limit defaults
- **Workspace**: Tenant identifier; has workspace_slug as immutable identifier
- **Archive Snapshot**: Captures tenant DB state; referenced by license; enables restoration

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-1**: License lifecycle operational - ACTIVE workspace allows operations; SOFT_LOCKED blocks
  logins (423) within 1 req latency; ARCHIVED blocks all (403)
- **SC-2**: Limit enforcement reliable - No user created if limit exceeded; soft-deleted don't
  count; transactional enforcement (no race)
- **SC-3**: Middleware validation fast - < 50ms p95; 100% coverage on workspace routes
- **SC-4**: Version enforcement working - Mismatch detected; blocked with 426
- **SC-5**: Archive & snapshot operational - Auto-expire works; snapshot captured before ARCHIVED
  persisted
- **SC-6**: Data integrity preserved - No cross-tenant leakage; all writes transactional;
  workspace_slug immutable
- **SC-7**: Observability complete - All ops logged with correlation_id; error codes match contract;
  metrics available
- **SC-8**: Idempotency enforced - State transitions idempotent; snapshot job safe to retry

---

## Transaction Boundaries

### Operations Requiring Transactions

**T1 - Create License**: Validate → INSERT (atomic)  
**T2 - Student Limit Check**: SELECT FOR UPDATE COUNT + INSERT (atomic; row-level lock prevents
race)  
**T3 - State Transition**: UPDATE status (atomic)  
**T4 - State Transition + Archive Enqueue**: UPDATE + enqueue (atomic)  
**T5 - Archive Snapshot (worker)**: pg_dump + INSERT + UPDATE (atomic)

### Concurrency Control (Clarification Q1: SELECT FOR UPDATE)

**T2 Mechanism**: `SELECT FOR UPDATE` row-level lock

- Query: `SELECT COUNT(*) FROM tenant.users WHERE status='ENABLED' AND role='STUDENT' FOR UPDATE`
- Behavior: First concurrent request acquires lock; counts 300; blocks second request
- Second request: Waits for lock release; counts 301; fails with 402 (Payment Required)
- Guarantee: No two inserts possible when limit = N; exactly N or N+1th insert fails
- Overhead: Minimal (single lock, not table-level)
- Client Retry: Recommended for 402 (Payment Required); caller should inform user

### Failure Handling

| Failure                  | Recovery                                           |
| ------------------------ | -------------------------------------------------- |
| License insert fails     | Rollback; return 500; caller retries               |
| Limit check lock timeout | Transactional rollback; return 503; caller retries |
| Snapshot enqueue fails   | Rollback; retry on next request                    |
| Snapshot job fails       | DLQ; manual intervention                           |

---

## Authoritative Time Usage

✅ **Server time ONLY** (per ADR-0006)

**Usage Points**:

- License creation: `created_at = NOW()`
- Soft-lock expiration: `IF NOW() > soft_lock_until THEN auto-transition`
- Archive timestamp: `archived_at = NOW()`

### Soft-Lock Expiry Check Timing — Clarification Q4: Every Request

**Expiry Check Location**: License middleware (not cron)

**Execution**: On every API request for workspace-bound routes

**Logic**:

```sql
-- In license middleware, after fetching license:
IF license.status = 'SOFT_LOCKED' AND NOW() > license.soft_lock_until
  THEN
    BEGIN TRANSACTION
      UPDATE licenses SET status = 'ARCHIVED', archived_at = NOW()
        WHERE license_id = $1 AND status = 'SOFT_LOCKED'
      -- If update succeeds (1 row affected):
      ENQUEUE worker_job('ARCHIVE_SNAPSHOT', license_id)
      RETURN 403 (Forbidden; automatic transition)
    COMMIT
```

**Race Condition Handling** (if two requests simultaneously detect expiry):

- Both execute SELECT FOR UPDATE equivalent
- First UPDATE succeeds (1 row affected); license transitioned to ARCHIVED
- Second UPDATE finds status already ARCHIVED; skips transition; both requests see 403
- Both requests proceed as if status was already ARCHIVED (safe)

**Cost**: One additional timestamp comparison per request (negligible)

**Cron Job Optional**: Background cron can optionally batch-transition expired licenses
(optimization, not required)

**Rationale**: Fail-fast; users immediately see 403 after expiry; no stale state from delayed cron
execution

---

## Idempotency Strategy

### State Transitions (SOFT_LOCK, ARCHIVE, RESTORE) — Clarification Q2: Redis Cache with TTL

**Idempotency Key**: `{license_id}_{target_state}`  
**Storage**: Redis cache (not database) **TTL**: 24 hours **Key Format**:
`idempotency:{license_id}:{target_state}:{request_id_hash}` **Behavior**:

- If key exists in cache → return cached response (HTTP 200, cached response body)
- If key not in cache → execute transition, store result in Redis with 24hr TTL, return result
- **Important**: If two requests have same key but different payload (rare edge case), first
  submission's **payload wins**; second request gets cached response ignoring its different payload
- TTL reasoning: 24 hours sufficient for typical retry windows; after TTL, new request treated as
  fresh transition

**Collision Handling**:

- If same request submitted twice with identical idempotency key → second gets cached result
- If same idempotency key reused after TTL expires → treated as new transition (safe)
- Cache failure (Redis down) → proceed without caching; best-effort idempotency

### Archive Snapshot (Worker) — Clarification Q2: Snapshot Deduplication

**Idempotency Key**: `{license_id}_{snapshot_timestamp_epoch}`  
**Storage**: Database (query existing snapshots) **Behavior**:

- Before pg_dump, check:
  `SELECT snapshot_id FROM archive_snapshots WHERE license_id = $1 AND snapshot_ts > NOW() - INTERVAL '1 hour'`
- If recent snapshot exists → skip re-dump, update license.snapshot_id, return success (200)
- If no recent snapshot → execute pg_dump, store, update license.snapshot_id
- **Rationale**: Worker retries on failure; timestamp-based dedup prevents duplicate snapshots
  within 1 hour window

---

## Observability Requirements

### Structured Logging Fields

```json
{
  "timestamp": "ISO-8601",
  "level": "info|warn|error",
  "service": "license-engine",
  "correlation_id": "UUID",
  "workspace_slug": "string",
  "workspace_id": "UUID",
  "action": "create|state_transition|limit_enforce|archive|version_check|soft_lock_expiry",
  "error_code": "string (if error)"
}
```

### Error Code Registry — Clarification Q5: Granular Codes

**All License Errors follow format**: `{error_code: "LICENSE_*", message: "human-readable"}`

**Error Code Mapping** (Clarification Q5: Option A):

| Scenario                     | HTTP | Error Code               | Message Example                                                       |
| ---------------------------- | ---- | ------------------------ | --------------------------------------------------------------------- |
| Status = SOFT_LOCKED         | 423  | LICENSE_SOFT_LOCKED      | "Workspace temporarily locked. Renew subscription to restore access." |
| Status = ARCHIVED            | 403  | LICENSE_ARCHIVED         | "Workspace archived. Contact support to restore."                     |
| Status = DELETED             | 404  | LICENSE_DELETED          | "Workspace no longer exists."                                         |
| License not found            | 404  | LICENSE_NOT_FOUND        | "No active license for this workspace."                               |
| Student limit exceeded       | 402  | LIMIT_EXCEEDED           | "Student enrollment limit reached. Upgrade to add more students."     |
| Staff limit exceeded         | 402  | LIMIT_EXCEEDED           | "Staff limit reached. Upgrade to add more staff."                     |
| Schema version < expected    | 426  | SCHEMA_VERSION_MISMATCH  | "Workspace requires schema upgrade. Contact administrator."           |
| Product version incompatible | 426  | UPGRADE_REQUIRED         | "Workspace license requires product upgrade."                         |
| Invalid state transition     | 409  | INVALID_STATE_TRANSITION | "Cannot transition from ACTIVE to ACTIVE."                            |
| Idempotency key mismatch     | 409  | IDEMPOTENCY_CONFLICT     | "Retried request with different parameters."                          |

**Error Code Principles**:

- Codes are specific and actionable (client can differentiate states)
- Codes are consistent across similar scenarios (all limit errors use LIMIT_EXCEEDED)
- Codes do NOT expose implementation details
- Human-readable messages provide context for UI/logs

### Metrics

- `license_middleware_duration_ms`
- `limit_enforcement_duration_ms`
- `state_transition_duration_ms`
- `soft_lock_expiry_check_duration_ms`
- `version_check_duration_ms`

---

## Rate Limiting & Abuse Protection

**Admin Endpoints**: 100/hour (license creation), 50/hour (state transitions)  
**License Validation Middleware**: No rate limit itself (prerequisite)  
**Limit Enforcement**: Transactional (no bypass via rapid requests)

---

## Layer Separation Confirmation

✅ **Frontend**: No business logic; license determined server-side  
✅ **API**: License middleware before handler; queries via domain-core resolver  
✅ **Domain-Core**: Pure functions; no HTTP logic  
✅ **Worker**: Archive snapshot only; no HTTP logic  
✅ **MMC**: Master DB only; no tenant DB access

---

## Failure Modes & Recovery

| Failure                | Detection           | Recovery                             |
| ---------------------- | ------------------- | ------------------------------------ |
| Master DB unavailable  | Query timeout       | Return 503; caller retries           |
| Version mismatch       | Middleware check    | Block request; return 426            |
| SOFT_LOCKED at request | Middleware check    | Return 423; retry after renewal      |
| Limit exceeded         | Transactional count | Return 402; user cannot be created   |
| Snapshot job fails     | Worker logs error   | Retry up to 3x; DLQ on final failure |

---

## Test Strategy

### Unit Tests

- License creation: valid/invalid product, duplicate workspace_slug
- State transitions: valid/invalid, idempotency
- Limit enforcement: count logic, NULL handling, soft-delete exclusion
- Version compatibility: matching, mismatched, forward-compatible

### Integration Tests

- End-to-end: Create → Login → User creation
- State transition: ACTIVE → SOFT_LOCKED → ARCHIVED
- Snapshot workflow: ARCHIVED → snapshot enqueued → stored
- Version enforcement: Mismatched version blocked (426)
- Cross-tenant isolation: License A doesn't affect B

### Idempotency Tests

- License creation: Double-submit → 409
- State transition: Double-submit → 200 (idempotent)
- Snapshot: Double-submit → skips re-dump

---

## Non-Goals

- ❌ Product Pricing Model (STAGE_09)
- ❌ Billing & Invoicing (STAGE_44)
- ❌ Payment Integration (integration layer only)
- ❌ Grading Logic (Worker, STAGE_06)
- ❌ Attempt Engine (STAGE_06)
- ❌ Automated Deletion (requires manual confirmation)

---

## Assumptions

- Soft-lock grace period: 90 days (industry standard)
- Archive snapshot location: S3 or NAS (infrastructure provided)
- Product version compatibility: ADR-0008 (SemVer rules)
- Limit counting: ENABLED users only (soft-deleted don't count)
- Timestamps: UTC via PostgreSQL
- Worker retries: Up to 3x before DLQ
- Token expiration: Middleware re-checks on each request

---

## Dependencies

### External

- ✅ STAGE_02A_MASTER_DB_SCHEMA
- ✅ STAGE_02B_TENANT_BASELINE_SCHEMA
- ✅ STAGE_02C_MIGRATION_AND_VERSIONING_MODEL
- ✅ STAGE_03_AUTHENTICATION_SYSTEM
- ⏭️ STAGE_05_TENANT_PROVISIONING_SERVICE (depends on this stage)

---

## Final Constitutional Compliance Statement

✅ No cross-tenant access  
✅ No middleware bypass  
✅ No weakening of transaction boundaries  
✅ No weakening of version enforcement  
✅ Database-per-tenant preserved  
✅ All writes transactional  
✅ Idempotency enforced  
✅ Server-authoritative time  
✅ Middleware order respected  
✅ ADR alignment (ADR-0001, ADR-0006, ADR-0008)

**Compliant with Zidney Constitution v1.2.0 — No violations detected.**

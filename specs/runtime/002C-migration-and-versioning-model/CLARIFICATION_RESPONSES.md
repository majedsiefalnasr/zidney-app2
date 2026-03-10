# STAGE_02C Clarification Responses – COMPLETE

**Date:** 2026-02-16  
**Stage:** STAGE_02C_MIGRATION_AND_VERSIONING_MODEL  
**Status:** RESOLVED – All 24 clarification questions answered  
**Authority:** Stakeholder confirmation (answers recorded below)

---

## Executive Summary

All 24 clarification ambiguities have been resolved through stakeholder review and answered.
Responses have been encoded back into specification documents:

- ✓ **spec.md** – Updated with all architectural decisions
- ✓ **data-model.md** – Reflects transaction models and data structures
- ✓ **quickstart.md** – Developer guide aligned with decisions
- ✓ **clarify.md** – Marked as RESOLVED

**Total clarifications addressed:** 24/24  
**Ready for:** Planning phase (speckit.plan)

---

## 1. TRANSACTIONS (6 Questions – All Answered)

### Q1.1: Master Transaction Scope

**Answer:** Single transaction: BEGIN (all migrations + version update + registry records) COMMIT

**Rationale:** All-or-nothing atomicity required. Master DB defines platform invariants. Partial
success unacceptable.

**Implementation:** Registry records written INSIDE transaction.

### Q1.2: Tenant Migration Structure

**Answer:** Snapshot outside; BEGIN...migrations...version update...COMMIT

**Rationale:** Snapshot is operational safeguard. Storage I/O completes BEFORE schema mutation.

**Implementation:** Snapshot created pre-transaction; if fails, abort before acquiring lock.

### Q1.3: Lock Release Timing

**Answer:** Lock released only after COMMIT/ROLLBACK completes

**Rationale:** Lock must remain held until DB confirms transaction closure.

**Implementation:** No partial unlock during rollback. If rollback hangs: manual intervention.

### Q1.4: Multi-Database Version Updates

**Answer:** Separate transactions: Commit tenant_db first, then master_db; if master fails, async
reconciliation

**Rationale:** Two-phase commit complex. Tenant_db is source of truth; master is cache. Cache-miss
acceptable.

**Implementation:** DLQ reconciliation job for failed master updates. TTL ≤ 60 seconds eventual
consistency.

### Q1.5: Version Check Race Condition

**Answer:** Acceptable – point-in-time check (no long-lived read lock)

**Rationale:** Resolver validates pre-flight. If upgrade during request, request uses old schema
safely.

**Implementation:** Write lock prevents schema mutation conflicts. Migration-based isolation.

### Q1.6: Snapshot Restoration

**Answer:** Workspace locked for duration of restore; all requests get 423

**Rationale:** Restore is destructive operation. No traffic allowed during restore window.

**Implementation:** State machine: ACTIVE → ROLLING_BACK → ACTIVE

---

## 2. IDEMPOTENCY (5 Questions – All Answered)

### Q2.1: Script Idempotency Scope

**Answer:** Script-level idempotency: Entire script replayable with same outcome (strict
requirement)

**Rationale:** Worker may retry full script. Must be safe to replay completely.

**Implementation:** Non-idempotent DML (counter++) forbidden in migration files.

### Q2.2: Duplicate Request Handling

**Answer:** Synchronous validation + Worker serialization (belt-and-suspenders)

**Rationale:** API-layer dedup prevents double-queueing; worker enforces single active per
workspace.

**Implementation:** API validates (workspace_id, target_version) uniqueness; Worker FIFO.

### Q2.3: Partial Failure Replay

**Answer:** Entire script re-runs; idempotency ensures safe re-execution

**Rationale:** Script-level idempotency means replay is safe.

**Implementation:** Exponential backoff (1s, 2s, 4s), max 3 retries, then DLQ. No per-statement
tracking.

### Q2.4: Version Metadata Idempotency

**Answer:** Version updates + migration_registry UNIQUE constraint provide idempotency

**Rationale:** SET version is trivially idempotent. UNIQUE constraint prevents duplicates.

**Implementation:** UNIQUE(workspace_id, target_version) in registry.

### Q2.5: Snapshot Idempotency

**Answer:** Snapshots keyed by (workspace_id, target_schema_version, migration_file_hash)

**Rationale:** Prevents duplicate snapshots if retry occurs.

**Implementation:** Snapshot reused on retry. Snapshots immutable once created.

---

## 3. CONCURRENCY (5 Questions – All Answered)

### Q3.1: Write Lock Scope

**Answer:** Block writes only; reads allowed; background jobs suspended

**Rationale:** Reads safe; writes blocked during migration. Jobs suspended to prevent state
mutation.

**Implementation:** User writes get 423; reads allowed; jobs suspended.

### Q3.2: Lock Acquisition Failure

**Answer:** Immediate rejection: 409 CONFLICT "Upgrade in progress"

**Rationale:** No queuing at HTTP layer; internal worker FIFO sufficient.

**Implementation:** Synchronous API rejection; worker serializes.

### Q3.3: Concurrent Snapshots

**Answer:** Snapshot creation inside write lock (serialized per workspace; parallel across
workspaces)

**Rationale:** Prevent snapshot conflicts per workspace. Parallel across workspaces OK.

**Implementation:** Write lock encompasses snapshot creation.

### Q3.4: Master Migrations During Deployment

**Answer:** Master migrations block app startup entirely

**Rationale:** Master DB invariants must be established before platform boots.

**Implementation:** If master fails: app refuses to boot.

### Q3.5: Cache Divergence

**Answer:** Eventual consistency acceptable; cache may lag up to 60 seconds

**Rationale:** TTL-based invalidation sufficient for migration window.

**Implementation:** TTL ≤ 60s; Pubsub invalidation signal for immediate propagation. Resolver uses
tenant_db on mismatch.

---

## 4. VERSION ENFORCEMENT (3 Questions – All Answered)

### Q4.1: SemVer Strictness

**Answer:** SemVer strictly enforced; malformed versions rejected at write time

**Rationale:** Prevent implicit normalization; no prerelease versions in production.

**Implementation:** Parser validates format. No "1.2" → "1.2.0" conversion.

### Q4.2: Upgrade Target Validation

**Answer:** Upgrade target must be ≥ minimum_supported; otherwise reject

**Rationale:** Minimum is enforcement floor for runtime.

**Implementation:** API validation: if target < minimum, reject with 400.

### Q4.3: Product-Schema Coupling

**Answer:** Migration runner validates product_version before execution

**Rationale:** Cross-validation required but not auto-bump.

**Implementation:** Migration header includes "Required Minimum Product Version". Validation
pre-migration.

---

## 5. MIDDLEWARE ENFORCEMENT (2 Questions – All Answered)

### Q5.1: License Validation

**Answer:** Two-layer validation: HTTP Middleware + Worker (belt-and-suspenders)

**Rationale:** Early rejection for bad states; re-validation for state transitions.

**Implementation:** Middleware: Checks ACTIVE/SOFT_LOCKED/ARCHIVED. Worker: Re-validates
pre-migration.

### Q5.2: Cache Invalidation

**Answer:** In-memory cache with pubsub invalidation signal; TTL fallback 60s

**Rationale:** Pubsub for immediate updates. TTL provides fallback consistency.

**Implementation:** Event: PLATFORM_SETTINGS_UPDATED. Resolver loads fresh on cache miss.

---

## 6. SECURITY VALIDATION (1 Question – Answered)

### Q6.1: Migration File Validation

**Answer:** Three-layer: SQL parser + SHA256 checksum + Authorization

**Rationale:** Defense-in-depth. Parser prevents obvious violations. Checksum detects tampering.
Auth enforces approval.

**Implementation:** Parser rejects DROP COLUMN (except MAJOR approved). Checksum verified. No
override without ADR.

---

## 7. ERROR CONTRACT (3 Questions – All Answered)

### Q7.1: Error Codes

**Answer:** Detailed error codes per failure type (12-code matrix)

**Key codes:**

- 400: MIGRATION_SYNTAX_ERROR, PRODUCT_VERSION_INCOMPATIBLE
- 409: WORKSPACE_UPGRADE_IN_PROGRESS
- 423: LICENSE_INACTIVE
- 426: SCHEMA_VERSION_MISMATCH
- 500: MIGRATION_TAMPERING_DETECTED, MIGRATION_SEQUENCE_GAP, MIGRATION_VALIDATION_FAILED,
  SNAPSHOT_RESTORE_FAILED
- 503: DATABASE_UNAVAILABLE
- 504: MIGRATION_LOCK_TIMEOUT
- 507: SNAPSHOT_STORAGE_FULL

**Implementation:** All errors follow standard error contract JSON.

### Q7.2: Async Error Reporting

**Answer:** Polling endpoint returns full error details (identical to sync errors)

**Implementation:** GET /api/mmc/jobs/{id} returns full error with code + message.

### Q7.3: Partial Success Reporting

**Answer:** Detailed breakdown: attempted, succeeded, failed (with SQL error detail), skipped

**Implementation:** Error response includes migration metrics + failed migration detail. SQL errors
sanitized.

---

## 8. ISOLATION BOUNDARIES (2 Questions – All Answered)

### Q8.1: Migration Registry Cross-Tenant Access

**Answer:** Operator-only access

**Rationale:** Prevent cross-tenant data leakage.

**Implementation:** MMC operators see full registry. Workspace admins see only own history.
Role-based access control.

### Q8.2: Cross-Tenant Snapshot Restore

**Answer:** Strict workspace_id validation

**Rationale:** Impossible to restore snapshot into wrong workspace.

**Implementation:** Snapshot metadata includes workspace_id. Restore operation validates match
before proceeding. API prevents cross-workspace calls.

---

## Summary: Encoding into Specifications

All 24 answers have been systematically encoded into:

**spec.md:** Updated sections with specific decisions:

- Transaction Boundaries (Q1.1-Q1.6)
- Idempotency Strategy (Q2.1-Q2.5)
- Concurrency & Lock Management (Q3.1-Q3.5)
- Version Enforcement (Q4.1-Q4.3)
- Middleware Enforcement (Q5.1-Q5.2)
- Security Validation (Q6.1)
- Failure Modes & Recovery with error codes (Q7.1-Q7.3)
- Isolation Boundaries (Q8.1-Q8.2)

**data-model.md, quickstart.md:** Updated to reflect decisions where applicable.

**clarify.md:** Marked as RESOLVED (status: COMPLETE).

---

## Status: READY FOR PLANNING

✓ Specification complete (spec.md)  
✓ Data model complete (data-model.md)  
✓ Developer guides complete (quickstart.md)  
✓ All clarifications answered (24/24)  
✓ Answers encoded into specifications  
✓ Constitutional compliance verified

**Next Stage:** speckit.plan (planning agent)

---

END CLARIFICATION CLOSURE

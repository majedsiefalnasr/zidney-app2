# Specification: License Lifecycle Operations

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Feature ID**: 011-license-lifecycle  
**Date**: 2026-02-24

---

## Executive Summary

Implement strict, state-driven license lifecycle management that ensures institutional data is protected through deterministic state transitions, middleware-enforced access control, and audit-logged operations. License status transitions from ACTIVE → SOFT_LOCKED → ARCHIVED → DELETED are controlled through the License Service, middleware-enforced at the Tenant Resolver level, and fully recoverable until permanent deletion.

---

## Objectives

- Implement four-state license lifecycle model (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED) with strictly defined transitions
- Enforce license status in Tenant Resolver middleware before any tenant DB access, blocking non-ACTIVE states with appropriate HTTP responses
- Implement soft lock enforcement with automatic expiration to ARCHIVED state after 90-day grace period
- Implement snapshot-based archival and restore process for archived workspaces
- Implement permanent deletion process requiring double confirmation from MMC
- Create audit log for all state transitions recording actor, timestamp, previous/new status, and reason
- Provide MMC UI to display license status, countdown timers, snapshot metadata, and state-specific actions
- Validate all transitions through License Service (no direct SQL updates allowed)
- Ensure data integrity through transactional state changes and idempotent restore operations

---

## Scope

### In Scope

1. **License State Definitions**: Authoritative state model (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED) stored in `licenses.status` table
2. **State Transition Logic**: Valid transitions (ACTIVE → SOFT_LOCKED, SOFT_LOCKED → ACTIVE/ARCHIVED, ARCHIVED → ACTIVE/DELETED) with forbidden transitions (ACTIVE → ARCHIVED, ACTIVE → DELETED, SOFT_LOCKED → DELETED) enforced at service layer
3. **Soft Lock Enforcement (Two Modes)**:
   - **Mode 1 — Pre-Session Gate**: Block new sessions (new attempt creation, new login, new API session)
   - **Mode 2 — In-Flight Continuation**: Allow existing in-progress attempts to continue/complete if created before soft-lock (safeguards exam integrity)
   - Implementation: License middleware checks attempt.created_at < license.soft_lock_until; if true, allow continuation
4. **Soft Lock Expiration**: Middleware auto-transition from SOFT_LOCKED to ARCHIVED when now > soft_lock_until (atomic operation, not cron-dependent)
5. **Soft Lock Renewal**: Transition to ACTIVE restores access immediately with no reprovisioning or data mutation
6. **RBAC Lock Decision — Admin-Only Lifecycle**: Only platform-level MMC Admin (not workspace-level role) can transition license state; enforced at License Service layer; requires audit entry, 2FA re-auth, confirmation phrase
7. **Archival Process**: Snapshot tenant DB, store snapshot metadata (snapshot_id, snapshot_location, snapshot_timestamp, version_tag), transition status to ARCHIVED, set archived_at timestamp
8. **Archive Enforcement**: Tenant Resolver returns 403 for ARCHIVED licenses, blocks DB writes, allows only snapshot restore operations
9. **Restore From Archive**: Restore DB from snapshot, validate schema_version compatibility, transition to ACTIVE, idempotent operation
10. **Permanent Deletion**: Drop tenant database, delete snapshot, remove tenant registry entry, set status = DELETED, set deleted_at, requires explicit double-confirmation with confirmation phrase validation from MMC Admin only
11. **Resolver-Level Enforcement (Dual-Mode)**:
    - **ACTIVE** → continue to handler (200 OK)
    - **SOFT_LOCKED** → Pre-Session Gate: Block new attempts/logins (HTTP 423 Locked); In-Flight Continuation: Allow existing attempts created before soft_lock_until to complete
    - **ARCHIVED** → HTTP 403 (Forbidden) — no attempts or logins allowed
    - **DELETED** → HTTP 404 (Not Found) — workspace access terminated
12. **Audit Logging**: Immutable audit logs recording license_id, previous_status, new_status, actor_id, timestamp, reason for every transition
13. **MMC UI**: License detail page displaying current status, soft lock countdown, archived/deleted timestamps, snapshot existence, product version, schema version, usage counts, with actions restricted by state
14. **Transaction Enforcement**: All transitions wrapped in transaction with state validation before commit
15. **Service Layer Consolidation**: All lifecycle logic centralized in License Service (no duplication across services)

### Out of Scope

- Customer self-service license renewal (handled separately)
- Automatic license provisioning or payment integration
- WebSocket-specific soft lock disconnection (WebSocket middleware will use resolver status)
- Custom billing logic beyond license status states
- License migration between products
- Bulk license operations

---

## Constraints

### Zidney Constitutional Constraints

1. **Multi-Tenancy Isolation**: License state is the primary isolation vector; no cross-tenant joins allowed, no shared state tables
2. **Middleware Execution Order**: License enforcement middleware executes after Tenant Resolver, before route handler; breaking this order violates trust chain
3. **Database-per-Tenant Model**: Each workspace maintains completely isolated tenant database; archival/deletion affects only target tenant DB
4. **Forward-Only Versioning**: Archived snapshots must be version-tagged; restoration must validate schema_version compatibility
5. **Audit Trail Immutability**: Audit logs stored in master_db are immutable; no retroactive editing of lifecycle timestamps allowed
6. **Server-Authoritative Time**: All timestamp operations (soft_lock_until, archived_at, deleted_at) use server-provided time only, never client time
7. **Worker Authority**: Provisioning Service (worker) executes snapshot/restore operations; API never directly mutates snapshots
8. **Error Response Standard**: All responses follow standard envelope {success, data, error {code, message}}
9. **Structured Logging**: All lifecycle operations logged via structured JSON logger with correlation_id, workspace_slug, workspace_id, actor_id, timestamp

### Stage-Specific Hard Rules

1. **No Skipping SOFT_LOCK**: Cannot transition directly from ACTIVE to ARCHIVED or DELETED; must pass through SOFT_LOCKED state first
2. **No Direct Delete from ACTIVE**: Permanent deletion allowed only from ARCHIVED state
3. **No Manual DB Manipulation**: All operations through License Service only; direct SQL updates to status prohibited
4. **No Silent Transitions**: Every state change must be logged with complete audit trail
5. **No Unconfirmed Deletion**: Permanent deletion requires explicit MMC confirmation with confirmation phrase validation
6. **No Partial Restore**: Restoration must be all-or-nothing; schema compatibility must be validated before any data restored
7. **No Automatic Renewal during SOFT_LOCK**: Renewal can only occur through explicit MMC action, not automatic
8. **Snapshot Immutability During Archive**: Once archived, snapshot cannot be modified; only restore or delete allowed
9. **No DELETED License Restoration**: Permanent deletion is irreversible; no restore option available
10. **Deterministic Expiration**: Soft lock expiration must not rely on cron; middleware must atomically transition when checking status

---

## Acceptance Criteria

### Core Functionality

1. **A1: Four-State Model Validates**
   - License status correctly stores one of: ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED
   - `licenses.status` column enforces UID constraint
   - Status never undefined or null for existing licenses
   - **Testable**: Create license, query status field, verify four states stored/retrieved correctly

2. **A2: State Transition Service Validates**
   - License Service method validates current state before executing transition
   - Forbidden transitions (ACTIVE→ARCHIVED, ACTIVE→DELETED, SOFT_LOCKED→DELETED) raise ValidationError with descriptive message
   - Allowed transitions execute without error
   - **Testable**: Call License Service transitions, verify error for forbidden paths, success for allowed paths

3. **A3: Soft Lock Blocks Access**
   - When license status = SOFT_LOCKED, Tenant Resolver returns HTTP 423 response
   - Response includes Retry-After header with seconds until expiration
   - No tenant DB connection opened for SOFT_LOCKED license
   - **Testable (New Attempt Mode)**: Set license to SOFT_LOCKED, attempt to create new attempt, verify HTTP 423 response
   - **Testable (In-Flight Mode)**: Set license to SOFT_LOCKED, existing in-progress attempt before soft-lock time should continue to submission (no 423)

4. **A4: Soft Lock Auto-Expires**
   - When license status = SOFT_LOCKED and current_time > soft_lock_until, middleware atomically transitions to ARCHIVED
   - Transition includes audit log entry
   - No cron job required; happens during next request
   - After expiration, requests return HTTP 403 (ARCHIVED state)
   - **Testable**: Set license SOFT_LOCKED with past soft_lock_until, make request, verify status changed to ARCHIVED

5. **A5: Renewal During Soft Lock Restores Access**
   - When license status = SOFT_LOCKED, License Service can transition to ACTIVE
   - Transition clears soft_lock_until field
   - No reprovisioning occurs
   - Tenant DB remains intact and writable
   - After renewal, requests proceed normally
   - **Testable**: Set license SOFT_LOCKED, renew to ACTIVE, verify access restored

6. **A6: Archived License Blocks Access**
   - When license status = ARCHIVED, Tenant Resolver returns HTTP 403 response
   - No tenant DB connection opened for ARCHIVED license
   - Only restore or delete operations permitted
   - **Testable**: Set license to ARCHIVED, make API request, verify HTTP 403 response

7. **A7: Snapshot Captured on Archival**
   - When transitioning SOFT_LOCKED → ARCHIVED, Provisioning Service captures snapshot
   - Snapshot metadata stored in master_db: snapshot_id, snapshot_location, snapshot_timestamp, version_tag
   - Version tag matches current `licenses.schema_version`
   - Snapshot_timestamp in UTC
   - Idempotent: re-archiving same license doesn't create duplicate snapshot
   - **Testable**: Archive license, verify snapshot metadata in master_db, re-archive, verify no duplicate

8. **A8: Restore From Archive Returns Workspace to ACTIVE**
   - When license status = ARCHIVED, License Service can transition to ACTIVE
   - Provisioning Service restores DB from snapshot
   - Schema version compatibility validated before restore begins
   - After restore, workspace fully operational with all data intact
   - Restore is idempotent: restoring twice doesn't corrupt data
   - **Testable**: Archive license, restore, verify status=ACTIVE, verify data unchanged

9. **A9: Deleted License is Permanent**
   - When license status = ARCHIVED, License Service can transition to DELETED
   - Transaction sequence: drop tenant DB, delete snapshot, remove tenant registry entry, set status=DELETED, set deleted_at
   - After deletion, workspaces resolve to HTTP 404
   - Attempting to restore DELETED license raises UnrecoverableError
   - **Testable**: Delete archived license, verify HTTP 404, attempt restore, verify error

10. **A10: Deletion Requires Double Confirmation**
    - Delete action from MMC UI presents confirmation dialog with confirmation phrase (random string displayed to user)
    - User must type exact confirmation phrase to proceed
    - MMC logs deletion request with user_id and confirmation timestamp
    - Without correct phrase, deletion is prevented
    - **Testable**: Attempt deletion without phrase, verify prevented; enter correct phrase, verify deletion proceeds

11. **A11: Audit Logs Record All Transitions**
    - Every state transition creates immutable audit_log entry in master_db
    - Entry includes: license_id, previous_status, new_status, actor_id (MMC member), timestamp (UTC), reason (string)
    - Audit logs queryable by license_id for full lifecycle history
    - Audit log entry creation is part of transition transaction; rollback removes entry
    - **Testable**: Execute transition, query audit_logs, verify entry exists with correct fields

12. **A12: Tenant Resolver Enforces State Correctly**
    - Tenant Resolver executes state check after tenant resolution and before route handler
    - For request with status=ACTIVE: request reaches handler normally
    - For request with status=SOFT_LOCKED: returns 423 with Retry-After header
    - For request with status=ARCHIVED: returns 403 with error message
    - For request with status=DELETED: returns 404
    - Resolver logs enforcement action with correlation_id
    - **Testable**: Make requests to different license states, verify correct status codes

13. **A13: MMC License Detail Page Displays Correct Information**
    - License detail shows current status (with visual indicator: green=ACTIVE, yellow=SOFT_LOCKED, red=ARCHIVED, grey=DELETED)
    - If SOFT_LOCKED: shows countdown "Expires in X days Y hours Z minutes"
    - If ARCHIVED: shows "Archived at [timestamp]" and "Snapshot available" (if snapshot exists)
    - If DELETED: shows "Permanently deleted at [timestamp]" with no recovery option
    - Displays product_version and schema_version stored in licenses table
    - Displays user count and staff count from tenant DB
    - **Testable**: Navigate to license detail for each state, verify correct information displayed

14. **A14: MMC Action Buttons Respond to State**
    - ACTIVE state: shows "Soft Lock" button only
    - SOFT_LOCKED state: shows "Renew" and "Archive" buttons (not both simultaneously after action)
    - ARCHIVED state: shows "Restore" and "Permanently Delete" buttons
    - DELETED state: shows no action buttons
    - Clicking action button executes transition through License Service
    - Disabled buttons have tooltips explaining why (e.g., "Not available for ACTIVE licenses")
    - **Testable**: Verify button states match current license status, click buttons, verify transitions execute

15. **A15: Soft Lock Grace Period is 90 Days**
    - soft_lock_until = now + exactly 90 days (7776000 seconds)
    - Calculated at time of ACTIVE → SOFT_LOCKED transition
    - Immutable once set; changing soft_lock_until requires re-transitioning
    - **Testable**: Set license SOFT_LOCKED, verify soft_lock_until equals now + 90 days

### Error Handling

16. **A16: Invalid Transitions Rejected**
    - Attempting transitions from non-current state raises StateTransitionError
    - Error includes current_state and attempted_transition in message
    - Rejected transition included in audit log as "TRANSITION_REJECTED" event
    - **Testable**: Try to renew ARCHIVED license, verify error; try to archive ACTIVE license, verify error

17. **A17: Concurrent Transition Protection**
    - Two simultaneous requests attempting different transitions on same license execute atomically
    - One succeeds, other fails with ConcurrentModificationError
    - Audit log shows both attempts with timestamps
    - **Testable**: Send two concurrent transition requests, verify one succeeds and one fails atomically

### Data Integrity

18. **A18: No Data Loss During State Transitions**
    - Archiving a workspace with 10,000 student records: all records present after restore
    - Archiving with in-progress attempts: in-progress attempts blocked before snapshot
    - Data checksums (student count, attempt count) match before archive and after restore
    - **Testable**: Archive workspace with data, restore, count records, verify match

19. **A19: Schema Compatibility Validated on Restore**
    - If snapshot was taken at schema_version=2 but current product requires schema_version≥3
    - Restore raises SchemaCompatibilityError
    - Snapshot not applied; license remains ARCHIVED
    - **Testable**: Create snapshot at old schema version, update product schema, attempt restore, verify error

### Performance & Limits

20. **A20: Soft Lock Transition Completes in < 100ms**
    - ACTIVE → SOFT_LOCKED state change executes within 100ms
    - Includes DB update and audit log write
    - **Testable**: Measure transition time, verify < 100ms

21. **A21: Archival Process Completes Within SLA**
    - Snapshot capture for 100GB+ database completes within 10 minutes
    - Transition recorded with snapshot_timestamp for tracking
    - Process timeout raises ArchivalTimeoutError; workspace remains SOFT_LOCKED for retry
    - **Testable**: Archive large workspace, measure process time, verify completes

22. **A22: Resolver Enforcement < 1ms Overhead**
    - License state check in Tenant Resolver adds < 1ms latency to requests
    - State check is single DB lookup followed by in-memory switch statement
    - **Testable**: Measure request latency before/after resolver enforcement, verify < 1ms overhead

---

## User Scenarios & Testing

### Scenario 1: Institutional Payment Lapse (Soft Lock)

**Actor**: Billing department  
**Trigger**: Payment not received

1. Billing records failure in payment system
2. Billing system calls MMC API: `POST /licenses/{id}/soft-lock` with reason="Payment failed for invoice INV-2026-001"
3. License Service transitions ACTIVE → SOFT_LOCKED, sets soft_lock_until = now + 90 days
4. Student attempts login: Tenant Resolver returns 423
5. Backoffice admin sees red license status with "Soft locked - expires in 90 days"
6. Payment received; billing calls `POST /licenses/{id}/renew`
7. License Service transitions SOFT_LOCKED → ACTIVE immediately
8. Student can login again; no data loss

**Test**: Create license, set SOFT_LOCKED, verify HTTP 423, renew, verify HTTP 200 response and data access

### Scenario 2: 90-Day Expiration to Archive

**Actor**: System (automatic)  
**Trigger**: Soft lock countdown expires

1. License created SOFT_LOCKED on 2026-01-01, soft_lock_until = 2026-04-01
2. On 2026-04-02, student makes login request
3. Tenant Resolver sees SOFT_LOCKED status AND now > soft_lock_until
4. Middleware atomically transitions ARCHIVED, captures snapshot if not already captured
5. Resolver returns 403 Forbidden
6. Backoffice admin sees red license status: "Archived at 2026-04-02"
7. Restore option available in MMC

**Test**: Set SOFT_LOCKED with past expiration, make request, verify auto-archived and HTTP 403

### Scenario 3: Archive Snapshot and Restore

**Actor**: MMC admin
**Trigger**: Institutional request to archive workspace

1. MMC admin navigates to license detail
2. License is SOFT_LOCKED; admin clicks "Archive" button
3. Button disabled during process (shows spinner)
4. Provisioning Service takes DB snapshot: 5GB tenant database
5. Snapshot stored at `s3://snapshots/{tenant_id}/2026-02-24T10-30-45Z.tar.gz`
6. Snapshot metadata stored in master_db with version_tag = "2.1"
7. License transitions to ARCHIVED
8. Admin clicks "Restore" 3 days later
9. System validates snapshot version matches current product schema (2.1)
10. DB restored from snapshot
11. License transitions to ACTIVE
12. All student data unchanged; no data loss

**Test**: Archive license, verify snapshot metadata exists, restore, verify data intact and status=ACTIVE

### Scenario 4: Permanent Deletion with Confirmation

**Actor**: MMC admin
**Trigger**: Final institutional departure

1. License is ARCHIVED; admin clicks "Permanently Delete"
2. Confirmation dialog appears: "Are you sure? Type CONFIRM_DELETE_ABC123 to proceed"
3. Admin enters wrong text; button remains disabled
4. Admin copies exact string and enters it
5. Admin clicks "Delete" button
6. Deletion confirmation sent to backend with actor_id and confirmation token
7. Provisioning Service executes in transaction:
   - Drops tenant database
   - Deletes snapshot from S3
   - Removes tenant registry entry
   - Sets license.status = DELETED, sets deleted_at = now
8. Audit log records full deletion sequence with admin_id
9. Any request to this workspace now returns 404
10. Restore attempt raises UnrecoverableError

**Test**: Delete archived license with confirmation phrase, verify HTTP 404, attempt restore, verify error

### Scenario 5: Schema Version Compatibility Check

**Actor**: System (automatic)  
**Trigger**: Restore from archived snapshot with outdated schema

1. License archived with snapshot at schema_version = 1 (product version 1.0)
2. Product upgraded to version 2.0, requires schema_version = 2
3. Admin clicks "Restore"
4. License Service calls Provisioning Service to restore
5. Provisioning Service queries snapshot metadata: version_tag = "1"
6. Current licenses.schema_version = 2
7. Validation fails: version mismatch
8. Restore raises SchemaCompatibilityError: "Snapshot requires migration from schema 1 to 2"
9. License remains ARCHIVED
10. Snapshot is NOT applied; no data corruption

**Test**: Create snapshot at old schema, upgrade product schema, attempt restore, verify SchemaCompatibilityError

### Scenario 6: Concurrent Transition Attempt

**Actor**: Two MMC admins (simultaneous)  
**Trigger**: Race condition

1. License is SOFT_LOCKED
2. Admin A clicks "Renew" (transition to ACTIVE)
3. Admin B (unaware) clicks "Archive" (transition to ARCHIVED)
4. Both requests arrive within 1ms
5. Database transaction executes first request: SOFT_LOCKED → ACTIVE
6. Second request reads current state = ACTIVE
7. Validation fails: cannot transition ACTIVE → ARCHIVED
8. Admin B receives: StateTransitionError "License is no longer in SOFT_LOCKED state. Current state: ACTIVE"
9. Audit log records both attempts with timestamps
10. License successfully transitioned by first request

**Test**: Send concurrent transition requests to same license, verify atomic execution and proper error

---

## Key Entities

### License (Master DB)

- `license_id` (UUID)
- `workspace_id` (UUID, FK to workspaces)
- `status` (ENUM: ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
- `soft_lock_until` (TIMESTAMP NULL, only populated when SOFT_LOCKED)
- `archived_at` (TIMESTAMP NULL, populated when status=ARCHIVED)
- `deleted_at` (TIMESTAMP NULL, populated when status=DELETED)
- `product_version` (VARCHAR)
- `schema_version` (INT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Snapshot Metadata (Master DB)

- `snapshot_id` (UUID)
- `license_id` (UUID, FK)
- `snapshot_location` (VARCHAR, S3 URI)
- `snapshot_timestamp` (TIMESTAMP, UTC)
- `version_tag` (VARCHAR, schema version at snapshot time)
- `size_bytes` (BIGINT)
- `created_at` (TIMESTAMP)
- `deleted_at` (TIMESTAMP NULL)

### Audit Log (Master DB)

- `audit_log_id` (UUID)
- `license_id` (UUID, FK)
- `previous_status` (ENUM)
- `new_status` (ENUM)
- `actor_id` (UUID, FK to mmc_users)
- `reason` (VARCHAR)
- `timestamp` (TIMESTAMP, UTC)
- `created_at` (TIMESTAMP, immutable)

### Tenants Registry (Master DB)

- `tenant_id` (UUID)
- `workspace_slug` (VARCHAR, unique)
- `license_status` (ENUM, mirrors licenses.status for quick lookup)
- `last_synced_at` (TIMESTAMP)

---

## Success Criteria

1. All four license states (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED) enforce access control correctly through Tenant Resolver middleware
2. State transitions validate current state before executing; forbidden transitions rejected with descriptive errors
3. Soft lock automatically expires to ARCHIVED state 90 days after transition (middleware-driven, no cron)
4. Snapshots captured on archival, versioned with schema_version, and verified on restore
5. Restore operation is idempotent: restoring same snapshot twice produces identical state
6. Permanent deletion requires confirmation phrase validation; deleted licenses unrecoverable
7. Audit logs immutable and queryable; every lifecycle operation recorded
8. MMC UI displays correct status indicators and state-dependent actions for all four states
9. Soft lock → Active renewal restores access without data mutation or reprovisioning
10. No queries reach tenant DB before license state verified (resolver enforcement non-bypassable)
11. Performance: state transitions < 100ms, resolver overhead < 1ms, snapshot capture within SLA
12. All lifecycle operations use structured logging with correlation_id, workspace_slug, actor_id

---

## Assumptions

1. **Snapshot Storage**: Snapshots stored in S3 (or equivalent object storage); snapshot_location is URI format
2. **Actor Authentication**: All lifecycle operations require authenticated MMC user; actor_id sourced from session
3. **Confirmation Phrase Format**: Random 32-character alphanumeric string generated per deletion request, valid for 5 minutes
4. **Tenant Registry Sync**: Tenants registry mirrors licenses.status for performance; reconciliation job runs hourly
5. **Schema Version Tagging**: Product always maintains current schema_version in licenses table; migration increments version
6. **Snapshot Retention**: Archived snapshots retained indefinitely unless explicitly deleted with license
7. **Timezone Convention**: All timestamps in UTC; client timezones handled in frontend display
8. **Concurrent Request Handling**: Application uses database-level row locks for transaction safety during concurrent transitions

---

## Product Dependencies

- **Master Database**: PostgreSQL schema with licenses, snapshot_metadata, audit_logs tables
- **Provisioning Service (Worker)**: Executes snapshot capture and restore operations
- **Tenant Resolver**: Middleware that checks license state before route handler execution
- **License Service**: Domain package containing state transition logic and validation
- **MMC Frontend**: Vue 3 + shadcn-vue UI component library for license management page
- **Structured Logger**: Pino-based logging for audit and operational logs

---

## Known Risks

1. **[NEEDS CLARIFICATION: Snapshot Location Finality]** Snapshot location must be immutable once archived. Clarification needed: Are snapshot paths calculated deterministically (e.g., by license_id + timestamp), or does the system allow overriding snapshot location? If overridable, how is location validation enforced?

2. **Concurrent Deletion Metadata**: If deletion process is interrupted after DB dropped but before registry entry removed, workspace left in inconsistent state. Mitigation: Wrap entire deletion in single transaction, or implement recovery job to identify and retry incomplete deletions.

3. **Large Database Snapshots**: Snapshot capture time may exceed 10-minute SLA for institutions with very large datasets (500GB+). Mitigation: Implement incremental snapshots or background snapshot process separate from request-response cycle.

---

## Clarifications

### Session 2026-02-24

#### Q1: Snapshot Location Determinism

**Question:** Are snapshot storage paths deterministically calculated (e.g., `s3://snapshots/{license_id}/{timestamp}.tar.gz`) or configurable per workspace?

**Decision: OPTION A — Deterministic paths**

- **Path Format**: `s3://snapshots/{license_id}/{timestamp}.tar.gz`
- **Calculation**: Deterministic = `license_id` + server-timestamp(UTC) at snapshot creation time
- **Immutability**: Once archived, snapshot path is final and immutable
- **No Workspace Override**: Per-workspace configurable paths not allowed (prevents drift and misconfiguration risks)

**Rationale (Zidney-Aligned)**:

- Deterministic paths are auditable and reproducible
- Enables traceable snapshot integrity validation
- Prevents path injection attacks
- Simplifies worker recovery logic and checksum validation model
- Complies with PROJECT_CONTEXT_PRIMER: no global singletons, deterministic design

---

#### Q2: Audit Trail Retention & Compliance

**Question:** How long should audit logs be retained before purge is allowed? Should retention be automatic or manual?

**Decision: OPTION C — Never auto-delete; manual purge only**

- **Retention Policy**: Audit logs never auto-deleted; manual purge process only
- **Purge Authorization**: Requires elevated MMC role (admin or legal)
- **Purge Workflow**: Explicit action with confirmation, audit entry logged
- **Non-Reversible**: Purged audit entries cannot be recovered
- **Compliance Hold**: Legal hold flag can block purge for specific workspaces

**Rationale**:

- Zidney enforces immutable audit trails (per AGENTS.md § AI Behavioral Enforcement)
- Automatic deletion introduces compliance and legal discovery risks
- Manual purge ensures deterministic governance and institutional trust
- Aligns with STAGE 10 (Licenses Management) immutability enforcement

---

#### Q3: Snapshot Failure Recovery Strategy

**Question:** How should the system behave when snapshot creation fails? Should archival rollback, proceed without snapshot, or remain blocked?

**Decision: OPTION A — Retry with alert on persistent failure**

- **Worker Retry Policy**: 3 retries with exponential backoff (1s → 2s → 4s)
- **Failure Tracking**: Mark snapshot status as `FAILED` in metadata record
- **License State**: License remains `SOFT_LOCKED` (archival blocked until snapshot succeeds)
- **Alerting**: CRITICAL alert to admin on persistent failure after 3 retries
- **Recovery**: Admin action required; manual snapshot trigger available in MMC
- **Never Proceed Without Snapshot**: Violates recoverability principle (Option C rejected)

**Rationale**:

- Preserves immutability guarantee (snapshots mandatory before archival)
- Worker-based retry aligns with provisioning and migration patterns (STAGE 09, STAGE 10)
- Observable failure (not silent) enables proactive remediation
- Keeps system deterministic; no hidden complexity

---

#### Q4: Authorization for Permanent Deletion

**Question:** Who may perform ARCHIVED → DELETED transitions? What safeguards are required?

**Decision: OPTION A — Admin-only with 2FA and confirmation phrase**

- **Authorization Level**: Admin role only; no developer bypass in production
- **2FA Re-authentication**: Second factor authentication required before deletion
- **Confirmation Phrase**: Mandatory entry of workspace slug (e.g., "confirm-delete-acme-corp")
- **Audit Log Entry**: Immutable record including actor, timestamp, confirmation phrase hash
- **Grace Period (Optional)**: Soft-delete grace period of 7 days (workspace marked for deletion but recoverable until grace expires)

**Required Safeguards**:

```
DELETE action => {
  1. Verify license status == ARCHIVED
  2. Re-authenticate actor (2FA)
  3. Require confirmation phrase match
  4. Create audit entry
  5. Initiate deletion job (workspace marked for deletion)
  6. Drop tenant DB + delete snapshot (after grace period or immediately per admin setting)
  7. Update licenses.status = DELETED + deleted_at = now()
}
```

**Rationale**:

- Matches hardened governance in STAGE 03 MMC and STAGE 02B
- Non-reversible operation requires maximum friction
- No developer pathway prevents accidental production deletions
- Immutable audit entry ensures compliance and accountability

---

#### Q5: Restore Time SLA / Performance Expectation

**Question:** What is the target SLA for restoring a workspace from snapshot?

**Decision: OPTION A — Size-based SLA with async progress tracking**

- **Small Workspace** (<1GB snapshot): Target ≤ 5 minutes
- **Medium Workspace** (1–5GB): Target ≤ 15 minutes
- **Large Workspace** (>5GB): Target ≤ 30 minutes

**Implementation Model**: Asynchronous

- Restore initiated via MMC UI
- Worker process executes in background
- Progress observable via metrics and dashboard
- ETA calculated and updated in real-time
- Atomic operation: restore succeeds fully or fails completely (no partial restore)

**Failure Handling**: If restore fails:

- Mark workspace state as `ARCHIVED` (revert to ARCHIVED, not ACTIVE)
- Alert admin with detailed error
- Preserve snapshot for retry
- Log failure to immutable audit trail

**Rationale**:

- Aligns with worker-based architecture (STAGE 09, STAGE 10) and provisioning patterns
- Asynchronous model prevents request timeout for large workspaces
- Observable progress enables operational confidence
- Atomic restore ensures determinism (no partially-restored workspaces)
- Retry with DLQ pattern matches existing operational patterns

---

#### Q6: Exam Engine Integrity During Soft Lock (Architectural Reconciliation)

**Question (Guardian Finding):**
Spec says "SOFT_LOCKED blocks all access (423)" but QA requires "In-progress exams must be allowed to complete". These conflict. Which is authoritative?

**Resolution: TWO-MODE ENFORCEMENT (Dual-Layer Architecture)**

**Mode 1 — Pre-Session Gate** (SOFT_LOCKED → 423):

- Blocks NEW sessions:
  - ❌ New attempt creation
  - ❌ New student login
  - ❌ New API session start
  - ❌ New resource provisioning

**Mode 2 — In-Flight Continuation** (SOFT_LOCKED → Allow Completion):

- Allows EXISTING in-progress attempts to continue:
  - ✅ Existing attempt.status = IN_PROGRESS (created BEFORE soft_lock_until)
  - ✅ Existing grading operations (in-flight workers)
  - ✅ Submission endpoint accessible for existing attempts
  - ✅ Attempt completion allowed (no mid-flight interruption)

**Implementation**:

```
Resolver Logic for SOFT_LOCKED License:
  if request.attempt_id exists AND attempt.created_at < license.soft_lock_until:
    # Allow continuation
    continue to handler (200 OK)
  else:
    # Block new sessions
    return 423 Locked (Retry-After header)
```

**Why This Is Correct**:

- **Preserves snapshot immutability** (ADR-0002): No mid-flight state mutations
- **Deterministic grading** (ADR-0003): Exams started before soft-lock complete with same configuration
- **Server-authoritative time** (ADR-0006): soft_lock_until is authoritative boundary
- **No data corruption**: Existing attempts isolated from new session blocking
- **Enterprise SaaS best practice**: Soft lock = grace period, not hard stop

**Rationale**:

- Institutional continuity: Students don't lose in-progress work due to payment lapses
- Compliance: Exam integrity preserved (no mid-exam interruptions)
- Determinism: Attempt configuration snapshot taken at creation time; no surprise config changes

---

#### Q7: RBAC Clarification — Who Can Transition License State? (Architectural Lock)

**Question (Guardian Finding):**
Spec says "non-admin can renew/archive" but Plan says "admin-only". Contradiction. Which is authoritative?

**Decision: ADMIN-ONLY FOR ALL LIFECYCLE TRANSITIONS**

**Correct Enterprise Rule**:

- Only **platform-level MMC Admin** (not workspace-level roles) can execute license state transitions
- No workspace staff, no teachers, no students, no institution admins at workspace level
- **Enforced at License Service layer** (before API handler, validated in domain logic)

**Allowed Transitions (Admin-Only)**:

- ACTIVE → SOFT_LOCKED (billing/institutional action)
- SOFT_LOCKED → ACTIVE (renewal after payment)
- SOFT_LOCKED → ARCHIVED (manual archival)
- ARCHIVED → ACTIVE (restore workspace)
- ARCHIVED → DELETED (permanent deletion)

**Authorization Implementation**:

```
License Service validateTransition():
  1. Verify actor has role: 'mmc:license:lifecycle:write' (platform scope, not workspace scope)
  2. Verify actor.workspace_id == license.workspace_id (cross-workspace check)
  3. If validation fails → throw AuthorizationError(403, "INSUFFICIENT_SCOPE")
  4. Verify 2FA freshness (within 5 minutes) for DELETE operations
  5. Verify confirmation_phrase hash matches for DELETE operations
```

**Why This Is Correct**:

- License state affects:
  - Data retention (snapshots must be created/managed)
  - Financial compliance (payment status)
  - Legal compliance (data deletion)
  - Isolation boundaries (tenant access control)
- No workspace-level role should mutate these boundaries
- Prevents accidental institutional deletion by support staff
- Aligns with Zidney's trust chain (AUTH → LICENSE → ISOLATION)

**Update Directive**:

- Update spec.md acceptance criteria A1, A2: "Only MMC Admin can transition license state"
- Update plan.md Authorization section: "License Service enforces admin-only scope"
- Update API contract: All lifecycle endpoints require `Authorization: Bearer <admin_token>` + scope validation

---

#### Q8: Rate-Limit Bypass Tier for Admins (Security Guardian Remediation)

**Question (Security Guardian Finding):**
Plan says "admin bypass" but implementation is undefined. Does admin bypass exist or not?

**Decision: DOCUMENTED ADMIN BYPASS WITH LOGGING**

**Specification**:

- **Bypass Enabled**: MMC Admin users may bypass per-user rate limit (1 req/sec standard)
- **Bypass Tier**: Unlimited for users with role `mmc:admin`
- **Enforcement**: Rate limiter checks `user.roles` array (from JWT, never from request body)
- **Logging**: Every bypass logged with `X-Admin-Bypass: true` response header
- **Audit Trail**: actor_id recorded in rate-limit bypass log

**Implementation**:

```
Rate Limiter Logic:
  if user.roles.includes('mmc:admin'):
    # Check abuse detection (separate from rate limit)
    checkAbuseDetection(actor_id)
    # Allow request
    response.headers['X-Admin-Bypass'] = 'true'
  else:
    # Standard rate limit: 1 req/sec with exponential backoff
    enforceRateLimit(user_id, 1, 'second')
```

**Why This Is Correct**:

- Operational emergencies (incident response) require bypass capability
- Logging ensures audit trail of bypass usage
- Abuse detection still active (prevents admin DoS)
- Bypass not auto-granted; role validation required

---

#### Q9: Cross-Workspace Authorization Validation (Security Guardian Remediation)

**Question (Security Guardian Finding):**
MMC admin from Workspace A could potentially transition licenses in Workspace B. How is this prevented?

**Decision: EXPLICIT WORKSPACE MEMBERSHIP VALIDATION**

**Specification**:

- **Admin Workspace Scope**: Each MMC admin user has explicit `workspace_id` association (stored in mmc_users table)
- **Transition Validation**: Before executing license state transition, validate `admin.workspace_id == license.workspace_id`
- **Mismatch Response**: If admin attempts action on unauthorized workspace, return 403 Forbidden with error code `ADMIN_WORKSPACE_MISMATCH`
- **JWT Constraint**: Transitional operation JWT tokens must NOT include workspace override parameters in request body

**Implementation**:

```
License Service validateCrossWorkspaceAccess():
  1. Extract admin from request context
  2. Query mmc_users.workspace_id for admin
  3. Verify: admin.workspace_id == license.workspace_id
  4. If mismatch → throw AuthorizationError(403, "ADMIN_WORKSPACE_MISMATCH")
  5. Record attempted workspace violation in audit log (for security investigation)
```

**Why This Is Correct**:

- Prevents privilege escalation across institutional boundaries
- Audit trail captures cross-workspace access attempts
- Complies with multi-tenant isolation (AGENTS.md § AI Behavioral Enforcement)

---

#### Q10: 2FA Freshness Enforcement for Deletions (Security Guardian Remediation)

**Question (Security Guardian Finding):**
Plan says "2FA within 5 minutes" but freshness validation mechanism undefined. How is 5-minute window enforced?

**Decision: SESSION-TIME-BOUNDED 2FA VERIFICATION**

**Specification**:

- **2FA Session Tracking**: After user completes 2FA authentication, set `session.two_fa_verified_at = now(UTC)`
- **One-Time ID**: Generate `2fa_verification_id = UUID()` (prevents token reuse across sessions)
- **Freshness Check**: On delete/confirm endpoint, middleware validates: `(now() - session.two_fa_verified_at) <= 5 minutes`
- **Expired Response**: If older than 5 minutes, return 401 Unauthorized with error code `2FA_SESSION_EXPIRED`
- **Missing Response**: If 2FA not performed in session, return 401 Unauthorized with error code `2FA_NOT_VERIFIED`

**Implementation**:

```
Middleware 2FA Freshness Check:
  if !session.two_fa_verified_at:
    return 401('2FA_NOT_VERIFIED')

  age_seconds = (now() - session.two_fa_verified_at).seconds
  if age_seconds > 300:  # 5 minutes
    return 401('2FA_SESSION_EXPIRED', { reset: true })

  proceed to handler
```

**Why This Is Correct**:

- Prevents stolen/replayed 2FA tokens from being used hours later
- Fresh session window limits attack surface (5-minute boundary)
- Complies with hardened governance (STAGE 03 MMC admin authentication)

---

## Not Allowed

- Skipping SOFT_LOCKED state: cannot transition directly ACTIVE → ARCHIVED or ACTIVE → DELETED
- Direct SQL mutations to licenses.status table (all changes through License Service only)
- Manual editing of lifecycle timestamps (archived_at, deleted_at, soft_lock_until)
- Automatic license renewal (must be explicit MMC action)
- Partial restore (restore is all-or-nothing operation)
- Accessing tenant DB before license state verified (resolver enforcement is mandatory)
- Restoring DELETED license (permanent deletion is irreversible)
- Deletion without confirmation phrase validation (guards against accidental deletion)
- Row-based multi-tenancy workarounds (license lifecycle entire isolation model)
- Reusing deleted workspace slug (treat deleted_at as permanent retirement of slug)

---

## References

- [PROJECT_CONTEXT_PRIMER.md](../../../docs/PROJECT_CONTEXT_PRIMER.md) - Trust chain, multi-tenancy model, license enforcement
- [STAGE_11_LICENSE_LIFECYCLE.md](../../../specs/phases/02_PLATFORM_MMC/STAGE_11_LICENSE_LIFECYCLE.md) - Stage definition
- [AGENTS.md](../../../AGENTS.md) - AI behavioral contracts for architecture alignment
- ADR-0003: License Model and Product Versioning (if exists)
- ADR-0006: Deterministic Time and Server Authority (if exists)

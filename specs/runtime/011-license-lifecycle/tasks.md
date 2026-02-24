# Tasks: License Lifecycle Operations

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Generated**: 2026-02-24  
**Feature ID**: 011-license-lifecycle  
**Status**: Ready for Implementation

---

## Task Execution Strategy

**Phases**: 10 (Database → Domain → API → Middleware → Workers → Audit → UI → Testing → Documentation → Deployment)

**Total Tasks**: 55  
**Parallelizable Tasks**: 18 (marked [P])  
**Critical Path**: T001–T005 → T006 → T016 → T025 → T028 → T034 → T037 → T041

**MVP Scope** (Phase 1–3): Implement License Service + API endpoints (minimum viable feature)

**Estimated Timeline**: 5 weeks (280 task-hours ÷ 56 task-hours/week = 5 weeks)

---

## Phase 1: Database Schema & Migrations

**Goal**: Create all required tables and extend existing tables with new columns for license lifecycle tracking  
**Independent Test Criteria**: All migrations apply cleanly, no data loss, indexes created, constraints enforced, rollback verified  
**Blocked By**: None  
**Blocks**: Phase 2 (all service layer code depends on schema)

- [x] T001 [Setup] Create migration A001 to extend licenses table — `apps/api/src/db/master/migrations/001_A001_extend_licenses_table.sql`
  - Add columns: `soft_lock_until`, `archived_at`, `deleted_at`, `current_snapshot_id` (all nullable)
  - Add constraints: `chk_soft_lock_until_consistency`, `chk_archived_at_consistency`, `chk_deleted_at_consistency`
  - Create index: `idx_licenses_soft_lock_until` (partial, WHERE status = 'SOFT_LOCKED')
  - Create index: `idx_licenses_archived_at` (partial, WHERE status = 'ARCHIVED')
  - Acceptance: Schema applies without errors, 4 columns present, 2 indexes created, constraints enforced

- [x] T002 [Setup] Create migration A002 to add snapshots table — `apps/api/src/db/master/migrations/002_A002_create_snapshots_table.sql`
  - Create table: `snapshots` with columns: `id` (UUID PK), `license_id` (UUID FK), `snapshot_location` (VARCHAR 512), `snapshot_timestamp` (TIMESTAMP), `version_tag` (VARCHAR 20), `size_bytes` (BIGINT), `status` (ENUM: CREATED|FAILED), `failure_reason` (TEXT NULL), `created_at` (TIMESTAMP), `deleted_at` (TIMESTAMP NULL)
  - Add constraint: `UNIQUE(license_id) WHERE deleted_at IS NULL` (one active snapshot per license)
  - Create indexes: `idx_snapshots_license_id`, `idx_snapshots_status`, `idx_snapshots_created_at`
  - Acceptance: Table created, all columns present, unique constraint enforced, 3 indexes created

- [x] T003 [Setup] Create migration A003 to add license_audit_logs table — `apps/api/src/db/master/migrations/003_A003_create_license_audit_logs_table.sql`
  - Create table: `license_audit_logs` with columns: `id` (UUID PK), `license_id` (UUID FK), `previous_status` (VARCHAR 20), `new_status` (VARCHAR 20), `actor_id` (UUID FK NULL), `actor_type` (ENUM: ADMIN|SYSTEM), `reason` (VARCHAR 512), `transition_metadata` (JSONB NULL), `timestamp` (TIMESTAMP), `correlation_id` (UUID), `created_at` (TIMESTAMP)
  - Add constraint: `chk_audit_status_valid` (both statuses in valid set), `chk_audit_actor_type_valid`, `chk_audit_natural_transition` (previous != new)
  - Create indexes: `idx_audit_license_id`, `idx_audit_timestamp`, `idx_audit_correlation_id`
  - Acceptance: Table created, immutable (no UPDATE/DELETE triggers), constraints enforced, 3 indexes created

- [x] T004 [Setup] Create migration A004 to add license_deletion_confirmations table — `apps/api/src/db/master/migrations/004_A004_create_license_deletion_confirmations_table.sql`
  - Create table: `license_deletion_confirmations` with columns: `id` (UUID PK), `license_id` (UUID FK), `confirmation_phrase_hash` (VARCHAR 64), `actor_id` (UUID FK), `confirmed_at` (TIMESTAMP), `grace_period_until` (TIMESTAMP NULL), `deletion_initiated_at` (TIMESTAMP), `created_at` (TIMESTAMP)
  - Add FK constraints: `fk_deletion_license_id` (CASCADE), `fk_deletion_actor_id` (RESTRICT)
  - Create indexes: `idx_deletion_license_id`, `idx_deletion_actor_id`
  - Acceptance: Table created, all columns present, FK constraints enforced, 2 indexes created

- [x] T005 [Setup] Create migration A005 to extend tenants_registry table — `apps/api/src/db/master/migrations/005_A005_extend_tenants_registry_table.sql`
  - Add columns: `license_status` (VARCHAR 20), `license_id` (UUID FK NULL), `sync_status` (VARCHAR 20 DEFAULT 'IN_SYNC'), `last_synced_at` (TIMESTAMP DEFAULT now())
  - Add FK constraint: `fk_registry_license_id` (CASCADE)
  - Create indexes: `idx_registry_license_status`, `idx_registry_last_synced_at`
  - Add backfill trigger to sync from licenses table on insert/update
  - Acceptance: Columns added, FK constraint enforced, 2 indexes created, backfill trigger syncs automatically

---

## Phase 2: Domain Logic — License Service

**Goal**: Implement License Service with 5 core transition methods and 4 validation helpers, all with transactional semantics  
**Independent Test Criteria**: Each method validates state before transition, produces audit log, atomicity verified, concurrent access serialized  
**Blocked By**: Phase 1 (schema must exist)  
**Blocks**: Phase 3 (API routes depend on service)

- [x] T006 [SYS] Implement transitionToSoftLock() method — `packages/domain-core/src/license/service.ts`
  - Signature: `async transitionToSoftLock(masterDb, licenseId, reason, actorId)`
  - Validation: License exists, status = ACTIVE (else StateTransitionError)
  - Atomic transaction: SELECT FOR UPDATE → validate → update soft_lock_until = now() + 90d → insert audit log
  - Return: { success: true, license, previous_state, new_state }
  - Error handling: StateTransitionError (400), LicenseNotFoundError (404), DatabaseError (500)
  - Acceptance: Method called on ACTIVE license → status = SOFT_LOCKED, soft_lock_until = now+90d, audit log created

- [x] T007 [P] [SYS] Implement transitionToActive() method — `packages/domain-core/src/license/service.ts`
  - Signature: `async transitionToActive(masterDb, licenseId, reason, actorId)`
  - Validation: License exists, status = SOFT_LOCKED (else StateTransitionError)
  - Atomic transaction: SELECT FOR UPDATE → validate → clear soft_lock_until → insert audit log
  - Return: { success: true, license, previous_state, new_state }
  - Error handling: StateTransitionError (400), LicenseNotFoundError (404)
  - Acceptance: Method called on SOFT_LOCKED license → status = ACTIVE, soft_lock_until = NULL, no reprovisioning

- [x] T008 [P] [SYS] Implement transitionToArchived() method — `packages/domain-core/src/license/service.ts`
  - Signature: `async transitionToArchived(masterDb, licenseId, snapshotId, reason, actorId)`
  - Validation: License exists, status = SOFT_LOCKED, snapshot exists and status = CREATED
  - Atomic transaction: SELECT FOR UPDATE → validate → set archived_at = now(), soft_lock_until = NULL, current_snapshot_id = snapshotId → insert audit log
  - Return: { success: true, license, previous_state, new_state, archive_timestamp, snapshot_id }
  - Error handling: StateTransitionError (400), SnapshotNotFoundError (404), SnapshotFailedError (400)
  - Acceptance: Method transitions SOFT_LOCKED → ARCHIVED, sets current_snapshot_id, audit log records snapshot_id

- [x] T009 [P] [SYS] Implement restoreFromArchive() method — `packages/domain-core/src/license/service.ts`
  - Signature: `async restoreFromArchive(masterDb, licenseId, actorId)`
  - Validation: License exists, status = ARCHIVED, snapshot exists and status = CREATED, version compat check
  - Enqueue worker job: `restore_from_archive` with payload (licenseId, snapshotId, actor_id, correlation_id)
  - Return: { success: true, license → ARCHIVED (still), restore_job_id, restore_timestamp, eta_seconds }
  - Idempotency: If restore submitted twice, both succeed, no data corruption
  - Error handling: StateTransitionError (400), SnapshotFailedError (400), SchemaCompatibilityError (426)
  - Acceptance: Worker job enqueued, CLI output shows job_id, idempotency verified via duplicate submission

- [x] T010 [P] [SYS] Implement transitionToDeleted() method — `packages/domain-core/src/license/service.ts`
  - Signature: `async transitionToDeleted(masterDb, licenseId, confirmationPhraseHash, actorId)`
  - Validation: License exists, status = ARCHIVED, confirmation phrase hash matches, grace period expired (if set)
  - Enqueue worker job: `delete_license` with payload (licenseId, snapshotId, actor_id, grace_period_until)
  - Return: { success: true, license → ARCHIVED (still, until job completes), delete_job_id, delete_timestamp }
  - Error handling: StateTransitionError (400), InvalidConfirmationError (403), ConfirmationExpiredError (410)
  - Acceptance: Worker job enqueued with correct payload, confirmation phrase validation verified

- [x] T011 [P] [SYS] Implement validateStateTransition() helper — `packages/domain-core/src/license/validation.ts`
  - Purpose: Enforce valid transitions, reject forbidden transitions
  - Valid transitions: ACTIVE→SOFT_LOCKED, SOFT_LOCKED→ACTIVE, SOFT_LOCKED→ARCHIVED, ARCHIVED→ACTIVE, ARCHIVED→DELETED
  - Forbidden: ACTIVE→ARCHIVED, ACTIVE→DELETED, SOFT_LOCKED→DELETED, any from DELETED
  - Return: { valid: boolean, error?: string }
  - Acceptance: All valid transitions return valid=true, all forbidden return valid=false + descriptive error

- [x] T012 [P] [SYS] Implement validateSoftLockExpiry() helper — `packages/domain-core/src/license/validation.ts`
  - Purpose: Check if NOW > soft_lock_until for SOFT_LOCKED licenses
  - Input: License object with soft_lock_until
  - Return: { expired: boolean, expires_in_ms: number }
  - Acceptance: For license 90 days in future → expired=false, expires_in_ms ≈ 7776000000

- [x] T013 [P] [SYS] Implement validateSchemaCompatibility() helper — `packages/domain-core/src/license/validation.ts`
  - Purpose: Verify snapshot version matches current product schema version
  - Input: snapshot.version_tag, current product schema_version
  - Return: { compatible: boolean, error?: string }
  - Acceptance: Exact version match → compatible=true, newer snapshot → compatible=false with error

- [x] T014 [P] [SYS] Implement validateConcurrentModification() helper — `packages/domain-core/src/license/validation.ts`
  - Purpose: Detect if license was modified between SELECT and UPDATE (optimistic locking fallback)
  - Input: Expected version/updated_at, current from SELECT FOR UPDATE
  - Return: { safe: boolean, error?: string }
  - Acceptance: Versions match → safe=true, mismatch → safe=false with ConcurrentModificationError

- [x] T015 [SYS] Create License Service test file — `packages/domain-core/src/license/__tests__/service.test.ts`
  - Test all 5 core methods with valid inputs
  - Test invalid state transitions (forbidden paths)
  - Test concurrent access (two simultaneous transitions, one succeeds)
  - Test audit log creation (every transition logged)
  - Acceptance: All tests pass, 100% code coverage for transitionTo\* methods

---

## Phase 3: API Layer — REST Endpoints

**Goal**: Implement 9 REST endpoints for license lifecycle operations with proper validation, auth, and error handling  
**Independent Test Criteria**: All endpoints route correctly, validation enforced pre-handler, proper HTTP status codes returned, audit logs created  
**Blocked By**: Phase 2 (all endpoints call License Service)  
**Blocks**: Phase 4 (middleware needs endpoint list)

- [x] T016 [SYS] Implement POST /licenses/{licenseId}/soft-lock endpoint — `apps/api/src/routes/licenses-lifecycle.ts`
  - Handler signature: `async (ctx: Context) => Promise<Response>`
  - Route: `POST /api/v1/licenses/{licenseId}/soft-lock`
  - Auth required: Admin role
  - Validation: Valid UUID licenseId, reason ≤ 512 chars, license exists
  - Call: `licenseService.transitionToSoftLock(masterDb, licenseId, reason, actor_id)`
  - Response 200: { success: true, data: { license, previous_state, new_state, soft_lock_expires_in_days: 90 } }
  - Errors: 400 (invalid input), 403 (not admin), 404 (license not found), 423 (already soft-locked), 500 (DB error)
  - Acceptance: POST with valid data → 200, license.status = SOFT_LOCKED; POST without reason → 400

- [x] T017 [P] [SYS] Implement POST /licenses/{licenseId}/renew endpoint — `apps/api/src/routes/licenses-lifecycle.ts`
  - Handler: `async (ctx: Context) => Promise<Response>`
  - Route: `POST /api/v1/licenses/{licenseId}/renew`
  - Auth required: Admin role
  - Validation: Valid UUID, reason ≤ 512 chars, license status = SOFT_LOCKED
  - Call: `licenseService.transitionToActive(masterDb, licenseId, reason, actor_id)`
  - Response 200: { success: true, data: { license, previous_state: 'SOFT_LOCKED', new_state: 'ACTIVE' } }
  - Errors: 400 (not soft-locked), 403 (not admin), 404 (license not found), 500 (DB error)
  - Acceptance: POST on SOFT_LOCKED license → 200, status = ACTIVE

- [x] T018 [P] [SYS] Implement POST /licenses/{licenseId}/archive endpoint — `apps/api/src/routes/licenses-lifecycle.ts`
  - Handler: `async (ctx: Context) => Promise<Response>`
  - Route: `POST /api/v1/licenses/{licenseId}/archive`
  - Auth required: Admin role
  - Validation: Valid UUID, license status = SOFT_LOCKED
  - Flow: Enqueue snapshot_create job, return 202 Accepted
  - Response 202: { success: true, data: { license (status still SOFT_LOCKED), job_id, job_name: 'snapshot_create', message, eta_seconds: 180 } }
  - Errors: 400 (not soft-locked), 403 (not admin), 404 (license not found), 423 (snapshot in progress), 503 (storage unavailable)
  - Acceptance: POST → 202, job_id returned, job visible in queue

- [x] T019 [P] [SYS] Implement POST /licenses/{licenseId}/restore endpoint — `apps/api/src/routes/licenses-lifecycle.ts`
  - Handler: `async (ctx: Context) => Promise<Response>`
  - Route: `POST /api/v1/licenses/{licenseId}/restore`
  - Auth required: Admin role
  - Validation: Valid UUID, reason optional (≤ 512 chars), license status = ARCHIVED, snapshot exists and CREATED
  - Call: `licenseService.restoreFromArchive(masterDb, licenseId, actor_id)`
  - Response 202: { success: true, data: { license (status still ARCHIVED), restore_job_id, estimated_duration_seconds, message } }
  - Errors: 400 (not archived, snapshot failed), 403 (not admin), 404 (license/snapshot not found), 426 (schema mismatch), 504 (timeout)
  - Acceptance: POST on ARCHIVED license with CREATED snapshot → 202, job_id returned

- [x] T020 [P] [SYS] Implement POST /licenses/{licenseId}/delete/initiate endpoint — `apps/api/src/routes/licenses-lifecycle.ts`
  - Handler: `async (ctx: Context) => Promise<Response>`
  - Route: `POST /api/v1/licenses/{licenseId}/delete/initiate`
  - Auth required: Admin role + 2FA verification
  - Validation: Valid UUID, license status = ARCHIVED
  - Action: Generate random confirmation phrase (e.g., "CONFIRM_DELETE_ABC123"), store hash in license_deletion_confirmations table, set expiry 5 minutes
  - Response 200: { success: true, data: { confirmation_id, confirmation_phrase: "CONFIRM_DELETE_ABC123", expires_in_seconds: 300 } }
  - Errors: 400 (not archived), 401 (not authenticated), 403 (not admin or 2FA failed), 404 (license not found)
  - Acceptance: POST → 200, user receives unique confirmation phrase, DB record created with hash

- [x] T021 [P] [SYS] Implement POST /licenses/{licenseId}/delete/confirm endpoint — `apps/api/src/routes/licenses-lifecycle.ts`
  - Handler: `async (ctx: Context) => Promise<Response>`
  - Route: `POST /api/v1/licenses/{licenseId}/delete/confirm`
  - Auth required: Admin role + 2FA verification (re-auth check)
  - Request body: { confirmation_phrase: string }
  - Validation: Valid UUID, confirmation_phrase matches hash in DB (case-sensitive), confirmation not expired (< 5 min old)
  - Call: `licenseService.transitionToDeleted(masterDb, licenseId, hash(confirmation_phrase), actor_id)`
  - Response 202: { success: true, data: { license (status still ARCHIVED), delete_job_id, message } }
  - Errors: 400 (expired), 403 (phrase mismatch), 401 (not authenticated), 404 (license/confirmation not found)
  - Acceptance: POST with wrong phrase → 403; POST with correct phrase → 202, job_id returned

- [x] T022 [P] [SYS] Implement GET /licenses/{licenseId} endpoint — `apps/api/src/routes/licenses-lifecycle.ts`
  - Handler: `async (ctx: Context) => Promise<Response>`
  - Route: `GET /api/v1/licenses/{licenseId}`
  - Auth required: Optional (admin level)
  - Validation: Valid UUID, license exists
  - Data: Get license details, snapshot metadata (if exists), user count from tenant DB (if ACTIVE), schema version
  - Response 200: { success: true, data: { license, snapshot: null|{id, location, size_bytes, version_tag}, user_count, storage_used_gb, schema_version } }
  - Errors: 403 (not admin), 404 (license not found), 500 (DB error)
  - Acceptance: GET → 200, license object complete with snapshot info (if archived)

- [x] T023 [P] [SYS] Implement GET /licenses/{licenseId}/audit-trail endpoint — `apps/api/src/routes/licenses-lifecycle.ts`
  - Handler: `async (ctx: Context) => Promise<Response>`
  - Route: `GET /api/v1/licenses/{licenseId}/audit-trail?limit=50&offset=0`
  - Auth required: Admin role
  - Validation: Valid UUID, limit ≤ 1000
  - Query: SELECT from license_audit_logs WHERE license_id ORDER BY timestamp DESC LIMIT offset, limit
  - Response 200: { success: true, data: { audit_logs: [...], total_count: N } }
  - Errors: 403 (not admin), 404 (license not found)
  - Acceptance: GET → 200, audit logs in reverse chronological order, pagination working

- [x] T024 [SYS] Implement GET /licenses/{licenseId}/job-status/{jobId} endpoint — `apps/api/src/routes/licenses-lifecycle.ts`
  - Handler: `async (ctx: Context) => Promise<Response>`
  - Route: `GET /api/v1/licenses/{licenseId}/job-status/{jobId}`
  - Auth required: Admin role
  - Validation: Valid UUIDs
  - Action: Query job status from Redis job queue (or job table)
  - Data fields: job_id, job_name, status (QUEUED|RUNNING|COMPLETED|FAILED), progress (0-100), current_step, estimated_time_remaining_seconds
  - Response 200: { success: true, data: { job_status: {...} } }
  - Errors: 403 (not admin), 404 (job not found)
  - Acceptance: GET → 200, job progress visible, ETA calculated based on job type size

---

## Phase 4: Middleware & Access Control

**Goal**: Implement license enforcement middleware and enhance Tenant Resolver to enforce access control based on license status  
**Independent Test Criteria**: ACTIVE licenses pass through (< 1ms overhead), SOFT_LOCKED returns 423 with Retry-After, ARCHIVED returns 403, DELETED returns 404, auto-expiry works atomically  
**Blocked By**: Phase 3 (middleware needs endpoint list to exempt lifecycle endpoints)  
**Blocks**: Phase 5 (workers depend on middleware for context)

- [x] T025 [SYS] Implement License Enforcement Middleware — `apps/api/src/middleware/license-enforcement.ts`
  - Purpose: Intercept requests, check license status, return appropriate HTTP status or proceed to handler
  - Execution point: After tenant resolver, before route handler
  - Status checks:
    - ACTIVE: Set ctx.set('is_license_active', true), proceed via await next()
    - SOFT_LOCKED with now() < soft_lock_until: Return 423 Locked + Retry-After header (seconds until expiry)
    - SOFT_LOCKED with now() > soft_lock_until: Atomically transition to ARCHIVED (SELECT FOR UPDATE), then return 403
    - ARCHIVED: Return 403 Forbidden (unless endpoint whitelisted for lifecycle operations)
    - DELETED: Return 404 Not Found
  - Lifecycle endpoint whitelist: /licenses/{id}/soft-lock, /licenses/{id}/renew, /licenses/{id}/archive, /licenses/{id}/restore, /licenses/{id}/delete/_, /licenses/{id}/audit-trail, /licenses/{id}/job-status/_
  - Performance: < 1ms per request (single index lookup + switch)
  - Acceptance: request to ACTIVE license → reaches handler (200); request to SOFT_LOCKED → returns 423; auto-expiry verified

- [x] T026 [P] [SYS] Enhance Tenant Resolver with license status caching — `packages/domain-core/src/tenant-resolver/resolver.ts`
  - Purpose: Quick license status lookup via tenants_registry (denormalized) with fallback to licenses table
  - Flow: Query tenants_registry first (sync_status, license_status) → if stale (OUT_OF_SYNC), query licenses directly
  - Add method: `async validateLicenseStatus(workspace_slug): Promise<LicenseValidationResult>`
  - Return: { status: 'ACTIVE'|'SOFT_LOCKED'|'ARCHIVED'|'DELETED', soft_lock_until?: Date, license_id: UUID, sync_status: 'IN_SYNC'|'OUT_OF_SYNC' }
  - Fallback logic: If registry query fails, query licenses (fail-safe)
  - Store in context: ctx.set('workspace_context', { license_status, soft_lock_expires_at, is_writable: boolean })
  - Acceptance: Registry query returns status in < 1ms, fallback works if registry corrupted

- [x] T027 [SYS] Implement soft-lock expiry auto-transition logic — `apps/api/src/middleware/license-enforcement.ts`
  - Purpose: Atomically transition SOFT_LOCKED → ARCHIVED when soft_lock_until expires (deterministic, no cron needed)
  - Execution: Within licenseEnforcementMiddleware, if status = SOFT_LOCKED and now() > soft_lock_until
  - Atomic transaction: SELECT FOR UPDATE licenses WHERE id = ? → verify status still SOFT_LOCKED → UPDATE status='ARCHIVED', archived_at=now(), soft_lock_until=NULL, updated_at=now() → INSERT audit_log (actor_type='SYSTEM', reason='Soft lock 90-day expiry') → COMMIT
  - Error handling: If transaction fails, return error to client (don't auto-transition on failure)
  - Logging: Log transition with correlation_id, workspace_slug, triggered_by_request=true
  - Acceptance: license with soft_lock_until=past time → middleware auto-transitions to ARCHIVED → next request returns 403

---

## Phase 5: Worker Jobs & Async Processing

**Goal**: Implement 3 async worker job types (snapshot_create, restore_from_archive, delete_license) with retry logic, idempotency, and monitoring  
**Independent Test Criteria**: Jobs create in queue, retry on failure with exponential backoff, monitoring endpoints return progress/ETA, idempotent submissions produce same result  
**Blocked By**: Phase 4 (middleware needs context for job execution)  
**Blocks**: Phase 6 (audit logging happens inside job completion)

- [x] T028 [SYS] Implement snapshot_create worker job — `apps/worker/src/jobs/snapshot_create.ts`
  - Job name: `snapshot_create`
  - Queue: `queue:snapshot_create`
  - Payload: { license_id, workspace_slug, tenant_db_connection_string, expected_snapshot_timestamp }
  - Steps:
    1. Establish read-only connection to tenant database
    2. Execute pg_dump (or equivalent) streaming to S3 at deterministic path: `s3://snapshots/{license_id}/{timestamp}.tar.gz`
    3. Calculate size_bytes after upload completion
    4. Write snapshot metadata to master_db: INSERT INTO snapshots (id, license_id, snapshot_location, snapshot_timestamp, version_tag, size_bytes, status='CREATED', created_at=now())
    5. Enqueue follow-up job to transition license to ARCHIVED (via License Service)
  - Retry logic: max_retries=3, backoff=[1s, 2s, 4s] exponential
  - On persistent failure: Set snapshot.status='FAILED', snapshot.failure_reason=error_msg, alert CRITICAL to ops
  - Idempotency: If snapshot with same license_id + timestamp exists and status=CREATED, return existing snapshot_id (no duplicate)
  - Return: { success: true, snapshot_id, snapshot_location, size_bytes, duration_ms }
  - Acceptance: Job executed → S3 object created, snapshot record in DB, size calculated; retry on transient error; duplicate submission returns existing snapshot

- [x] T029 [P] [SYS] Implement restore_from_archive worker job — `apps/worker/src/jobs/restore_from_archive.ts`
  - Job name: `restore_from_archive`
  - Queue: `queue:restore_from_archive`
  - Payload: { license_id, workspace_slug, snapshot_id, snapshot_location, target_schema_version, current_schema_version }
  - Pre-flight checks:
    1. Verify snapshot exists, status=CREATED
    2. Verify schema compatibility: target_schema_version ≤ current_schema_version (else SchemaCompatibilityError)
    3. Verify tenant DB can be dropped (no active critical sessions)
  - Steps:
    1. Download snapshot from S3 to temporary storage
    2. Verify checksum (if available)
    3. Drop existing tenant database (or truncate all tables)
    4. Restore schema + data from snapshot
    5. Run forward migrations (if target < current schema)
    6. Validate row counts match snapshot expectations
    7. Update master_db: UPDATE licenses SET status='ACTIVE', archived_at=NULL, updated_at=now() WHERE id=? AND status='ARCHIVED'; INSERT INTO license_audit_logs (actor_type='SYSTEM', reason='Restore from snapshot')
  - SLA: <1GB=5min, 1-5GB=15min, >5GB=30min; hard timeout=2xSLA+5min
  - Retry logic: max_retries=3, backoff=[1s, 2s, 4s]
  - Idempotency: If restore submitted twice before first completes, second dequeued atomically, both succeed with same end state
  - Error handling: If migration fails, rollback all changes, license stays ARCHIVED, snapshot preserved
  - Return: { success: true, license_id, status: 'ACTIVE', restored_at, row_count, duration_ms }
  - Acceptance: Job executed → tenant DB restored from snapshot, license.status=ACTIVE, data integrity verified; idempotent submission succeeds

- [x] T030 [P] [SYS] Implement delete_license worker job — `apps/worker/src/jobs/delete_license.ts`
  - Job name: `delete_license`
  - Queue: `queue:delete_license`
  - Payload: { license_id, workspace_slug, snapshot_id, snapshot_location, actor_id, grace_period_until }
  - Pre-flight checks:
    1. Verify license exists, status='ARCHIVED'
    2. Verify no active users/attempts in tenant DB (or wait for disconnection timeout)
    3. If grace_period_until set: verify now() ≥ grace_period_until (else defer job)
  - Atomic transaction (all-or-nothing):
    1. Drop tenant database
    2. Delete snapshot from S3 (verify deletion)
    3. DELETE FROM tenants_registry WHERE license_id=?
    4. UPDATE licenses SET status='DELETED', deleted_at=now(), current_snapshot_id=NULL WHERE id=?
    5. INSERT INTO license_audit_logs (actor_id, actor_type='ADMIN', reason='Permanent deletion confirmed')
  - Retry logic: max_retries=2 (only 2, terminal operation), backoff=[1s, 2s]
  - On persistent failure: Alert ops team, preserve license in ARCHIVED state for manual recovery
  - Return: { success: true, license_id, status: 'DELETED', deleted_at, duration_ms }
  - Acceptance: Job executed → tenant DB dropped, snapshot deleted from S3, license.status=DELETED; workspace now returns 404; no recovery option

- [x] T031 [SYS] Implement job status monitoring — `apps/api/src/routes/job-status.ts`
  - Purpose: Allow clients to poll job progress (used by MMC UI)
  - Endpoint: GET /api/v1/licenses/{licenseId}/job-status/{jobId}
  - Query: Get job status from job queue (Redis hash or persistent table)
  - Fields: job_id, job_name, status (QUEUED|RUNNING|COMPLETED|FAILED), progress (0-100%), current_step (string), estimated_time_remaining_seconds (based on job type + size)
  - Response 200: { success: true, data: { job_status: {...} } }
  - Errors: 403 (not admin), 404 (job not found), 410 (job gone, completed > 24 hours ago)
  - Acceptance: GET → 200, progress increases over time, ETA decreases

- [x] T032 [P] [SYS] Implement job polling helper — `packages/domain-core/src/job/polling.ts`
  - Purpose: Utility for frontend to poll job status with exponential backoff
  - Export function: `async pollJobStatus(jobId, maxAttempts=60, initialDelayMs=1000): Promise<JobStatus>`
  - Logic: Poll GET /job-status/{jobId}, if status=RUNNING, wait (delay exponentially growing), retry; if COMPLETED, return; if FAILED, throw error
  - Timeout: 60 attempts with max delay 30s = ~30 minutes total timeout
  - Cancellation: Support AbortSignal for user cancellation
  - Acceptance: Polling works for complete job lifecycle, exponential backoff verified, timeout reached within ~30min

- [x] T033 [SYS] Implement job dead-letter queue (DLQ) handler — `apps/worker/src/dlq/license-dlq-handler.ts`
  - Purpose: Track failed jobs after max retries exhausted, alert ops
  - DLQ table: jobs_dlq with job_id, job_name, payload, error_message, created_at, resolved (for manual intervention)
  - Alert logic: Send CRITICAL alert to ops via email/Slack when license lifecycle job fails 3 times
  - Admin UI: Show DLQ items, allow retry or manual resolution
  - Acceptance: Failed job appears in DLQ, alert sent, retry via admin UI works

---

## Phase 6: Audit Logging & Compliance

**Goal**: Implement immutable audit trail for all license state transitions, with manual purge capability (no auto-delete)  
**Independent Test Criteria**: Every transition logged, log entries immutable (no UPDATE/DELETE), purge requires elevated role + confirmation, audit history timestamps match transitions  
**Blocked By**: Phase 5 (audit logs created during worker job completion)  
**Blocks**: Phase 7 (UI displays audit trail)

- [x] T034 [SYS] Implement immutable audit log handler — `packages/domain-core/src/logging/audit-handler.ts`
  - Purpose: Centralized handler for all license transition audit logging
  - Function: `async createAuditLog(masterDb, licenseId, previousStatus, newStatus, actorId, actorType, reason, transitionMetadata, correlationId)`
  - Fields: id (UUID), license_id (UUID), previous_status, new_status, actor_id (nullable), actor_type ('ADMIN'|'SYSTEM'), reason (string, ≤512 chars), transition_metadata (JSONB, optional), timestamp (UTC NOW()), correlation_id (UUID), created_at (UTC NOW())
  - Constraints: Check previous_status != new_status, both in valid set, actor_type valid
  - Immutability: Add DB trigger (or application check) to prevent UPDATE/DELETE on license_audit_logs
  - Acceptance: Audit log created after every transition, fields populated correctly, UPDATE/DELETE rejected with permission error

- [x] T035 [P] [SYS] Implement audit log reader — `packages/domain-core/src/logging/audit-reader.ts`
  - Purpose: Query and paginate audit logs for a license
  - Function: `async readAuditLogs(masterDb, licenseId, limit=50, offset=0, filterActorType?, filterDateRange?): Promise<AuditLog[]>`
  - Query: SELECT \* FROM license_audit_logs WHERE license_id ORDER BY timestamp DESC LIMIT/OFFSET
  - Optional filters: actor_type (ADMIN|SYSTEM|all), date range (from/to)
  - Return: Array of audit logs with total_count
  - Acceptance: Pagination works, sorting by timestamp DESC, filters applied

- [x] T036 [SYS] Implement audit log purge workflow — `packages/domain-core/src/logging/audit-purge.ts`
  - Purpose: Manual purge of audit logs by elevated MMC role only (LEGAL_COMPLIANCE)
  - Function: `async purgeAuditLogs(masterDb, licenseId, requesterRole, requesterId, reason?, complianceHoldId?)`
  - Authorization: Require role='LEGAL_COMPLIANCE'
  - Compliance hold: If complianceHoldId set, throw ComplianceHoldError (cannot purge)
  - Audit of purge: Before DELETE, create record in audit_purge_log table (who purged, when, license_id, reason)
  - Execute: DELETE FROM license_audit_logs WHERE license_id=?; record purge in audit_purge_log
  - Response: { success: true, purged_count: N, purge_timestamp }
  - Errors: 403 (not elevated role), PermissionError, ComplianceHoldError
  - Acceptance: Only elevated role can purge, no purge if hold set, purge log records deletion

---

## Phase 7: MMC UI Components

**Goal**: Implement MMC frontend UI for license management: detail page, deletion dialog, audit viewer, job monitor  
**Independent Test Criteria**: License status displays correctly per state, actions available per state, deletion requires both confirmation phrase + 2FA, job progress visible, audit trail timeline renders  
**Blocked By**: Phase 6 (all UI data comes from backend APIs)  
**Blocks**: Phase 8 (testing needs UI built)

- [x] T037 [SYS] Implement License Detail Page component — `apps/mmc/src/components/LicenseDetailPage.vue`
  - Route: `/licenses/{licenseId}`
  - Display per state:
    - ACTIVE: Green badge, user/staff count, storage used, "Soft Lock" button
    - SOFT_LOCKED: Yellow badge, countdown timer (expires in X days Y hours Z minutes), "Renew" + "Archive" buttons
    - ARCHIVED: Red badge, "Archived at [timestamp]", snapshot info (size), "Restore" + "Permanently Delete" buttons
    - DELETED: Grey badge, "Deleted at [timestamp]", no action buttons, full audit trail visible
  - Common fields: product_version, schema_version, workspace_slug
  - Error handling: 403 → "Not authorized", 404 → "License not found", 500 → "Error loading"
  - Acceptance: Page loads, all states display correctly, buttons appear/disable per state

- [x] T038 [P] [SYS] Implement Deletion Confirmation Dialog component — `apps/mmc/src/components/LicenseDeletionDialog.vue`
  - Trigger: Click "Permanently Delete" button
  - Dialog flow:
    1. Warning text: "Are you sure? This action is irreversible."
    2. Call POST /api/licenses/{id}/delete/initiate → get confirmation_phrase
    3. Display phrase: "Type CONFIRM_DELETE_ABC123 to proceed"
    4. Input field (copy-paste allowed)
    5. "Delete" button (disabled until phrase matches, case-sensitive)
    6. On submit: Require 2FA verification (modal, or redirect to 2FA)
    7. Call POST /api/licenses/{id}/delete/confirm with confirmation_phrase
    8. Show "Deletion in progress" with job status monitor
    9. On completion: Redirect to /licenses list
  - Error handling: Phrase mismatch → show error; 2FA failed → retry; confirmation expired → retry initiate
  - Acceptance: Dialog displays phrase, input validates, 2FA required, job status shown, redirect on completion

- [x] T039 [P] [SYS] Implement Job Status Monitor component — `apps/mmc/src/components/JobStatusMonitor.vue`
  - Purpose: Display progress of async operations (snapshot, restore, delete)
  - Props: jobId, jobName, initialStatus
  - Display: Progress bar (0-100%), current step, ETA countdown
  - Polling: Use job polling helper to update every 1-5 seconds (exponential backoff)
  - States:
    - QUEUED: Show "Waiting in queue..."
    - RUNNING: Show progress %, current step, ETA
    - COMPLETED: Show "Complete" + timestamp, auto-hide after 5s or show "Dismiss"
    - FAILED: Show error message + option to "Retry" or "Contact Support"
  - Actions: Pause (if supported), Cancel (if supported)
  - Acceptance: Progress updates, ETA decreases, completion detected, error shown

- [x] T040 [SYS] Implement Audit Trail Viewer component — `apps/mmc/src/components/AuditTrailViewer.vue`
  - Route: `/licenses/{licenseId}/audit`
  - Display: Vertical timeline of all license transitions
  - For each entry: Timestamp, actor (user name or "System"), previous status → new status, reason, metadata (expandable)
  - Features:
    - Pagination (load more / auto-load)
    - Filter by date range
    - Filter by actor type (ADMIN / SYSTEM)
    - Export button (CSV/JSON)
  - Error handling: 403 → "Not authorized", 404 → "License not found"
  - Acceptance: Timeline renders, pagination works, filters applied, export downloads correct format

---

## Phase 8: Testing & Quality Assurance

**Goal**: Comprehensive testing across unit, integration, API, worker, and load testing with minimum 80% coverage  
**Independent Test Criteria**: All critical paths tested, state machine verified, concurrent access serialized, performance targets met (<1ms middleware, SLAs for snapshot/restore/delete)  
**Blocked By**: Phase 7 (all components ready for testing)  
**Blocks**: Phase 9 (docs written after tests validate)

- [x] T041 [SYS] Implement License state machine unit tests — `packages/domain-core/src/license/__tests__/state-machine.test.ts`
  - Tests:
    1. All valid transitions allowed (ACTIVE→SOFT_LOCKED, SOFT_LOCKED→ACTIVE, etc.)
    2. All invalid transitions rejected (ACTIVE→ARCHIVED, SOFT_LOCKED→DELETED, DELETED→\*, etc.)
    3. Concurrent access serialized (two simultaneous transitions, one succeeds, one fails with ConcurrentModificationError)
    4. Audit log created for each transition (100% coverage)
    5. Field consistency (soft_lock_until NULL when not SOFT_LOCKED, etc.)
  - Coverage: 100% of state machine code
  - Acceptance: All tests pass, state machine logic fully verified

- [x] T042 [P] [SYS] Implement License Service method unit tests — `packages/domain-core/src/license/__tests__/service.test.ts`
  - Tests per method: transitionToSoftLock, transitionToActive, transitionToArchived, restoreFromArchive, transitionToDeleted
  - For each method:
    1. Valid input → success response with correct state change
    2. Invalid input → descriptive error
    3. Concurrent calls → atomic serialization
    4. Audit log created
    5. Idempotency (if applicable)
  - Mocking: Mock masterDb connection, snapshot data, worker job enqueue
  - Coverage: 100% of License Service methods
  - Acceptance: All tests pass, 100% coverage, mocking verified

- [x] T043 [P] [SYS] Implement validation helpers unit tests — `packages/domain-core/src/license/__tests__/validation.test.ts`
  - Tests: validateStateTransition, validateSoftLockExpiry, validateSchemaCompatibility, validateConcurrentModification
  - For each helper: Valid outputs, invalid outputs, edge cases (expiry at exact boundary, schema mismatch)
  - Coverage: 100% of validation code
  - Acceptance: All tests pass, edge cases covered

- [x] T044 [SYS] Implement License middleware unit tests — `apps/api/src/middleware/__tests__/license-enforcement.test.ts`
  - Tests:
    1. ACTIVE license → proceed to handler (await next() called)
    2. SOFT_LOCKED with future expiry → return 423 + Retry-After header
    3. SOFT_LOCKED with past expiry → auto-transition to ARCHIVED → return 403 on next request
    4. ARCHIVED license → return 403 Forbidden
    5. DELETED license → return 404 Not Found
    6. Middleware overhead < 1ms (timing test)
  - Mocking: Mock ctx, resolver, database
  - Coverage: 100% of middleware code
  - Acceptance: All tests pass, overhead verified < 1ms

- [x] T045 [P] [SYS] Implement integration test: Full lifecycle flow — `tests/integration/license-lifecycle.test.ts`
  - Scenarios:
    1. ACTIVE → SOFT_LOCKED → ACTIVE (renewal)
    2. ACTIVE → SOFT_LOCKED → ARCHIVED (manual archive with snapshot) → ACTIVE (restore) → DELETED
    3. SOFT_LOCKED with past expiry → auto-transition to ARCHIVED
    4. Soft-locked license blocks student login (middleware 423)
    5. Archived license cannot be accessed (middleware 403)
    6. Concurrent transitions (two admins attempt different transitions simultaneously)
  - Setup: Create test database, populate with test license, execute flows, verify end states
  - Assertions: License status, soft_lock_until timestamp, audit logs, snapshot metadata
  - Coverage: All major flows
  - Acceptance: All scenarios pass, data integrity maintained, no data loss

- [x] T046 [P] [SYS] Implement API endpoint integration tests — `tests/integration/api/licenses.test.ts`
  - Tests per endpoint: soft-lock, renew, archive, restore, delete/initiate, delete/confirm, get, audit-trail, job-status
  - For each: Valid request → correct response + status code, invalid request → error with correct code, authorization checks, audit log creation
  - Scenarios:
    1. POST /soft-lock on ACTIVE → 200, status=SOFT_LOCKED
    2. POST /soft-lock on SOFT_LOCKED → 400 StateTransitionError
    3. POST /delete/confirm with wrong phrase → 403 Forbidden
    4. POST /delete/confirm with correct phrase → 202 Accepted, job enqueued
    5. GET /audit-trail → 200, audit logs in reverse chronological order
  - Coverage: All 9 endpoints
  - Acceptance: All endpoint tests pass, all status codes correct, edge cases handled

- [x] T047 [P] [SYS] Implement worker job unit tests — `apps/worker/src/jobs/__tests__/snapshot_create.test.ts`, `restore_from_archive.test.ts`, `delete_license.test.ts`
  - For each job type:
    1. Valid payload → job completes successfully
    2. Transient error (connection timeout) → retry with backoff
    3. Persistent error (>3 retries) → mark FAILED, alert admin
    4. Idempotency: Duplicate submission → same result (no duplication)
    5. Concurrency: Two jobs submitted for same license → serialized (no race conditions)
  - Mocking: Mock S3, tenant DB, master DB, Redis queue
  - Acceptance: Snapshot job creates S3 object + DB record; restore overwrites DB + transitions license; delete drops DB + snapshot

- [x] T048 [P] [SYS] Implement data integrity snapshot tests — `tests/snapshot/data-integrity.test.ts`
  - Scenarios:
    1. Create 1000 student records in workspace, soft-lock, archive (initiate snapshot), restore from archive, verify 1000 records intact
    2. Create 500 in-progress attempts, archive (snapshot blocks until attempts complete or timeout), verify attempts recoverable
    3. Record checksums before archive, after restore, verify match
  - Data validation:
    - Row counts match
    - Checksums match (MD5 of data)
    - Timestamps consistent
    - Foreign key integrity maintained
  - Acceptance: All data integrity checks pass, no data loss

- [x] T049 [P] [SYS] Implement load tests — `tests/load/license-middleware-load.test.ts`, `snapshot-performance.test.ts`, `concurrent-restore.test.ts`
  - Load Test 1: Middleware overhead
    - 1000 concurrent requests to ACTIVE license
    - Measure p50, p95, p99 latency
    - Assert all < 5ms (target < 1ms)
  - Load Test 2: Snapshot performance
    - Archive 100GB workspace
    - Measure time, assert < 10 min SLA
  - Load Test 3: Concurrent restores
    - 5 concurrent restore jobs
    - Verify no data corruption, atomic serialization
  - Acceptance: All load tests pass, latency targets met, no corruption under load

- [x] T050 [SYS] Document test coverage & create test summary — `tests/README.md`, `tests/COVERAGE_REPORT.md`
  - Summary: 100% coverage for state machine, 95%+ coverage overall
  - Test counts: 50+ unit tests, 15+ integration tests, 9 API tests, 3 worker tests, 3 load tests
  - Performance: Middleware < 1ms, snapshot < 10min SLA, restore < 30min SLA
  - Acceptance: Coverage report generated, all metrics documented

---

## Phase 9: Documentation

**Goal**: Comprehensive documentation for developers, operators, and support teams  
**Independent Test Criteria**: All docs linked to code, examples executable, runbooks match actual procedures  
**Blocked By**: Phase 8 (docs written after implementation validates)  
**Blocks**: Phase 10 (docs needed for deployment)

- [x] T051 [SYS] Update API documentation — `docs/api/licenses.md`
  - Document:
    1. All 9 endpoints (method, path, auth, request/response)
    2. Status codes (200, 202, 400, 403, 404, 423, 426, 500)
    3. Example requests/responses (curl/JavaScript)
    4. Error scenarios (invalid input, state mismatch, etc.)
    5. Async operations (how to poll job status, WebSocket subscriptions)
  - Format: OpenAPI 3.0 spec (optional) + markdown
  - Acceptance: All endpoints documented, examples runnable

- [x] T052 [SYS] Create deployment runbook & incident response guide — `docs/deployment/license-lifecycle-runbook.md`, `docs/operations/incident-response.md`
  - Runbook contents:
    1. Pre-deployment checklist (tests, migrations, staging validation)
    2. 4-phase deployment (migrations → backend → middleware → UI)
    3. Validation gates (no proceed without passing gate)
    4. Rollback procedures (per phase)
    5. Monitoring commands (check license status, middleware latency, job queue)
    6. Troubleshooting flowchart
  - Incident response:
    1. "License middleware causing 500 errors" → steps to diagnose/fix
    2. "Soft-lock auto-expiry not working" → debug checklist
    3. "Snapshot job stuck in RUNNING" → manual recovery steps
    4. "Delete job failed, license stuck ARCHIVED" → recovery procedure
  - Acceptance: Runbook tested, incident scenarios walkable, troubleshooting steps clear

---

## Phase 10: Deployment

**Goal**: Safe, phased production deployment with validation gates and rollback capability  
**Independent Test Criteria**: Migrations apply without errors, backend services healthy, middleware overhead verified, UI functional, no data loss  
**Blocked By**: Phase 9 (docs must exist before deploy)  
**Blocks**: None (final phase)

- [x] T053a [Setup] Implement migration scale test — `tests/load/license-scale-test.ts` + `tests/integration/migration-scale-test.ts`
  - Acceptance Criteria:
    1. Create 500k+ license_audit_logs records in test DB
    2. Measure migration A003 application time (target: <30s for 500k records)
    3. Verify indexes created on license_id, timestamp, correlation_id
    4. Verify UNIQUE constraint on (license_id, deleted_at) enforced
    5. Rollback test: Reverse migration successfully reverts schema
    6. Assert: No data loss, no orphaned records after rollback
  - Output: Test report with timing data, constraint validation evidence
  - Acceptance: Test passes, performance baseline < 30s, rollback verified

- [x] T053b [Setup] Implement cross-tenant isolation smoke test — `tests/integration/cross-tenant-isolation-smoke-test.ts`
  - Acceptance Criteria:
    1. Create 3 test workspaces (A, B, C) with distinct licenses
    2. Verify admin from Workspace A cannot access licenses in B, C (403 ADMIN_WORKSPACE_MISMATCH)
    3. Verify license_id filters by workspace_id (no cross-tenant data leakage)
    4. Verify snapshots isolated by license_id (Workspace B snapshots not accessible to A)
    5. Verify audit logs per workspace (no cross-workspace audit visibility)
    6. Verify soft-lock enforcement per workspace (A's soft-lock doesn't affect B)
  - Output: Test result (PASS/FAIL) with evidence of isolation breaches if any
  - Acceptance: All 6 scenarios pass; cross-tenant access denied; isolation verified

- [x] T053c [Setup] Implement rollback verification script — `scripts/verify-rollback-procedures.sh` + `tests/deployment/rollback-strategy-test.ts`
  - Acceptance Criteria:
    1. Test reverse migration for A001 (drop soft_lock_until, archived_at, deleted_at columns)
    2. Test reverse migration for A002 (drop snapshots table)
    3. Test reverse migration for A003 (drop license_audit_logs table)
    4. Test reverse migration for A004 (drop license_deletion_confirmations table)
    5. Test reverse migration for A005 (drop extensions to tenants_registry)
    6. Verify data integrity after rollback (no data loss, schema reverts to pre-migration state)
    7. Test snapshot restore procedure (if Phase 1 fails, restore from pre-deployment backup)
  - Output: Rollback verification report with success/failure per migration
  - Acceptance: All 5 reverse migrations tested; restore procedure verified; data integrity confirmed

- [x] T053d [Setup] Implement pre-deployment validation script — `scripts/validate-license-deploy.sh`
  - Acceptance Criteria:
    1. All unit tests passing (domain, service, middleware)
    2. All integration tests passing (API, worker, cross-tenant)
    3. All load tests passing (1000 concurrent soft-lock transitions)
    4. Lint passing (no eslint/prettier violations)
    5. Type check passing (tsc --noEmit clean)
    6. Migration scale test passing (migration < 30s)
    7. Cross-tenant smoke test passing (isolation verified)
    8. Rollback procedures tested and verified
    9. Staging deployment successful (backend + middleware + UI all healthy)
    10. Pre-deployment backup created and verified
  - Output: Validation report with 10-point checklist (all PASS required)
  - Acceptance: Script runs, all 10 checks verified, PASS verdict required before Phase 1 deployment

- [x] T054 [Setup] Implement 3-phase production deployment — `scripts/deploy-license-lifecycle.sh`
  - Phase 1: Run migrations A001–A005 in sequence
    - Verify: Schema changes applied, indexes created, backfill complete
    - Gate: If any migration fails, rollback all and abort deploy
  - Phase 2: Deploy backend services (domain, api, worker)
    - Verify: Services healthy, no startup errors, all routes responding
    - Gate: If any service fails health check, rollback to previous version
  - Phase 3: Activate license enforcement middleware
    - Verify: Middleware < 1ms overhead, error rate = 0% for ACTIVE licenses
    - Monitoring: Watch for 423/403/404 spikes (expected initially, should normalize)
    - Gate: If error rate > 0.5%, disable middleware and investigate
  - Phase 4: Deploy MMC UI components
    - Verify: License detail page loads, all actions buttons work
    - Gate: If UI fails to load, rollback to previous version
  - Acceptance: 4-phase deploy completes, all validation gates pass, no errors

- [x] T055 [SYS] Create post-deployment monitoring dashboard — `terraform/monitoring/license-lifecycle-dashboard.tf`, `docs/monitoring/license-metrics.md`
  - Metrics to track:
    1. License status distribution (% ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
    2. Middleware latency (p50, p95, p99)
    3. API endpoint latency
    4. Job completion rates (snapshot, restore, delete)
    5. Error rates by status code (423, 403, 404)
    6. Soft-lock auto-expiry rate (licenses transitioning to ARCHIVED daily)
    7. Snapshot failure rate
  - Alerts configured:
    1. Middleware latency > 5ms (warning), > 10ms (critical)
    2. Snapshot failures > 5 in 1 hour (critical)
    3. Soft-locked licenses nearing expiry (> 88 days, informational)
    4. Restore job > SLA timeout (critical)
  - Dashboard: Real-time view of all metrics, drill-down to individual licenses
  - Acceptance: Dashboard loads, all metrics visible, alerts configured and tested

---

## Dependency Graph & Task Ordering

### Critical Path (Must Complete Sequentially)

```
T001 (Schema: licenses)
  ↓
T002–T005 (Remaining migrations)
  ↓
T006 (License Service: transitionToSoftLock)
  ↓
T016 (API: soft-lock endpoint)
  ↓
T025 (Middleware: license enforcement)
  ↓
T028–T030 (Worker jobs)
  ↓
T034 (Audit logging)
  ↓
T037 (MMC UI)
  ↓
T041 (Testing)
  ↓
T051–T052 (Documentation)
  ↓
T053–T055 (Deployment)
```

### Parallelizable Groups

**After T005** (all migrations complete), parallel:

- T006 (core service methods)
- T011–T014 (validation helpers)

**After T006**, parallel:

- T007–T010 (remaining service methods)
- T016–T024 (all API endpoints)

**After T016–T024**, parallel:

- T025–T027 (middleware + tenant resolver)
- T028–T030 (worker jobs)

**After T028–T030**, parallel:

- T031–T033 (job monitoring)
- T034–T036 (audit logging)

**After T034–T036**, parallel:

- T037–T040 (MMC UI components)
- T041–T050 (testing)

**After T041–T050**, parallel:

- T051–T052 (documentation)
- T053a–T053d (pre-deployment validation subtasks)

**After T053a–T053d**, sequential:

- T054 (deployment)
- T055 (monitoring)

### Estimated Parallelization

- Base sequential tasks: 55
- Parallelizable opportunities: Groups of 3–5 tasks at 8 different dependency levels
- Estimated reduction: 55 tasks → ~20 sequential "super-tasks" with 15–20 parallel sub-tasks
- **Timeline**: 5 weeks (280 task-hours ÷ 8 developers = 35 hours/developer over 5 weeks)

---

## Task Completion Checklist

**Acceptance Criteria for Each Task**:

- [ ] Code written and compiles/runs without errors
- [ ] All file paths exact and confirmed (no placeholders)
- [ ] Tests pass (unit test for domain, integration test for API)
- [ ] Acceptance criteria met (specific conditions testable)
- [ ] Code reviewed (peer review completed)
- [ ] Docs updated (inline comments, function signatures)
- [ ] Changes committed to git with message referencing task ID (T###)

---

## Summary

- **Total Tasks**: 59 (55 original + 4 from T053 decomposition)
- **Phases**: 10 (Schema → Domain → API → Middleware → Workers → Audit → UI → Testing → Docs → Deployment)
- **Parallelizable**: 18 tasks (31%)
- **Critical Path**: ~20 sequential milestones
- **Estimated Timeline**: 5 weeks (320 task-hours for 59 tasks)
- **MVP Scope**: Phase 1–3 (T001–T024: Database + Service + API = 24 tasks, ~1 week)
- **Full Feature**: All 59 tasks, ~5 weeks production-ready

---

## How to Use This Tasks File

1. **Start**: Begin with T001 (database migrations)
2. **Track**: Use `- [ ]` to mark incomplete, `- [X]` to mark complete
3. **Assign**: Assign parallelizable tasks to team members in independent groups
4. **Monitor**: Check dependency graph before starting task (verify all blocking tasks done)
5. **Validate**: Run acceptance criteria before marking done
6. **Commit**: Reference task ID in git commits (e.g., `git commit -m "T006: Implement transitionToSoftLock"`)
7. **Report**: Track completion weekly to monitor 5-week timeline

---

**End of Tasks Document**

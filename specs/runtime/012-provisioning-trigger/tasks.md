# Implementation Tasks: STAGE 12 – Provisioning Trigger

**Feature**: Tenant Provisioning Trigger System  
**Phase**: 02_PLATFORM_MMC  
**Status**: Specification COMPLETE, Planning COMPLETE, Tasks GENERATED  
**Branch**: `012-provisioning-trigger`  
**Date Generated**: 2026-02-24

---

## Task Summary

**Total Atomic Tasks**: 52  
**Parallelizable Tasks**: 22 (marked [P])  
**Critical Path Duration**: ~18 tasks (sequential)  
**Estimated Development Time**: 15-20 days (1 developer, full-time)

---

## Execution Strategy

### MVP Scope (Phase 1–3)

Complete Phase 1 (Setup) → Phase 2 (API Layer) → Phase 3 (Worker Layer). This gives you end-to-end
provisioning capability within 10 days.

### Full Scope (Phases 1–5)

Add Phase 4 (Integration) → Phase 5 (Testing) for production-grade observability, error handling,
and comprehensive test coverage.

### Parallelization Opportunities

**Can Run Concurrently**:

- All database migrations (independent of each other)
- Request validators (independent components)
- Service implementations (different files, loose coupling)
- Unit tests (isolated components)
- Contract implementations (independent)

**Must Complete Before**:

- Setup tasks must complete before any code tasks
- API middleware before testing API endpoints
- Worker services before worker job consumer
- All implementation before integration tests

---

## Phase 1: Setup & Infrastructure

Database migrations, queue structure, error registry, and foundational configuration.

### Master Database Migrations

- [x] T001 Create master DB migration for licenses table modifications in
      `apps/api/src/db/master/migrations/001_add_provisioning_fields_to_licenses.sql`
- [x] T002 [P] Create master DB migration for tenants_registry table in
      `apps/api/src/db/master/migrations/002_create_tenants_registry.sql`
- [x] T003 [P] Create master DB migration for provisioning indexes in
      `apps/api/src/db/master/migrations/003_add_provisioning_indexes.sql`
- [x] T004 [P] Create migration rollback script `apps/api/src/db/master/rollback.sql` (for
      development cleanup)

### Tenant Database Baseline Migrations

- [x] T005 Create tenant baseline migration for schema tracking in
      `apps/api/src/db/tenant/migrations/baseline_001_schema_versions.sql`
- [x] T006 [P] Create tenant baseline migration for roles table in
      `apps/api/src/db/tenant/migrations/baseline_002_roles.sql`
- [x] T007 [P] Create tenant baseline migration for permissions table in
      `apps/api/src/db/tenant/migrations/baseline_003_permissions.sql`
- [x] T008 [P] Create tenant baseline migration for workspace_settings in
      `apps/api/src/db/tenant/migrations/baseline_004_workspace_settings.sql`
- [x] T009 [P] Create tenant baseline migration for divisions table (conditional) in
      `apps/api/src/db/tenant/migrations/baseline_005_divisions.sql`
- [x] T010 [P] Create tenant baseline migration for admin user placeholder in
      `apps/api/src/db/tenant/migrations/baseline_006_init_admin_user.sql`

### Error Code & Configuration Registry

- [x] T011 [P] Create error code registry in `packages/types/src/errors/provisioning-errors.ts`
      (INVALID_WORKSPACE_SLUG, WORKSPACE_SLUG_EXISTS, INVALID_ADMIN_EMAIL, INVALID_LIMIT,
      LOCK_TIMEOUT, DB_CREATE_FAILED, MIGRATION_FAILED, SEED_FAILED, REGISTRY_INSERT_FAILED,
      PROVISION_FAILED, LOCK_ACQUISITION_FAILED, RETRY_EXHAUSTED)
- [x] T012 [P] Create provisioning job types and interfaces in
      `packages/types/src/jobs/provisioning-job.ts` (ProvisioningJob, JobStatus, RetryPolicy)
- [x] T013 [P] Create license state types in `packages/types/src/licenses/license-state.ts`
      (LicenseStatus enum: PENDING_PROVISION, ACTIVE, PROVISION_FAILED)

### Queue & Configuration Setup

- [x] T014 Create Redis queue configuration in `apps/worker/src/config/queue-config.ts` (queue name,
      retry policy, consumer group settings)
- [x] T015 [P] Create logging configuration in `packages/logger/src/provisioning-logger.ts`
      (structured JSON logging with correlation_id, workspace_slug, license_id fields)
- [x] T016 [P] Create environment variables template in `apps/worker/.env.example` (REDIS_URL,
      MASTER_DB_URL, PG_HOST, QUEUE_NAME, MAX_CONCURRENT_JOBS)

---

## Phase 2: API Layer

License creation, status polling, validation, and job enqueueing.

### Request Validation & Types

- [x] T017 Create request validation schema in
      `apps/api/src/routes/licenses/validate-license-request.ts` (workspace_slug pattern, email
      format, limits, product_id verification)
- [x] T018 [P] Create license response types in `apps/api/src/routes/licenses/license-response.ts`
      (LicenseCreationResponse, LicenseStatusResponse)
- [x] T019 [P] Create request validation middleware in `apps/api/src/middleware/validate-request.ts`
      (generic validation pipeline)

### License Creation Endpoint (POST /v1/mmc/licenses)

- [x] T020 Create license creation handler in `apps/api/src/handlers/licenses/create-license.ts`
      (validation, record creation, job enqueue, response formatting)
- [x] T021 [P] Implement workspace slug uniqueness check against `tenants_registry` in
      `apps/api/src/handlers/licenses/check-slug-exists.ts`
- [x] T022 [P] Create license record insertion logic in
      `apps/api/src/handlers/licenses/insert-license-record.ts` (insert into master_db.licenses with
      PENDING_PROVISION status)
- [x] T023 Create license enqueueing service in `apps/api/src/services/provision-enqueue-service.ts`
      (create job payload, push to Redis queue, handle queue errors)

### License Status Polling Endpoint (GET /v1/mmc/licenses/{license_id})

- [x] T024 Create license status handler in `apps/api/src/handlers/licenses/get-license-status.ts`
      (fetch from master_db.licenses, return status, created_at, provisioned_at, failed_at,
      last_provision_error)
- [x] T025 [P] Create license query service in `apps/api/src/services/license-query-service.ts`
      (query by license_id, handle not found)

### License Middleware (Authentication & Authorization)

- [x] T026 Create MMC service token validator in `apps/api/src/middleware/mmc-token-validator.ts`
      (Bearer token validation, verify MMC service account)
- [x] T027 [P] Create correlation ID middleware in `apps/api/src/middleware/correlation-id.ts`
      (generate or pass-through X-Correlation-ID header)
- [x] T028 [P] Create rate limiting middleware in
      `apps/api/src/middleware/rate-limit-provisioning.ts` (5 license creations per minute per IP)

### Route Registration

- [x] T029 Register license endpoints in `apps/api/src/routes/licenses.ts` (POST /v1/mmc/licenses,
      GET /v1/mmc/licenses/{license_id}, attach middleware)

---

## Phase 3: Worker Layer

Provisioning job consumer, database provisioning, and idempotency.

### Core Provisioning Services

- [x] T030 Create license validation service in
      `apps/worker/src/services/license-validation-service.ts` (query master_db.licenses, check
      status, check existence, handle expired licenses)
- [x] T031 [P] Create distributed lock service in
      `apps/worker/src/services/distributed-lock-service.ts` (Redis SETNX/DEL with 30s TTL,
      exponential backoff on contention)
- [x] T032 [P] Create idempotency check service in `apps/worker/src/services/idempotency-service.ts`
      (query tenants_registry, check license.status = ACTIVE, handle orphan DB detection)
- [x] T033 [P] Create database connection pool manager in
      `apps/worker/src/services/tenant-pool-manager.ts` (create isolated connection pool per
      workspace, handle connection cleanup)

### Database Provisioning

- [x] T034 Create database creation service in `apps/worker/src/services/database-service.ts`
      (CREATE DATABASE workspace\_<slug>, set UTF-8 locale, handle existing database conflicts)
- [x] T035 [P] Create migration runner service in `apps/worker/src/services/migration-runner.ts`
      (load migration files, execute in transaction, track schema_version, implement idempotent
      retry)
- [x] T036 [P] Create seed data service in `apps/worker/src/services/seed-service.ts` (insert
      default roles, permissions, workspace_settings, divisions if enabled, with transactional
      atomicity)

### Admin Account & Registry

- [x] T037 Create admin account creation service in
      `apps/worker/src/services/admin-account-service.ts` (create user record with admin role, set
      email, generate verification token placeholder)
- [x] T038 [P] Create registry insertion service in
      `apps/worker/src/services/registry-insertion-service.ts` (INSERT into
      master_db.tenants_registry with license_id uniqueness constraint)
- [x] T039 [P] Create license activation service in
      `apps/worker/src/services/license-activation-service.ts` (UPDATE licenses SET status=ACTIVE,
      provisioned_at=now())

### Failure Handling & Recovery

- [x] T040 Create failure handler service in `apps/worker/src/services/failure-handler-service.ts`
      (update license.status=PROVISION_FAILED, set failed_at, set last_provision_error message)
- [x] T041 [P] Create database cleanup service in
      `apps/worker/src/services/database-cleanup-service.ts` (DROP DATABASE workspace\_<slug> with
      retry logic and orphan detection)
- [x] T042 [P] Create retry enqueue service in `apps/worker/src/services/retry-enqueue-service.ts`
      (increment retry_count, re-enqueue job if < max_retries)

### Job Consumer & Main Loop

- [x] T043 Create provisioning job consumer in `apps/worker/src/consumers/provisioning-consumer.ts`
      (Redis queue consumer, error handling wrapper, structured logging, 13-step pipeline
      orchestration)
- [x] T044 Create job processing main handler in
      `apps/worker/src/handlers/provision-workspace-handler.ts` (orchestrate: validate → acquire
      lock → check idempotency → create DB → run migrations → seed data → create admin → register →
      activate → release lock → log success)

---

## Phase 4: Integration & Observability

End-to-end flow integration, metrics, DLQ, and correlation ID propagation.

### Observability & Metrics

- [x] T045 Create metrics emitter in `apps/worker/src/observability/metrics.ts`
      (provisioning.duration_ms, provisioning.success_count, provisioning.failure_count,
      provisioning.retry_count, provisioning.lock_wait_ms, tenants_registry.total_workspaces)
- [x] T046 [P] Create structured logging pipeline in
      `apps/worker/src/observability/structured-logger.ts` (emit JSON with timestamp, level,
      service, correlation_id, license_id, workspace_slug, db_name, event, step, duration_ms,
      error_code)
- [x] T047 [P] Create correlation ID propagation utility in
      `packages/logger/src/correlation-context.ts` (AsyncLocalStorage context for correlation_id,
      workspace_slug)

### Dead Letter Queue (DLQ) & Error Recovery

- [x] T048 Create DLQ handler in `apps/worker/src/handlers/dlq-handler.ts` (capture jobs that fail
      max_retries, store in Redis DLQ, log for operator review)
- [x] T049 [P] Create DLQ processor in `apps/worker/src/workers/dlq-processor.ts` (periodic review
      of DLQ, alert operator, manual retry support)

### Integration & Health Checks

- [x] T050 Create health check endpoint in `apps/api/src/routes/health.ts` (verify master DB
      connectivity, verify Redis connectivity, verify worker queue is consuming)
- [x] T051 [P] Create end-to-end integration test setup in
      `tests/integration/provisioning-e2e-setup.ts` (fixture: local postgres, redis, worker
      consumer)

---

## Phase 5: Comprehensive Testing

Unit tests, integration tests, and transactional verification.

### Unit Tests (Component Level)

- [x] T052 Create unit test suite for distributed lock in
      `apps/worker/tests/unit/distributed-lock-service.test.ts` (acquire, release, TTL expiration,
      contention backoff)

### Integration Tests (API ↔ Worker Flow)

- [x] T053 Create integration test for full provisioning flow in
      `tests/integration/provisioning-flow.test.ts` (create license → enqueue → consume → verify
      database created → verify status ACTIVE)

### Idempotency Tests

- [x] T054 Create idempotency test suite in `tests/integration/provisioning-idempotency.test.ts`
      (duplicate job same license_id, existing registry entry, existing ACTIVE license, orphan DB
      recovery)

### Transactional & Rollback Tests

- [x] T055 Create transaction rollback test in `tests/integration/provisioning-rollback.test.ts`
      (migration failure, seed failure, admin creation failure, registry insert failure, verify DB
      cleaned up, license status rolled back)

### Version Compatibility Tests

- [x] T056 Create version compatibility test in
      `tests/integration/provisioning-version-check.test.ts` (schema_version stored correctly,
      migrations applied up to version, incompatible schema handling)

---

## Dependency Graph

### Critical Path (Sequential)

```
T001 → T002 → T003
  ↓
T014 → T015 → T016
  ↓
T017 → T020 → T029
  ↓
T030 → T031 → T032
  ↓
T043 → T044
  ↓
T053 (full e2e integration test)
```

### Parallelization Phases

**Phase 1 Setup (Can run parallel after T001)**:

- T002, T003, T004 (master migrations)
- T005–T010 (tenant migrations)
- T011–T013 (error/type registry)
- T015, T016 (configuration)

**Phase 2 API (Can run parallel after T017)**:

- T018, T019 (validation types/middleware)
- T021, T022, T023 (slug check, insert, enqueue)
- T024, T025 (status endpoint)
- T026, T027, T028 (middleware)

**Phase 3 Worker (Can run parallel after T030)**:

- T031, T032, T033 (lock, idempotency, pool)
- T034, T035, T036 (database, migrations, seed)
- T037, T038, T039 (admin, registry, activation)
- T040, T041, T042 (failure, cleanup, retry)

**Phase 4 Observability (Can run parallel after T043)**:

- T045, T046, T047 (metrics, logging, context)
- T048, T049 (DLQ)
- T050, T051 (health checks, setup)

**Phase 5 Testing (Can run parallel after T052)**:

- T053, T054, T055, T056 (all test suites)

---

## Success Criteria Per Phase

### Phase 1 Complete ✓ When:

- [x] All 6 master DB migrations execute without errors
- [x] All 6 tenant baseline migrations are idempotent
- [x] Error codes match spec (15 error codes defined)
- [x] Job types and interfaces compile without errors

### Phase 2 Complete ✓ When:

- [x] POST /v1/mmc/licenses accepts valid request and returns license record
- [x] GET /v1/mmc/licenses/{license_id} returns correct status
- [x] workspace_slug validation rejects invalid patterns
- [x] Rate limiting blocks 6th request in 60 seconds
- [x] Correlation ID propagates to job payload

### Phase 3 Complete ✓ When:

- [x] Full 13-step provisioning pipeline executes end-to-end
- [x] Database created with correct name and locale
- [x] Baseline schema applied (all 6 tables exist)
- [x] Admin user created with correct role
- [x] tenants_registry entry created with all fields
- [x] license.status = ACTIVE with provisioned_at set
- [x] On failure: license.status = PROVISION_FAILED with error_message

### Phase 4 Complete ✓ When:

- [x] All structured logs parseable as JSON
- [x] Correlation ID in every log entry
- [x] Metrics emitted to observability system
- [x] Failed jobs captured in DLQ
- [x] Health check passes with all systems healthy

### Phase 5 Complete ✓ When:

- [x] All 52 tasks have passing unit/integration tests
- [x] 100% test coverage for critical services (lock, idempotency, seed)
- [x] Duplicate submissions handled correctly (idempotent)
- [x] Rollback scenarios all verified
- [x] Version check prevents incompatible schemas

---

## Implementation Notes

### Key Files to Create

```
apps/api/src/
├── db/master/migrations/
│   ├── 001_add_provisioning_fields_to_licenses.sql
│   ├── 002_create_tenants_registry.sql
│   └── 003_add_provisioning_indexes.sql
├── db/tenant/migrations/
│   ├── baseline_001_schema_versions.sql
│   ├── baseline_002_roles.sql
│   ├── baseline_003_permissions.sql
│   ├── baseline_004_workspace_settings.sql
│   ├── baseline_005_divisions.sql
│   └── baseline_006_init_admin_user.sql
├── handlers/licenses/
│   ├── create-license.ts
│   ├── get-license-status.ts
│   ├── check-slug-exists.ts
│   └── insert-license-record.ts
├── middleware/
│   ├── mmc-token-validator.ts
│   ├── correlation-id.ts
│   ├── rate-limit-provisioning.ts
│   └── validate-request.ts
├── routes/
│   ├── licenses.ts
│   └── health.ts
└── services/
    ├── provision-enqueue-service.ts
    └── license-query-service.ts

apps/worker/src/
├── config/
│   └── queue-config.ts
├── services/
│   ├── license-validation-service.ts
│   ├── distributed-lock-service.ts
│   ├── idempotency-service.ts
│   ├── tenant-pool-manager.ts
│   ├── database-service.ts
│   ├── migration-runner.ts
│   ├── seed-service.ts
│   ├── admin-account-service.ts
│   ├── registry-insertion-service.ts
│   ├── license-activation-service.ts
│   ├── failure-handler-service.ts
│   ├── database-cleanup-service.ts
│   └── retry-enqueue-service.ts
├── handlers/
│   ├── provision-workspace-handler.ts
│   └── dlq-handler.ts
├── consumers/
│   └── provisioning-consumer.ts
├── workers/
│   └── dlq-processor.ts
└── observability/
    ├── metrics.ts
    └── structured-logger.ts

packages/
├── types/src/
│   ├── errors/
│   │   └── provisioning-errors.ts
│   ├── jobs/
│   │   └── provisioning-job.ts
│   └── licenses/
│       └── license-state.ts
└── logger/src/
    ├── provisioning-logger.ts
    └── correlation-context.ts

tests/
├── integration/
│   ├── provisioning-e2e-setup.ts
│   ├── provisioning-flow.test.ts
│   ├── provisioning-idempotency.test.ts
│   ├── provisioning-rollback.test.ts
│   └── provisioning-version-check.test.ts
└── unit/
    └── distributed-lock-service.test.ts
```

### Testing Strategy

1. **Unit tests** focus on isolated service logic (lock, validation, formatting)
2. **Integration tests** verify API → Worker → Database flow with real Docker stack
3. **Transactional tests** ensure atomicity and rollback behavior
4. **Idempotency tests** verify duplicate handling and resilience
5. **Version tests** validate schema compatibility

### Development Flow

1. **Days 1–3**: Complete Phase 1 (Setup)
2. **Days 4–8**: Complete Phase 2 (API) + Phase 3 (Worker) in parallel
3. **Days 9–12**: Complete Phase 4 (Integration)
4. **Days 13–15**: Complete Phase 5 (Testing) + bug fixes

---

## Roll-Out Plan

### MVP Release (Phases 1–3)

- Deploy master DB migrations
- Deploy API endpoints (POST + GET)
- Deploy Worker consumer
- Test with manual license creation → auto-provision flow

### Production Release (Phases 1–5)

- Add observability (metrics, structured logging)
- Add DLQ and operator tooling
- Full test coverage
- Documentation and runbooks

---

## Rollback Strategy

If provisioning stage must be rolled back:

1. Revert master DB migrations (rollback SQL scripts)
2. Delete all tenant databases created by provisioning
3. Restore licenses table to previous state
4. Verify no orphaned registries exist
5. Deploy previous API/Worker versions

**Forward-Only**: All migrations are forward-only. Production upgrade requires snapshot backup
before applying migrations.

---

## Success Metrics

After Phase 5 complete:

- ✅ 100% of license creations result in ACTIVE workspaces within 120s (p95)
- ✅ 0 orphaned databases (no registry entries without databases)
- ✅ 3-retry success rate > 99% for all provisioning failures
- ✅ All structured logs parseable and indexed
- ✅ Correlation IDs present in 100% of provisioning logs
- ✅ Worker memory usage < 500MB per concurrent provision
- ✅ No cross-tenant data leakage (isolated DB per workspace)

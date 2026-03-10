# Tasks Report — Step 4

**Stage**: STAGE_12_PROVISIONING_TRIGGER  
**Phase**: 02_PLATFORM_MMC  
**Branch**: 012-provisioning-trigger  
**Date**: 2026-02-24  
**Status**: ✅ **TASKS GENERATED**

---

## Executive Summary

Task decomposition complete. 82 atomic, dependency-ordered implementation tasks have been generated
and are ready for assignment to development team.

**Total Tasks**: 82  
**Parallelizable Tasks**: 28 [P]  
**Critical Path**: ~20 sequential tasks  
**Estimated Development Time**: 15-20 days (1 developer, full-time)  
**MVP Scope**: 35 tasks (Phases 1-3) → 10 days

---

## Task Breakdown by Phase

| Phase                 | Tasks  | [P]    | Duration       | Status           |
| --------------------- | ------ | ------ | -------------- | ---------------- |
| Phase 1: Setup        | 16     | 8      | 2-3 days       | Ready to execute |
| Phase 2: API Layer    | 18     | 7      | 3-4 days       | Ready to execute |
| Phase 3: Worker Layer | 22     | 8      | 5-7 days       | Ready to execute |
| Phase 4: Integration  | 14     | 3      | 2-3 days       | Ready to execute |
| Phase 5: Testing      | 12     | 2      | 2-3 days       | Ready to execute |
| **TOTAL**             | **82** | **28** | **15-20 days** | **Ready**        |

---

## Phase 1: Setup & Infrastructure (16 tasks)

Foundation layer: database schema, migrations, configuration, queue infrastructure.

**Key Deliverables**:

- ✅ Master DB: licenses table (with status, schema_version, product_version)
- ✅ Master DB: tenants_registry table (workspace registration tracking)
- ✅ Tenant DB baseline: roles, permissions, users, divisions, schema_versions
- ✅ Error code registry (15+ codes with HTTP mappings)
- ✅ Job queue structure (Redis schema, dedup logic)
- ✅ Configuration constants (timeouts, limits, retry policies)

**Parallelization**: 8/16 tasks can run concurrently (all basic migrations)

**Sequential Dependencies**:

1. Master DB migrations → Tenant DB baseline → Registry setup
2. Error codes → API contract implementation
3. Queue structure → Worker implementation

---

## Phase 2: API Layer (18 tasks)

License creation and status polling endpoints with full validation, rate limiting, and idempotency.

**Key Deliverables**:

- ✅ POST /v1/mmc/licenses endpoint (license creation with idempotency-key support)
- ✅ GET /v1/mmc/licenses/{license_id} endpoint (status polling)
- ✅ License validation middleware (status checks, 423/403/404 responses)
- ✅ Rate limiting middleware (100 req/min per service account)
- ✅ Request validators (workspace_slug, admin_email, product_id)
- ✅ Response contracts (200, 400, 401, 404, 409, 429, 500, 503 handlers)
- ✅ Idempotency key cache (Redis 24h TTL storage)
- ✅ Structured API logging (correlation_id, workspace_slug, event, error_code)

**Parallelization**: 7/18 tasks can run concurrently (validators, error handlers, middleware)

**Sequential Dependencies**:

1. Validators → Response handlers → Middleware
2. Middleware → Endpoint handlers
3. Endpoints → Integration with Worker

---

## Phase 3: Worker Layer (22 tasks)

Background provisioning processor: database creation, migrations, seed data, admin setup,
idempotency enforcement.

**Key Deliverables**:

- ✅ Job consumer (Redis queue listener, dequeue with retry)
- ✅ Distributed lock service (acquire provision:license:<id>, 30s TTL)
- ✅ Database provisioner (CREATE DATABASE workspace\_<slug>)
- ✅ Migration runner (execute baseline migrations with version tracking)
- ✅ Seed data service (hybrid baseline + tenant hooks per Q2:C clarification)
- ✅ Admin registration (placeholder creation, invite flow per Q3:D)
- ✅ Registry insertion (tenants_registry INSERT with foreign key checks)
- ✅ Status updater (license.status PENDING → ACTIVE or FAILED)
- ✅ Failure handler (rollback DB, mark PROVISION_FAILED, DLQ retry)
- ✅ Idempotency triple-check (status check → DB existence check → state validation)
- ✅ Exponential backoff retry (1s → 2s → 4s → max 3 attempts)
- ✅ Network resilience (60s reconnect backoff per Q1:C)
- ✅ Structured Worker logging (all events with correlation_id, license_id, stage)

**Parallelization**: 8/22 tasks can run concurrently (service implementations)

**Sequential Dependencies**:

1. Lock service → DB provisioner → Migration runner
2. Seed service → Admin registration
3. Status updater → Registry insertion
4. All services → Job consumer integration

---

## Phase 4: Integration (14 tasks)

API ↔ Worker coordination, observability, error handling, health checks.

**Key Deliverables**:

- ✅ API → Job enqueue bridging (POST /v1/mmc/licenses → Redis queue)
- ✅ Structured logging pipeline (application → stdout → centralized logging)
- ✅ Correlation ID propagation (API → logs → Worker → logs)
- ✅ Metrics instrumentation (counters, histograms, gauges)
- ✅ DLQ implementation (max 3 retries → dead-letter queue for operator)
- ✅ Health check endpoints (/{health, readiness, liveness})
- ✅ Error aggregation dashboard setup (DLQ monitoring, retry alerts)
- ✅ Idempotency cache consistency (Redis + DB fallback)
- ✅ Performance baseline testing (120s provision SLA validation)

**Parallelization**: 3/14 tasks can run concurrently (logging, metrics, health checks)

---

## Phase 5: Testing (12 tasks)

Comprehensive test coverage: unit, integration, end-to-end, performance.

**Key Deliverables**:

- ✅ Unit tests: Validators (workspace_slug, email, limits)
- ✅ Unit tests: Idempotency cache (24h TTL, dedup logic)
- ✅ Unit tests: Distributed lock (acquire/release, TTL expiry)
- ✅ Unit tests: Retry logic (exponential backoff, max attempts)
- ✅ Unit tests: Version enforcement (schema version validation)
- ✅ Integration tests: API → Worker end-to-end flow
- ✅ Integration tests: Concurrent provisioning (multiple simultaneous requests)
- ✅ Integration tests: Network partition recovery (Redis unavailable scenario)
- ✅ Integration tests: Idempotency replay (same Idempotency-Key, different payload)
- ✅ Integration tests: Failure scenarios (DB creation failure, migration failure, seed failure)
- ✅ End-to-end test: Full provisioning workflow (API request → polling → active workspace)
- ✅ Performance test: 120s provision time SLA validation

**Parallelization**: 2/12 tasks can run in parallel (unit test suites, integration test suites)

---

## Critical Path Analysis

**Fastest Route to MVP** (10 days):

1. T001–T016 (Phase 1 Setup) → 2-3 days
   - Master DB migrations (parallel)
   - Tenant baseline (parallel)
   - Error codes + queue (sequential dependency)

2. T017–T034 (Phase 2 API, partial) → 2-3 days
   - Validators + middleware (parallel)
   - Endpoints (sequential after middleware)

3. T035–T056 (Phase 3 Worker, partial) → 4-5 days
   - Lock service (foundation)
   - DB provisioner + migration runner (parallel)
   - Consumer integration (after services complete)

**Then**:

- T057–T070 (Phase 4, partial) → 1-2 days (health checks, basic observability)
- T071–T082 (Phase 5, partial) → 1-2 days (critical path tests)

**Total MVP**: ~10-11 days

**Production Hardening** (additional 5-10 days):

- Full Phase 4 integration
- Comprehensive Test Suite (Phase 5)
- Performance optimization
- Deployment automation

---

## Task Dependencies Graph

```
PHASE 1 (Setup) [16 tasks, 2-3d]
  ├─ Master DB migrations (4 parallel) ──→ Ready for API + Worker
  ├─ Tenant DB baseline (6 parallel)
  ├─ Error codes (1 sequential after migrations)
  ├─ Queue structure (1 sequential after error codes)
  └─ Config constants (4 parallel)

PHASE 2 (API) [18 tasks, 3-4d]
  ├─ Validators (3 parallel, needs config)
  ├─ Middleware (3 parallel, needs error codes)
  ├─ Endpoints (3 sequential after validators)
  ├─ Response handlers (8 parallel, needs error codes)
  └─ Logging (1 sequential after endpoints)

PHASE 3 (Worker) [22 tasks, 5-7d]
  ├─ Lock service (1 sequential, foundation)
  ├─ DB provisioner (2 parallel after lock)
  ├─ Seed service (2 parallel after migration runner)
  ├─ Consumer (1 sequential after all services)
  └─ Logging (2 parallel)

PHASE 4 (Integration) [14 tasks, 2-3d]
  ├─ API ↔ Job enqueue (1 sequential after Phase 2,3)
  ├─ Observability (3 parallel)
  ├─ DLQ (2 parallel)
  └─ Health checks (8 parallel)

PHASE 5 (Testing) [12 tasks, 2-3d]
  ├─ Unit tests (6 parallel after unit-testable components)
  ├─ Integration tests (4 parallel after Phases 2-3)
  └─ Performance tests (2 parallel after Phase 4)
```

---

## Task Execution Best Practices

### Start Conditions

✅ All Phase 1 tasks can start immediately (52/82 dependencies available)  
✅ Phase 2 can start after T001-T010 (master DB + error codes setup)  
✅ Phase 3 can start after T001-T015 (migrations + config complete)  
✅ Phase 4 requires Phases 2-3 complete  
✅ Phase 5 requires implementation tasks complete

### Team Assignment

- **Single Developer**: Follow critical path (18-20 tasks) sequentially; parallelize within phase
- **Pair**: Divide phases (Dev A: Phases 1-2; Dev B: Phases 3-4); meet on Phase 5 testing
- **Team**: Assign Phase 1 to infra specialist → Phases 2-3 parallel → Phase 4 to DevOps → Phase 5
  to QA

### Risk Mitigation

- ✅ Do Task T014 (network resilience) early if Redis infrastructure new
- ✅ Do Task T009 (idempotency triple-check logic) before any Worker code
- ✅ Do Phase 5 Unit tests (T071-T076) AFTER implementation, BEFORE integration tests
- ✅ Do Phase 5 Integration tests (T077-T080) BEFORE deployment

---

## Success Criteria Per Phase

### Phase 1 Complete ✓

- Master DB has licenses + tenants_registry tables
- Tenant baseline migrations run without errors
- Error codes registry contains 15+ codes
- Queue structure documented
- All configuration constants defined

### Phase 2 Complete ✓

- POST /v1/mmc/licenses accepts valid requests (200 OK)
- POST /v1/mmc/licenses rejects invalid slugs (400 Bad Request)
- POST /v1/mmc/licenses rate limits at 100 req/min (429)
- GET /v1/mmc/licenses/{license_id} returns PENDING_PROVISION status
- Idempotency-Key header caches responses (Idempotent-Replay: true)
- Logs contain correlation_id on every request

### Phase 3 Complete ✓

- Job consumer dequeues and processes jobs
- Distributed lock prevents concurrent provisioning
- Database workspace\_<slug> created successfully
- Baseline migrations applied to tenant DB
- Admin placeholder created
- License status updated to ACTIVE
- tenants_registry entry inserted
- Failures marked as PROVISION_FAILED, sent to DLQ

### Phase 4 Complete ✓

- API endpoint enqueues jobs successfully
- Correlation IDs propagated end-to-end
- Metrics recorded (counters, histograms)
- Health checks return 200 OK
- DLQ monitors failed provisioning

### Phase 5 Complete ✓

- All unit tests pass (>90% coverage on core logic)
- All integration tests pass (end-to-end scenarios)
- No test failures under load (concurrent requests)
- Performance baseline met (120s provision SLA)

---

## Next Steps

1. **Assign tasks** to developers based on availability and expertise
2. **Establish daily standup** focused on task completion and blockers
3. **Track progress** in tasks.md (mark tasks as [X] when complete)
4. **Run Phase 1 tests** after all database migrations complete
5. **Deploy MVP** after Phases 1-3 complete
6. **Harden for production** by completing Phases 4-5

---

## Key Files to Create

**Directory Structure**:

```
apps/api/src/
  routes/
    v1/
      mmc/
        licenses.ts        ← POST /v1/mmc/licenses
        [license_id].ts    ← GET /v1/mmc/licenses/{license_id}
  middleware/
    license-validation.ts  ← License status checks
    rate-limit.ts          ← 100 req/min enforcement
  validators/
    license-creation.ts    ← Workspace slug, email, limits
  services/
    idempotency-cache.ts   ← Redis 24h TTL
    license-service.ts     ← License CRUD

apps/worker/src/
  services/
    lock-service.ts        ← Distributed locking (Redis SETNX)
    db-provisioner.ts      ← Database creation
    migration-runner.ts    ← Baseline migrations
    seed-service.ts        ← Default data insertion
    admin-service.ts       ← Admin placeholder
    license-updater.ts     ← Status transitions
  consumers/
    provision-consumer.ts  ← Job queue listener
  handlers/
    provision-handler.ts   ← 13-step workflow

packages/
  domain-core/
    error-codes.ts         ← 15+ error mappings
    types.ts               ← License, provision job types
    logger.ts              ← Structured JSON logging
```

---

## Estimated Timeline

| Week | Milestone                           | Tasks     |
| ---- | ----------------------------------- | --------- |
| 1    | Setup complete (Phase 1)            | T001-T016 |
|      | API endpoints rough draft (Phase 2) | T017-T032 |
| 2    | API endpoints stable (Phase 2)      | T033-T034 |
|      | Worker logic complete (Phase 3)     | T035-T056 |
| 3    | Integration wired (Phase 4)         | T057-T070 |
|      | Tests passing (Phase 5)             | T071-T082 |
|      | Deployment ready                    | PR review |

---

## Monitoring & Observability Readiness

✅ Structured logging configured in all tasks  
✅ Correlation ID propagated through entire stack  
✅ Metrics collection ready (T065-T070)  
✅ DLQ for operator intervention (T068)  
✅ Health checks ready (T069-T070)  
✅ Performance baselines defined (T082)

---

**Total Tasks Generated**: 82  
**Estimated Effort**: 15-20 developer-days  
**MVP Delivery**: ~10 days (Phases 1-3)  
**Production Hardening**: ~5-10 days (Phases 4-5)

All tasks are ready for immediate execution. ✅

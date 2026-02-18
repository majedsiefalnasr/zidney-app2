# Tasks Report – STAGE_06_ATTEMPT_ENGINE_FOUNDATION

**Report Date:** 2026-02-18T00:00:00Z  
**Stage:** STAGE_06_ATTEMPT_ENGINE_FOUNDATION  
**Phase:** 01_PLATFORM_FOUNDATION  
**Status:** ✅ COMPLETE

---

## Overview

The task generation phase has broken down the technical plan into 72 atomic, independently reviewable, and sequentially dependent tasks. All tasks are scoped to individual layers with explicit transactional guarantees and constitutional compliance notations.

**Tasks File:** [tasks.md](tasks.md)  
**Total Tasks:** 72  
**Estimated Duration:** 27 days (parallelizable)

---

## Task Breakdown by Layer

### Phase A: Database & Schema (12 tasks — 5 days)

**T001-T012** — Foundation layer tasks:

1. T001 – Create PostgreSQL migration for attempts table
2. T002 – Create PostgreSQL migration for attempt_progress table
3. T003 – Create PostgreSQL migration for idempotency_keys table
4. T004 – Add indexes to attempts table (workspace_id, user_id, status, created_at)
5. T005 – Add UNIQUE constraint on (workspace_id, user_id, attempt_id) for idempotency
6. T006 – Add check constraints for attempt status enum
7. T007 – Create database types for JSON enums (snapshot, progress, result)
8. T008 – Create tenant connection pooling infrastructure in application
9. T009 – Create database seed scripts for test data
10. T010 – Validate schema version compatibility (backward compatibility tests)
11. T011 – Document database migration strategy
12. T012 – Setup database monitoring and query logging

**Dependencies:** None (Phase A has no dependencies)

**Success Criteria:**

- ✅ All migrations execute successfully on fresh database
- ✅ Schema version incremented correctly
- ✅ Indexes created and verified with EXPLAIN ANALYZE
- ✅ UNIQUE constraints enforced
- ✅ Connection pooling provides 5 connections per tenant

---

### Phase B: Middleware (9 tasks — 3 days)

**T013-T021** — Middleware and enforcement layer:

1. T013 – Create tenant resolver middleware (from subdomain/URL)
2. T014 – Create database connection selector middleware (per-tenant pool)
3. T015 – Create license validation middleware (required before all workspace routes)
4. T016 – Create correlation ID propagation middleware
5. T017 – Create structured logging infrastructure
6. T018 – Create idempotency key storage layer (PostgreSQL + Redis cache)
7. T019 – Create version compatibility checker middleware
8. T020 – Create error normalizer middleware (RFC 7807 responses)
9. T021 – Create middleware test suite

**Dependencies:** Phase A (database must exist)

**Success Criteria:**

- ✅ Tenant resolver extracts workspace from URL correctly
- ✅ License middleware blocks SOFT_LOCKED and ARCHIVED workspaces
- ✅ Correlation IDs propagate through all logs
- ✅ Idempotency keys prevent duplicate submissions
- ✅ All errors return RFC 7807 format

---

### Phase C: API – Create & Progress (6 tasks — 3 days)

**T022-T027** — Attempt creation and progress tracking:

1. T022 – Implement POST /attempts endpoint (creates attempt with snapshot)
2. T023 – Snapshot exam configuration at attempt start
3. T024 – Snapshot question list and order
4. T025 – Build snapshot validator (verifies snapshot integrity after creation)
5. T026 – Implement PATCH /attempts/:id/progress (idempotent progress updates)
6. T027 – Create integration tests for attempt creation and progress flow

**Dependencies:** Phase B (middleware required)

**Success Criteria:**

- ✅ Attempt created with all snapshots immutable
- ✅ Progress updates idempotent (duplicate submissions result in same state)
- ✅ Snapshots survive schema migration attempts
- ✅ Returns 201 CREATED with attempt ID
- ✅ Logging includes correlation ID and workspace_id

---

### Phase D: API – Submit & Grading (9 tasks — 4 days)

**D028-D036** — Submission and grading lifecycle:

1. T028 – Implement POST /attempts/:id/submit endpoint
2. T029 – Add pessimistic row locking (SELECT … FOR UPDATE, 5s timeout, 3 retries)
3. T030 – Validate submission arrives before time expiration
4. T031 – Implement idempotency for submission (prevent duplicate enqueue)
5. T032 – Implement submission to grading job enqueue (with 3 automatic retries)
6. T033 – Create Dead Letter Queue (DLQ) for failed job enqueues
7. T034 – Implement manual recovery flow for DLQ items
8. T035 – Implement result polling endpoint (GET /attempts/:id/result)
9. T036 – Create end-to-end submission tests with concurrency scenarios

**Dependencies:** Phase C (progress tracking must exist)

**Success Criteria:**

- ✅ Submission atomic with pessimistic lock
- ✅ Concurrent submissions on same attempt return 409 CONFLICT
- ✅ Failed job enqueue retries 3 times with exponential backoff (1s, 2s, 4s)
- ✅ After 3 retries, item moved to DLQ for manual recovery
- ✅ Submission idempotent (duplicate submissions don't re-enqueue)
- ✅ Result polling returns PROCESSING, then final result

---

### Phase E: Worker & Grading (7 tasks — 5 days)

**T037-T043** — Background grading pipeline:

1. T037 – Implement grading job consumer (dequeue from Redis)
2. T038 – Implement deterministic score computation (from snapshot, no live config)
3. T039 – Implement pass/fail logic (server-side, no client override)
4. T040 – Implement result persistence (UPDATE attempts SET result_snapshot, score)
5. T041 – Implement worker retry strategy (5 retries with exponential backoff)
6. T042 – Implement DLQ consumer (retry failed grades, escalate to manual)
7. T043 – Create worker unit and integration tests

**Dependencies:** Phase D (submission must exist)

**Success Criteria:**

- ✅ Grading uses snapshot configuration only (no live exam lookups)
- ✅ Score is deterministic (same submission → same score)
- ✅ Failed jobs retry 5 times before DLQ escalation
- ✅ Workers are idempotent (retrying doesn't double-grade)
- ✅ All grading errors logged with correlation ID

---

### Phase F: Testing & Observability (17 tasks — 5 days)

**T044-T060** — Comprehensive testing and monitoring:

**Unit Tests (T044-T048):**

- T044 – Unit tests for snapshot builder
- T045 – Unit tests for score computation logic
- T046 – Unit tests for version compatibility checker
- T047 – Unit tests for idempotency key logic
- T048 – Unit tests for middleware chain

**Integration Tests (T049-T054):**

- T049 – Integration test: full attempt lifecycle (create → progress → submit → grade)
- T050 – Integration test: concurrent submission handling (2 identical submissions)
- T051 – Integration test: timeout enforcement (attempt after time_limit exceeded)
- T052 – Integration test: license state transitions (SOFT_LOCKED during attempt)
- T053 – Integration test: schema version mismatch handling
- T054 – Integration test: worker retry and DLQ escalation

**Load & Concurrency Tests (T055-T058):**

- T055 – Concurrency test: 100 simultaneous submissions on same attempt → 1 graded, 99 conflicts
- T056 – Concurrency test: pessimistic lock timeout with 1000 lock contenders
- T057 – Load test: 10,000 attempts created in 1 minute
- T058 – Load test: Idempotency cache hit rate > 95%

**Snapshot Integrity Tests (T059-T060):**

- T059 – Snapshot immutability: verify snapshot unchanged after creation
- T060 – Snapshot upgrade safety: verify snapshot survives schema version increment

**Success Criteria:**

- ✅ All unit tests pass (>95% code coverage)
- ✅ All integration tests pass consecutively 5x
- ✅ Load tests complete without 503 errors
- ✅ Concurrency tests detect race conditions (if any)
- ✅ Snapshot tests verify upgrade safety
- ✅ All logs include correlation IDs

---

### Phase G: Documentation & Sign-Off (12 tasks — 2 days)

**T061-T072** — Final validation and documentation:

1. T061 – Create operational runbook (deployment, monitoring, troubleshooting)
2. T062 – Create database backup and recovery procedure
3. T063 – Create DLQ manual recovery procedure
4. T064 – Document idempotency guarantee semantics
5. T065 – Document version compatibility matrix
6. T066 – Create audit trail documentation
7. T067 – Security review: verify no client-side scoring
8. T068 – Security review: verify tenant isolation
9. T069 – Performance review: verify lock contention acceptable at load
10. T070 – Constitutional compliance audit (ADR-0001 through ADR-0008)
11. T071 – Create production readiness checklist
12. T072 – Final sign-off: stage marked PRODUCTION_READY

**Dependencies:** Phase F (all tests must pass)

**Success Criteria:**

- ✅ Operational runbook complete and reviewed
- ✅ Constitutional compliance audit 100% pass
- ✅ Production readiness checklist all items complete
- ✅ No security violations identified
- ✅ Performance meets SLAs (p99 submission latency < 500ms)

---

## Transaction & Idempotency Summary

| Task            | Transactional | Idempotency                                       | Middleware                        |
| --------------- | ------------- | ------------------------------------------------- | --------------------------------- |
| T022 (Create)   | YES           | Idempotency key checksum                          | License + Tenant                  |
| T026 (Progress) | NO            | Sequence number + timestamp                       | License + Tenant + Correlation ID |
| T028 (Submit)   | YES           | Pessimistic lock (5s timeout, 3 retries)          | License + Tenant + Idempotency    |
| T037 (Grade)    | YES           | Attempt snapshot version + worker idempotency key | Worker credentials                |
| T042 (DLQ)      | YES           | Max 5 retries with exponential backoff            | Worker credentials                |

---

## Dependency Graph

```
Phase A (Database) [5d]
└── Phase B (Middleware) [3d]
    └── Phase C (Create & Progress) [3d]
        └── Phase D (Submit & Grading) [4d]
            └── Phase E (Worker) [5d]
                └── Phase F (Testing) [5d]
                    └── Phase G (Documentation) [2d]
```

**Critical Path:** 27 days sequential (parallelizable in weeks 1-2)

**Parallelization Opportunities:**

- Week 1: Phase A + Phase B in parallel (5 days)
- Week 2: Phase C + Phase D in parallel (4 days)
- Week 3: Phase E (5 days)
- Week 4: Phase F + Phase G in parallel (5 days)

**Realistic Timeline:** 4 weeks with full team

---

## Constitutional Compliance Summary

All 72 tasks enforce:

✅ **ADR-0001** – Database-per-tenant (connection pooling, tenant resolver)  
✅ **ADR-0002** – Snapshot immutability (immutable_at, no live config lookups)  
✅ **ADR-0003** – White-label visual only (no UI customization in grading logic)  
✅ **ADR-0004** – Single runtime engine (unified attempts table)  
✅ **ADR-0005** – Upgrade opt-in (schema_version tracking, version compatibility matrix)  
✅ **ADR-0006** – Server-authoritative time (server_start_time, no client timers)  
✅ **ADR-0007** – Product version compatibility (version checks at create + submit + grade)  
✅ **ADR-0008** – Semantic versioning (schema_version incremented per migration)

---

## Risk Mitigation

| Risk                           | Mitigation                                                            |
| ------------------------------ | --------------------------------------------------------------------- |
| Concurrency race conditions    | Pessimistic locking (T029), concurrency tests (T055)                  |
| Snapshot corruption on upgrade | Version compatibility matrix (T010), upgrade tests (T060)             |
| Duplicate grading              | Idempotency keys (T018), submission retries with deduplication (T032) |
| License bypass                 | License middleware (T015), license enforcement tests (T052)           |
| Cross-tenant data leak         | Tenant resolver (T013), isolation tests (T054)                        |
| Worker failures                | Retry strategy (5 retries) + DLQ (T033, T042)                         |

---

## Next Steps

**Step 5: Architectural Drift Analysis** — All 72 tasks will be analyzed for:

1. Isolation violations
2. License middleware bypass
3. Snapshot integrity breaks
4. Missing transactions
5. Missing idempotency guards
6. Version enforcement gaps
7. Authority violations (API vs Worker)
8. Logging deficiencies
9. Security vulnerabilities

If drift analysis passes, implementation is automatically authorized.

---

**Report Status:** ✅ COMPLETE  
**Action:** Proceeding to Step 5 – Analyze (Drift Detection)

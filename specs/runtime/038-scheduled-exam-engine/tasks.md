# Tasks: Scheduled Exam Engine

**Stage:** STAGE_38 — Scheduled Exam Engine
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE
**Total Tasks:** 40
**Generated:** 2026-04-01
**Spec:** `specs/runtime/038-scheduled-exam-engine/spec.md`
**Plan:** `specs/runtime/038-scheduled-exam-engine/plan.md`
**Data Model:** `specs/runtime/038-scheduled-exam-engine/data-model.md`

---

## Dependency Chain

```
T001 (migration 016) ──┐
T002 (migration 017) ──┤──► T003/T004 (Drizzle schemas) ──► T005 (schema index)
                        │
T003/T004/T005 ─────────┼──► T006–T009 (domain types/pure fns) [parallel]
                        │       └──► T010 (workflow) ──► T011 (repository) ──► T012 (service) ──► T013 (barrel)
T014 (validation) ──────┤              (parallel w/ T006-T009)
                        │
T013 + T014 ────────────┼──► T015 (helpers) ──► T016–T025 (handlers) [parallel] ──► T026 (router)
                        │
T027 (job-queue) ───────┼──► T028 (worker handler) ──► T029 (dispatcher) ──► T030 (queue reg)
                        │
All impl (T001–T030) ───┼──► T031–T036 (tests)
                        │
T031–T036 ──────────────┴──► T037–T039 (validation/governance)
```

---

## Phase P0 — Database Migrations + Drizzle Schema

> **Rule:** All migrations before any code that references the schema.
> **Note:** T003 and T004 are parallel (different files) but both depend on T001 + T002 settling the DDL contract.

- [ ] T001 Create two-phase migration (table DDL in tx + CONCURRENT unique index outside tx) — `apps/api/src/db/tenant/migrations/20260402_016_create_scheduled_exams.ts`
- [ ] T002 Create single-phase migration (ALTER TABLE attempts, 6 new columns + 3 partial indexes) — `apps/api/src/db/tenant/migrations/20260402_017_add_scheduled_fields_to_attempts.ts`
- [ ] T003 [P] Create Drizzle table definition (scheduledExams pgTable, all 20 columns, 5 B-tree indexes, 4 CHECK constraints, ScheduledExam + NewScheduledExam types) — `apps/api/src/db/tenant/schemas/scheduled-exams.schema.ts`
- [ ] T004 [P] Add 6 new Drizzle columns to attempts table (is_scheduled, scheduled_exam_id, scheduled_end_time, auto_submitted, forced_submission_reason, last_heartbeat_at) — `apps/api/src/db/tenant/schemas/attempts.schema.ts`
- [ ] T005 Export scheduledExams, ScheduledExam, NewScheduledExam from Drizzle schema barrel — `apps/api/src/db/tenant/schemas/index.ts`

---

## Phase P1 — Domain Core

> **Package:** `packages/domain-core/src/scheduled-exam/`
> **Rule:** Pure functions only — no HTTP, no Drizzle, no env vars. All accept DbClient as first param.
> **Note:** T006–T009 are leaf files with no intra-module dependencies and can be authored in parallel.

- [ ] T006 [P] [US1] Define all TypeScript types (ScheduledExamRow, CreateScheduledExamInput, UpdateScheduledExamInput, ListScheduledExamsInput, AttemptStartResult, HeartbeatResult, SubmitResult, DbClient, AuditContext, ScheduledExamStatus, ScheduledExamType, ForcedSubmissionReason) — `packages/domain-core/src/scheduled-exam/scheduled-exam.types.ts`
- [ ] T007 [P] Define error class (ScheduledExamError) and SCHEDULED_EXAM_ERROR_CODES const (14 codes) — `packages/domain-core/src/scheduled-exam/scheduled-exam.errors.ts`
- [ ] T008 [P] [US8] Implement SHA-256 base exam snapshot hash (MCQ_HASH_FIELDS, TRADITIONAL_HASH_FIELDS constants + computeBaseExamHash function; Clarification Q1) — `packages/domain-core/src/scheduled-exam/scheduled-exam-hash.ts`
- [ ] T009 [P] [US3] Implement pure time gate functions (isWindowOpen, isBeforeWindow, isAfterWindow, computeAttemptEndTime, isAttemptExpired, isConnectionTimedOut, computeRemainingSeconds) — `packages/domain-core/src/scheduled-exam/scheduled-exam-time.ts`
- [ ] T010 [US2] Implement pure workflow transition rules (canTransitionToEnabled, getImmutableFields, isFieldMutable) — `packages/domain-core/src/scheduled-exam/scheduled-exam-workflow.ts`
- [ ] T011 [US1] Implement all repository functions (findById, findByCode, findAll, countAll, countAttempts, insert, update, softDelete, updateWorkflowStatus, setBaseExamModified, findApprovedByBaseExamId, findEnabledByBaseExamId) — `packages/domain-core/src/scheduled-exam/scheduled-exam.repository.ts`
- [ ] T012 [US1] Implement service orchestration (createScheduledExam, updateScheduledExam, deleteScheduledExam, enableScheduledExam, reApproveScheduledExam, startScheduledAttempt with advisory lock per Clarification Q3, recordHeartbeat with BullMQ enqueue, submitAttempt with idempotency, notifyBaseExamModified) — `packages/domain-core/src/scheduled-exam/scheduled-exam.service.ts`
- [ ] T013 Create module barrel export (re-exports from all 7 sibling files) — `packages/domain-core/src/scheduled-exam/index.ts`

---

## Phase P2 — API Layer

> **Directory:** `apps/api/src/routes/backoffice/scheduled-exams/`
> **Rule:** Validation schemas before helpers; helpers before handlers; handlers before router.
> **Validation schema (T014) is independent of API layer — can be authored in parallel with T006–T013.**

- [ ] T014 [P] Define Zod validation schemas (createScheduledExamSchema, updateScheduledExamSchema, listScheduledExamsQuerySchema, workflowTransitionSchema) — `packages/validation/src/backoffice/scheduled-exams.schemas.ts`
- [ ] T015 Create route helpers following mcq-exams pattern (getDb, buildAuditCtx, successResponse, scheduledExamErrorResponse with full error-code-to-HTTP-status mapping) — `apps/api/src/routes/backoffice/scheduled-exams/helpers.ts`
- [ ] T016 [P] [US1] POST handler — validate body, call createScheduledExam(), return 201 — `apps/api/src/routes/backoffice/scheduled-exams/create-scheduled-exam.ts`
- [ ] T017 [P] [US7] GET handler — validate query params, call findAll() + countAll(), return 200 with pagination envelope — `apps/api/src/routes/backoffice/scheduled-exams/list-scheduled-exams.ts`
- [ ] T018 [P] [US7] GET/:id handler — call findById() + countAttempts(), return 200 with attempts_count, 404 if not found — `apps/api/src/routes/backoffice/scheduled-exams/get-scheduled-exam.ts`
- [ ] T019 [P] [US7] PATCH/:id handler — validate body, call updateScheduledExam(), map FIELD_IMMUTABLE + HAS_ATTEMPTS to 409 — `apps/api/src/routes/backoffice/scheduled-exams/update-scheduled-exam.ts`
- [ ] T020 [P] [US7] DELETE/:id handler — call deleteScheduledExam(), guard: no attempts + not ENABLED, return 204 — `apps/api/src/routes/backoffice/scheduled-exams/delete-scheduled-exam.ts`
- [ ] T021 [P] [US2] POST/:id/workflow handler — body: { action: 'ENABLE' }, call enableScheduledExam(), record snapshot hash on transition, return 200 — `apps/api/src/routes/backoffice/scheduled-exams/workflow-transition.ts`
- [ ] T022 [P] [US8] POST/:id/re-approve handler — call reApproveScheduledExam(), precondition APPROVED + base_exam_modified=true, return 200 — `apps/api/src/routes/backoffice/scheduled-exams/re-approve.ts`
- [ ] T023 [P] [US3] POST/:id/attempts handler (studentGuard) — call startScheduledAttempt() with advisory lock (Clarification Q3), return 201 with remaining_seconds; validation order: JWT → STUDENT role → ENABLED status → time gate → single-attempt — `apps/api/src/routes/backoffice/scheduled-exams/start-attempt.ts`
- [ ] T024 [P] [US4] POST/attempts/:attemptId/heartbeat handler (studentGuard) — validate ownership + not submitted, update last_heartbeat_at=NOW(), enqueue BullMQ dedup job on time expiry (Clarification Q2), return 200 with remaining_seconds — `apps/api/src/routes/backoffice/scheduled-exams/heartbeat.ts`
- [ ] T025 [P] [US3] POST/attempts/:attemptId/submit handler (studentGuard) — idempotent submit, late-submission returns HTTP 200 with auto_submitted=true (Clarification Q4), return 200 — `apps/api/src/routes/backoffice/scheduled-exams/submit-attempt.ts`
- [ ] T026 Create router factory (createScheduledExamsRouter — 10 routes in static-before-parameterised order, readGuard + writeGuard + studentGuard applied per route) — `apps/api/src/routes/backoffice/scheduled-exams/index.ts`
- [ ] T040 Register scheduled-exams router in app.ts under `/api/v1/backoffice/workspace` mount point to ensure tenant → licenseEnforcementMiddleware → auth chain is applied to all 10 routes (drift analysis remediation C2/A1) — `apps/api/src/app.ts`

---

## Phase P3 — Job Queue Package

> **Rule:** Job type definitions in packages/job-queue must land before worker files that reference them.

- [ ] T027 [US5] Add AutoSubmitScheduledAttemptJob and ScheduledExamDispatcherJob interfaces to existing job schema file — `packages/job-queue/src/job-schema.ts`

---

## Phase P4 — Worker Layer

> **Rule:** Worker handler and dispatcher files after job-queue types (T027). Queue registration after both job files.

- [ ] T028 [US5] Create per-attempt auto-submit job handler (Redis lock auto_submit_lock:{attemptId} TTL 60s → tx SELECT FOR UPDATE re-check → determine forced_submission_reason priority → UPDATE attempts SET auto_submitted=true + status=SUBMITTED + submitted_at=NOW() → COMMIT → release lock → WARN log) — `apps/worker/src/jobs/auto-submit-scheduled-attempt.ts`
- [ ] T029 [US5] Create tenant dispatcher job handler (query master DB for active tenant slugs with open scheduled exam windows → per-tenant: query active scheduled attempts meeting force-submit conditions → enqueue auto-submit BullMQ jobs with jobId auto_submit:{attemptId} dedup; Clarification Q2) — `apps/worker/src/jobs/scheduled-exam-dispatcher.ts`
- [ ] T030 [US5] Register auto-submit-scheduled-attempt processor and scheduled-exam-dispatcher as repeatable job (every 30s) in worker queue infrastructure — `apps/worker/src/queue.ts`

---

## Phase P5 — Tests

> **Rule:** All implementation files (T001–T030) must exist before writing tests against them.
> **Parallel groups:** T031–T033 (unit) and T036 (migration) can run in parallel with T034 (integration) and T035 (worker).

- [ ] T031 [P] Unit tests — hash function stability: known input → known SHA-256 output, MCQ vs TRADITIONAL field list divergence, updated_at change → different hash, missing field → deterministic behaviour — `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-hash.test.ts`
- [ ] T032 [P] Unit tests — time gate functions: isBeforeWindow/isAfterWindow at boundaries, computeAttemptEndTime MIN logic (with duration, without duration, duration past window), isConnectionTimedOut 25s→false/35s→true, computeRemainingSeconds negative→0 — `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-time.test.ts`
- [ ] T033 [P] Unit tests — workflow rules: canTransitionToEnabled all blocked paths (not ENABLED, archived, base_exam_modified), getImmutableFields per status×attempt-count matrix — `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-workflow.test.ts`
- [ ] T034 Integration tests — 30+ API scenarios: create (201/422 BASE_EXAM_NOT_ENABLED/409 CODE_CONFLICT/422 INVALID_TIME_WINDOW), update (200/409 FIELD_IMMUTABLE/409 HAS_ATTEMPTS), delete (204/409), workflow (200/422), re-approve (200/422), start-attempt (201 with remaining_seconds/403 NOT_STARTED/403 CLOSED/403 ALREADY_ATTEMPTED), heartbeat (200/410), submit (200 always including late path with auto_submitted:true), tenant isolation (cross-tenant attempt → 404) — `apps/api/src/modules/backoffice/scheduled-exams/__tests__/scheduled-exams.integration.test.ts`
- [ ] T035 [P] Worker tests — auto-submit: expired attempt → submitted with correct reason, already-submitted → idempotent skip, lock acquisition failure → skip, concurrent workers → single commit, ROLLBACK on failure → attempt remains active for next cycle — `apps/worker/src/jobs/__tests__/auto-submit-scheduled-attempt.test.ts`
- [ ] T036 [P] Migration tests — migration 016 up: scheduled_exams created + unique code index enforced; migration 017 up: 6 new attempts columns + 3 partial indexes; re-run both migrations → idempotent (IF NOT EXISTS) — `apps/api/src/db/tenant/migrations/__tests__/scheduled-exam-migrations.test.ts`

---

## Phase P6 — Validation & Governance

> **Rule:** All tests must pass before running governance checks.

- [ ] T037 Run TypeScript typecheck — all new files compile without errors; DbClient type consistent between domain-core and API handlers; no implicit any — `rtk tsc --noEmit -p tsconfig.json`
- [ ] T038 Run lint — no Biome errors or warnings on any new or modified file — `rtk lint`
- [ ] T039 Run architecture guard and audit — import boundary violations = 0; migration sequence 014→015→016→017 confirmed sequential; all new modules registered in architecture map — `bun run ai:guard && bun run arch:audit`

---

## Summary

| Phase                    | Tasks  | T-Range   | Key Deliverables                                                                      |
| ------------------------ | ------ | --------- | ------------------------------------------------------------------------------------- |
| P0: Migrations + Drizzle | 5      | T001–T005 | 2 migration files, new Drizzle schema, attempts schema update, schema index           |
| P1: Domain Core          | 8      | T006–T013 | 8 files: types, errors, hash, time, workflow, repository, service, barrel             |
| P2: API Layer            | 13     | T014–T026 | Zod schemas, helpers, 10 route handlers, router factory                               |
| P3: Job Queue            | 1      | T027      | 2 new job type interfaces in job-schema.ts                                            |
| P4: Worker               | 3      | T028–T030 | auto-submit handler, dispatcher, queue registration                                   |
| P5: Tests                | 6      | T031–T036 | ~65 test scenarios: 3 unit suites, 1 integration suite, worker suite, migration suite |
| P6: Validation           | 3      | T037–T039 | typecheck, lint, arch:audit                                                           |
| **Total**                | **39** | T001–T039 | —                                                                                     |

---

## Parallel Groups

| Group                   | Task IDs                                                   | Parallel Condition                                                |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Drizzle schemas         | T003, T004                                                 | Both depend on T001+T002; independent of each other               |
| Domain leaf files       | T006, T007, T008, T009                                     | No intra-module deps; all pure files                              |
| Validation schema       | T014                                                       | Independent of API layer; only requires knowledge of input shapes |
| API handlers            | T016, T017, T018, T019, T020, T021, T022, T023, T024, T025 | All depend on T013+T015; independent of each other                |
| Unit test suites        | T031, T032, T033                                           | Each tests a single pure-function file                            |
| Parallel test/migration | T031–T033, T036                                            | Can run simultaneously with T034 (integration) and T035 (worker)  |

---

## Deviations from plan.md

| #             | Deviation                                                                                          | Reason                                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1             | plan.md P0 = 3 tasks; this file = 5 tasks for P0                                                   | plan.md P0-3 (Drizzle schema updates) touches 3 files (new schema, update attempts schema, update index). Split into T003/T004/T005 per atomic-task rule ("one file per task where possible").                                                    |
| 2             | Validation schemas added as standalone T014                                                        | plan.md describes `packages/validation/src/backoffice/scheduled-exams.schemas.ts` in the P2 narrative but does not assign it a P2-N task number. Adding as T014 satisfies the atomic-task rule and ensures the schema file has an explicit owner. |
| 3             | plan.md groups P3 (worker) before P4 (job-queue); this file swaps order to P3=job-queue, P4=worker | Worker imports job type interfaces from `packages/job-queue`. Correct dependency ordering requires job-queue types (T027) before worker handlers (T028–T030). No functional change — only ordering in this file.                                  |
| 4             | T040 added: `app.ts` route registration                                                            | Drift analysis (C2/A1) identified that no task covered mounting the router in `app.ts` under `/api/v1/backoffice/workspace`. Without this, all 10 routes are unreachable. T040 added as required remediation.                                     |
| **Net delta** | **+4 tasks (36 → 40)**                                                                             | All additions are atomic decompositions or gap-fills of existing plan tasks; no new features introduced.                                                                                                                                          |

---

## Risk Overview

| Risk Level | Count | Task IDs                                                                                                   |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| HIGH       | 7     | T001, T002, T011, T012, T023, T028, T029                                                                   |
| MEDIUM     | 15    | T003, T004, T005, T010, T014, T016–T022, T025, T030, T034                                                  |
| LOW        | 18    | T006, T007, T008, T009, T013, T015, T024, T026, T027, T031, T032, T033, T035, T036, T037, T038, T039, T040 |

**HIGH risk rationale:**

- T001/T002: Forward-only schema migrations — irreversible; 015→016→017 sequence must be verified.
- T011: Repository contains raw advisory-lock SQL (`pg_try_advisory_xact_lock`) and complex partial-index queries.
- T012: Service orchestrates 9 functions across transactions, advisory locks, BullMQ enqueue, and snapshot computation.
- T023: Start-attempt handler implements the race-condition-safe single-attempt guard (Clarification Q3) and time gate.
- T028: Auto-submit worker uses distributed Redis lock + inner transaction re-check to prevent double-submission under concurrency.
- T029: Dispatcher iterates across ALL active tenants; a query error in one must not abort the entire dispatcher cycle.

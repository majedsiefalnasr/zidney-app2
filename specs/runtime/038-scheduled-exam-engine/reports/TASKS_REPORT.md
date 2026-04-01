# Tasks Report — Scheduled Exam Engine

**Step:** 4 — Tasks
**Timestamp:** 2026-04-01T00:45:00Z
**Status:** COMPLETE

---

## Summary

39 atomic tasks generated across 7 phases (P0–P6) for the Scheduled Exam Engine. Tasks are
dependency-ordered: migrations first, then domain layer, API layer, worker layer, job-queue package
extensions, tests, and finally validation/governance tasks. Three tasks were added beyond the 36
in plan.md to enforce the atomic-task rule (one file per task) and to assign an explicit task for
the validation schema file that was referenced but unassigned in plan.md. TASKS_TOTAL = 39.

---

## Inputs Reviewed

- `specs/runtime/038-scheduled-exam-engine/spec.md` (1389 lines, includes 5 clarifications)
- `specs/runtime/038-scheduled-exam-engine/plan.md` (825 lines, 36 planned tasks)
- `specs/runtime/038-scheduled-exam-engine/data-model.md` (278 lines)
- `specs/runtime/038-scheduled-exam-engine/research.md` (297 lines)

---

## Task Breakdown

| Category              | Count  | Task IDs  | Notes                                         |
| --------------------- | ------ | --------- | --------------------------------------------- |
| Database Migrations   | 2      | T001–T002 | Migration 016 (new table) + 017 (alter)       |
| Drizzle Schema        | 3      | T003–T005 | Two schema files + barrel index               |
| Domain Types          | 4      | T006–T009 | Pure types, errors, constants, pure fns       |
| Domain Workflow Rules | 1      | T010      | Temporal + state rules                        |
| Repository            | 1      | T011      | Drizzle queries + advisory lock SQL           |
| Domain Service        | 1      | T012      | Orchestration: snapshot, lock, BullMQ enqueue |
| Validation Schemas    | 2      | T013–T014 | Barrel + Zod schemas for all 10 endpoints     |
| API Helpers           | 1      | T015      | Snapshot helper                               |
| API Handlers          | 10     | T016–T025 | One handler file per endpoint                 |
| API Router            | 1      | T026      | Route registration                            |
| Job Queue Extension   | 1      | T027      | BullMQ job type + schema                      |
| Worker Processor      | 1      | T028      | Auto-submit handler (idempotent)              |
| Worker Dispatcher     | 1      | T029      | Per-tenant queue routing                      |
| Worker Registration   | 1      | T030      | Register processor in worker entrypoint       |
| Unit Tests            | 3      | T031–T033 | Domain pure functions, service, validation    |
| Integration Tests     | 3      | T034–T036 | API endpoints, worker, migration              |
| Validation/Governance | 3      | T037–T039 | typecheck, lint, arch:audit                   |
| **Total**             | **39** |           |                                               |

---

## Parallel Task Groups

| Group                | Task IDs   | Notes                                      |
| -------------------- | ---------- | ------------------------------------------ |
| Drizzle schema files | T003, T004 | Both import from migrations, no intra-deps |
| Domain leaf files    | T006–T009  | Pure (types, errors, constants, pure-fns)  |
| Validation schema    | T014       | Independent of API handler files           |
| API handlers         | T016–T025  | All import from shared helpers/service     |
| Unit tests           | T031–T033  | Independent test suites                    |

---

## Transactional Tasks

- **T001** — Migration 016: `CREATE TABLE scheduled_exams` — DDL transaction
- **T002** — Migration 017: `ALTER TABLE attempts` — DDL transaction
- **T011** — Repository: all write operations wrapped in Drizzle transactions
- **T012** — Domain service: `startAttempt` orchestrates advisory lock + snapshot + BullMQ enqueue in a single DB transaction; `submitAttempt` atomically marks attempt complete
- **T023** — Start-attempt handler: advisory lock acquired inside transaction to prevent phantom reads (`pg_try_advisory_xact_lock`)
- **T028** — Worker processor: idempotent auto-submit wrapped in DB transaction

---

## Idempotency Tasks

- **T023** — Start-attempt: advisory lock prevents duplicate in-progress attempts per `userId:scheduledExamId`
- **T024** — Heartbeat: BullMQ enqueue with dedup ID `auto_submit:{attemptId}` — repeated calls upsert same job (no duplicate processing)
- **T028** — Worker processor: checks `submitted_at IS NULL` before auto-submitting (safe re-delivery)
- **T029** — Worker dispatcher: per-tenant queue creation is idempotent (BullMQ `Queue` is reused)

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                     |
| ------- | --------- | --------------------------------------------------------------- |
| T001    | 🔴 HIGH   | Migration 016: `CREATE TABLE scheduled_exams` (18 cols, 6 idx)  |
| T002    | 🔴 HIGH   | Migration 017: `ALTER TABLE attempts` (6 cols, 3 partial idx)   |
| T011    | 🔴 HIGH   | Repository: advisory lock raw SQL + multi-tenant isolation      |
| T012    | 🔴 HIGH   | Domain service: snapshot hash, lock, BullMQ enqueue transaction |
| T023    | 🔴 HIGH   | Start-attempt handler: advisory lock + snapshot binding         |
| T028    | 🔴 HIGH   | Worker processor: auto-submit (idempotent, server-time gate)    |
| T029    | 🔴 HIGH   | Worker dispatcher: per-tenant BullMQ queue routing              |
| T003    | 🟡 MEDIUM | Drizzle schema: `scheduled_exams` pgTable definition            |
| T004    | 🟡 MEDIUM | Drizzle schema: `attempts` table extension                      |
| T010    | 🟡 MEDIUM | Domain workflow rules: temporal + state machine                 |
| T013    | 🟡 MEDIUM | Barrel: domain exports (affects tree-shaking)                   |
| T014    | 🟡 MEDIUM | Validation schemas: Zod for all 10 endpoints                    |
| T016    | 🟡 MEDIUM | Handler: create scheduled exam (backoffice)                     |
| T017    | 🟡 MEDIUM | Handler: list scheduled exams (backoffice)                      |
| T018    | 🟡 MEDIUM | Handler: get scheduled exam by ID (backoffice)                  |
| T019    | 🟡 MEDIUM | Handler: update scheduled exam (backoffice)                     |
| T020    | 🟡 MEDIUM | Handler: delete scheduled exam (backoffice)                     |
| T021    | 🟡 MEDIUM | Handler: publish scheduled exam (backoffice)                    |
| T022    | 🟡 MEDIUM | Handler: lookup by code (frontoffice)                           |
| T030    | 🟡 MEDIUM | Register auto-submit processor in worker entrypoint             |
| T034    | 🟡 MEDIUM | Integration tests: API endpoints (tenant isolation)             |
| T035    | 🟡 MEDIUM | Integration tests: worker auto-submit job                       |

---

## Tasks with External Dependencies

| Task ID | Package     | Version Note                                           |
| ------- | ----------- | ------------------------------------------------------ |
| T003    | drizzle-orm | `pgTable`, `text`, `integer`, `timestamp` — v0.30+     |
| T011    | drizzle-orm | `db.execute(sql\`...\`)` for advisory lock raw SQL     |
| T024    | bullmq      | `Queue.add()` with `{ jobId: dedup-id }` option        |
| T028    | bullmq      | `Worker` + `Job` types, `opts.jobId` for deduplication |

---

## High-Downstream-Impact Tasks

These tasks modify modules with HIGH dependency centrality:

| Task ID | Module                     | Centrality | Description                                    |
| ------- | -------------------------- | ---------- | ---------------------------------------------- |
| T002    | apps/api/src/db (attempts) | HIGH       | Alters `attempts` table used by all exam flows |
| T012    | packages/domain-core       | HIGH       | New service in core domain package             |
| T026    | apps/api (route registry)  | HIGH       | Registers 10 new routes                        |
| T030    | apps/worker (entrypoint)   | HIGH       | Adds new processor to worker startup           |

---

## Architecture Governance Compliance

| Check                                        | Status | Notes                                                         |
| -------------------------------------------- | ------ | ------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T001, T002, T011, T012, T023, T028 all transactional          |
| Idempotency tasks are defined where required | ✅     | T023 (advisory lock), T024 (BullMQ dedup), T028 (guard)       |
| Layer boundary rules are respected           | ✅     | packages/_ → domain logic; apps/_ → routing/handlers only     |
| No unrelated file modifications planned      | ✅     | All 39 tasks touch only stage-scoped files                    |
| Migration tasks included when required       | ✅     | T001 (migration 016) + T002 (migration 017)                   |
| Trust chain respected                        | ✅     | tenant → license → auth → handler middleware order maintained |
| ADR-0001 (DB-per-tenant) enforced            | ✅     | No cross-tenant queries; tenant context threaded through      |
| ADR-0002 (snapshot integrity) enforced       | ✅     | T012 snapshots config + snapshot hash at attempt start        |
| ADR-0006 (server-authoritative time)         | ✅     | T012, T023, T028 use `new Date()` server-side only            |

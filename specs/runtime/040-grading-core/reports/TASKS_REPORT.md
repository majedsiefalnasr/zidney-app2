# Tasks Report — Grading Core

**Step:** 4 — Tasks  
**Timestamp:** 2026-04-02T00:04:00.000Z  
**Status:** COMPLETE

---

## Summary

19 atomic tasks generated covering all 9 implementation phases: schema definitions (4 tasks), migration (1 task), types and errors (2 parallel tasks), pure grader functions (3 parallel tasks), repository layer (1 task), engine orchestrator (1 task), barrel exports (2 tasks), and unit + integration tests (4 tasks). No API endpoints or frontend changes. Pure backend domain-layer implementation.

---

## Inputs Reviewed

- `specs/runtime/040-grading-core/spec.md`
- `specs/runtime/040-grading-core/plan.md`
- `specs/runtime/040-grading-core/data-model.md`

---

## Task Breakdown

| Category         | Count  | Notes                                                                  |
| ---------------- | ------ | ---------------------------------------------------------------------- |
| Infrastructure   | 5      | T001–T005: 3 new schemas + modify attempts + index barrel              |
| Migration        | 1      | T006: single forward-only migration                                    |
| Types & Errors   | 2      | T007–T008: parallel type/error definitions                             |
| Pure Logic       | 3      | T009–T011: mcq-grader, traditional-grader, score-aggregator (parallel) |
| Repository       | 1      | T012: DB access layer                                                  |
| Engine           | 1      | T013: orchestrator gradeAttempt()                                      |
| Barrel Exports   | 2      | T014–T015: module index files                                          |
| Unit Tests       | 3      | T016–T018: parallel unit tests                                         |
| Integration Test | 1      | T019: grading-engine integration test                                  |
| **Total**        | **19** |                                                                        |

---

## Transactional Tasks

- T012 (grading.repository.ts) — all operations scoped to a provided `tx` handle; single transaction wraps entire grading flow
- T013 (grading-engine.ts) — orchestrates the full 13-step transaction; any failure triggers full rollback
- T006 (migration) — all DDL in single `BEGIN/COMMIT` block; additive-only

---

## Idempotency Tasks

- T013 (grading-engine.ts) — grading_status check before computation; returns existing result on re-invocation
- T001 (grading-results.schema.ts) — UNIQUE(attempt_id) constraint at DB level prevents duplicate rows
- T002 (grading-question-results.schema.ts) — UNIQUE(attempt_id, question_id) prevents duplicate question rows

---

## Parallel Execution Groups

| Group      | Tasks            | Can Run After   |
| ---------- | ---------------- | --------------- |
| Schema     | T001, T002, T003 | — (independent) |
| Types      | T007, T008       | T001–T006       |
| Graders    | T009, T010, T011 | T007–T008       |
| Unit Tests | T016, T017, T018 | T009–T011       |

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                            |
| ------- | --------- | ---------------------------------------------------------------------- |
| T004    | 🔴 HIGH   | Modify attempts.schema.ts — adds column and updates check constraints  |
| T006    | 🔴 HIGH   | Migration 019 — modifies existing attempts table, creates 3 new tables |
| T012    | 🟡 MEDIUM | Grading repository — SELECT FOR UPDATE, batch inserts                  |
| T013    | 🟡 MEDIUM | Grading engine — orchestrates full 13-step transactional flow          |
| T001    | 🟡 MEDIUM | New Drizzle schema: grading_results                                    |
| T002    | 🟡 MEDIUM | New Drizzle schema: grading_question_results                           |
| T003    | 🟢 LOW    | New Drizzle schema: grading_overrides (insert-only, no mutations)      |
| T005    | 🟢 LOW    | Schema barrel index update                                             |
| T007    | 🟢 LOW    | Type definitions (pure TypeScript)                                     |
| T008    | 🟢 LOW    | Error definitions (pure TypeScript)                                    |
| T009    | 🟢 LOW    | MCQ grader (pure function, no I/O)                                     |
| T010    | 🟢 LOW    | Traditional grader (pure function, no I/O)                             |
| T011    | 🟢 LOW    | Score aggregator (pure function, no I/O)                               |
| T014    | 🟢 LOW    | Barrel exports                                                         |
| T015    | 🟢 LOW    | Domain-core index update                                               |
| T016    | 🟢 LOW    | MCQ grader unit tests                                                  |
| T017    | 🟢 LOW    | Traditional grader unit tests                                          |
| T018    | 🟢 LOW    | Score aggregator unit tests                                            |
| T019    | 🟡 MEDIUM | Grading engine integration test (real DB)                              |

---

## External Dependency Tasks

| Task ID | Package        | Version Note                                                                                |
| ------- | -------------- | ------------------------------------------------------------------------------------------- |
| T012    | drizzle-orm    | Uses `.for('update')` and batch `values()` — verified against existing patterns in codebase |
| T013    | @zidney/logger | Uses existing structured logger interface                                                   |

No new package installations required.

---

## High-Downstream-Impact Tasks

| Task ID | Module                                            | Description                                                   |
| ------- | ------------------------------------------------- | ------------------------------------------------------------- |
| T004    | apps/api/src/db/tenant/schemas/attempts.schema.ts | Modifies core attempts schema — affects all attempt consumers |
| T006    | apps/api/src/db/tenant/migrations/                | Forward-only DDL — cannot be rolled back once deployed        |

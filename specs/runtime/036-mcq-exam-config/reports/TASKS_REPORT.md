# Tasks Report — MCQ Exam Configuration

**Step:** 4 — Tasks  
**Timestamp:** 2026-04-01T00:04:00Z  
**Status:** COMPLETE

---

## Summary

34 atomic tasks generated across 10 execution phases. Tasks follow strict dependency ordering: migration → schemas → workflow engine → domain types/errors → repository → validators → service → barrel → validation → routes → router registration. 8 tasks are marked [P] for parallel execution within their phase.

---

## Inputs Reviewed

- `specs/runtime/036-mcq-exam-config/spec.md`
- `specs/runtime/036-mcq-exam-config/plan.md`
- `specs/runtime/036-mcq-exam-config/data-model.md`
- `specs/runtime/036-mcq-exam-config/research.md`
- `specs/runtime/036-mcq-exam-config/tasks.md`

---

## Task Breakdown

| Category      | Count  | Notes                                               |
| ------------- | ------ | --------------------------------------------------- |
| Migration     | 1      | T001 — 4 tables, two-phase pattern                  |
| Schema        | 5      | T002-T006 — 4 Drizzle schemas + barrel update       |
| Workflow      | 2      | T007-T008 — engine + state integration              |
| Domain Types  | 2      | T009-T010 — types + errors                          |
| Repository    | 5      | T011-T015 — CRUD, settings, questions, criteria, TX |
| Validators    | 2      | T016-T017 — pre-enable + deletion guard             |
| Service       | 7      | T018-T024 — all business operations                 |
| Domain Barrel | 1      | T025 — public API                                   |
| Validation    | 2      | T026-T027 — Zod schemas + barrel                    |
| Routes        | 7      | T028-T034 — handlers + helpers + router             |
| **Total**     | **34** | 29 new files + 5 modified files                     |

---

## Transactional Tasks

- T011: createExam — BEGIN → INSERT → COMMIT
- T012: upsertSettings — BEGIN → INSERT ON CONFLICT UPDATE → COMMIT
- T013: addQuestions — BEGIN → validate all → INSERT batch → COMMIT
- T013: replaceQuestionOrder — BEGIN → DELETE all → INSERT batch → COMMIT
- T014: setCriteria — BEGIN → DELETE all → INSERT batch → verify sum → COMMIT
- T018-T024: All service write functions wrap repository calls in transactions

---

## Idempotency Tasks

- T001: Code uniqueness via partial unique index CONCURRENTLY
- T012: Settings UPSERT — INSERT ON CONFLICT DO UPDATE
- T014: Criteria atomic replace — DELETE all + INSERT all in TX
- T022: Question duplicate prevention via unique(exam_id, question_id) constraint + 409
- T024: Workflow transition — SELECT FOR UPDATE prevents races

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                    |
| --------- | --------- | -------------------------------------------------------------- |
| T001      | 🔴 HIGH   | Migration 014 — 4 tables, FK, CHECK constraints, CONCURRENT ix |
| T007      | 🔴 HIGH   | Workflow engine ENTITY_TABLE_MAP modification                  |
| T008      | 🔴 HIGH   | Workflow engine WORKFLOW_ENTITY_TYPES modification             |
| T016      | 🟡 MEDIUM | Pre-enable validation logic (security-adjacent)                |
| T017      | 🟡 MEDIUM | Deletion guard with extensible registry                        |
| T018      | 🟡 MEDIUM | Service createExam — initial status COMPLETED                  |
| T024      | 🟡 MEDIUM | Transition with pre-enable hook                                |
| T034      | 🟡 MEDIUM | Router registration with permission guards                     |
| T002-T005 | 🟢 LOW    | Drizzle schema definitions (follow established pattern)        |
| T009-T010 | 🟢 LOW    | Type definitions and error codes                               |
| T026-T027 | 🟢 LOW    | Zod validation schemas                                         |
| T028-T033 | 🟢 LOW    | Route handlers (follow established pattern)                    |

---

## Tasks with External Dependencies

None identified — all dependencies are internal workspace packages.

---

## High-Downstream-Impact Tasks

| Task ID | Module                                               | Impact | Description                         |
| ------- | ---------------------------------------------------- | ------ | ----------------------------------- |
| T007    | packages/domain-core/src/workflow/workflow.engine.ts | HIGH   | Shared workflow engine modification |
| T008    | packages/domain-core/src/workflow/workflow.states.ts | HIGH   | Shared workflow state types         |

---

## Architecture Governance Compliance

| Check                                        | Status | Notes                                         |
| -------------------------------------------- | ------ | --------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T011-T015, T018-T024 all TX-wrapped           |
| Idempotency tasks are defined where required | ✅     | UPSERT, unique constraints, SELECT FOR UPDATE |
| Layer boundary rules are respected           | ✅     | domain-core → validation → api                |
| No unrelated file modifications planned      | ✅     | Only 5 files modified, all directly related   |
| Migration tasks included when required       | ✅     | T001 — full migration with 4 tables           |
| Trust chain respected                        | ✅     | Routes behind tenant + license middleware     |

---

## Next Step

Proceed to Step 5 — Analyze.

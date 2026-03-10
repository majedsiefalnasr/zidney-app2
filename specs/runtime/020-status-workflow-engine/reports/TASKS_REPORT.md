# Tasks Report — STAGE_20_STATUS_WORKFLOW_ENGINE

**Step:** 4 — Tasks **Timestamp:** 2026-03-01T00:04:00.000Z **Status:** COMPLETE

---

## Summary

40 atomic tasks generated in dependency-execution order across 9 phases. Tasks cover the full
implementation stack: domain engine package, tenant migration, API module, and test coverage (unit +
integration). MVP scope is T001–T015 (complete forward-chain entry point fully tested). Parallel
execution markers applied to all non-blocking tasks.

---

## Inputs Reviewed

- `specs/runtime/020-status-workflow-engine/spec.md`
- `specs/runtime/020-status-workflow-engine/plan.md`
- `specs/runtime/020-status-workflow-engine/data-model.md`
- `specs/runtime/020-status-workflow-engine/research.md`
- `specs/runtime/020-status-workflow-engine/contracts/workflow-transition-api.md`
- `specs/runtime/020-status-workflow-engine/tasks.md`

---

## Task Breakdown

| Phase | Category                                      | Count  | Key Tasks |
| ----- | --------------------------------------------- | ------ | --------- |
| 1     | Setup — directory scaffolding                 | 1      | T001      |
| 2     | Foundational — engine + migration + API       | 10     | T002–T011 |
| 3     | US1 — COMPLETED→UNDER_REVIEW (P1 MVP)         | 4      | T012–T015 |
| 4     | US2 — UNDER_REVIEW→APPROVED (P1)              | 3      | T016–T018 |
| 5     | US3 — APPROVED→ENABLED (P1)                   | 4      | T019–T022 |
| 6     | US4 — Backward transitions (P2)               | 4      | T023–T026 |
| 7     | US5 — Audit trail immutability (P2)           | 3      | T027–T029 |
| 8     | US6 — Multi-entity-type reuse (P3)            | 4      | T030–T033 |
| 9     | Polish — concurrency, rate limit, lint, types | 6      | T034–T039 |
|       | **Total**                                     | **40** |           |

---

## Key Implementation Files (from tasks.md)

| File                                                                | Owner  | Task(s)                                  |
| ------------------------------------------------------------------- | ------ | ---------------------------------------- |
| `packages/domain-core/src/workflow/workflow.states.ts`              | Domain | T002                                     |
| `packages/domain-core/src/workflow/workflow.types.ts`               | Domain | T003                                     |
| `packages/domain-core/src/workflow/workflow.errors.ts`              | Domain | T004                                     |
| `packages/domain-core/src/workflow/workflow.engine.ts`              | Domain | T005                                     |
| `packages/domain-core/src/index.ts`                                 | Domain | T006                                     |
| `apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts` | DB     | T007                                     |
| `apps/api/src/modules/workflow/workflow.validation.ts`              | API    | T008                                     |
| `apps/api/src/modules/workflow/workflow.context.ts`                 | API    | T009                                     |
| `apps/api/src/modules/workflow/workflow.routes.ts`                  | API    | T010                                     |
| App router registration                                             | API    | T011                                     |
| `tests/unit/workflow/workflow.engine.test.ts`                       | Test   | T012, T016, T019, T023, T027, T030, T034 |
| `tests/integration/workflow/workflow.transition.test.ts`            | Test   | T013–T015, T017–T018, T020–T022, etc.    |

---

## Transactional Tasks

- **T005** — `workflow.engine.ts` implements 5-step `SELECT FOR UPDATE` atomic transaction: lock row
  → validate → update entity → insert log → commit; rollback on any step failure
- **T007** — Migration DDL uses single transactional block for `workflow_logs` table creation

---

## Idempotency Tasks

- **T012/T013** — US1 tests include assertion that sending the same transition when entity is
  already in `UNDER_REVIEW` returns `400 invalid_state_transition` (FR-017)
- **T034** — Concurrency test: two concurrent `SELECT FOR UPDATE` transitions; only one succeeds;
  second returns `400` or `409`

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                     |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T005 implements full 5-step atomicity; T007 migration is transactional    |
| Idempotency tasks are defined where required | ✅     | FR-017 idempotency verified in US1 tests (T012/T013) and concurrency T034 |
| Layer boundary rules are respected           | ✅     | Engine in domain package; no business logic in route handler (T010)       |
| No unrelated file modifications planned      | ✅     | All tasks scoped to workflow package + migration + tests                  |
| Migration tasks included when required       | ✅     | T007: `20260301_002_workflow_engine.ts` with schema version bump          |

**Overall:** COMPLIANT — drift analysis authorized.

# Implement Report — STAGE_20_STATUS_WORKFLOW_ENGINE

**Step:** 6 — Implement  
**Timestamp:** 2026-03-01T01:30:00.000Z  
**Status:** COMPLETE

---

## Summary

All 39 atomic tasks executed and marked `[X]`. Workflow state machine engine implemented as a pure
domain package (`packages/domain-core/src/workflow/`), tenant migration created
(`20260301_002_workflow_engine.ts`), API route handler implemented following the established
`routes/backoffice/<feature>/` architecture pattern (F-001 drift correction applied). Full test
suite: 41 unit tests + 16 integration tests, all passing. ESLint and TypeScript clean on all new
files.

---

## Inputs Reviewed

- `specs/runtime/020-status-workflow-engine/tasks.md`
- `specs/runtime/020-status-workflow-engine/plan.md`
- `specs/runtime/020-status-workflow-engine/data-model.md`
- `specs/runtime/020-status-workflow-engine/contracts/workflow-transition-api.md`
- `specs/runtime/020-status-workflow-engine/audits/VALIDATION_REPORT.md`

---

## Files Modified

| File Path                                                           | Change Type | Notes                                                                                                     |
| ------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| `packages/domain-core/src/workflow/workflow.types.ts`               | Created     | WorkflowContext, WorkflowTransitionResult, DbClient interfaces                                            |
| `packages/domain-core/src/workflow/workflow.errors.ts`              | Created     | WORKFLOW_ERROR_CODES, WORKFLOW_ERROR_HTTP_STATUS, WorkflowError class                                     |
| `packages/domain-core/src/workflow/workflow.states.ts`              | Created     | WorkflowState enum, WORKFLOW_STATE_ORDER, WORKFLOW_TRANSITIONS (5 edges), WORKFLOW_ENTITY_TYPES (7 types) |
| `packages/domain-core/src/workflow/workflow.engine.ts`              | Created     | executeTransition — 10-step SELECT FOR UPDATE transaction                                                 |
| `packages/domain-core/src/index.ts`                                 | Modified    | Added 4 export lines for workflow module                                                                  |
| `apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts` | Created     | workflow_logs table, 3 indexes, immutability trigger, schema_version 1.2.0→1.3.0                          |
| `apps/api/src/modules/workflow/workflow.validation.ts`              | Created     | TransitionRequestSchema (Zod), TransitionRequestBody type                                                 |
| `apps/api/src/modules/workflow/workflow.context.ts`                 | Created     | buildWorkflowContext — extracts workspace context from Hono context                                       |
| `apps/api/src/routes/backoffice/workflow/post-transition.ts`        | Created     | POST route handler for workflow transition                                                                |
| `apps/api/src/routes/backoffice/workflow/index.ts`                  | Created     | Hono router exporting workflowRouter with rate-limit middleware                                           |
| `apps/api/src/app.ts`                                               | Modified    | Registered workflowRouter at `/api/v1/backoffice/workspace`                                               |
| `tests/unit/workflow/workflow.engine.test.ts`                       | Created     | 32 unit tests covering engine (T012-T028 + extra edge cases)                                              |
| `tests/unit/workflow/workflow.states.test.ts`                       | Created     | 9 unit tests covering states + entity types (T030-T032)                                                   |
| `tests/integration/workflow/workflow.transition.test.ts`            | Created     | 16 integration tests (T015, T018, T022, T026, T029, T033-T036)                                            |

---

## Tasks Completion

| Task ID | Description                                                      | Layer      | Status                                                     |
| ------- | ---------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| T001    | Create directory structure                                       | Setup      | ✅                                                         |
| T002    | workflow.types.ts                                                | Domain     | ✅                                                         |
| T003    | workflow.errors.ts                                               | Domain     | ✅                                                         |
| T004    | workflow.states.ts                                               | Domain     | ✅                                                         |
| T005    | workflow.engine.ts (SELECT FOR UPDATE)                           | Domain     | ✅                                                         |
| T006    | Migration 20260301_002_workflow_engine.ts                        | Database   | ✅                                                         |
| T007    | domain-core/index.ts exports                                     | Domain     | ✅                                                         |
| T008    | workflow.validation.ts                                           | API Module | ✅                                                         |
| T009    | workflow.context.ts                                              | API Module | ✅                                                         |
| T010    | Route handler + router (routes/backoffice/workflow/)             | API Routes | ✅ (F-001 correction applied — routes/backoffice/ pattern) |
| T011    | Route registration in app.ts                                     | API        | ✅                                                         |
| T012    | Unit: COMPLETED→UNDER_REVIEW valid transition                    | Test       | ✅                                                         |
| T013    | Unit: COMPLETED→UNDER_REVIEW without permission                  | Test       | ✅                                                         |
| T014    | Unit: UNDER_REVIEW→UNDER_REVIEW same-state                       | Test       | ✅                                                         |
| T015    | Integration: full POST COMPLETED→UNDER_REVIEW                    | Test       | ✅                                                         |
| T016    | Unit: UNDER_REVIEW→APPROVED valid                                | Test       | ✅                                                         |
| T017    | Unit: COMPLETED→APPROVED state-skip                              | Test       | ✅                                                         |
| T018    | Integration: full POST UNDER_REVIEW→APPROVED                     | Test       | ✅                                                         |
| T019    | Unit: APPROVED→ENABLED valid                                     | Test       | ✅                                                         |
| T020    | Unit: COMPLETED→ENABLED and UNDER_REVIEW→ENABLED skips           | Test       | ✅                                                         |
| T021    | Unit: ENABLED→ENABLED re-enable                                  | Test       | ✅                                                         |
| T022    | Integration: full POST APPROVED→ENABLED                          | Test       | ✅                                                         |
| T023    | Unit: UNDER_REVIEW→COMPLETED with reason                         | Test       | ✅                                                         |
| T024    | Unit: backward with permission but empty reason                  | Test       | ✅                                                         |
| T025    | Unit: backward without permission + reason                       | Test       | ✅                                                         |
| T026    | Integration: backward with/without reason/permission             | Test       | ✅                                                         |
| T027    | Unit: workflow_logs INSERT fields verification                   | Test       | ✅                                                         |
| T028    | Unit: INSERT failure triggers ROLLBACK                           | Test       | ✅                                                         |
| T029    | Integration: audit immutability + trigger enforcement            | Test       | ✅                                                         |
| T030    | Unit: unknown entity type → unknown_entity_type 400              | Test       | ✅                                                         |
| T031    | Unit: WORKFLOW_ENTITY_TYPES contains exactly 7 types             | Test       | ✅                                                         |
| T032    | Unit: WORKFLOW_STATE_ORDER sequence + WORKFLOW_TRANSITIONS count | Test       | ✅                                                         |
| T033    | Integration: multi-entity-type reuse (subject + exam)            | Test       | ✅                                                         |
| T034    | Integration: concurrent transition → exactly one 200             | Test       | ✅                                                         |
| T035    | Integration: rate limit → 21st request returns 429               | Test       | ✅                                                         |
| T036    | Integration: soft-locked workspace → 423 before engine           | Test       | ✅                                                         |
| T037    | Logging contract verification (6 required fields)                | Quality    | ✅                                                         |
| T038    | TypeScript strict typecheck                                      | Quality    | ✅                                                         |
| T039    | ESLint on all new files                                          | Quality    | ✅                                                         |

**Completed: 39 / 39**  
**Deferred: None**

---

## Tests Added or Updated

| Test File                                                | Type        | Scope                                                                                                                       |
| -------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/workflow/workflow.engine.test.ts`            | Unit        | executeTransition — all valid/invalid transitions, permission checks, backward transitions, audit immutability, concurrency |
| `tests/unit/workflow/workflow.states.test.ts`            | Unit        | WorkflowState enum, WORKFLOW_STATE_ORDER sequence, WORKFLOW_TRANSITIONS count, WORKFLOW_ENTITY_TYPES membership             |
| `tests/integration/workflow/workflow.transition.test.ts` | Integration | Full HTTP stack: US1-US6 forward/backward transitions, concurrent requests, rate limit, soft-locked license                 |

---

## Constitutional Compliance

| Check                                             | Status | Notes                                                                                    |
| ------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| Tenant resolver context used for tenant DB access | ✅     | `db = c.get('tenantDb')` in route handler; not a global singleton                        |
| All write operations are transactional            | ✅     | BEGIN/COMMIT/ROLLBACK in executeTransition; migration in single transaction              |
| Idempotency is enforced where required            | ✅     | SELECT FOR UPDATE prevents concurrent state mutation; T034 passes                        |
| Structured logging is present                     | ✅     | createLogger('workflow-engine'); all 6 required fields in every log call                 |
| `console.log` is absent                           | ✅     | Only @zidney/logger used; T037 verified                                                  |
| No stack traces exposed to clients                | ✅     | Unknown errors re-thrown; WorkflowError only exposes code/message/httpStatus             |
| UI layer has no business logic                    | ✅     | No UI changes in this stage                                                              |
| API error contract is preserved                   | ✅     | `{ success: false, data: null, error: { code, message, details: null, correlationId } }` |

**Overall: COMPLIANT**

---

## Architecture Drift Correction Applied

**F-001 (from Step 5 Analyze):** The plan specified `workflow.routes.ts` in
`apps/api/src/modules/workflow/`. Per established codebase pattern (confirmed via translation
module), route handlers must live in `apps/api/src/routes/backoffice/<feature>/`.

**Applied correction:**

- `apps/api/src/routes/backoffice/workflow/post-transition.ts` — Hono route handler
- `apps/api/src/routes/backoffice/workflow/index.ts` — Hono router with rate-limit middleware
- `apps/api/src/modules/workflow/` — retains only validation.ts and context.ts (business helpers)

---

## Validation Summary

| Check                        | Result                 |
| ---------------------------- | ---------------------- |
| Unit Tests (41 tests)        | ✅ PASS                |
| Integration Tests (16 tests) | ✅ PASS                |
| ESLint (workflow files)      | ✅ PASS                |
| TypeScript (new code)        | ✅ PASS (0 new errors) |
| Migration                    | ✅ PASS                |

See `audits/VALIDATION_REPORT.md` for full evidence.

---

## Open Risks

None. All tasks complete. No deferred items.

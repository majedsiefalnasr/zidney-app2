# Tasks: Status Workflow Engine

**Feature**: `020-status-workflow-engine`
**Input**: `specs/runtime/020-status-workflow-engine/`
**Date**: 2026-03-01
**Stage**: STAGE_20_STATUS_WORKFLOW_ENGINE
**TASKS_TOTAL**: 39

**Sources Consumed**:

- `spec.md` — 6 user stories (US1–US6), FR-001–FR-018, error contract
- `plan.md` — 4 implementation layers, transaction strategy, logging requirements
- `data-model.md` — WorkflowState enum, transition table, workflow_logs DDL, WorkflowContext shape
- `research.md` — R-001–R-008 decisions (pattern = translation service, migration = `20260301_002`, locking = SELECT FOR UPDATE)
- `contracts/workflow-transition-api.md` — POST endpoint, middleware stack, response envelopes

---

## Format

```
- [ ] T### [P] [US#] Description with exact file path
```

- **[P]** = parallelisable (different file, no incomplete dependency)
- **[US#]** = user story scope (US1–US6); absent in Setup/Foundational/Polish phases

---

## Phase 1: Setup

**Purpose**: Create directory scaffolding. No implementation; unblocks all parallel work in Phase 2.

- [ ] T001 Create directory structure: `packages/domain-core/src/workflow/`, `apps/api/src/modules/workflow/`, `tests/unit/workflow/`, and `tests/integration/workflow/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All four implementation layers must be complete before any user story can be exercised end-to-end. The engine is generic — it serves all six stories. Story-specific work in Phases 3–8 is exclusively test tasks.

**⚠️ CRITICAL**: No user-story test phase can begin until T002–T011 are all complete.

### Layer 1 — Domain Package (`packages/domain-core/src/workflow/`)

- [ ] T002 [P] Create `packages/domain-core/src/workflow/workflow.types.ts` — export `WorkflowContext` interface (entityType, entityId, targetState, actorId, permissions[], reason?, correlationId, workspaceSlug, workspaceId), `WorkflowTransitionResult`, `WorkflowEnabledEntityRow`, and `DbClient` interface (`{ query, connect? }`)
- [ ] T003 [P] Create `packages/domain-core/src/workflow/workflow.errors.ts` — export `WORKFLOW_ERROR_CODES` typed const object, `WORKFLOW_ERROR_HTTP_STATUS` Record mapping code→HTTP status, and `WorkflowError extends Error` with `.code` and `.httpStatus` properties; mirror pattern from `packages/domain-core/src/translation/translation.errors.ts`
- [ ] T004 [P] Create `packages/domain-core/src/workflow/workflow.states.ts` — export `WorkflowState` enum (`COMPLETED | UNDER_REVIEW | APPROVED | ENABLED`), `WORKFLOW_STATE_ORDER: WorkflowState[]` (index = sequence position), `WorkflowTransitionDefinition` interface, `WORKFLOW_TRANSITIONS: WorkflowTransitionDefinition[]` (3 forward + 2 backward edges with `actionKey` and `forward` boolean per data-model.md §1.2), and `WORKFLOW_ENTITY_TYPES: Set<string>` (7 entity types: subject, mcq_question, traditional_question, exam, topic, library_file, template)
- [ ] T005 Create `packages/domain-core/src/workflow/workflow.engine.ts` — export `executeTransition(db: DbClient, context: WorkflowContext): Promise<WorkflowTransitionResult>` implementing the exact 10-step sequence: (1) validate entityType ∈ WORKFLOW_ENTITY_TYPES, (2) `db.connect()`, (3) BEGIN, (4) `SELECT id, status, status_updated_at, status_updated_by FROM <entity_table> WHERE id=$1 FOR UPDATE`, (5) lookup transition match, (6) check permission via `${entityType}.${transition.actionKey} ∈ context.permissions`, (7) validate reason for backward, (8) UPDATE entity status+timestamps, (9) INSERT workflow_logs RETURNING id+changed_at, (10) COMMIT; ROLLBACK+rethrow on any failure; structured logs via `createLogger('workflow-engine')` with workspace_slug, workspace_id, correlation_id, entity_type, entity_id, actor_id fields; `ENTITY_TABLE_MAP` for all 7 entity types

### Layer 2 — Tenant Migration

- [ ] T006 [P] Create `apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts` — `up()` function executes in a single transaction: CREATE TABLE workflow_logs (id UUID PK, entity_type VARCHAR(100) NOT NULL, entity_id UUID NOT NULL, previous_state VARCHAR(50) NOT NULL CHECK IN states, new_state VARCHAR(50) NOT NULL CHECK IN states, changed_by UUID NOT NULL, changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reason TEXT); CREATE INDEX idx_wfl_entity_created ON (entity_type, entity_id, changed_at DESC, id DESC); CREATE INDEX idx_wfl_actor_created ON (changed_by, changed_at DESC); CREATE INDEX idx_wfl_entity_type_created ON (entity_type, changed_at DESC); DROP TRIGGER IF EXISTS + CREATE TRIGGER prevent_workflow_log_modification BEFORE UPDATE OR DELETE using existing `prevent_audit_modification()`; UPDATE schema_version SET version='1.3.0'; `down()` throws irreversible error per ADR-0008

### Layer 1 (continued) — Domain Package Index

- [ ] T007 Update `packages/domain-core/src/index.ts` — add four export lines for workflow module: `export * from './workflow/workflow.states'`, `export * from './workflow/workflow.types'`, `export * from './workflow/workflow.errors'`, `export * from './workflow/workflow.engine'`

### Layer 3 — API Module (`apps/api/src/modules/workflow/`)

- [ ] T008 [P] Create `apps/api/src/modules/workflow/workflow.validation.ts` — export `TransitionRequestSchema` Zod object schema: `target_state: z.enum(['COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED'])`, `reason: z.string().optional()`; export inferred `TransitionRequestBody` type
- [ ] T009 [P] Create `apps/api/src/modules/workflow/workflow.context.ts` — export `buildWorkflowContext(c: HonoContext, body: TransitionRequestBody): WorkflowContext` extracting: entityType from `:entityType` path param, entityId from `:entityId` path param, targetState from validated body, actorId from `c.get('user').id` (JWT payload), permissions from `c.get('permissions')` (auth middleware), correlationId from `x-correlation-id` header or generated UUID, workspaceSlug from `c.get('tenantSlug')`, workspaceId from `c.get('tenantId')`
- [ ] T010 Create `apps/api/src/modules/workflow/workflow.routes.ts` — define Hono route `POST /workflow/:entityType/:entityId/transition`; obtain `db = c.get('tenantDb')`, parse+validate body with `TransitionRequestSchema`, call `buildWorkflowContext()`, call `executeTransition(db, ctx)`, return `{ success: true, data: result, error: null }` on 200; catch `WorkflowError` → `{ success: false, data: null, error: { code, message, details: null, correlationId: ctx.correlationId } }` with `err.httpStatus`; rethrow unknown errors
- [ ] T011 Register workflow routes in the backoffice API router (same pattern as translation routes) — locate the existing route registration file under `apps/api/src/` for backoffice routes and add `app.route('/workflow', workflowRoutes)` with the rate-limit middleware key `workflow-transition:{actorId}:{entityType}` at 20 req/user/entity-type/minute applied to the workflow route group

**Checkpoint**: All 10 implementation tasks (T002–T011) complete. The engine is fully functional. All US test phases can begin independently.

---

## Phase 3: User Story 1 — Content Author Submits for Review (P1) 🎯 MVP

**Goal**: Validate the `COMPLETED → UNDER_REVIEW` forward transition — the entry point of the entire workflow (the permission model, entity status update, and log entry creation).

**Independent Test**: Transition any single entity from `COMPLETED` to `UNDER_REVIEW` with the `{entityType}.review` permission, verify entity status and `workflow_logs` entry; test rejection without permission and same-state re-attempt — all without any other transition being exercised.

- [ ] T012 [P] [US1] Write unit test — valid `COMPLETED→UNDER_REVIEW` with `subject.review` permission: mock DB returns entity in COMPLETED, assert engine returns `WorkflowTransitionResult` with correct previousState/newState/logId, assert UPDATE+INSERT queries were called in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T013 [P] [US1] Write unit test — `COMPLETED→UNDER_REVIEW` without `subject.review` permission: assert throws `WorkflowError` with code `workflow_permission_denied` and httpStatus 403 in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T014 [P] [US1] Write unit test — `UNDER_REVIEW→UNDER_REVIEW` same-state re-attempt: assert throws `WorkflowError` with code `invalid_state_transition` and httpStatus 400 in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T015 [US1] Write integration test — full POST `/:workspaceSlug/workflow/subject/:entityId/transition` with `target_state: "UNDER_REVIEW"` through middleware stack: assert 200 response with correct `data` envelope, assert entity row updated in tenant DB, assert one `workflow_logs` row inserted in `tests/integration/workflow/workflow.transition.test.ts`

**Checkpoint**: US1 fully functional and independently verified. Content submission flow works end-to-end.

---

## Phase 4: User Story 2 — Reviewer Approves Content (P1)

**Goal**: Validate the `UNDER_REVIEW → APPROVED` transition — the critical gating step before content can be enabled.

**Independent Test**: Transition an entity seeded in `UNDER_REVIEW` to `APPROVED`, verify update and log; test `COMPLETED→APPROVED` state-skip is rejected with 400.

- [ ] T016 [P] [US2] Write unit test — valid `UNDER_REVIEW→APPROVED` with `subject.approve` permission: assert correct `WorkflowTransitionResult` shape returned in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T017 [P] [US2] Write unit test — `COMPLETED→APPROVED` state-skip: assert throws `WorkflowError` code `invalid_state_transition` (400) in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T018 [US2] Write integration test — full POST `UNDER_REVIEW→APPROVED` for a `subject` entity; verify 200 response envelope, entity status update, and log entry in `tests/integration/workflow/workflow.transition.test.ts`

**Checkpoint**: US2 independently verified. Reviewer approval flow confirmed.

---

## Phase 5: User Story 3 — Administrator Enables Approved Content (P1)

**Goal**: Validate the `APPROVED → ENABLED` terminal forward transition — the business outcome of the full workflow chain.

**Independent Test**: Transition an entity seeded in `APPROVED` to `ENABLED`; test that routing from non-APPROVED states to ENABLED is rejected; test ENABLED→ENABLED re-enable is rejected.

- [ ] T019 [P] [US3] Write unit test — valid `APPROVED→ENABLED` with `subject.enable` permission: assert correct result shape in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T020 [P] [US3] Write unit test — `COMPLETED→ENABLED` and `UNDER_REVIEW→ENABLED` state-skip attempts: assert throws `invalid_state_transition` (400) for each in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T021 [P] [US3] Write unit test — `ENABLED→ENABLED` re-enable attempt: assert throws `invalid_state_transition` (400) in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T022 [US3] Write integration test — full POST `APPROVED→ENABLED`; verify 200 response, entity status, and log entry; verify `COMPLETED→ENABLED` state-skip returns 400 envelope in `tests/integration/workflow/workflow.transition.test.ts`

**Checkpoint**: US3 independently verified. Full forward chain `COMPLETED→UNDER_REVIEW→APPROVED→ENABLED` confirmed end-to-end.

---

## Phase 6: User Story 4 — Reviewer Returns Content for Revision (P2)

**Goal**: Validate backward transitions (`UNDER_REVIEW→COMPLETED`, `APPROVED→UNDER_REVIEW`) — requires explicit `{entityType}.return` permission and non-empty justification.

**Independent Test**: Perform backward transition with/without permission and with/without justification on entity seeded in `UNDER_REVIEW`; all three rejection paths must be verifiable independently.

- [ ] T023 [P] [US4] Write unit test — valid `UNDER_REVIEW→COMPLETED` backward transition with `subject.return` permission and non-empty reason: assert correct result returned in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T024 [P] [US4] Write unit test — backward transition (`UNDER_REVIEW→COMPLETED`) with `subject.return` permission but empty/missing reason: assert throws `WorkflowError` code `justification_required` (400) in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T025 [P] [US4] Write unit test — backward transition without `subject.return` permission even when reason is provided: assert throws `WorkflowError` code `workflow_permission_denied` (403) in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T026 [US4] Write integration test — POST `UNDER_REVIEW→COMPLETED` with reason: assert 200 + log entry with reason stored; POST without reason: assert 400 `justification_required` envelope; POST without permission: assert 403 `workflow_permission_denied` envelope in `tests/integration/workflow/workflow.transition.test.ts`

**Checkpoint**: US4 independently verified. Backward transition permission + justification enforcement confirmed.

---

## Phase 7: User Story 5 — Auditor Reviews Transition History (P2)

**Goal**: Validate the immutable append-only `workflow_logs` table — every successful transition writes exactly one log row; no UPDATE or DELETE is permitted.

**Independent Test**: Perform several transitions on one entity, query `workflow_logs` for that entity; verify all rows present, ordered by `changed_at`, immutable (trigger rejects UPDATE/DELETE).

- [ ] T027 [P] [US5] Write unit test — on successful transition, engine calls INSERT INTO workflow_logs with all required fields (entity_type, entity_id, previous_state, new_state, changed_by, reason); the returned `logId` matches the RETURNING id in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T028 [P] [US5] Write unit test — when `workflow_logs` INSERT fails after entity UPDATE, entire transaction rolls back (mock DB throws on INSERT after UPDATE succeeds); assert engine throws and entity status is not persisted in `tests/unit/workflow/workflow.engine.test.ts`
- [ ] T029 [US5] Write integration test — perform `COMPLETED→UNDER_REVIEW` then `UNDER_REVIEW→APPROVED` on same entity; assert `workflow_logs` has two rows ordered by `changed_at`; attempt direct `UPDATE workflow_logs SET reason='tampered'` via raw DB query inside test and assert it throws (trigger enforcement); assert `DELETE FROM workflow_logs` is also rejected in `tests/integration/workflow/workflow.transition.test.ts`

**Checkpoint**: US5 independently verified. Audit trail completeness and immutability confirmed.

---

## Phase 8: User Story 6 — Engine Applied Across Multiple Entity Types (P3)

**Goal**: Validate the engine's reusability contract — two distinct entity types use the same code path with no engine modifications; unknown entity types are rejected before DB access.

**Independent Test**: Exercise transitions on `subject` and `exam` entities separately; both produce correct results via identical engine code path. Attempt with unregistered entity type; assert pre-DB rejection.

- [ ] T030 [P] [US6] Write unit test — entity type `'custom_thing'` not in `WORKFLOW_ENTITY_TYPES`: assert throws `WorkflowError` code `unknown_entity_type` (400) and no DB query is executed in `tests/unit/workflow/workflow.states.test.ts`
- [ ] T031 [P] [US6] Write unit test — `WORKFLOW_ENTITY_TYPES` Set contains exactly the 7 Phase 3 entity types: `subject`, `mcq_question`, `traditional_question`, `exam`, `topic`, `library_file`, `template` in `tests/unit/workflow/workflow.states.test.ts`
- [ ] T032 [P] [US6] Write unit test — `WORKFLOW_STATE_ORDER` array has exactly 4 members in correct sequence: `COMPLETED` at index 0, `UNDER_REVIEW` at 1, `APPROVED` at 2, `ENABLED` at 3; `WORKFLOW_TRANSITIONS` has exactly 5 entries (3 forward + 2 backward) in `tests/unit/workflow/workflow.states.test.ts`
- [ ] T033 [US6] Write integration test — perform `COMPLETED→UNDER_REVIEW` transition for entity type `subject` and then for entity type `exam` (separate entities); assert both return correct 200 response envelopes with correct entityType field; assert both produce `workflow_logs` rows with correct entity_type values in `tests/integration/workflow/workflow.transition.test.ts`

**Checkpoint**: US6 independently verified. Engine reusability across entity types confirmed without code changes.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Concurrency, rate limiting, license middleware integration, structured logging validation, type safety, and lint.

- [ ] T034 [P] Write integration test — concurrent transition: send two simultaneous POST `COMPLETED→UNDER_REVIEW` requests for the same entity; assert exactly one returns 200 and the other returns 400 (`invalid_state_transition`) or 409 (`workflow_conflict`); assert exactly one `workflow_logs` row exists for the entity after both resolve in `tests/integration/workflow/workflow.transition.test.ts`
- [ ] T035 [P] Write integration test — rate limit enforcement: send 21 consecutive POST transition requests from the same actor for the same entity type; assert the 21st returns `429` with `error.code = "rate_limit_exceeded"` in `tests/integration/workflow/workflow.transition.test.ts`
- [ ] T036 [P] Write integration test — soft-locked workspace: configure test tenant license as `SOFT_LOCKED`; send POST transition request; assert `423` is returned from license middleware before engine is invoked (no `workflow_logs` row created) in `tests/integration/workflow/workflow.transition.test.ts`
- [ ] T037 [P] Verify structured logging contract: review `packages/domain-core/src/workflow/workflow.engine.ts` to confirm every `logger.info` / `logger.warn` call includes `workspace_slug`, `workspace_id`, `correlation_id`, `entity_type`, `entity_id`, and `user_id` fields; confirm `console.log` is absent
- [ ] T038 Run TypeScript strict type check (`tsc --noEmit`) on `packages/domain-core` and `apps/api` to confirm no type errors introduced by the new workflow module and migration file
- [ ] T039 Run ESLint on all new files: `packages/domain-core/src/workflow/`, `apps/api/src/modules/workflow/`, `apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts`, `tests/unit/workflow/`, and `tests/integration/workflow/`; confirm zero lint violations

---

## Dependencies

```
T001 ──► T002, T003, T004, T006, T008, T009  (setup unblocks all Layer 1/2/3 parallel work)
T002 ──► T005, T007, T009                     (types needed by engine, index, context)
T003 ──► T005, T007                            (errors needed by engine, index)
T004 ──► T005, T007, T008                      (states needed by engine, index, validation)
T005 ──► T007, T010                            (engine needed by index + route handler)
T006 □   (migration is independent — no domain dependency)
T007 ──► T010                                  (index export needed by route handler import)
T008 ──► T010                                  (validation schema needed by route handler)
T009 ──► T010                                  (context builder needed by route handler)
T010 ──► T011                                  (routes file needed before registration)
T011 ──► T012–T039                             (full stack ready; all test phases can begin)
T012–T014 □ parallel (same test file, separate test blocks)
T015 depends on T011
T016–T017 □ parallel
T018 depends on T011
T019–T021 □ parallel
T022 depends on T011
T023–T025 □ parallel
T026 depends on T011
T027–T028 □ parallel
T029 depends on T011
T030–T032 □ parallel
T033 depends on T011
T034–T036 □ parallel
T037 depends on T005
T038 depends on T002–T011
T039 depends on T002–T011
```

---

## Parallel Execution Map

### Phase 2 — Maximum parallelism within the domain layer

```
T002, T003, T004, T006 ──► (all parallel, different files, zero interdependency)
                        ──► then T005 (engine, depends on T002+T003+T004)
                        ──► then T007 (index, depends on T002+T003+T004+T005)
T008, T009 ──► (parallel, different files; T008 depends on T004, T009 depends on T002)
T010 ──► (depends on T005+T007+T008+T009)
T011 ──► (depends on T010)
```

### Phases 3–8 — All test phases can run in parallel after T011

```
Phase 3 tests ──►  T012, T013, T014 parallel  →  T015
Phase 4 tests ──►  T016, T017 parallel         →  T018
Phase 5 tests ──►  T019, T020, T021 parallel   →  T022
Phase 6 tests ──►  T023, T024, T025 parallel   →  T026
Phase 7 tests ──►  T027, T028 parallel         →  T029
Phase 8 tests ──►  T030, T031, T032 parallel   →  T033
```

All six phase pairs (3–8) can execute concurrently because they target distinct test blocks in the same test files.

---

## Implementation Strategy

### MVP Scope (Phase 3 only)

Complete T001–T015 to deliver a working, tested `COMPLETED→UNDER_REVIEW` transition end-to-end. This validates:

- Domain package structure
- 5-step SELECT FOR UPDATE transaction
- workflow_logs append-only audit
- Permission enforcement
- API middleware stack integration
- Migration correctness

All remaining US phases extend the same engine without modification.

### Incremental Delivery Order

1. **MVP**: T001–T015 — US1 complete, full chain scaffolded
2. **Complete forward chain**: T016–T022 — US2 + US3 (P1 all done)
3. **Backward transitions**: T023–T026 — US4 (P2)
4. **Audit trail verification**: T027–T029 — US5 (P2)
5. **Multi-entity reuse**: T030–T033 — US6 (P3)
6. **Polish**: T034–T039 — concurrency, rate limit, license, type safety

---

## Task Summary

| Phase     | Scope                                         | Tasks     | Count  |
| --------- | --------------------------------------------- | --------- | ------ |
| 1         | Setup — directory scaffolding                 | T001      | 1      |
| 2         | Foundational — all 4 implementation layers    | T002–T011 | 10     |
| 3         | US1 — COMPLETED→UNDER_REVIEW (P1) 🎯 MVP      | T012–T015 | 4      |
| 4         | US2 — UNDER_REVIEW→APPROVED (P1)              | T016–T018 | 3      |
| 5         | US3 — APPROVED→ENABLED (P1)                   | T019–T022 | 4      |
| 6         | US4 — Backward transitions (P2)               | T023–T026 | 4      |
| 7         | US5 — Audit trail immutability (P2)           | T027–T029 | 3      |
| 8         | US6 — Multi-entity-type reuse (P3)            | T030–T033 | 4      |
| 9         | Polish — concurrency, rate limit, lint, types | T034–T039 | 6      |
| **Total** |                                               |           | **39** |

**TASKS_TOTAL = 39**

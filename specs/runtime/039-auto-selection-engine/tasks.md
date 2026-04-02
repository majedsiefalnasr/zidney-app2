# Tasks: Auto Selection Engine

**Input**: Design documents from `/specs/runtime/039-auto-selection-engine/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included. The feature specification defines explicit testing scenarios and measurable criteria.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stage scaffolding for migration and test execution entry points.

- [X] T001 Create tenant migration file `apps/api/src/db/tenant/migrations/20260403_018_auto_selection_engine.ts` for additive Stage 39 schema updates, including filter-support indexes and idempotency-claim persistence constraints
- [X] T002 Create migration verification test `apps/api/src/db/tenant/migrations/__tests__/018_auto_selection_engine.migration.test.ts` validating required indexes and uniqueness constraints
- [X] T003 [P] Create auto-selection fixture helpers in `apps/api/tests/fixtures/auto-selection.fixture.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and shared contracts that MUST exist before user-story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Update `apps/api/src/db/tenant/schemas/attempts.schema.ts` with deterministic selection seed, candidate-pool fingerprint, and diagnostics snapshot columns
- [X] T005 [P] Create `apps/api/src/db/tenant/schemas/attempt-questions.schema.ts` with immutable assignment constraints and unique indexes
- [X] T006 [P] Extend `apps/api/src/db/tenant/schemas/mcq-exam-auto-criteria.schema.ts` for `fixed_count` and additional optional filters
- [X] T050 [P] Create `apps/api/src/db/tenant/schemas/attempt-start-idempotency-claims.schema.ts` with tenant-scoped unique claim constraints
- [X] T007 Update `apps/api/src/db/tenant/schemas/index.ts` to export Stage 39 schema additions
- [X] T008 Add Stage 39 selection error codes in `packages/types/src/error-codes.ts`
- [X] T009 Extend criteria validation schemas in `packages/validation/src/backoffice/mcq-exams.schemas.ts` for percentage-or-fixed-count mode rules
- [X] T010 Update `packages/validation/src/backoffice/index.ts` with Stage 39 schema exports
- [X] T011 Create structured selection diagnostics helper in `packages/domain-core/src/logging/selection-events.ts`

**Checkpoint**: Foundation ready; user stories can proceed.

---

## Phase 3: User Story 1 - Start Fair Attempt with Auto Selection (Priority: P1) 🎯 MVP

**Goal**: Execute deterministic, atomic auto-selection during attempt start and persist immutable snapshot data.

**Independent Test**: Start an attempt for an automatic exam and verify exact question count, zero duplicates, deterministic replay behavior, idempotency replay/conflict behavior, 426 version-guard behavior, and transactional abort on insufficiency.

### Tests for User Story 1

- [X] T012 [P] [US1] Add deterministic shuffle unit tests in `packages/domain-core/tests/unit/attempts/auto-selection.shuffle.test.ts`
- [X] T013 [P] [US1] Add pool insufficiency and duplicate guard tests in `packages/domain-core/tests/unit/attempts/auto-selection.rules.test.ts`
- [X] T014 [P] [US1] Add attempt-start auto-selection integration tests in `apps/api/tests/integration/create-attempt-auto-selection.test.ts`
- [ ] T041 [P] [US1] Add idempotency replay integration tests (same-key replay and payload-conflict) in `apps/api/tests/integration/create-attempt-idempotency-replay.test.ts`
- [ ] T042 [P] [US1] Add schema/product version mismatch (HTTP 426) integration tests in `apps/api/tests/integration/create-attempt-version-guard.test.ts`
- [ ] T044 [P] [US1] Add attempt-start error-contract matrix tests for all Stage 39 codes in `apps/api/tests/contract/attempts/auto-selection-errors.contract.test.ts`
- [X] T045 [P] [US1] Add deterministic candidate-order repository tests in `packages/domain-core/tests/unit/attempts/auto-selection.candidate-order.test.ts`

### Implementation for User Story 1

- [X] T015 [US1] Implement seeded selector primitives in `packages/domain-core/src/attempts/auto-selection.selector.ts`
- [X] T016 [US1] Implement orchestration service for per-criteria selection and merge in `packages/domain-core/src/attempts/auto-selection.service.ts`
- [X] T017 [US1] Export Stage 39 attempt selection APIs from `packages/domain-core/src/index.ts`
- [X] T018 [US1] Integrate auto-selection orchestration into attempt creation flow in `apps/api/src/routes/attempts/create.ts`
- [X] T019 [US1] Implement immutable assignment persistence helper (including candidate-pool fingerprint snapshot persistence) in `apps/api/src/modules/attempt/selection-persistence.ts`
- [X] T020 [US1] Add `Idempotency-Key` validation and conflict behavior in `apps/api/src/services/attempt-input-validator.ts`
- [X] T021 [US1] Map Stage 39 selection failures to response envelope/error codes in `apps/api/src/routes/attempts/create.ts`
- [X] T046 [US1] Implement tenant-scoped idempotency claim/replay service in `apps/api/src/modules/attempt/idempotency-claim.service.ts`
- [X] T047 [US1] Enforce mandatory advisory lock and post-lock revalidation in attempt-start orchestration in `apps/api/src/routes/attempts/create.ts`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Prevent Misconfiguration Before Live Use (Priority: P2)

**Goal**: Block invalid automatic criteria configurations at save/publish time with actionable server-side validation errors.

**Independent Test**: Save and publish criteria with invalid totals, missing count mode, and overlap-undersized scenarios; confirm API rejects with structured errors.

### Tests for User Story 2

- [ ] T022 [P] [US2] Add contract tests for auto-criteria validation responses in `apps/api/tests/contract/exams/auto-criteria-validation.contract.test.ts`
- [ ] T023 [P] [US2] Add integration tests for criteria save/publish blocking in `apps/api/tests/integration/mcq-auto-criteria-validation.test.ts`

### Implementation for User Story 2

- [ ] T024 [US2] Implement strict criteria count-mode and total-match validation in `packages/domain-core/src/mcq-exams/mcq-exams.validators.ts`
- [ ] T025 [US2] Implement overlap-risk and undersized-uniqueness validation service in `packages/domain-core/src/mcq-exams/mcq-auto-criteria-validation.service.ts`
- [ ] T026 [US2] Integrate Stage 39 validation into criteria mutation endpoint in `apps/api/src/routes/backoffice/mcq-exams/set-criteria.ts`
- [ ] T027 [US2] Integrate publish-time blocking checks in `apps/api/src/routes/backoffice/mcq-exams/transition-exam.ts`
- [ ] T028 [US2] Add validation error mapping helpers for Stage 39 codes in `apps/api/src/routes/backoffice/mcq-exams/helpers.ts`
- [ ] T029 [US2] Update criteria data access for new filter dimensions with stable ordered candidate retrieval and index-backed query constraints in `packages/domain-core/src/mcq-exams/mcq-exams.repository.ts`

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - Run Hybrid Manual + Auto Selection Safely (Priority: P3)

**Goal**: Support manual + automatic question composition without duplicates while preserving required total count and ordering rules.

**Independent Test**: Configure hybrid exam with manual IDs plus criteria blocks; verify manual-first retention, auto exclusion of manual IDs, no duplicates, and exact final totals.

### Tests for User Story 3

- [ ] T030 [P] [US3] Add hybrid merge/uniqueness unit tests in `packages/domain-core/tests/unit/attempts/hybrid-selection.test.ts`
- [ ] T031 [P] [US3] Add hybrid attempt-start integration tests in `apps/api/tests/integration/create-attempt-hybrid-selection.test.ts`
- [ ] T043 [P] [US3] Add manual-only attempt-start integration tests in `apps/api/tests/integration/create-attempt-manual-only.test.ts`

### Implementation for User Story 3

- [ ] T032 [US3] Extend selection orchestration to exclude manual IDs and support zero-auto edge case in `packages/domain-core/src/attempts/auto-selection.service.ts`
- [ ] T033 [US3] Add manual-first ordering merge logic in `apps/api/src/modules/attempt/selection-persistence.ts`
- [X] T034 [US3] Integrate hybrid diagnostics and final-count enforcement in `apps/api/src/routes/attempts/create.ts`

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Performance, observability, and governance closure across all stories.

- [ ] T035 [P] Add 500-concurrent attempt-start load test with explicit integrity assertions (no duplicate assignments, exact counts, no partial writes) in `apps/api/tests/load/auto-selection-concurrency.test.ts`
- [ ] T036 [P] Add combined benchmark gate (50k+ pool, 500 concurrent starts, P95 <= 200 ms) in `apps/api/tests/performance/auto-selection.performance.test.ts`
- [ ] T037 Update Stage 39 operator verification flow in `specs/runtime/039-auto-selection-engine/quickstart.md`
- [ ] T038 Record validation run outcomes and threshold pass/fail evidence in `specs/runtime/039-auto-selection-engine/reports/TASKS_VALIDATION_REPORT.md`
- [ ] T039 [P] Add mandatory eligibility-constraints integration matrix test in `apps/api/tests/integration/create-attempt-eligibility-matrix.test.ts`
- [ ] T040 [P] Add selection observability metrics emission and assertions in `apps/api/tests/integration/auto-selection-observability.test.ts`
- [ ] T048 [P] Add trust-chain negative tests (401/403/license blocked) for attempt and criteria endpoints in `apps/api/tests/integration/auto-selection-trust-chain-negative.test.ts`
- [ ] T049 [P] Add cross-tenant isolation integration tests for selection and criteria routes in `apps/api/tests/integration/auto-selection-tenant-isolation.test.ts`
- [ ] T051 [P] Add middleware-order contract tests asserting correlation -> tenant -> license -> version -> auth -> handler for attempt and criteria endpoints in `apps/api/tests/contract/middleware/auto-selection-middleware-order.contract.test.ts`
- [ ] T052 [P] Add criteria save/publish transactional rollback tests (no partial writes on validation failure) in `apps/api/tests/integration/mcq-auto-criteria-transaction-rollback.test.ts`
- [ ] T053 [P] Add observability contract tests asserting required structured fields on success and failure (`request_id`, `correlation_id`, `workspace_slug`, `exam_id`, `attempt_id`, `selection_seed`, `criteria_block_count`, `pool_sizes`, `selected_count`, `duplicate_count`) in `apps/api/tests/contract/attempts/auto-selection-observability.contract.test.ts`
- [ ] T054 [P] Add forced DB-error rollback integration test proving attempt-start atomic rollback across idempotency claim, attempt snapshot, and attempt_questions writes in `apps/api/tests/integration/create-attempt-transaction-rollback.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies; start immediately.
- Phase 2 (Foundational): depends on Phase 1; blocks all user stories.
- Phase 3 (US1): depends on Phase 2.
- Phase 4 (US2): depends on Phase 2; can run in parallel with US1 after foundational completion.
- Phase 5 (US3): depends on Phase 2 and integration points from US1 selection orchestration.
- Phase 6 (Polish): depends on completion of desired user stories.

### User Story Dependencies

- US1 (P1): no dependency on other stories after foundational tasks.
- US2 (P2): no dependency on US1 for criteria validation; can run independently after foundational tasks.
- US3 (P3): depends on US1 selection engine primitives and attempt-start integration.

### Within Each User Story

- Tests first (write and confirm failing before implementation).
- Core domain logic before API integration.
- Persistence and diagnostics before final response mapping.

---

## Parallel Opportunities

### Setup Phase

- T003 can run in parallel with T001-T002.

### Foundational Phase

- T005 and T006 can run in parallel after T004 starts.
- T009 and T011 can run in parallel after T008.

### User Story 1

- T012, T013, T014, T041, T042, T044, and T045 can run in parallel.
- T015 and T019 can run in parallel before T018 integration.

### User Story 2

- T022 and T023 can run in parallel.
- T024 and T029 can run in parallel before endpoint wiring in T026-T028.

### User Story 3

- T030, T031, and T043 can run in parallel.
- T032 and T033 can run in parallel before T034 integration.

### Polish Phase

- T035 and T036 can run in parallel.
- T039 and T040 can run in parallel with other polish checks once core behavior is stable.
- T048 and T049 can run in parallel as post-integration security/isolation verification gates.

---

## Parallel Example: User Story 1

```bash
# Run these in parallel once foundational tasks are complete:
Task T012: packages/domain-core/tests/unit/attempts/auto-selection.shuffle.test.ts
Task T013: packages/domain-core/tests/unit/attempts/auto-selection.rules.test.ts
Task T014: apps/api/tests/integration/create-attempt-auto-selection.test.ts

# Then parallel implementation tasks:
Task T015: packages/domain-core/src/attempts/auto-selection.selector.ts
Task T019: apps/api/src/modules/attempt/selection-persistence.ts
```

---

## Parallel Example: User Story 2

```bash
# Validation test lanes in parallel:
Task T022: apps/api/tests/contract/exams/auto-criteria-validation.contract.test.ts
Task T023: apps/api/tests/integration/mcq-auto-criteria-validation.test.ts

# Domain layer preparation in parallel:
Task T024: packages/domain-core/src/mcq-exams/mcq-exams.validators.ts
Task T029: packages/domain-core/src/mcq-exams/mcq-exams.repository.ts
```

---

## Parallel Example: User Story 3

```bash
# Hybrid verification in parallel:
Task T030: packages/domain-core/tests/unit/attempts/hybrid-selection.test.ts
Task T031: apps/api/tests/integration/create-attempt-hybrid-selection.test.ts

# Hybrid merge internals in parallel:
Task T032: packages/domain-core/src/attempts/auto-selection.service.ts
Task T033: apps/api/src/modules/attempt/selection-persistence.ts
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end-to-end.
3. Validate deterministic replay, atomic persistence, and insufficiency failures.
4. Demo/deploy MVP.

### Incremental Delivery

1. Add US2 validation hardening after US1.
2. Add US3 hybrid mode after US1 core is stable.
3. Finish with load/performance and governance validation in Phase 6.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. After Phase 2:
   - Engineer A: US1 (attempt-start engine)
   - Engineer B: US2 (criteria validation/publish guard)
   - Engineer C: US3 (hybrid merge) after US1 primitives land
3. Integrate in Phase 6 and run full validation pipeline.

---

## Notes

- All tasks follow required checklist format: `- [ ] T### [P] [US#] Description with file path`.
- `[P]` indicates parallel-safe tasks with separate files and no incomplete-task dependency.
- User-story tasks include mandatory `[US#]` labels.
- Keep schema changes additive and forward-only.
- Preserve API error envelope `{ success, data, error }` and structured logging contract.

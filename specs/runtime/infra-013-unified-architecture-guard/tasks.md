# Tasks: Unified Architecture Guard

**Input**: Design documents from `/specs/runtime/infra-013-unified-architecture-guard/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included because this stage defines independent test criteria and measurable outcomes in `spec.md`.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`) for story-phase tasks only
- All tasks include exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare unified-guard scaffolding and stage-linked script entrypoints.

- [x] T001 Create unified guard workspace structure in `scripts/architecture-guard/architecture-guard.ts`
- [x] T002 Create runner skeleton and mode parser in `scripts/architecture-guard/runner.ts`
- [x] T003 [P] Create shared guard types for run/rule/violation contracts in `scripts/architecture-guard/types.ts`
- [x] T004 [P] Add stage-scoped npm scripts (`arch:guard`, `arch:guard:ci`, `arch:guard:changed`) in `package.json`
- [x] T005 [P] Create deterministic report utility shell in `scripts/architecture-guard/reporters/json-reporter.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared orchestration primitives required by all user stories.

**CRITICAL**: No user story implementation starts until this phase is complete.

- [x] T006 Implement canonical mode resolution (`development|strict|changed`) in `scripts/architecture-guard/mode.ts`
- [x] T007 [P] Implement changed-files discovery and baseline abstraction in `scripts/architecture-guard/utils/changed-files.ts`
- [x] T008 [P] Implement safe fallback reason resolver for incremental mode in `scripts/architecture-guard/utils/fallback.ts`
- [x] T009 Implement rule registry and deterministic rule ordering in `scripts/architecture-guard/rule-registry.ts`
- [x] T010 [P] Implement shared violation normalization and remediation formatting in `scripts/architecture-guard/reporters/violation-normalizer.ts`
- [x] T011 Add unified runner wiring to existing governance scripts in `scripts/ai-guard.ts`
- [x] T012 Add unified runner entry shim for type-safety checks in `scripts/type-safety-guard.ts`

**Checkpoint**: Foundation complete; user stories can be implemented in priority order.

---

## Phase 3: User Story 1 - Block Architecture Violations Early (Priority: P1) 🎯 MVP

**Goal**: Provide one strict governance entrypoint that blocks architecture violations consistently.

**Independent Test**: Introduce a controlled forbidden import in a fixture and verify strict mode returns `BLOCKED` with actionable violation metadata.

### Tests for User Story 1

- [x] T013 [P] [US1] Add strict-mode blocked-case test fixture in `tests/static/architecture-guard/fixtures/us1-forbidden-import.ts`
- [x] T014 [P] [US1] Add strict-mode pass-case test fixture in `tests/static/architecture-guard/fixtures/us1-valid-import.ts`
- [x] T015 [US1] Add strict-mode governance test for deterministic pass/fail verdict in `tests/static/architecture-guard/us1-strict-mode.test.ts`

### Implementation for User Story 1

- [x] T016 [P] [US1] Implement dependency and cross-app boundary rule adapter in `scripts/architecture-guard/rules/dependency-boundaries.rule.ts`
- [x] T017 [P] [US1] Implement circular-dependency rule adapter in `scripts/architecture-guard/rules/circular-dependency.rule.ts`
- [x] T018 [P] [US1] Implement FR-009A database-per-tenant signal check in `scripts/architecture-guard/rules/non-negotiables.rule.ts`
- [x] T019 [US1] Integrate US1 rule adapters into deterministic execution pipeline in `scripts/architecture-guard/runner.ts`
- [x] T020 [US1] Emit structured strict-mode violations (`rule`, `location`, `source_module`, `remediation`) in `scripts/architecture-guard/reporters/json-reporter.ts`
- [x] T038 [P] [US1] Implement unsafe TS suppression detection rule in `scripts/architecture-guard/rules/type-safety-suppression.rule.ts`
- [x] T039 [US1] Add TS suppression detection tests (positive/negative) in `tests/static/architecture-guard/us1-type-safety-suppression.test.ts`
- [x] T042 [P] [US1] Implement FR-009B cross-tenant join pattern detection in `scripts/architecture-guard/rules/non-negotiables.rule.ts`
- [x] T043 [P] [US1] Implement FR-009C license middleware contract-presence rule in `scripts/architecture-guard/rules/non-negotiables.rule.ts`
- [x] T044 [P] [US1] Implement FR-009D architecture drift consistency rule in `scripts/architecture-guard/rules/non-negotiables.rule.ts`
- [x] T045 [US1] Add FR-009A/FR-009B/FR-009C/FR-009D rule coverage tests in `tests/static/architecture-guard/us1-non-negotiables.test.ts`

**Checkpoint**: User Story 1 is independently functional and strict mode blocks known architecture violations.

---

## Phase 4: User Story 2 - Validate Changed Mode Quickly (Priority: P2)

**Goal**: Add fast changed validation with safe fallback while preserving strict-rule consistency.

**Independent Test**: Run changed mode with a small file diff and verify scoped validation, then simulate missing baseline and verify deterministic full-scan fallback.

### Tests for User Story 2

- [x] T021 [P] [US2] Add changed-mode fixture set for scoped diff evaluation in `tests/static/architecture-guard/fixtures/us2-changed-scope/README.md`
- [x] T022 [US2] Add changed-mode scoped-validation test in `tests/static/architecture-guard/us2-changed-mode.test.ts`
- [x] T023 [US2] Add changed-mode fallback test (`graph_missing`/`graph_stale`) in `tests/static/architecture-guard/us2-fallback-mode.test.ts`

### Implementation for User Story 2

- [x] T024 [P] [US2] Implement changed-scope expansion using dependency graph inputs in `scripts/architecture-guard/utils/impact-expansion.ts`
- [x] T025 [P] [US2] Implement unchanged-file skip accounting for report scope metrics in `scripts/architecture-guard/utils/scope-accounting.ts`
- [x] T026 [US2] Add changed-mode execution path and fallback branching in `scripts/architecture-guard/runner.ts`
- [x] T027 [US2] Include fallback reason and scope counters in JSON output contract in `scripts/architecture-guard/reporters/json-reporter.ts`
- [x] T041 [US2] Add changed-vs-strict performance assertion task for SC-002 in `tests/performance/architecture-guard/us2-changed-vs-strict.benchmark.test.ts`
- [x] T046 [US2] Add strict-vs-changed rule parity assertion test for identical changed surfaces in `tests/static/architecture-guard/us2-parity-mode.test.ts`

**Checkpoint**: User Story 2 is independently testable with fast-path validation and deterministic fallback behavior.

---

## Phase 5: User Story 3 - Keep AI and Governance Context Current (Priority: P3)

**Goal**: Regenerate and validate architecture context artifacts for governance and AI consumers.

**Independent Test**: Trigger architecture-context generation and validate required artifacts and brain integrity checks pass.

### Tests for User Story 3

- [x] T028 [P] [US3] Add artifact-presence integration test for required context files in `tests/integration/architecture-context/us3-artifact-generation.test.ts`
- [x] T029 [US3] Add architecture-brain validation test hook in `tests/integration/architecture-context/us3-brain-validation.test.ts`

### Implementation for User Story 3

- [x] T030 [P] [US3] Add unified runner hook to trigger architecture context generation in `scripts/architecture-guard/hooks/generate-context.ts`
- [x] T031 [P] [US3] Add unified runner hook to validate `ai-architecture-brain.json` in `scripts/architecture-guard/hooks/validate-brain.ts`
- [x] T032 [US3] Integrate context generation/validation hooks into strict and changed workflows in `scripts/architecture-guard/runner.ts`
- [x] T033 [US3] Update stage quickstart command flow and expected artifact verification in `specs/runtime/infra-013-unified-architecture-guard/quickstart.md`

**Checkpoint**: User Story 3 is independently functional with reproducible artifact generation and validation.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, docs alignment, and full-pipeline verification for the stage.

- [x] T034 [P] Add consolidated architecture-guard usage documentation in `docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md`
- [x] T035 Add stage report update with implemented verification evidence in `specs/runtime/infra-013-unified-architecture-guard/reports/PLAN_REPORT.md`
- [x] T036 Run and record governance validation pipeline outputs in `specs/runtime/infra-013-unified-architecture-guard/reports/TASKS_VALIDATION_REPORT.md`
- [x] T037 [P] Add/adjust npm script docs for guard modes in `README.md`
- [x] T040 Add no-runtime-mutation regression guard for SC-006 in `tests/static/architecture-guard/stage-scope-regression.test.ts`
- [x] T047 Add JSON schema validation task for unified guard output contract in `tests/static/architecture-guard/contract-schema-validation.test.ts`
- [x] T048 Add backward-compatibility snapshot test for report JSON structure in `tests/static/architecture-guard/contract-backward-compat.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2; delivers MVP strict blocking behavior.
- **Phase 4 (US2)**: Depends on Phase 2; may start after US1 or in parallel if teams are split, but final integration follows US1 pipeline contracts.
- **Phase 5 (US3)**: Depends on Phase 2; can proceed after US1 contracts are stable.
- **Phase 6 (Polish)**: Depends on completion of intended user stories.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after foundational completion.
- **US2 (P2)**: Depends on foundational runner primitives and reuses US1 reporting contract.
- **US3 (P3)**: Depends on foundational runner and integrates with established guard flow.

### Within Each User Story

- Tests before implementation.
- Rule/hook modules before runner integration.
- Runner integration before documentation/reporting updates.

### Parallel Opportunities

- Setup tasks `T003`, `T004`, `T005` can run in parallel.
- Foundational tasks `T007`, `T008`, `T010` can run in parallel.
- US1 rule adapters `T016`, `T017`, `T018` can run in parallel.
- US2 utility tasks `T024`, `T025` can run in parallel.
- US3 hook tasks `T030`, `T031` can run in parallel.
- Polish tasks `T034` and `T037` can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Parallel test-fixture work
T013 -> tests/static/architecture-guard/fixtures/us1-forbidden-import.ts
T014 -> tests/static/architecture-guard/fixtures/us1-valid-import.ts

# Parallel rule implementation
T016 -> scripts/architecture-guard/rules/dependency-boundaries.rule.ts
T017 -> scripts/architecture-guard/rules/circular-dependency.rule.ts
T018 -> scripts/architecture-guard/rules/non-negotiables.rule.ts
```

## Parallel Example: User Story 2

```bash
# Parallel changed-mode utilities
T024 -> scripts/architecture-guard/utils/impact-expansion.ts
T025 -> scripts/architecture-guard/utils/scope-accounting.ts
```

## Parallel Example: User Story 3

```bash
# Parallel context hooks
T030 -> scripts/architecture-guard/hooks/generate-context.ts
T031 -> scripts/architecture-guard/hooks/validate-brain.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1 strict blocking + structured violations).
3. Validate strict-mode independent test criteria.
4. Demo/deploy governance MVP.

### Incremental Delivery

1. Setup + Foundational.
2. Add US1 and validate.
3. Add US2 and validate changed-mode behavior.
4. Add US3 and validate artifact generation/brain checks.
5. Run final polish pipeline and documentation updates.

### Stage Scope Guard

- Keep all tasks constrained to infrastructure governance files and docs.
- Do not modify runtime tenant data flow, license behavior, or attempt engine logic.

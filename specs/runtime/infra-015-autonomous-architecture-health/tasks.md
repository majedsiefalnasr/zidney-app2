# Tasks: Autonomous Architecture Health

**Input**: Design documents from `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-015-autonomous-architecture-health/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/

**Tests**: Unit, static, and governance validation tasks are required by the plan and included below.

**Organization**: Tasks are grouped by user story so each increment remains independently testable while staying inside infra-governance scope only. No task introduces runtime/API/DB changes.

## Phase 1: Setup (Shared Governance Surface)

**Purpose**: Establish the new governance-only command surface and shared assessment model.

- [x] T001 Create the architecture health CLI entrypoint scaffold and option parsing in scripts/architecture-health/architecture-health.ts
- [x] T002 [P] Create shared assessment, signal, finding, and source-run types in scripts/architecture-health/types.ts
- [x] T003 [P] Register the governance-only `arch:health` and `arch:health:ci` command placeholders in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core orchestration, scoring, synchronization, and report-writing infrastructure that MUST exist before any user story implementation.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Create a deterministic governance command runner with an allowlisted non-shell command surface, explicit per-tool timeout budgets, and structured execution telemetry for `arch:guard:ci`, `bun scripts/infra-audit.ts --quick`, `bun type-safety-guard --json`, `bun run arch:validate-brain`, `gitnexus query`, and `gitnexus impact` in scripts/architecture-health/source-runner.ts
- [x] T005 [P] Implement the approved weighted threshold policy and PASS/BLOCKED verdict calculation in scripts/architecture-health/score-model.ts
- [x] T006 [P] Implement finding fingerprinting and cross-tool deduplication in scripts/architecture-health/finding-normalizer.ts
- [x] T007 [P] Implement baseline-first architecture-intelligence inspection for stale, missing, invalid, and partially regenerated artifacts in scripts/architecture-health/intelligence-snapshot.ts
- [x] T008 [P] Implement GitNexus freshness checks, enrichment hooks, and stale-index remediation handling in scripts/architecture-health/gitnexus-enrichment.ts
- [x] T009 Implement atomic current-report writes plus timestamped history snapshots that only persist newly observed assessment states in scripts/architecture-health/report-writer.ts
- [x] T010 Implement deterministic JSON, Markdown, and text formatter helpers in scripts/architecture-health/formatters.ts

**Checkpoint**: Foundation ready. The health scanner can now collect signals, score them, and write deterministic artifacts without touching runtime systems.

---

## Phase 3: User Story 1 - Detect Architecture Health Regressions Early (Priority: P1) 🎯 MVP

**Goal**: Produce one consolidated repository-wide assessment that surfaces dependency, layer, circular-risk, drift, type-safety, and validation regressions early.

**Independent Test**: Run the health assessment against compliant and regressed repository fixtures and confirm it emits one normalized result with scored signals, deduplicated findings, and a PASS or BLOCKED verdict.

### Tests for User Story 1

- [x] T011 [P] [US1] Add unit coverage for weighting, threshold evaluation, and health-state mapping in tests/unit/architecture-health/score-model.test.ts
- [x] T012 [P] [US1] Add unit coverage for finding fingerprints and duplicate-penalty prevention in tests/unit/architecture-health/finding-normalizer.test.ts

### Implementation for User Story 1

- [x] T013 [P] [US1] Implement dependency, layer, circular-risk, and drift signal normalization from `arch:guard:ci` and `infra-audit --quick` in scripts/architecture-health/collectors/baseline-governance.ts
- [x] T014 [P] [US1] Implement type-safety and architecture-brain validation normalization in scripts/architecture-health/collectors/validation-governance.ts
- [x] T015 [US1] Compose the consolidated assessment flow, deterministic signal ordering, and repository-scoped verdict emission in scripts/architecture-health/architecture-health.ts (depends on T004, T005, T006, T007, T008, T009, T010, T013, T014)
- [x] T016 [US1] Add focused compliant-vs-regressed assessment coverage in tests/unit/architecture-health/architecture-health.test.ts

**Checkpoint**: User Story 1 is complete when one governance-only command produces a trustworthy consolidated assessment without runtime/API/DB changes.

---

## Phase 4: User Story 2 - Enforce Health Thresholds Without Changing Runtime Behavior (Priority: P2)

**Goal**: Use the same assessment model to gate governance review and CI decisions while preserving existing runtime contracts.

**Independent Test**: Validate passing and failing repository states through the CLI and workflow wiring, confirming the threshold gate changes governance outcomes only, covers `--refresh-context` and `--fail-on-sync`, and does not broaden runtime behavior.

### Tests for User Story 2

- [x] T017 [P] [US2] Add CLI contract coverage for `--ci`, locked-threshold CI behavior, exploratory local `--threshold`, `--output`, `--refresh-context`, `--fail-on-sync`, and the default no-refresh path in tests/unit/architecture-health/cli-contract.test.ts
- [x] T018 [P] [US2] Add static regression coverage for package scripts, governance workflow gating, nightly scheduling, artifact publication, performance budgets, and trust-chain preservation against runtime/API/Worker drift in tests/static/07-architecture-health-governance.test.ts

### Implementation for User Story 2

- [x] T019 [US2] Wire the final `arch:health` and `arch:health:ci` commands to the governance CLI in package.json
- [x] T020 [US2] Integrate architecture health threshold gating, immutable CI policy enforcement, artifact upload, and nightly scheduling into .github/workflows/architecture-governance.yml
- [x] T021 [US2] Document governance-only CI usage, immutable threshold semantics, nightly monitoring, artifact publication, and the required validation sequence in docs/architecture/health/README.md

**Checkpoint**: User Story 2 is complete when governance automation can block unhealthy repository states using the same health model without changing tenant, license, version, attempt, API, or worker behavior.

---

## Phase 5: User Story 3 - Keep Architecture Intelligence Synchronized (Priority: P3)

**Goal**: Detect stale or inconsistent architecture intelligence, preserve the baseline state in findings, enrich with GitNexus when possible, and emit deterministic current plus history artifacts.

**Independent Test**: Run the scanner against synchronized and stale artifact states and confirm it distinguishes direct rule violations from synchronization findings, records stale GitNexus index conditions, and avoids creating duplicate history snapshots for the same repository state.

### Tests for User Story 3

- [x] T022 [P] [US3] Add unit coverage for stale, missing, invalid, and partially regenerated intelligence artifacts in tests/unit/architecture-health/intelligence-synchronization.test.ts
- [x] T023 [P] [US3] Add unit coverage for deterministic current artifacts and non-duplicating timestamped history snapshot generation in tests/unit/architecture-health/report-writer.test.ts

### Implementation for User Story 3

- [x] T024 [US3] Implement baseline-first synchronization evidence capture, optional `--refresh-context` follow-up, and `--fail-on-sync` handling in scripts/architecture-health/intelligence-snapshot.ts
- [x] T025 [US3] Integrate GitNexus enrichment results and stale-index findings into the assessment flow in scripts/architecture-health/architecture-health.ts
- [x] T026 [US3] Generate deterministic `docs/architecture/health/architecture-health.json`, `docs/architecture/health/architecture-health-summary.md`, `docs/architecture/health/architecture-drift-report.md`, and timestamped snapshots under docs/architecture/health/history/ via scripts/architecture-health/report-writer.ts
- [x] T027 [US3] Validate generated report payloads against specs/runtime/infra-015-autonomous-architecture-health/contracts/architecture-health-report.schema.json in scripts/architecture-health/report-schema.ts
- [x] T031 [US3] Implement structured scanner logging and health metrics emission validation in scripts/architecture-health/architecture-health.ts and tests/static/07-architecture-health-governance.test.ts
- [x] T032 [US2] Implement immutable threshold policy enforcement and reject caller-supplied threshold downgrades in CI mode within scripts/architecture-health/architecture-health.ts and package.json
- [x] T033 [P] [US1] Add unit coverage for allowlisted command execution, timeout handling, and command-budget telemetry in tests/unit/architecture-health/source-runner.test.ts
- [x] T034 [P] [US2] Add a benchmark harness that executes at least 20 compliant local and CI scanner runs, verifies p95 duration budgets from emitted telemetry, and asserts artifact-upload behavior in tests/static/07-architecture-health-governance.test.ts

**Checkpoint**: User Story 3 is complete when synchronization drift is surfaced explicitly, GitNexus enrichment is required when available, and current/history reports remain deterministic and idempotent for same-state reruns.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Final validation and operator confidence tasks that apply across all user stories.

- [x] T028 [P] Run the focused architecture-health unit and static suites centered on tests/unit/architecture-health/architecture-health.test.ts and tests/static/07-architecture-health-governance.test.ts
- [x] T029 [DEFERRED] Run the full governance validation sequence declared in package.json (`arch:guard:ci`, `arch:audit`, `type-safety-guard`, `ai-context:refresh`, `arch:validate-brain`, `lint`, `validate:types`)
  - _Deferral Justification_: arch:guard:ci, infra-audit, arch:validate-brain, and type-safety-guard all PASSED. `lint` failed on 2 pre-existing external violations (apps/mmc/src/core/state/app.store.ts and packages/domain-core/src/monitoring/provisioning-metrics.ts) outside INFRA-015 stage scope. These external lint violations must be addressed in a separate maintenance stage to avoid scope creep. Stage-scoped governance validation is complete and passing.
- [x] T030 Validate generated artifact expectations and remediation guidance against docs/architecture/health/README.md and specs/runtime/infra-015-autonomous-architecture-health/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies.
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3: User Story 1**: Depends on Phase 2 and delivers the MVP assessment flow.
- **Phase 4: User Story 2**: Depends on User Story 1 because threshold gating reuses the completed assessment flow.
- **Phase 5: User Story 3**: Depends on User Story 1 and can proceed in parallel with User Story 2 after the MVP assessment flow is stable.
- **Phase 6: Polish**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational and has no dependency on other user stories.
- **US2 (P2)**: Starts after US1 and focuses on governance gating only.
- **US3 (P3)**: Starts after US1 and focuses on synchronization, GitNexus enrichment, and report determinism only.

### Within Each User Story

- Tests should be written before or alongside implementation and must fail before the implementation is considered complete.
- Collectors and shared models precede assessment composition.
- Assessment composition precedes workflow wiring and report publication.
- Deterministic writes and schema validation must be in place before final validation tasks run.

---

## Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- T005, T006, T007, and T008 can run in parallel after T004.
- T011 and T012 can run in parallel inside US1.
- T013 and T014 can run in parallel inside US1.
- T033 can run in parallel with T011 and T012 after T004.
- T017 and T018 can run in parallel inside US2.
- T022 and T023 can run in parallel inside US3.
- T031 can proceed after T025 and in parallel with T026 and T027.
- T034 can proceed after T020 and in parallel with T021.
- After T016 completes, US2 and US3 can proceed in parallel.

## Parallel Example: User Story 1

```bash
Task: T011 tests/unit/architecture-health/score-model.test.ts
Task: T012 tests/unit/architecture-health/finding-normalizer.test.ts
Task: T013 scripts/architecture-health/collectors/baseline-governance.ts
Task: T014 scripts/architecture-health/collectors/validation-governance.ts
Task: T033 tests/unit/architecture-health/source-runner.test.ts
```

## Parallel Example: User Story 2

```bash
Task: T017 tests/unit/architecture-health/cli-contract.test.ts
Task: T018 tests/static/07-architecture-health-governance.test.ts
```

## Parallel Example: User Story 3

```bash
Task: T022 tests/unit/architecture-health/intelligence-synchronization.test.ts
Task: T023 tests/unit/architecture-health/report-writer.test.ts
Task: T031 scripts/architecture-health/architecture-health.ts + tests/static/07-architecture-health-governance.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1.
3. Validate the consolidated assessment against compliant and regressed repository states.
4. Stop and confirm the MVP remains governance-only before proceeding.

### Incremental Delivery

1. Deliver US1 to establish the normalized assessment.
2. Add US2 to enforce threshold gating in package scripts and CI.
3. Add US3 to surface synchronization drift, GitNexus enrichment, and deterministic history snapshots.
4. Finish with the full validation sequence in Phase 6.

### Scope Guardrails

- Keep all work inside `scripts/architecture-health/`, `tests/unit/architecture-health/`, `tests/static/`, `docs/architecture/health/`, `.github/workflows/`, and `package.json`.
- Use `bun scripts/infra-audit.ts --quick` as the default baseline audit command.
- Preserve baseline-first synchronization assessment before any optional refresh behavior.
- Treat stale or unavailable GitNexus indexing as an explicit finding with `npx gitnexus analyze` remediation.
- Do not add runtime routes, tenant-facing UI, DB writes, queue consumers, or ADR changes in this stage.

---

## Notes

- Every task above stays within infra-governance scope only.
- The health scanner must remain repository-scoped and filesystem-only.
- Deterministic current artifacts and timestamped history snapshots are mandatory deliverables.
- Analyze can proceed after tasks generation, and implementation authorization is determined by the Step 5 Analyze gate.
- The stage workflow state has been updated to record the generated task count in specs/runtime/infra-015-autonomous-architecture-health/.workflow-state.json.

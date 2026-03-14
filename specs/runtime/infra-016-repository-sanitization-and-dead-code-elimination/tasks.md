# Tasks: Repository Sanitization and Dead Code Elimination

**Input**: Design documents from `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`

**Tests**: This stage relies on existing repository validation gates instead of new feature-specific test suites. Tasks include validation runs and any required updates to stale test references caused by cleanup.

**Organization**: Tasks are grouped by user story so repository sanitization can be executed, validated, and reviewed in reversible increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when they touch different files or independent inventory slices
- **[Story]**: Maps the task to `US1`, `US2`, or `US3`
- Every task includes the file path or repository surface that must be updated or verified

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the stage-owned tracking artifacts used to inventory, classify, batch, and report repository cleanup work.

- [ ] T001 Create the master sanitization inventory in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_INVENTORY.md`
- [ ] T002 [P] Create the evidence log in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/EVIDENCE_MATRIX.md`
- [ ] T003 [P] Create the duplicate tracker in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/DUPLICATE_GROUPS.md`
- [ ] T004 [P] Create the rollback batch tracker in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/ROLLBACK_BATCHES.md`
- [ ] T005 [P] Create the decision register in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_DECISIONS.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Capture the protected baseline and repository-wide evidence model before any cleanup decisions are applied.

**⚠️ CRITICAL**: No removal or consolidation work should begin until this phase is complete.

- [ ] T006 Define the protected-asset allowlist and derived protection rules in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/PROTECTED_ASSETS.md`
- [ ] T007 [P] Inventory in-scope assets under `apps/` and `packages/` into `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_INVENTORY.md`
- [ ] T008 [P] Inventory in-scope assets under `scripts/`, `.agents/skills/`, `docs/`, `.github/workflows/`, `.husky/`, and `package.json` into `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_INVENTORY.md`
- [ ] T009 [P] Collect governance-reference evidence from `AGENTS.md`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `docs/ai/`, `docs/architecture/`, `docs/architecture/health/`, `specs/STAGE_LIFECYCLE_POLICY.md`, `specs/phases/MASTER_EXECUTION_ROADMAP.md`, committed governance reports, `scripts/ai-guard.ts`, `scripts/architecture-diff.ts`, `scripts/infra-audit.ts`, `scripts/type-safety-guard.ts`, `scripts/generate-ai-context.ts`, `scripts/gitnexus-context.ts`, and `scripts/validate-architecture-brain.ts` into `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/EVIDENCE_MATRIX.md`
- [ ] T010 [P] Collect execution and support-surface evidence from `package.json`, `.github/workflows/`, `.husky/`, `scripts/`, `.agents/skills/`, `tests/`, `bun.lock`, `vitest.config.ts`, `vitest.workspace.ts`, and `lint-staged.config.mjs` into `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/EVIDENCE_MATRIX.md`
- [ ] T011 Resolve the initial asset states and manual-review criteria in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_DECISIONS.md`

**Checkpoint**: The repository inventory, evidence model, and protected baseline are ready for cleanup work.

---

## Phase 3: User Story 1 - Remove Inactive Repository Assets Safely (Priority: P1) 🎯 MVP

**Goal**: Remove only assets that have zero unresolved usage evidence while preserving governance-critical artifacts and documenting every decision.

**Independent Test**: Review `SANITIZATION_INVENTORY.md`, `EVIDENCE_MATRIX.md`, `PROTECTED_ASSETS.md`, and `SANITIZATION_DECISIONS.md` and confirm every removal candidate has explicit evidence while all protected assets remain excluded from deletion.

- [ ] T012 [US1] Classify protected assets and protected descendants from `docs/ai/`, `docs/architecture/`, `.github/workflows/`, `.husky/`, `AGENTS.md`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `docs/AGENT_GOVERNANCE.md`, `docs/PROJECT_CONTEXT_PRIMER.md`, `specs/STAGE_LIFECYCLE_POLICY.md`, `specs/phases/MASTER_EXECUTION_ROADMAP.md`, `package.json`, and the protected scripts listed in `spec.md` including `scripts/architecture-diff.ts` inside `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/PROTECTED_ASSETS.md`
- [ ] T013 [P] [US1] Verify zero unresolved references for removal candidates in unprotected `scripts/` and non-governance `package.json` entries, using evidence from code, CI, hooks, AGENTS, AI-context outputs, and support surfaces, and record the findings in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/EVIDENCE_MATRIX.md`
- [ ] T014 [P] [US1] Verify zero unresolved references for removal candidates in `apps/`, `packages/`, unprotected `.agents/skills/`, and unprotected `docs/` paths, using evidence from code, tests, CI, hooks, AGENTS guidance, AI-context outputs, architecture-intelligence outputs, committed governance reports, `bun.lock`, and repository tool configs, and record the findings in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/EVIDENCE_MATRIX.md`
- [ ] T015 [US1] Mark ambiguous or conflicting candidates as `manual_review` in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_DECISIONS.md`
- [ ] T016 [P] [US1] Remove confirmed generated artifacts, Finder noise, and empty scaffolding only within approved governed roots under `apps/`, `packages/`, `scripts/`, and unprotected `docs/` paths, and record deleted paths in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_INVENTORY.md`
- [ ] T017 [P] [US1] Remove dead scripts and dead skill directories from `scripts/` and `.agents/skills/` and record the deletions in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_INVENTORY.md`
- [ ] T018 [US1] Remove dead dependencies and dead non-governance script wiring from `package.json`, regenerate `bun.lock` only as a derived side effect when dependencies change, and record rationale in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_DECISIONS.md`
- [ ] T019 [US1] Record each applied cleanup batch, run the minimum affected validation gates before the next batch begins, and capture the rollback point in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/ROLLBACK_BATCHES.md`

**Checkpoint**: Dead assets with clear evidence are removed without touching protected governance surfaces.

---

## Phase 4: User Story 2 - Reduce Repository Noise and Duplication (Priority: P2)

**Goal**: Collapse duplicate repository assets to one authoritative artifact per governed purpose without weakening documentation or workflow intent.

**Independent Test**: Review `DUPLICATE_GROUPS.md` and confirm each governed purpose has one authoritative survivor, any unique behavior is preserved, and obsolete duplicates are explicitly marked for removal or consolidation.

- [ ] T020 [P] [US2] Group duplicate documentation and report surfaces across unprotected `docs/` paths and `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/` in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/DUPLICATE_GROUPS.md`
- [ ] T021 [P] [US2] Group duplicate scripts, package scripts, workflows, and hook entry points across `scripts/`, `package.json`, `.github/workflows/`, and `.husky/` in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/DUPLICATE_GROUPS.md`
- [ ] T022 [P] [US2] Group duplicate skills, repository instructions, and governance-routing artifacts across `.agents/skills/`, `AGENTS.md`, and `docs/ai/` in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/DUPLICATE_GROUPS.md`
- [ ] T023 [US2] Select the authoritative survivor and required merge behavior for each duplicate group in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/DUPLICATE_GROUPS.md`
- [ ] T024 [US2] Consolidate duplicate documentation and guidance only in unprotected `docs/` paths and `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/`, while recording removals in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_INVENTORY.md`
- [ ] T025 [US2] Consolidate duplicate scripts and non-governance script wiring only in `scripts/` and unprotected `package.json` entries, and record protected workflow or hook duplicates under manual review instead of mutating `.github/workflows/` or `.husky/`
- [ ] T026 [US2] Consolidate duplicate or inactive unprotected skill surfaces in `.agents/skills/` only, and record any duplicate routing references found in protected governance files such as `AGENTS.md` or `docs/ai/` as `manual_review` in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_DECISIONS.md`

**Checkpoint**: Duplicate repository assets are reduced to one authoritative path per purpose with clear traceability.

---

## Phase 5: User Story 3 - Prove Governance Still Holds After Cleanup (Priority: P3)

**Goal**: Validate that repository cleanup preserves the existing governance, architecture, testing, and AI-context safety chain.

**Independent Test**: Review the validation report and confirm the required gate set still passes after cleanup, or that any pre-existing baseline failures are documented without masking new regressions.

- [ ] T027 [US3] Finalize rollback-safe batch ordering for generated-artifact cleanup, dead-asset removals, dependency cleanup, and duplicate consolidation, including the exact validation checkpoint required after each meaningful batch, in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/ROLLBACK_BATCHES.md`
- [ ] T028 [P] [US3] Run `bun run lint`, `bun run typecheck`, `bun run test`, `bun run arch:guard`, `bun scripts/ai-guard.ts`, `bun scripts/architecture-diff.ts`, `bun scripts/infra-audit.ts`, `bun scripts/validate-architecture-brain.ts`, `bun run type-safety-guard`, and `bun run ai-context:refresh` from repository root and record results in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/audits/VALIDATION_REPORT.md`
- [ ] T029 [P] [US3] Re-validate workflow and hook integrity by running `bun run validate:workflows` for touched workflow files, confirming `.github/workflows/` and `.husky/` remain present, ensuring referenced scripts still exist, verifying that `package.json` plus `lint-staged.config.mjs` still resolve expected hook commands, and confirming protected governance authority files remain present and unmodified, including `AGENTS.md`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `docs/AGENT_GOVERNANCE.md`, `docs/PROJECT_CONTEXT_PRIMER.md`, `specs/STAGE_LIFECYCLE_POLICY.md`, `specs/phases/MASTER_EXECUTION_ROADMAP.md`, `.github/workflows/architecture-governance.yml`, `.husky/pre-commit`, and `.husky/pre-push`; allow only the explicit governance-remediation change to `.github/workflows/hard-mode-guard.yml`, and record the outcome in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/audits/VALIDATION_REPORT.md`
- [ ] T030 [US3] Reclassify any failing cleanup batch to `retain` or `manual_review` in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_DECISIONS.md` and `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/ROLLBACK_BATCHES.md`
- [ ] T031 [US3] Publish the final cleanup outcome, including removed assets, retained protected assets, duplicate survivors, deferred manual reviews, and validation evidence, in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_REPORT.md`

**Checkpoint**: Governance and quality gates remain intact after repository cleanup.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Update supporting documentation and stale references revealed by cleanup so the repository remains internally consistent.

- [ ] T032 [P] Update stale repository-path references in support surfaces `tests/`, `vitest.workspace.ts`, `vitest.config.ts`, and `lint-staged.config.mjs` only when approved sanitization changes require reference-integrity fixes
- [ ] T033 [P] Update the stage operator documentation in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/README.md` and `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/quickstart.md` to match the final batch order, protected-asset rules, and validation sequence
- [ ] T034 Run the final quickstart walkthrough in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/quickstart.md` and capture any remaining follow-up items in `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_REPORT.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all cleanup work.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; this is the MVP cleanup pass.
- **User Story 2 (Phase 4)**: Depends on Foundational and should follow or be coordinated with User Story 1 because duplicate removal relies on the validated inventory and evidence model.
- **User Story 3 (Phase 5)**: Depends on the applied cleanup batches from User Stories 1 and 2.
- **Polish (Phase 6)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1**: Can begin after Phase 2; no dependency on other user stories.
- **US2**: Can begin after Phase 2, but its consolidation outcomes should use the candidate set and evidence produced by US1.
- **US3**: Begins after cleanup batches from US1 and US2 exist and need validation.

### Within Each User Story

- Inventory and evidence tasks must be completed before any deletion or consolidation.
- Cleanup must be applied batch-by-batch and recorded with immediate validation before the next batch begins.
- Validation failures must be resolved by rolling back or reclassifying only the failing batch before moving forward.

### Parallel Opportunities

- `T002` through `T005` can run in parallel because they create separate tracking files.
- `T007` through `T010` can run in parallel because they inventory or gather evidence from independent repository surfaces.
- `T013` and `T014` can run in parallel because they validate different candidate sets.
- `T020` through `T022` can run in parallel because they group duplicates by distinct governed surfaces.
- `T028` and `T029` can run in parallel if separate operators validate repository gates and workflow wiring independently.
- `T032` and `T033` can run in parallel after validation completes.

---

## Parallel Example: User Story 1

```text
T013 Verify zero unresolved references for removal candidates in unprotected scripts/ and non-governance package.json entries
T014 Verify zero unresolved references for removal candidates in apps/, packages/, unprotected .agents/skills/, and unprotected docs/ paths using support surfaces as evidence only
```

## Parallel Example: User Story 2

```text
T020 Group duplicate documentation and report surfaces across unprotected docs/ paths and feature reports/
T021 Group duplicate scripts, package scripts, workflows, and hook entry points across scripts/, package.json, .github/workflows/, and .husky/
T022 Group duplicate skills, repository instructions, and governance-routing artifacts across .agents/skills/, AGENTS.md, and docs/ai/
```

## Parallel Example: User Story 3

```text
T028 Run the required repository validation gates and record results in audits/VALIDATION_REPORT.md
T029 Re-validate workflow and hook integrity for .github/workflows/, .husky/, package.json, and lint-staged.config.mjs
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 to remove dead assets with explicit evidence.
3. Validate the inventory, evidence, decisions, and rollback records before touching duplicate consolidation.

### Incremental Delivery

1. Build the inventory, evidence matrix, protection rules, and decision register.
2. Remove clearly dead assets in rollback-safe batches.
3. Consolidate duplicates only after the dead-asset pass is stable.
4. Run the full governance validation chain and publish the cleanup report.
5. Finish with documentation and stale-reference cleanup.

### Analyze Readiness

1. The task set is ready for analyze once Phase 1 and Phase 2 describe a complete inventory method, explicit protection rules, evidence collection, and batch/validation tracking.
2. Analyze should focus on candidate accuracy, duplicate-group safety, and whether any task still risks crossing into runtime redesign.

---

## Notes

- All deletion and consolidation work must remain inside repository sanitization scope.
- Protected governance assets default to retention unless a future approved stage explicitly supersedes them.
- Ambiguous candidates must be escalated to `manual_review`, not removed.
- Validation evidence is required for sign-off even when no new tests are added.

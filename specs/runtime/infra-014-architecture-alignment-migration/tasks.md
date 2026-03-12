# Tasks: Architecture Alignment Migration

**Input**: Design documents from `/specs/runtime/infra-014-architecture-alignment-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/alignment-verification-contract.md

**Tests**: Verification tasks are included for canonical governance commands and targeted regression suites required by `quickstart.md` and the alignment verification contract.

**Organization**: Tasks are grouped by user story to preserve the compliance-only scope, keep the trust chain intact, and allow each story to be verified independently before moving forward.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the stage-local evidence files and guardrail references used by all later remediation work.

- [ ] T001 Create the baseline evidence workspace in specs/runtime/infra-014-architecture-alignment-migration/audits/ALIGNMENT_BASELINE.md
- [ ] T002 Create the remediation tracker in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md
- [ ] T003 [P] Create the final verification ledger in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md
- [ ] T004 [P] Create the governance workflow guide in specs/runtime/infra-014-architecture-alignment-migration/guides/GOVERNANCE_WORKFLOW.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the canonical scope, invariants, and reporting model before any repository remediation begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Record the governed module scope, remediation file allowlist, and boundary references in specs/runtime/infra-014-architecture-alignment-migration/audits/GOVERNED_SCOPE.md using docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json and docs/architecture/module-boundaries.json
- [ ] T006 [P] Document trust-chain and runtime invariants in specs/runtime/infra-014-architecture-alignment-migration/guides/RUNTIME_INVARIANTS.md using specs/runtime/infra-014-architecture-alignment-migration/quickstart.md and specs/runtime/infra-014-architecture-alignment-migration/contracts/alignment-verification-contract.md
- [ ] T007 [P] Inventory canonical and legacy governance entrypoints plus secret and log-sensitive script surfaces in specs/runtime/infra-014-architecture-alignment-migration/audits/LEGACY_SCRIPT_REVIEW.md using package.json and scripts/
- [ ] T008 Define remediation categories, severity mapping, closure states, and required invariant checks in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md using specs/runtime/infra-014-architecture-alignment-migration/data-model.md and specs/runtime/infra-014-architecture-alignment-migration/research.md

**Checkpoint**: Stage evidence and invariant guardrails are ready for baseline capture.

---

## Phase 3: User Story 1 - Establish a Trusted Alignment Baseline (Priority: P1) 🎯 MVP

**Goal**: Produce a repository-wide, categorized alignment baseline that maintainers can use without reinterpreting governance rules.

**Independent Test**: Review specs/runtime/infra-014-architecture-alignment-migration/audits/ALIGNMENT_BASELINE.md and confirm every finding is grouped by module, rule family, severity, location, and remediation priority.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Capture the unified architecture guard baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/us1-arch-guard-baseline.json using scripts/architecture-guard/architecture-guard.ts
- [ ] T010 [P] [US1] Capture the infrastructure audit baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/us1-infra-audit-baseline.md using scripts/infra-audit.ts
- [ ] T011 [P] [US1] Capture the type-safety baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/us1-type-safety-baseline.json using scripts/type-safety-guard.ts
- [ ] T012 [US1] Merge the baseline outputs into specs/runtime/infra-014-architecture-alignment-migration/audits/ALIGNMENT_BASELINE.md with source tool, module, rule family, severity, and location columns
- [ ] T013 [US1] Add remediation priority, contract mapping, trust-chain risk flags, and hot-path sensitivity flags to specs/runtime/infra-014-architecture-alignment-migration/audits/ALIGNMENT_BASELINE.md using docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json and docs/architecture/module-boundaries.json
- [ ] T014 [US1] Seed specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md with dependency-boundary, circular-dependency, unsafe-type, validation-gap, export-typing, script-overlap, and artifact-drift work queues, each with exact file paths and required invariant checks before execution

**Checkpoint**: User Story 1 is complete when the baseline is authoritative enough to schedule every in-scope remediation item without additional discovery.

---

## Phase 4: User Story 2 - Align Existing Code Without Breaking the Trust Chain (Priority: P2)

**Goal**: Remove repository governance drift while preserving tenant isolation, mandatory license enforcement, standard API error envelopes, and server-authoritative runtime behavior.

**Independent Test**: Compare pre- and post-remediation results in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md and confirm in-scope violations are removed without trust-chain regressions.

### Implementation for User Story 2

- [ ] T015 [US2] Remediate file-scoped cross-app, package-to-app, runtime-to-UI, and UI-to-domain dependency violations in exact paths listed in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md under the governed allowlist from specs/runtime/infra-014-architecture-alignment-migration/audits/GOVERNED_SCOPE.md
- [ ] T016 [US2] Break file-scoped circular dependencies in exact paths listed in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md by moving shared contracts to approved package boundaries only
- [ ] T017 [US2] Replace unsafe typing and add trust-boundary validation in exact paths listed in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md without introducing new `any` escape hatches
- [ ] T018 [US2] Add explicit exported type boundaries in exact public interfaces listed in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md
- [ ] T019 [US2] Consolidate, narrow, or retire overlapping governance checks in package.json and scripts/ documented in specs/runtime/infra-014-architecture-alignment-migration/audits/LEGACY_SCRIPT_REVIEW.md, then rerun the canonical verification entrypoints before closure evidence is accepted
- [ ] T020 [US2] Verify all touched runtime and script paths still preserve authentication flow, correlation propagation, tenant resolver coverage, license enforcement order, schema and product compatibility checks, worker authority, server-authoritative time, transaction and idempotency guarantees, secret and log hygiene, and the `{ success, data, error }` response contract in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md

**Checkpoint**: User Story 2 is complete when repository code is aligned to the current architecture contract and runtime invariants remain unchanged on every touched path.

---

## Phase 5: User Story 3 - Regenerate Canonical Architecture Intelligence (Priority: P3)

**Goal**: Refresh the architecture intelligence layer so governance tools and AI context consumers evaluate the aligned repository state consistently.

**Independent Test**: Regenerate the canonical architecture artifacts and confirm final governance verification consumes the refreshed state without stale-artifact drift or malformed brain output.

### Implementation for User Story 3

- [ ] T021 [US3] Regenerate repository architecture intelligence in docs/architecture/intelligence/ and docs/ai/context/ using scripts/infra-audit.ts
- [ ] T022 [US3] Refresh AI context artifacts in docs/ai/context/ using scripts/generate-ai-context.ts --force
- [ ] T023 [US3] Validate docs/ai/context/ai-architecture-brain.json using scripts/validate-architecture-brain.ts and record the result in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md
- [ ] T024 [US3] Run targeted regression suites and performance-sensitive checks for touched modules and hot paths from package.json and record results in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md
- [ ] T025 [US3] Execute the canonical closure sequence from specs/runtime/infra-014-architecture-alignment-migration/contracts/alignment-verification-contract.md and record zero unresolved in-scope violations in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md

**Checkpoint**: User Story 3 is complete when canonical artifacts are regenerated, validated, and accepted by the final governance toolchain.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize stage evidence, workflow status, and closure readiness.

- [ ] T026 [P] Summarize task execution evidence, closure blockers, and residual risk in specs/runtime/infra-014-architecture-alignment-migration/reports/TASKS_REPORT.md
- [ ] T027 Update workflow progress and generated artifact references in specs/runtime/infra-014-architecture-alignment-migration/README.md
- [ ] T028 Reconcile final task status and closure notes in specs/runtime/infra-014-architecture-alignment-migration/tasks.md and specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user story work.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; establishes the baseline required for all remediation.
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion; remediation scope comes directly from the approved baseline.
- **User Story 3 (Phase 5)**: Depends on User Story 2 completion; architecture intelligence must be regenerated from the remediated repository state.
- **Polish (Phase 6)**: Depends on User Story 3 completion.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other user stories after Foundational completion.
- **User Story 2 (P2)**: Depends on User Story 1 because remediation must follow the classified baseline.
- **User Story 3 (P3)**: Depends on User Story 2 because regeneration and closure verification must use the aligned repository state.

### Within Each User Story

- Baseline capture before categorization.
- Categorization before remediation.
- Remediation before architecture refresh.
- Architecture refresh before final verification and closure evidence.

### Dependency Graph

`Phase 1 -> Phase 2 -> US1 -> US2 -> US3 -> Phase 6`

### Parallel Opportunities

- T003 and T004 can run in parallel after T001 and T002.
- T006 and T007 can run in parallel after T005.
- T009, T010, and T011 can run in parallel once Foundational is complete.
- T026 can run in parallel with T027 after T025 completes.

---

## Parallel Example: User Story 1

```bash
# Capture the three baseline inputs together after Foundational completion:
Task: "Capture the unified architecture guard baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/us1-arch-guard-baseline.json using scripts/architecture-guard/architecture-guard.ts"
Task: "Capture the infrastructure audit baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/us1-infra-audit-baseline.md using scripts/infra-audit.ts"
Task: "Capture the type-safety baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/us1-type-safety-baseline.json using scripts/type-safety-guard.ts"
```

---

## Parallel Example: User Story 2

```bash
# Repository remediation must stay inside the governed allowlist and file-scoped tracker entries:
Task: "Remediate file-scoped cross-app, package-to-app, runtime-to-UI, and UI-to-domain dependency violations in exact paths listed in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md"
```

---

## Parallel Example: User Story 3

```bash
# After regeneration and validation complete, documentation closure can split:
Task: "Summarize task execution evidence, closure blockers, and residual risk in specs/runtime/infra-014-architecture-alignment-migration/reports/TASKS_REPORT.md"
Task: "Update workflow progress and generated artifact references in specs/runtime/infra-014-architecture-alignment-migration/README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate that specs/runtime/infra-014-architecture-alignment-migration/audits/ALIGNMENT_BASELINE.md is complete and actionable before touching repository code.

### Incremental Delivery

1. Establish the baseline and remediation queues.
2. Remove boundary, cycle, typing, and script-overlap drift while preserving trust-chain invariants.
3. Regenerate canonical intelligence and complete final governance verification.
4. Close the stage only after zero unresolved in-scope violations are recorded.

### Execution Discipline

1. Do not introduce ADR changes, architecture redesign, cross-app imports, or package-to-app imports.
2. Preserve authentication flow, correlation propagation, tenant isolation, license enforcement order, schema and product compatibility checks, worker authority, server-authoritative time, transaction and idempotency guarantees, and secret and log hygiene on all touched runtime paths.
3. Preserve the standard `{ success, data, error }` response envelope on touched runtime endpoints.
4. Use canonical governance tooling for baseline capture, remediation verification, and architecture refresh, and rerun verification after any governance-script consolidation.

---

## Notes

- [P] tasks are limited to disjoint files or stage-local reporting artifacts.
- This stage is compliance-only; tasks must align code to the current architecture rather than redefine it.
- Architecture intelligence artifacts under docs/ai/context/ and docs/architecture/intelligence/ must be regenerated by tooling, never hand-edited.
- Final closure requires zero unresolved in-scope violations and no trust-chain regressions.

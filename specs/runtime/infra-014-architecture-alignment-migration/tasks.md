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

**Purpose**: Create the stage-local evidence files and guardrail references used by clean-state validation and any later remediation if drift is rediscovered.

- [x] T001 Create the baseline evidence workspace in specs/runtime/infra-014-architecture-alignment-migration/audits/ALIGNMENT_BASELINE.md
- [x] T002 Create the remediation tracker in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md
- [x] T003 [P] Create the final verification ledger in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md
- [x] T004 [P] Create the governance workflow guide in specs/runtime/infra-014-architecture-alignment-migration/guides/GOVERNANCE_WORKFLOW.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the canonical scope, invariants, and reporting model before baseline capture and any possible remediation begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Record the governed module scope, docs-only implementation allowlist, and boundary references in specs/runtime/infra-014-architecture-alignment-migration/audits/GOVERNED_SCOPE.md using docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json and docs/architecture/module-boundaries.json
- [x] T006 [P] Document trust-chain and runtime invariants in specs/runtime/infra-014-architecture-alignment-migration/guides/RUNTIME_INVARIANTS.md using specs/runtime/infra-014-architecture-alignment-migration/quickstart.md and specs/runtime/infra-014-architecture-alignment-migration/contracts/alignment-verification-contract.md
- [x] T007 [P] Inventory canonical and legacy governance entrypoints plus secret and log-sensitive script surfaces in specs/runtime/infra-014-architecture-alignment-migration/audits/LEGACY_SCRIPT_REVIEW.md using package.json and scripts/
- [x] T008 Define remediation categories, closure states, and the zero-violation evidence path in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md using specs/runtime/infra-014-architecture-alignment-migration/data-model.md and specs/runtime/infra-014-architecture-alignment-migration/research.md

**Checkpoint**: Stage evidence and invariant guardrails are ready for baseline capture.

---

## Phase 3: User Story 1 - Establish a Trusted Alignment Baseline (Priority: P1) 🎯 MVP

**Goal**: Produce a repository-wide, categorized alignment baseline that maintainers can use without reinterpreting governance rules, including a clean-state outcome when no remediation is required.

**Independent Test**: Review specs/runtime/infra-014-architecture-alignment-migration/audits/ALIGNMENT_BASELINE.md and confirm every finding is grouped by module, rule family, severity, location, and remediation priority.

### Implementation for User Story 1

- [x] T009 [P] [US1] Capture the unified architecture guard baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/us1-arch-guard-baseline.json using `bun run arch:guard -- --output json`
- [x] T010 [P] [US1] Capture the infrastructure audit baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/us1-infra-audit-baseline.md using scripts/infra-audit.ts
- [x] T011 [P] [US1] Capture the type-safety baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/us1-type-safety-baseline.json using `bun scripts/type-safety-guard.ts --json`
- [x] T012 [US1] Merge the baseline outputs into specs/runtime/infra-014-architecture-alignment-migration/audits/ALIGNMENT_BASELINE.md with source tool, module, rule family, severity, and location columns
- [x] T013 [US1] Record clean-state evidence, trust-chain risk flags, and hot-path sensitivity flags in specs/runtime/infra-014-architecture-alignment-migration/audits/ALIGNMENT_BASELINE.md when the canonical baseline reports zero violations
- [x] T014 [US1] Mark specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md with `not-required` repository remediation status and no-op closure notes when the baseline reports zero violations

**Checkpoint**: User Story 1 is complete when the baseline is authoritative enough to schedule every in-scope remediation item without additional discovery.

---

## Phase 4: User Story 2 - Align Existing Code Without Breaking the Trust Chain (Priority: P2)

**Goal**: Freeze the no-remediation decision and prove that repository alignment already preserves tenant isolation, mandatory license enforcement, standard API error envelopes, and server-authoritative runtime behavior.

**Independent Test**: Compare baseline evidence and final verification results in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md and confirm zero in-scope violations persist without trust-chain regressions.

### Implementation for User Story 2

- [x] T015 [US2] Record a no-remediation decision for apps/, packages/, scripts/, and tests/ in specs/runtime/infra-014-architecture-alignment-migration/audits/GOVERNED_SCOPE.md using the zero-violation baseline captured in Phase 3
- [x] T016 [US2] Record exact trust-chain preservation checks and docs-only implementation scope in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md with no runtime file mutations authorized
- [x] T017 [US2] Document that dependency-boundary, circular-dependency, unsafe-type, and export-typing remediation are `not-required` in specs/runtime/infra-014-architecture-alignment-migration/audits/REMEDIATION_TRACKER.md for the captured clean baseline
- [x] T018 [US2] Record that no transaction, idempotency, or compatibility regressions were introduced because implementation scope is limited to stage-local evidence and artifact refresh in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md
- [x] T019 [US2] Document governance toolchain ownership and confirm no package.json or scripts/ consolidation is required for the current clean baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/LEGACY_SCRIPT_REVIEW.md
- [x] T020 [US2] Verify and record that authentication flow, correlation propagation, tenant resolver coverage, license enforcement order, schema and product compatibility checks, worker authority, server-authoritative time, secret and log hygiene, and the `{ success, data, error }` response contract remain unchanged because no runtime paths were modified in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md

**Checkpoint**: User Story 2 is complete when repository code is aligned to the current architecture contract and runtime invariants remain unchanged on every touched path.

---

## Phase 5: User Story 3 - Regenerate Canonical Architecture Intelligence (Priority: P3)

**Goal**: Refresh the architecture intelligence layer so governance tools and AI context consumers evaluate the aligned repository state consistently.

**Independent Test**: Regenerate the canonical architecture artifacts and confirm final governance verification consumes the refreshed state without stale-artifact drift or malformed brain output.

### Implementation for User Story 3

- [x] T021 [US3] Regenerate repository architecture intelligence in docs/architecture/intelligence/ and docs/ai/context/ using scripts/infra-audit.ts
- [x] T022 [US3] Refresh AI context artifacts in docs/ai/context/ using scripts/generate-ai-context.ts --force
- [x] T023 [US3] Validate docs/ai/context/ai-architecture-brain.json using scripts/validate-architecture-brain.ts and record the result in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md
- [x] T024 [US3] Record that no targeted runtime regression suites or hot-path performance suites were required because implementation scope remained docs-only in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md
- [x] T025 [US3] Execute the canonical closure sequence from specs/runtime/infra-014-architecture-alignment-migration/contracts/alignment-verification-contract.md and record zero unresolved in-scope violations plus refreshed intelligence artifacts in specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md

**Checkpoint**: User Story 3 is complete when canonical artifacts are regenerated, validated, and accepted by the final governance toolchain.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize stage evidence, workflow status, and closure readiness.

- [x] T026 [P] Summarize task execution evidence, closure blockers, and residual risk in specs/runtime/infra-014-architecture-alignment-migration/reports/TASKS_REPORT.md
- [x] T027 Update workflow progress and generated artifact references in specs/runtime/infra-014-architecture-alignment-migration/README.md
- [x] T028 Reconcile final task status and closure notes in specs/runtime/infra-014-architecture-alignment-migration/tasks.md and specs/runtime/infra-014-architecture-alignment-migration/audits/FINAL_VERIFICATION.md

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
- **User Story 2 (P2)**: Depends on User Story 1 because the no-remediation decision must be grounded in the classified baseline.
- **User Story 3 (P3)**: Depends on User Story 2 because regeneration and closure verification must use the frozen zero-violation state.

### Within Each User Story

- Baseline capture before categorization.
- Categorization before no-remediation or remediation decision.
- Frozen implementation scope before architecture refresh.
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
# The clean baseline path keeps implementation docs-only:
Task: "Record a no-remediation decision for apps/, packages/, scripts/, and tests/ in specs/runtime/infra-014-architecture-alignment-migration/audits/GOVERNED_SCOPE.md"
Task: "Document governance toolchain ownership and confirm no package.json or scripts/ consolidation is required for the current clean baseline in specs/runtime/infra-014-architecture-alignment-migration/audits/LEGACY_SCRIPT_REVIEW.md"
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
2. Freeze the no-remediation decision and trust-chain evidence for the clean baseline.
3. Regenerate canonical intelligence and complete final governance verification.
4. Close the stage only after zero unresolved in-scope violations are recorded.

### Execution Discipline

1. Do not introduce ADR changes, architecture redesign, cross-app imports, or package-to-app imports.
2. Preserve authentication flow, correlation propagation, tenant isolation, license enforcement order, schema and product compatibility checks, worker authority, server-authoritative time, transaction and idempotency guarantees, and secret and log hygiene by keeping implementation docs-only unless a future baseline proves remediation is required.
3. Preserve the standard `{ success, data, error }` response envelope on touched runtime endpoints.
4. Use canonical governance tooling for baseline capture, evidence verification, and architecture refresh.

---

## Notes

- [P] tasks are limited to disjoint files or stage-local reporting artifacts.
- This stage is compliance-only; tasks must align code to the current architecture rather than redefine it.
- Architecture intelligence artifacts under docs/ai/context/ and docs/architecture/intelligence/ must be regenerated by tooling, never hand-edited.
- Final closure requires zero unresolved in-scope violations and no trust-chain regressions.

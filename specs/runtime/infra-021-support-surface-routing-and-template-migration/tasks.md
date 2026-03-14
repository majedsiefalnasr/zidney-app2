# Tasks: Support Surface Routing and Template Migration

**Input**: Design documents from `/specs/runtime/infra-021-support-surface-routing-and-template-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/

**Tests**: No new unit or contract tests are explicitly requested by the feature spec. Validation tasks below cover the mandatory governance, workflow, and routing checks required by the stage.

**Organization**: Tasks are grouped by user story so each migration increment can be reviewed and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes the exact file path to change

## Phase 1: Setup (Shared Migration Artifacts)

**Purpose**: Create the working artifacts used to track inventory, evidence, parity, and validation across the migration.

- [x] T001 Create the support-surface inventory worksheet in `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/support-surface-inventory.md`
- [x] T002 Create the blast-radius evidence matrix in `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/blast-radius-evidence.md`
- [x] T003 [P] Create the template, prompt, and direct consumer matrix in `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/template-consumer-parity-matrix.md`
- [x] T004 [P] Create the INFRA-21 validation ledger in `specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/VALIDATION_REPORT.md`
- [x] T025 Maintain and update per-batch smoke validation evidence in `specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/VALIDATION_REPORT.md` immediately after the authority declaration batch, the template parity batch, each routing-affecting rewiring or hardening batch, and any retirement batch that mutates a compatibility surface before the next batch starts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Collect the inventory, evidence, parity, and batch-planning inputs that block all story implementation.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T005 Populate `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/support-surface-inventory.md` with every governed path from the stage file, including `coverage/`, `tsconfig.base.json.backup`, `.agents/*`, `.github/*`, `.specify/templates/`, `specs/templates/`, `.specify/scripts/bash/`, `docs/type-safety/`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, and `package.json`
- [x] T006 Populate `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/blast-radius-evidence.md` with direct file references, workflow and hook consumers, INFRA-16 deferred-scope evidence, and unresolved-risk notes for each governed surface
- [x] T007 [P] Populate `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/template-consumer-parity-matrix.md` with file-level mappings for `.specify/templates/*` consumers, `.agents/prompts/*`, and `.github/prompts/*` compatibility relationships
- [x] T008 [P] Record the planned `authority_declaration`, `template_parity`, `consumer_rewiring`, `compatibility_hardening`, `retirement_decision`, and `artifact_cleanup` batches in `specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/migration-batches.md`

**Checkpoint**: Foundational evidence and migration batches are ready; user story work can proceed in sequence.

---

## Phase 3: User Story 1 - Establish a Single Routing Authority (Priority: P1) 🎯 MVP

**Goal**: Declare one authoritative routing root for agents, prompts, and templates, with explicit legacy compatibility policy for every retained duplicate surface.

**Independent Test**: Review the registry and decision artifacts and confirm that agents, prompts, and templates each have exactly one authoritative root, every retained legacy surface is marked non-authoritative, and later stages can resolve routing decisions from one source of truth.

- [x] T009 [US1] Create `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` with the `agents`, `prompts`, and `templates` records, authoritative roots, legacy compatibility surfaces, consumer classes, direct consumer map, migration policy, retirement criteria, and validation evidence
- [x] T010 [P] [US1] Publish the authority rationale and per-surface dispositions for every named in-scope support surface in `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/routing-authority-decisions.md`
- [x] T011 [US1] Update `specs/runtime/infra-021-support-surface-routing-and-template-migration/README.md` to point contributors and later stages to `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`, `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/routing-authority-decisions.md`, `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/support-surface-inventory.md`, `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/blast-radius-evidence.md`, `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/template-consumer-parity-matrix.md`, `specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/migration-batches.md`, and `specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/VALIDATION_REPORT.md`

**Checkpoint**: Routing authority is explicit and reviewable without rewiring live consumers yet.

---

## Phase 4: User Story 2 - Resolve Widened Support Artifacts Safely (Priority: P2)

**Goal**: Give the deferred support artifacts and template parity gaps explicit, evidence-backed dispositions before any cleanup or consumer migration proceeds.

**Independent Test**: Inspect the artifact decision report and template parity artifacts and confirm that `coverage/.tmp/coverage-*.json`, `tsconfig.base.json.backup`, and every required template parity gap have a documented disposition, replacement path, or compatibility block.

- [x] T012 [US2] Record the final dispositions and blocking evidence for `coverage/.tmp/coverage-*.json` and `tsconfig.base.json.backup` in `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/support-artifact-decisions.md`
- [x] T013 [P] [US2] Update `.gitignore` and `docs/TESTING.md` with the approved regeneration or ignore policy for `coverage/.tmp/` as preparatory policy hardening, not final cleanup
- [x] T014 [P] [US2] Audit root script references in `package.json` against the `tsconfig.base.json.backup` decision and remove any remaining backup dependency from `package.json` as preparatory policy hardening, not final cleanup
- [x] T015 [P] [US2] Reconcile `.specify/templates/spec-template.md` to the canonical `specs/templates/specify-template.md` path and add `specs/templates/agent-file-template.md`
- [x] T016 [P] [US2] Add canonical parity files in `specs/templates/checklist-template.md` and `specs/templates/constitution-template.md`
- [x] T017 [US2] Reconcile `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/template-consumer-parity-matrix.md` and `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` with the final canonical files, explicit mappings, stale command-reference removals, prompt-surface mappings, parity proof, and blocked-retirement notes for `.specify/templates/`

**Checkpoint**: Support artifacts and template parity have explicit evidence-backed decisions; live consumer rewiring can proceed safely.

---

## Phase 5: User Story 3 - Keep Hard Mode and Contributor Workflows Intact (Priority: P3)

**Goal**: Rewire direct consumers to the canonical authority model while preserving compatibility surfaces and keeping contributor and governance guidance aligned.

**Independent Test**: Review the touched shell scripts, guidance files, and compatibility notices and confirm they all resolve the same routing authority model without silently reviving `.github/*` or `.specify/templates/*` as authoritative roots.

**Execution Rule**: T025 is a cross-phase recurring gate task that begins with the first authority-declaration batch and must be updated immediately after the template parity batch, each routing-affecting rewiring or hardening batch, and any retirement batch that mutates a compatibility surface before the next batch starts. T026 must run after consumer rewiring plus compatibility hardening, again immediately before any retirement or cleanup batch that removes or mutates a compatibility surface, and once more after the final cleanup state is applied.

- [x] T018 [US3] Rewire `.specify/scripts/bash/setup-plan.sh` and `.specify/scripts/bash/create-new-feature.sh` to resolve canonical template inputs from `specs/templates/`
- [x] T019 [US3] Rewire `.specify/scripts/bash/update-agent-context.sh` to load the canonical agent template source while preserving `.github/agents/copilot-instructions.md` as compatibility output
- [x] T020 [P] [US3] Update `.agents/agents/speckit.specify.agent.md`, `.agents/agents/speckit.tasks.agent.md`, `.agents/agents/speckit.checklist.agent.md`, and `.agents/agents/speckit.constitution.agent.md` to reference the canonical template system, remove stale `.specify/templates/commands/*.md` guidance, and enforce routing registry rules
- [x] T021 [P] [US3] Update `.github/agents/speckit.specify.agent.md`, `.github/agents/speckit.tasks.agent.md`, `.github/agents/speckit.checklist.agent.md`, and `.github/agents/speckit.constitution.agent.md` to mirror the same canonical guidance and stale-reference removals as the `.agents/agents/` surface
- [x] T022 [P] [US3] Synchronize the overlapping Speckit prompt subset between `.agents/prompts/*.prompt.md` and `.github/prompts/*.prompt.md`, and record any intentional Zidney-only prompts as legacy-absent in the parity matrix and routing registry
- [x] T023 [P] [US3] Create `.github/agents/README.md`, `.github/prompts/README.md`, and `.specify/templates/README.md` to mark each path as a legacy compatibility surface and define retirement criteria
- [x] T024 [US3] Align `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `specs/templates/audits/analyze-report-template.md`, `scripts/infra-audit.ts`, `scripts/architecture-diff.ts`, and any cleanup guidance that makes routing-surface decisions with routing registry consultation, template parity gates, and same-batch migration requirements; only update `docs/AGENT_GOVERNANCE.md` if a minimal, explicitly justified migration note is still required after those primary consultation points are aligned
- [x] T026 [US3] Execute and record the full governance suite after consumer rewiring and compatibility hardening, again immediately before any retirement or cleanup batch that removes or mutates a compatibility surface, and once more after the final cleanup state is applied in `specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/VALIDATION_REPORT.md`

**Checkpoint**: Direct consumers and contributor guidance follow one authority model while legacy surfaces remain explicit compatibility paths.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the migration, capture outcomes, and document any deferred compatibility retirement.

- [x] T028 Execute and record any retirement decisions that are authorized by the routing registry, support-artifact decisions, and completed validation evidence; otherwise record explicit deferred retirement conditions in `specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/migration-batches.md`
- [x] T029 Execute and record the final artifact cleanup batch for only those files or compatibility surfaces already authorized for cleanup by T028, then capture post-cleanup smoke validation in `specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/VALIDATION_REPORT.md` and update `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/support-artifact-decisions.md`
- [x] T027 After T028 and T029 complete, reconcile final links, registry consultation points, residual compatibility surfaces, deferred retirement conditions, and final end-state evidence in `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`, `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/routing-authority-decisions.md`, `specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/support-artifact-decisions.md`, and `specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/migration-batches.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; establishes the routing authority required by later stories.
- **User Story 2 (Phase 4)**: Depends on Foundational and should follow User Story 1 so artifact and parity decisions use the declared authority model.
- **User Story 3 (Phase 5)**: Depends on User Story 1 and User Story 2 because direct consumer rewiring requires both the registry and parity decisions.
- **Polish (Phase 6)**: Depends on all prior phases.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational and defines the canonical routing control plane.
- **User Story 2 (P2)**: Uses the User Story 1 authority model to classify support artifacts and create missing canonical template parity.
- **User Story 3 (P3)**: Rewires scripts and contributor guidance only after User Story 2 confirms canonical targets and compatibility rules.
- **Recurring validation gates**: T025 runs between routing-affecting batches; T026 runs after rewiring/hardening and again before retirement or cleanup.

### Within Each User Story

- Evidence and parity artifacts before registry or rewiring updates.
- Canonical template parity before direct consumer rewiring.
- Script rewiring before compatibility hardening and guidance alignment.
- Registry parity proof before any direct consumer rewiring begins.
- Recurring smoke validation immediately after each routing-affecting batch.
- Full governance reruns after consumer rewiring and compatibility hardening, again before retirement or cleanup mutations, and once more after the final cleanup state is applied.

### Parallel Opportunities

- `T003`, `T004`, and the initial T025 ledger scaffolding can run in parallel during Setup.
- `T007` and `T008` can run in parallel once the core inventory and evidence structure exists.
- In User Story 1, `T010` can run in parallel with `T009` after Foundational evidence is complete.
- In User Story 2, `T013`, `T014`, `T015`, and `T016` can run in parallel once `T012` defines the artifact decisions.
- In User Story 3, `T020`, `T021`, `T022`, and `T023` can run in parallel only after the direct script rewiring tasks are complete against the finalized parity set.
- T025 recurs between batches from the first authority declaration onward, including any retirement batch that mutates a compatibility surface, while `T026` gates retirement and cleanup and both feed `T027`-`T029`.

---

## Parallel Example: User Story 1

```bash
Task: "Create docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md"
Task: "Publish specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/routing-authority-decisions.md"
```

## Parallel Example: User Story 2

```bash
Task: "Update .gitignore and docs/TESTING.md with the coverage/.tmp policy"
Task: "Audit package.json against the tsconfig.base.json.backup decision"
Task: "Map .specify/templates/spec-template.md to specs/templates/specify-template.md and add specs/templates/agent-file-template.md"
Task: "Add specs/templates/checklist-template.md and specs/templates/constitution-template.md"
```

## Parallel Example: User Story 3

```bash
Task: "Update .agents/agents/speckit.specify.agent.md, .agents/agents/speckit.tasks.agent.md, .agents/agents/speckit.checklist.agent.md, and .agents/agents/speckit.constitution.agent.md"
Task: "Update .github/agents/speckit.specify.agent.md, .github/agents/speckit.tasks.agent.md, .github/agents/speckit.checklist.agent.md, and .github/agents/speckit.constitution.agent.md"
Task: "Synchronize .agents/prompts/*.prompt.md and .github/prompts/*.prompt.md"
Task: "Create .github/agents/README.md, .github/prompts/README.md, and .specify/templates/README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate the registry and authority decisions before changing live consumers.

### Incremental Delivery

1. Finish Setup and Foundational to lock the inventory, evidence, parity map, and migration batches.
2. Deliver User Story 1 to establish the routing control plane.
3. Deliver User Story 2 to resolve artifact decisions and create canonical parity.
4. Deliver User Story 3 to rewire direct consumers and harden compatibility.
5. Finish with Phase 6 reconciliation, retirement execution, and authorized cleanup.

### Team Strategy

1. One contributor handles the evidence artifacts and recurring smoke-validation ledger (`T001`-`T008`, `T025`).
2. One contributor authors the routing registry and decision docs (`T009`-`T011`).
3. One contributor handles artifact and parity work (`T012`-`T017`).
4. One contributor rewires scripts and guidance (`T018`-`T023`).
5. Full-suite validation, retirement execution, and final reconciliation close the batch (`T026`-`T029`) while T025 is maintained throughout execution.

---

## Notes

- All tasks stay inside repository support-surface routing and template migration scope.
- Legacy surfaces remain compatibility-only until the registry retirement criteria are satisfied.
- Validation evidence is mandatory even when no new automated test files are added.
- Ambiguous cleanup defaults to retention, compatibility mirroring, or explicit escalation.

# INFRA-022 — Repository Hygiene Verification: Tasks

**Phase:** 01_PLATFORM_FOUNDATION
**Stage:** INFRA-022 — Repository Hygiene Verification
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_22_REPOSITORY_HYGIENE_VERIFICATION.md`
**Plan:** `specs/runtime/infra-022-repository-hygiene-verification/plan.md`
**Spec:** `specs/runtime/infra-022-repository-hygiene-verification/spec.md`
**ADR:** None required
**Branch:** `spec/infra-022-repository-hygiene-verification`
**Package Manager:** `bun`
**Generated:** 2026-03-16

---

## Summary

Total tasks: **22**

| Phase | Label    | Description                                         | Count |
| ----- | -------- | --------------------------------------------------- | ----- |
| 1     | [SETUP]  | Shared types foundation                             | 1     |
| 2     | [CHK]    | Individual verification check modules (parallel)    | 9     |
| 3     | [REPORT] | Orchestrator + report writer                        | 1     |
| 4     | [TEST]   | Unit tests for deterministic checks (parallel)      | 3     |
| 5     | [GATE]   | package.json entry + artifact + integration + gates | 8     |

**Execution discipline:** Phases must be completed in order. Tasks marked `[P]` within a phase are
independent of each other and can be executed concurrently.

---

## Phase 1 — Shared Types (Foundation)

Must be completed before any check module is implemented. All Phase 2 modules import from this file.

- [ ] T001 [SETUP] Create shared `TaskStatus`, `TaskFinding`, and `TaskResult` type definitions — `scripts/dev/hygiene-checks/types.ts`

---

## Phase 2 — Verification Check Modules (Parallel)

All check modules depend on `types.ts` (T001). Each module is independent of the others; all nine
can be implemented in parallel.

Spec verification tasks referenced in parentheses reflect the naming in `spec.md` and `plan.md`.

- [ ] T002 [P] [CHK] Create Routing Authority Verification check module (spec T001) — reads `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`; confirms one authoritative root per surface pair (agents, prompts, templates); returns `TaskResult` with PASS or FLAG — `scripts/dev/hygiene-checks/routing-authority-check.ts`
- [ ] T003 [P] [CHK] Create Template System Consolidation check module (spec T002) — scans `.specify/scripts/bash/`, `.github/workflows/`, `docs/**`, `AGENTS.md` for legacy `.specify/templates/` path references; checks template parity gap between `.specify/templates/` and `specs/templates/`; returns `TaskResult` with PASS or FLAG — `scripts/dev/hygiene-checks/template-consolidation-check.ts`
- [ ] T004 [P] [CHK] Create Dead Script Detection check module (spec T003) — enumerates all `**/*.ts` and `**/*.sh` under `scripts/`; builds reference corpus from `package.json`, `.github/workflows/*.yml`, `docs/**/*.md`, shell script invocations, and `specs/runtime/infra-022-*/`; classifies each as ACTIVE, DUPLICATE_ROOT_STUB, or POTENTIALLY_DEAD; flags-in-report only (no deletion); returns `TaskResult` — `scripts/dev/hygiene-checks/dead-script-check.ts`
- [ ] T005 [P] [CHK] Create Dependency Hygiene check module (spec T004) — collects all workspace roots (root + `packages/*` + `apps/*`); for each root with a `package.json`, scans `.ts`/`.tsx`/`.vue` source files for import usage of each declared dependency; invokes `scripts/dev/verify-dependency-usage.ts` as subprocess where applicable; groups unused and duplicate packages per workspace; returns `TaskResult` with FLAG if any unused found — `scripts/dev/hygiene-checks/dependency-hygiene-check.ts`
- [ ] T006 [P] [CHK] Create Workspace Package Validation check module (spec T005) — enumerates all `packages/*/package.json` entries; confirms each package appears as a dependency in at least one `apps/*/package.json` or has an import in `apps/*/src/**`; classifies each as ACTIVE or ORPHANED; returns `TaskResult` with PASS or FLAG — `scripts/dev/hygiene-checks/workspace-package-check.ts`
- [ ] T007 [P] [CHK] Create Skill Surface Validation check module (spec T006) — enumerates all immediate subdirectories of `.agents/skills/`; checks each against `SKILLS_INDEX.md` and `AGENTS.md` files; flags directories absent from both surfaces; flags stale index entries (in index but no directory on disk); parent container dirs without root `SKILL.md` (`aws-skills/`, `gitnexus/`) are not flagged; returns `TaskResult` — `scripts/dev/hygiene-checks/skill-surface-check.ts`
- [ ] T008 [P] [CHK] Create CI Workflow Hygiene check module (spec T007) — reads all `.github/workflows/*.yml`; extracts and normalises `run:` step commands; builds duplicate-step matrix; flags commands and step labels appearing in more than one workflow; lists consolidation candidates (no changes made); returns `TaskResult` with PASS or FLAG — `scripts/dev/hygiene-checks/ci-workflow-check.ts`
- [ ] T009 [P] [CHK] Create AI Context Integrity check module (spec T008) — spawns `bun run ai-context:validate`; applies SKIP if ENOENT or missing-script exit, WARNING if exit non-zero with artifact-error output, PASS if exit 0; captures stdout/stderr in findings; returns `TaskResult` with PASS, WARNING, or SKIP status — `scripts/dev/hygiene-checks/ai-context-check.ts`
- [ ] T010 [P] [CHK] Create Architecture Guard Verification check module (spec T009) — spawns `bun run arch:guard` and `bun run arch:health` (120 s timeout each); captures stdout, stderr, exit codes; classifies all violations as pre-existing (stage introduces no code changes); status = PASS if both exit 0 with no violations, FLAG (not FAIL) otherwise; records output under "Architecture Guard — Pre-existing Violations Found"; does not block stage — `scripts/dev/hygiene-checks/arch-guard-check.ts`

---

## Phase 3 — Orchestrator (Report Writer)

Depends on all Phase 2 check modules (T002–T010) being importable.

- [ ] T011 [REPORT] Create hygiene report orchestrator — imports and invokes T001–T009 check modules in sequence; collects `TaskResult[]`; determines overall verdict (CLEAN if all PASS/SKIP, ATTENTION REQUIRED otherwise); renders full markdown report per format specification in `plan.md`; writes to `docs/reports/REPOSITORY_HYGIENE_REPORT.md`; exits with code 0 regardless of findings — `scripts/dev/hygiene-report-generator.ts`

---

## Phase 4 — Unit Tests (Parallel)

Unit tests for the three checks with the most deterministic internal logic. Can be implemented in
parallel once Phase 2 modules are available. All tests use local fixture directories for determinism
(not the real repo workspace files).

- [ ] T012 [P] [TEST] Create unit tests for Routing Authority Verification check — covers: PASS when registry + both authoritative dirs exist; FLAG when authoritative dir missing on disk; FLAG when registry has no `Authoritative Root:` entry for a surface; no FLAG for correctly-classified legacy/compatibility dir — `scripts/dev/hygiene-checks/__tests__/routing-authority-check.test.ts`
- [ ] T013 [P] [TEST] Create unit tests for Dead Script Detection check — covers: ACTIVE when path appears in `package.json` scripts value; POTENTIALLY_DEAD when absent from all reference surfaces; DUPLICATE_ROOT_STUB when root-level file shares basename with a subdir file; no throw on empty `scripts/` directory — `scripts/dev/hygiene-checks/__tests__/dead-script-check.test.ts`
- [ ] T014 [P] [TEST] Create unit tests for Workspace Package Validation check — covers: PASS when all `packages/` dirs appear as deps in at least one `apps/` package.json; FLAG with orphaned package name when no consumer found; no throw on empty `packages/` directory — `scripts/dev/hygiene-checks/__tests__/workspace-package-check.test.ts`

---

## Phase 5 — Integration, Artifacts, and Safety Gates

Execute sequentially; T015 must precede T017; T017 must complete before T018–T022.

- [ ] T015 [GATE] Add `"hygiene:report": "bun scripts/dev/hygiene-report-generator.ts"` script entry to root `package.json`
- [ ] T016 [GATE] Ensure `docs/reports/` directory exists and create initial `REPOSITORY_HYGIENE_REPORT.md` placeholder file (will be overwritten by T017 with live report content) — `docs/reports/REPOSITORY_HYGIENE_REPORT.md`
- [ ] T017 [GATE] Run full integration smoke — `bun run hygiene:report`; confirms all nine checks execute without throws; produces final `docs/reports/REPOSITORY_HYGIENE_REPORT.md` containing all ten task sections (T001–T010); exits with code 0 — output: `docs/reports/REPOSITORY_HYGIENE_REPORT.md`
- [ ] T018 [GATE] Run `bun run lint` — confirm zero lint violations introduced by new scripts
- [ ] T019 [GATE] Run `bun run typecheck` — confirm zero TypeScript errors in new files
- [ ] T020 [GATE] Run `bun run test` — confirm unit tests T012–T014 pass; no pre-existing tests regressed
- [ ] T021 [GATE] Verify `git diff --name-only` — confirm zero writes to `docs/architecture/`, any ADR files, or `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`; confirm zero destructive operations (no file deletions, no dependency removals)
- [ ] T022 [GATE] Commit `docs/reports/REPOSITORY_HYGIENE_REPORT.md` as tracked stage artifact (source-controlled; not ephemeral)

---

## Task Dependency Graph

```
T001 (types.ts)
  └── T002 [P] (routing-authority-check.ts)
  └── T003 [P] (template-consolidation-check.ts)
  └── T004 [P] (dead-script-check.ts)
  └── T005 [P] (dependency-hygiene-check.ts)
  └── T006 [P] (workspace-package-check.ts)
  └── T007 [P] (skill-surface-check.ts)
  └── T008 [P] (ci-workflow-check.ts)
  └── T009 [P] (ai-context-check.ts)
  └── T010 [P] (arch-guard-check.ts)
        └── T011 (hygiene-report-generator.ts)
        └── T012 [P] (routing-authority-check.test.ts)
        └── T013 [P] (dead-script-check.test.ts)
        └── T014 [P] (workspace-package-check.test.ts)
              └── T015 (package.json script entry)
                    └── T016 (REPOSITORY_HYGIENE_REPORT.md placeholder)
                          └── T017 (bun run hygiene:report — smoke integration)
                                └── T018 (bun run lint)
                                └── T019 (bun run typecheck)
                                └── T020 (bun run test)
                                └── T021 (git diff verify)
                                      └── T022 (commit report)
```

---

## Files Created by This Stage

| Task | Path                                                                   | Type   |
| ---- | ---------------------------------------------------------------------- | ------ |
| T001 | `scripts/dev/hygiene-checks/types.ts`                                  | new    |
| T002 | `scripts/dev/hygiene-checks/routing-authority-check.ts`                | new    |
| T003 | `scripts/dev/hygiene-checks/template-consolidation-check.ts`           | new    |
| T004 | `scripts/dev/hygiene-checks/dead-script-check.ts`                      | new    |
| T005 | `scripts/dev/hygiene-checks/dependency-hygiene-check.ts`               | new    |
| T006 | `scripts/dev/hygiene-checks/workspace-package-check.ts`                | new    |
| T007 | `scripts/dev/hygiene-checks/skill-surface-check.ts`                    | new    |
| T008 | `scripts/dev/hygiene-checks/ci-workflow-check.ts`                      | new    |
| T009 | `scripts/dev/hygiene-checks/ai-context-check.ts`                       | new    |
| T010 | `scripts/dev/hygiene-checks/arch-guard-check.ts`                       | new    |
| T011 | `scripts/dev/hygiene-report-generator.ts`                              | new    |
| T012 | `scripts/dev/hygiene-checks/__tests__/routing-authority-check.test.ts` | new    |
| T013 | `scripts/dev/hygiene-checks/__tests__/dead-script-check.test.ts`       | new    |
| T014 | `scripts/dev/hygiene-checks/__tests__/workspace-package-check.test.ts` | new    |
| T015 | `package.json`                                                         | modify |
| T016 | `docs/reports/REPOSITORY_HYGIENE_REPORT.md`                            | new    |

---

## Stage Completion Criteria

Stage is complete when all 22 tasks are checked off AND:

- [ ] `docs/reports/REPOSITORY_HYGIENE_REPORT.md` exists, is committed, and contains all ten task sections (T001–T010 results)
- [ ] `bun run lint` passes with zero violations
- [ ] `bun run typecheck` passes with zero errors
- [ ] `bun run test` passes; T012–T014 all green
- [ ] `git diff --name-only` confirms zero writes to `docs/architecture/`, ADR files, or `ROUTING_AUTHORITY_REGISTRY.md`
- [ ] No destructive operations performed (no file deletions, no dependency removals, no schema changes)

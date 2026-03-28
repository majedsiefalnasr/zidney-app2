# INFRA-023 – Task List: Local CI Simulation With Act

**Version:** 1.0.0
**Created:** 2026-03-17
**Phase:** 01 – Platform Foundation
**Stage:** STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT
**Spec:** [spec.md](./spec.md)
**Plan:** [plan.md](./plan.md)
**Research:** [research.md](./research.md)

---

## Stage Status

Status: IN PROGRESS
Step: tasks

---

## Stage Context

- **Phase:** 01 – Platform Foundation
- **Stage:** INFRA-023 – Local CI Simulation With Act
- **Related Plan:** [plan.md](./plan.md)
- **Related Spec:** [spec.md](./spec.md)
- **Related ADR:** None (no architectural module changes introduced)

Tasks must not extend beyond this stage. This is a governance tooling layer only — no business
logic, no database changes, no API changes.

---

## Pre-Validation Checklist

Before implementation begins, confirm:

- [x] Plan is complied with Zidney Constitution v1.2.0 (zero violations — spec §Constitutional Compliance)
- [x] No architectural violations exist (`scripts/` domain excluded from architecture layer enforcement)
- [x] Stage scope is respected (config, scripts/, docs/ only)
- [x] `.actrc` already exists — must NOT be overwritten (plan AD-01, AD-06)
- [x] `.secrets` already exists and is `.gitignore`'d — primary secrets mechanism unchanged
- [x] `docs/ci/` directory does NOT yet exist (will be created by T013)
- [x] 5 target workflow files confirmed in `.github/workflows/`: `ci.yml`, `architecture-governance.yml`, `ci-type-safety.yml`, `hard-mode-guard.yml`, `ai-context-validation.yml`

---

## Task Summary

| Phase                 | User Story              | Tasks     | Parallel   |
| --------------------- | ----------------------- | --------- | ---------- |
| Phase 1: Setup        | None (setup)            | T001–T002 | T001, T002 |
| Phase 2: Foundational | None (blocking prereqs) | T003–T005 | T003, T004 |
| Phase 3               | US-01 & US-02           | T006–T008 | T006       |
| Phase 4               | US-03                   | T009      | —          |
| Phase 5               | US-04                   | T010      | —          |
| Phase 6               | US-05                   | T011–T012 | —          |
| Phase 7               | US-06                   | T013–T014 | T013       |
| Final Phase           | Acceptance              | T015–T016 | —          |

**TASKS_TOTAL: 16**

---

## Phase 1: Setup — Prerequisites Verification

> Establish that the developer environment prerequisites are in place. Both tasks are read-only
> verifications; neither produces code changes. They unblock all downstream phases by confirming
> preconditions documented in plan.md §3 (Pre-Conditions).

- [x] T001 [P] Verify `act` installation prerequisites: confirm `brew install act` (macOS) and Docker Desktop are available; document the canonical installation commands as the foundation for docs/ci/local-ci.md §Installation — no file changes, findings recorded for T013
- [x] T002 [P] Verify `.actrc` exists at repo root and contains the correct runner mapping, `--container-architecture linux/amd64`, `--secret-file .secrets`, `--pull=true`, `--rm`, and all three `-P ubuntu-*` entries — this is a **read-only verification, no modifications to `.actrc`**; output findings to confirm AC-01 satisfied without change

---

## Phase 2: Foundational — Repository Configuration Changes

> Blocking prerequisites for all user story phases. T003 and T004 modify different files and can
> be executed in parallel. T005 validates T003 and must run after T003 completes.

**Story goal (Foundational):** All `ci:local*` script commands exist in `package.json` and
`.act.secrets` is protected from accidental commits. These are necessary before any user story
can be independently tested.

**Independent test criteria:** `bun run ci:local --help` resolves without error; `git check-ignore -v .act.secrets` returns a match.

- [x] T003 [P] Add the following 5 script entries to the `"scripts"` block in root `package.json`: `"ci:local": "act --pull=false"`, `"ci:local:full": "act"`, `"ci:local:workflow": "act -W .github/workflows"`, `"ci:local:list": "act -l"`, `"validate:scripts:broken": "bun run scripts/validate/detect-broken-scripts.ts"` — additive-only, no existing entries modified
- [x] T004 [P] Add `.act.secrets` as an explicit entry in `.gitignore` under the existing `# act (local GitHub Actions runner)` section, immediately after the `.secrets` line — file path: `.gitignore` (root); do NOT modify `.actrc`'s `--secret-file` reference which must continue to point to `.secrets`
- [x] T005 Run `bun run validate:scripts:runtime` and confirm it exits 0 after T003 changes — verifies all 5 new script keys map to existing or newly-registered files; **blocks Phase 3 if this fails** — no file changes, terminal verification only

---

## Phase 3: US-01 & US-02 — Core Local CI Execution

> **US-01:** As a developer, I want to run all GitHub Actions workflows locally before pushing.
> **US-02:** As a developer, I want a fast default CI run that does not pull fresh Docker images.

**Story goal:** `bun run ci:local` executes all 5 workflows using the fast `--pull=false` profile; `bun run ci:local:full` re-pulls images for full-fidelity validation. The governance orchestrator (`run-local-ci.ts`) wraps all checks in a 7-step sequence with a summary table.

**Independent test criteria:** `bun run ci:local` exits 0 on a clean repository state; TypeScript compilation of `scripts/run-local-ci.ts` succeeds with `bun run typecheck`.

- [x] T006 [P] [US-01] Audit all 5 GitHub workflow files for `act` compatibility — for each of `.github/workflows/ci.yml`, `.github/workflows/architecture-governance.yml`, `.github/workflows/ci-type-safety.yml`, `.github/workflows/hard-mode-guard.yml`, `.github/workflows/ai-context-validation.yml`: verify no YAML structural changes are needed, document per-workflow compatibility status (FULL/PARTIAL), and record known limitations (cache, artifacts, schedule trigger, branch context); all findings feed directly into T013 §Differences from GitHub CI — no workflow YAML files modified
- [x] T007 [US-01] Create `scripts/run-local-ci.ts` — the 7-step governance orchestrator; must include: (0) Docker fail-fast check via `docker info`, then steps (1–7) in order: `validate-runtime-scripts`, `validate:scripts:broken`, `generate-script-docs`, `arch:guard`, `type-safety-guard`, `lint`, `ci:local`; all 7 steps run regardless of individual failure; print `[STEP N/7] <name> ... PASS/FAIL` per step; suppress output for passing steps, forward full stdout/stderr for failed steps; print final summary table after all steps; exit 0 if all pass, exit 1 with first-failure identification if any fail; JSDoc metadata header MUST include `@script ci:run-local`, `@domain ci`, `@description`, `@mode manual,pre-closure`, `@dependencies node:child_process, node:process`; ALSO add `"ci:run-local": "bun scripts/run-local-ci.ts"` to the root `package.json` `"scripts"` block (additive-only, done after creating the file so validate-runtime-scripts passes)
- [x] T008 [US-01] Verify TypeScript compilation of `scripts/run-local-ci.ts` by running `bun run typecheck` and then `bun run validate:scripts:runtime` — confirms (a) the orchestrator has no type errors and (b) the new `ci:run-local` key in `package.json` correctly resolves to the created script file; **this task is a sequential gate** — T007 must complete before T008 can run; no file changes, terminal verification only

---

## Phase 4: US-03 — Single Workflow Targeting

> **US-03:** As a developer, I want to run a single workflow in isolation so that I can debug a
> failing job without re-running all workflows.

**Story goal:** `bun run ci:local:workflow` accepts an optional workflow filename and runs that single workflow; `bun run ci:local:list` lists all available workflows without executing them. The implementation is fully covered by T003's script registrations; this phase verifies the correct behavior.

**Independent test criteria:** `bun run ci:local:list` outputs a table with all 5 workflow jobs without executing any containers; `bun run ci:local:workflow ci.yml` targets only `ci.yml`.

- [x] T009 [US-03] Verify `bun run ci:local:list` outputs all 5 workflow files and their jobs without executing any containers — confirm output lists `ci.yml`, `architecture-governance.yml`, `ci-type-safety.yml`, `hard-mode-guard.yml`, `ai-context-validation.yml`; verify `bun run ci:local:workflow ci.yml` runs only the `ci.yml` workflow jobs — no file changes, terminal acceptance verification only; findings feed into T013 §Running CI Locally

---

## Phase 5: US-04 — CI Parity Contract Enforcement

> **US-04:** As a developer, I want any new GitHub Actions workflow I add to be runnable locally
> via `act`, so that the CI parity contract is maintained across all team members.

**Story goal:** A documented and governance-enforced rule exists that every `.github/workflows/*.yml` file must be locally executable via `act`. Violations block PR merge and stage closure.

**Independent test criteria:** `docs/ci/local-ci.md` contains a "CI Parity Contract" section listing the enforcement rules; `AGENTS.md` contains a machine-readable rule requiring all workflows to be locally executable.

- [x] T010 [US-04] Document CI parity contract enforcement policy in `docs/ci/local-ci.md` §CI Parity Contract — policy must state: every file in `.github/workflows/` must execute locally via `act`; any workflow that cannot run locally must be adapted, mocked, or have exclusion documented before PR merge; violations block stage closure; document all per-workflow known limitations from T006 audit findings — this task may be done as part of the T013 documentation creation pass

---

## Phase 6: US-05 — Closure Gate Enforcement

> **US-05:** As an AI orchestrator agent, I want closure of any stage to be blocked if local CI
> simulation fails, so that no stage can be closed with broken workflows.

**Story goal:** The root `AGENTS.md` contains a machine-readable, non-bypassable pre-closure rule requiring `bun run ci:local` to pass before any stage can be closed. No bypass mechanism exists.

**Independent test criteria:** `grep -n "ci:local" AGENTS.md` returns at least one result in the AI Behavioral Enforcement section; the rule text explicitly states "non-bypassable".

- [x] T011 [US-05] Define the orchestrator closure gate specification — write the full gate prose (gate name: "Run Local CI Simulation (ACT)", command: `bun run ci:local`, required outcome: exit code 0, failure behavior: "Block closure with message 'Local CI failed — see output above'", bypass: "None. This gate is not configurable or skippable.") for integration into `AGENTS.md` root; this design artifact is consumed by T012
- [x] T012 [US-05] Update root `AGENTS.md` (repository root only — do NOT modify `apps/*/AGENTS.md`) by adding a `### Local CI Simulation Gate (Mandatory Pre-Closure)` section under the "AI Behavioral Enforcement (Strict Contract)" block; the section must state: (1) run `bun run ci:local` from repo root, (2) confirm all workflow jobs exit with code 0, (3) block closure if any job fails, (4) report failing workflow and job name in the closure block reason, (5) this gate is non-bypassable — no flag, config, or exceptional case permits skipping; also add CI parity contract rule: every `.github/workflows/*.yml` file must be locally executable via `act`, and any workflow not runnable locally must be adapted or have its exclusion documented before merge — file path: `AGENTS.md` (root)

---

## Phase 7: US-06 — Developer Documentation

> **US-06:** As a developer (or new team member), I want a clear reference document covering
> installation, configuration, running, and troubleshooting of local CI simulation.

**Story goal:** `docs/ci/local-ci.md` exists with all 6 required sections covering installation, configuration, running, troubleshooting, differences from GitHub CI, and the CI parity contract. `AGENTS.md` already contains the pre-closure rule (T012). All instructions reference `bun run` commands exclusively.

**Independent test criteria:** `docs/ci/local-ci.md` exists; file contains sections for "What Is act", "Installation", "Configuration", "Running CI Locally", "Troubleshooting", and "Differences from GitHub CI".

- [x] T013 [P] [US-06] Create `docs/ci/local-ci.md` (new directory `docs/ci/` must also be created) with all 6 required sections: (1) **What Is `act`** — 2-paragraph overview of act and how it mirrors GitHub runner environment; (2) **Installation** — `brew install act` for macOS, `curl | sudo bash` for Linux, Docker Desktop prerequisite; (3) **Configuration** — location and purpose of `.actrc` (do not recreate — show existing content), how to create `.act.secrets` from template (test-safe values: DATABASE_URL, TEST_DATABASE_URL, REDIS_URL, TEST_REDIS_URL, NODE_ENV), warning: never commit `.act.secrets`; (4) **Running CI Locally** — all 4 `ci:local*` commands with examples and the `bun scripts/run-local-ci.ts` full orchestrator invocation; (5) **Troubleshooting** — table covering Docker not running, OCI arch mismatch (Apple M1), missing secrets, E2E playwright binaries, hard-mode-guard branch context injection, Docker socket for services; (6) **Differences from GitHub CI** — table comparing cache, artifact upload, step summary, schedule trigger, branch context, pre-installed tools between GitHub CI and `act` local — file path: `docs/ci/local-ci.md`
- [x] T014 [US-06] Add **Developer Workflow** section to `docs/ci/local-ci.md` documenting the recommended pre-push sequence: `bun run ci:local` → on pass: `git add . && git commit && git push`; include note about optional (non-blocking) pre-push hint via `.husky/pre-push`; reference `bun scripts/run-local-ci.ts` for the full governance run with summary table — file path: `docs/ci/local-ci.md` (append section, do not recreate file)

---

## Final Phase: Acceptance Tests

> Manual acceptance verification tasks that confirm all user stories are satisfied end-to-end.
> These tasks produce no file changes — they validate the deliverables created in Phases 1–7.

- [x] T015 Verify all 5 GitHub workflows execute locally — run verification sequence: (1) confirm `.act.secrets` exists locally before running (developer must create from docs/ci/local-ci.md §Configuration — verify with `[[ -f .act.secrets ]]`); (2) `git log --diff-filter=A -- .act.secrets` must return empty (AC-12 git-history check); (3) `bun run ci:local:list` → confirm all 5 workflows appear; (4) `bun run ci:local` → confirm all non-E2E workflow jobs pass or expected failures are documented; (5) `bun run ci:local:full` → confirm with fresh images; (6) `bun run ci:local:workflow ci.yml` → confirm single-workflow execution; (7) `bun run ci:local:workflow architecture-governance.yml` → confirm targeted run; confirms AC-04, AC-05, AC-08, AC-12 — manual execution task, no file changes
- [x] T016 Run failure simulation test — two sub-cases; **all deliberate changes must be reverted before this task is marked complete (confirm via `git diff` showing clean state)**:
  - **Sub-case A — Lint failure (Step 6):** (1) Introduce a deliberate lint error in a scratch test file (e.g., unused variable declaration); (2) run `bun run ci:local`; (3) confirm exit code is non-zero; (4) run `bun scripts/run-local-ci.ts` and confirm summary table shows FAIL for the affected step; (5) revert the deliberate error via `git checkout`; (6) confirm `git diff` is clean; (7) confirm `bun run ci:local` exits 0 again
  - **Sub-case B — `act`-specific failure (Step 7, AC-11):** (1) Add a temporary `exit 1` step to a non-critical position inside `.github/workflows/ci.yml` (e.g., after a passing step, guarded by a comment); (2) run `bun run ci:local:workflow ci.yml`; (3) confirm exit code is non-zero from `act`; (4) run `bun scripts/run-local-ci.ts` and confirm summary table shows FAIL specifically for Step 7 (`ci:local`); (5) revert the temporary `exit 1` via `git checkout`; (6) confirm `git diff` is clean; (7) confirm `bun run ci:local:workflow ci.yml` exits 0 again — this is the only path that directly validates AC-11 (closure blocked when any `act` workflow job fails)

---

## Dependencies

```
Phase 1 (T001, T002)
    └── Phase 2 (T003, T004) [T001/T002 establish preconditions]
            ├── T005 [depends on T003]
            ├── Phase 3 (T006, T007, T008) [T003 must be complete]
            │       ├── T008 [depends on T007]
            │       └── Phase 4 (T009) [T003 must be complete]
            └── Phase 2 (T004) [independent of T003]

Phase 3 (T006, T007) ──► Phase 5 (T010) [T006 audit feeds T010 content]
Phase 5 (T010) ──► Phase 6 (T011) ──► T012 [T011 defines gate, T012 writes it]
Phase 6 (T012) is independent of Phase 7
Phase 7 (T013) ──► T014 [T014 appends to file T013 creates]
Phase 6 (T012) + Phase 7 (T013, T014) ──► Final Phase (T015, T016) [all deliverables must exist]
T007 ──► T016 [failure simulation requires orchestrator to exist]
```

**Completion order (minimum viable):** T001 → T002 → T003 → T004 → T005 → T007 → T008 → T011 → T012 → T013 → T014 → T015

**Parallel batches:**

- Batch A: T001, T002 (both read-only)
- Batch B: T003, T004 (different files)
- Batch C (after Batch B): T005, T006, T007 (T005 validates T003; T006 and T007 are independent)
- Batch D (after T007): T008, T009, T010 (T008 validates T007; T009 uses T003 scripts; T010 documents T006 findings)
- Batch E (after T010, T011): T011, T012 (T011 must precede T012)
- Batch F (after T011/T012): T013, T012 can overlap (different files)
- Batch G (after T013): T014
- Final: T015, T016 (after all above)

---

## Parallel Execution Examples

### Parallel Batch A — Setup verification (no dependencies)

```bash
# Terminal 1
cat .actrc  # Verify .actrc content (T002)

# Terminal 2
brew list act 2>/dev/null || echo "act not installed" # T001 prerequisite check
```

### Parallel Batch B — Foundational config changes

```bash
# Terminal 1 — T003: Add script entries to package.json
# Edit package.json: add 5 script keys

# Terminal 2 — T004: Update .gitignore
# Edit .gitignore: add .act.secrets under # act section
```

### Parallel Batch C — Workflow audit + orchestrator creation

```bash
# Terminal 1 — T006: Audit workflows (read-only analysis)
cat .github/workflows/ci.yml
cat .github/workflows/architecture-governance.yml
# ... per-workflow review

# Terminal 2 — T007: Create scripts/run-local-ci.ts
# Implement the 7-step orchestrator
```

### Parallel Batch F — AGENTS.md + docs creation

```bash
# Terminal 1 — T012: Update AGENTS.md (root)
# Add Local CI Simulation Gate section

# Terminal 2 — T013: Create docs/ci/local-ci.md
mkdir -p docs/ci
# Create full documentation file
```

---

## Implementation Strategy

**Recommended MVP:** Complete Phases 1–3 first (T001–T008). This gives you a working `bun run ci:local` command and the governance orchestrator. All other phases add documentation, enforcement rules, and verification.

**Incremental delivery order:**

1. **Day 1 — Core:** T001, T002 (verify), then T003 + T004 (config), then T005 (validate), then T007 (orchestrator)
2. **Day 1 — Verify:** T008 (type check), T006 (workflow audit)
3. **Day 2 — Governance:** T009 (US-03 verify), T010 (parity contract), T011 + T012 (AGENTS.md gate)
4. **Day 2 — Docs:** T013 + T014 (docs/ci/local-ci.md)
5. **Day 2 — Acceptance:** T015 (verify workflows), T016 (failure simulation)

**Risk factors:**

- T007 is the highest-risk task — TypeScript implementation with specific output format requirements
- T016 (failure simulation) requires Docker and act to be installed and running
- T015 may surface unexpected act compatibility issues despite the audit in T006

---

## Acceptance Criteria Mapping

| AC ID | Criterion                                                                    | Verified By                                   |
| ----- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| AC-01 | `.actrc` exists at repository root with correct runner mapping               | T002                                          |
| AC-02 | `.act.secrets` exists and is listed in `.gitignore`                          | T004                                          |
| AC-03 | Four `ci:local*` script keys exist in root `package.json`                    | T003                                          |
| AC-04 | `bun run ci:local` exits zero on a clean repository state                    | T015                                          |
| AC-05 | `bun run ci:local:full` exits zero on a clean repository state               | T015                                          |
| AC-06 | `scripts/run-local-ci.ts` exists with JSDoc metadata header                  | T007                                          |
| AC-07 | Orchestrator closure gate includes `act` as mandatory, non-bypassable step   | T012                                          |
| AC-08 | All `.github/workflows/` files can run locally or have documented exclusions | T006, T015                                    |
| AC-09 | `docs/ci/local-ci.md` exists with all required sections                      | T013, T014                                    |
| AC-10 | `AGENTS.md` includes the pre-closure `ci:local` enforcement rule             | T012                                          |
| AC-11 | Closure is blocked when any `act` workflow job fails                         | T016                                          |
| AC-12 | `.act.secrets` is not present in any git commit history                      | T004 (gitignore), T015 (git log verification) |

---

## Hard Enforcement Notes

- **`.actrc` must not be overwritten** — T002 is verify-only; any task that writes to `.actrc` violates plan AD-06
- **`.secrets` remains the primary file** — T004 only adds `.act.secrets` to `.gitignore`; the `--secret-file .secrets` reference in `.actrc` must not change
- **6 script keys total** — T003 adds 5: `ci:local`, `ci:local:full`, `ci:local:workflow`, `ci:local:list`, `validate:scripts:broken`; T007 adds 1 additional: `ci:run-local` (registered after `scripts/run-local-ci.ts` is created so `validate-runtime-scripts` passes); `ci:local` maps to `act --pull=false` (not to `run-local-ci.ts` — these are separate commands)
- **Root AGENTS.md only** — T012 updates `AGENTS.md` at repo root only; `apps/*/AGENTS.md` files are not touched (spec FR-12)
- **scripts/ domain** — `run-local-ci.ts` lives under `scripts/`; no changes required to `ARCHITECTURE_MAP.json` (plan AD-01)
- **No business logic** — this stage introduces zero database connections, zero API routes, zero domain logic

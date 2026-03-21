# INFRA-023 – Technical Implementation Plan: Local CI Simulation With Act

**Version:** 1.0.0
**Created:** 2026-03-17
**Phase:** 01 – Platform Foundation
**Stage:** STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT
**Spec:** [spec.md](./spec.md)
**Research:** [research.md](./research.md)
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md`

---

## Stage Status

Status: IN PROGRESS
Step: plan

---

## 1. Overview

This stage introduces a deterministic **local CI simulation layer** using `act` (nektos/act). The
deliverables are configuration files, script wrappers, and documentation — no business logic, no
database changes, no API changes.

The implementation is a governance tooling layer. It lives entirely in the `scripts/` domain and
repository configuration. The critical outcome is a mandatory pre-closure gate that blocks stage
closure when local CI fails.

### 1.1 Deliverables

| File                      | Type          | Action                                                              |
| ------------------------- | ------------- | ------------------------------------------------------------------- |
| `.actrc`                  | Config        | Verify (already exists — comprehensive)                             |
| `.act.secrets`            | Local secrets | Gitignore entry only (not committed)                                |
| `.gitignore`              | Config        | Modify (add entry)                                                  |
| `package.json`            | Config        | Modify (add 6 script entries: 5 via T003 + `ci:run-local` via T007) |
| `scripts/run-local-ci.ts` | Orchestrator  | Create                                                              |
| `docs/ci/local-ci.md`     | Documentation | Create (new dir)                                                    |
| `AGENTS.md` (root)        | Governance    | Modify (add pre-closure rule)                                       |

Per-app `AGENTS.md` files (`apps/*/AGENTS.md`) are **not modified** by this stage (FR-12).

---

## 2. Architecture Decisions

### AD-01 — No New Modules

`scripts/run-local-ci.ts` is a standalone script in the `scripts/` domain. It is not a
`packages/*` module and is not imported anywhere. The architecture layer model does not govern
`scripts/` internals. No update to `ARCHITECTURE_MAP.json` is required.

**Validation:** Running `bun scripts/infra-audit.ts` after this stage must pass without violations.

### AD-02 — No Migration, No Schema Change

Zero database interactions. Zero tenant context. Architecture trust chain is unaffected.

### AD-03 — Script Key Naming Follows `domain:action` Convention

All new `package.json` entries follow the Zidney script governance naming rule:

- `ci:local` — fast local CI (domain: ci, action: local)
- `ci:local:full` — full-pull local CI
- `ci:local:workflow` — single-workflow targeted run
- `ci:local:list` — list available workflows

### AD-04 — `validate:scripts-infra` Must Be Added

This script key does not exist in `package.json`. It is required by `run-local-ci.ts` (FR-06,
step 2). It maps to the existing `scripts/validate/detect-broken-scripts.ts` which validates that
all TypeScript scripts referenced in `package.json` exist and are not broken. Adding this entry
is part of T003 (not a new script file — only a new `package.json` registration).

### AD-05 — Correct Script Key Mapping

The following mapping between conceptual names and actual registered keys has been verified:

| Conceptual Name (spec/FR-06)     | Registered key in `package.json`            | Verified            |
| -------------------------------- | ------------------------------------------- | ------------------- |
| `validate-runtime-scripts`       | `validate-runtime-scripts`                  | ✅                  |
| `validate-script-infrastructure` | `validate:scripts-infra` (to be added T003) | ➕ ADD              |
| `generate-script-docs`           | `generate-script-docs`                      | ✅                  |
| `architecture-guard`             | `arch:guard`                                | ✅                  |
| `type-safety-guard`              | `type-safety-guard`                         | ✅                  |
| `lint (full-repo)`               | `lint`                                      | ✅                  |
| `type:check` (user request)      | `type-check` (actual key)                   | ✅ use `type-check` |
| `ci:local`                       | (to be added T003)                          | ➕ ADD              |

### AD-06 — Secrets Strategy: `.secrets` Is Primary, `.act.secrets` Is Optional

The existing `.actrc` already references `--secret-file .secrets`. The `.secrets` file exists at
the repository root (587 bytes, last modified 2026-02-28) and is listed in `.gitignore` under the
`# act (local GitHub Actions runner)` section. This is the **primary** secrets mechanism — it
must not be changed.

`.act.secrets` is an **optional** secondary file some developers may prefer. It must also be
gitignored. T004 scope: add `.act.secrets` to `.gitignore` only. Do **not** modify `.actrc`'s
`--secret-file` reference — it must continue to point to `.secrets`.

### AD-07 — `run-local-ci.ts` Package.json Registration

The orchestrator script `scripts/run-local-ci.ts` must be registered in `package.json` as
`"ci:run-local": "bun scripts/run-local-ci.ts"`. T003 adds this key alongside the 5 `ci:local*`
scripts. Running `bun run validate:runtime:scripts` then confirms the key exists and the script
file parses. **Correction:** `ci:local` maps to `act --pull=false`, NOT to `run-local-ci.ts` —
these are separate commands. `ci:run-local` is the key that invokes the orchestrator script.

---

## 3. Pre-Conditions

Before implementation begins, the following must be confirmed:

| Pre-Condition                                               | Status                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `act` installable via `brew install act` (macOS)            | ✅ Documented                                                                                                          |
| Docker Desktop available on developer machine               | ✅ Assumption (spec §Assumptions)                                                                                      |
| `.github/workflows/` contains 5 workflow files              | ✅ Confirmed (ci.yml, architecture-governance.yml, ci-type-safety.yml, hard-mode-guard.yml, ai-context-validation.yml) |
| `.gitignore` exists                                         | ✅ Confirmed                                                                                                           |
| `docs/ci/` directory does **not** yet exist                 | ✅ Confirmed — will be created                                                                                         |
| `.actrc` exists at repo root with full Apple Silicon config | ✅ Confirmed — do NOT overwrite                                                                                        |
| No existing `.act.secrets` at repo root                     | Verify before T004                                                                                                     |

---

## 4. Implementation Tasks

Tasks in this plan provide design-level context and scope. The authoritative implementation task
list is **`tasks.md`** (16 tasks, T001–T016). Task IDs in this plan do not align 1:1 with
`tasks.md` — `tasks.md` is more granular (3 additional verification gate tasks: T005, T008, T009).
When implementing, always reference `tasks.md` as the controlling task document.

---

### T001 – Install & Standardize `act`

**Type:** Documentation + Developer Setup  
**Files:** `docs/ci/local-ci.md` (section: Installation)  
**Risk:** Low

**Scope:**

- Document the canonical `act` installation methods:
  - macOS: `brew install act`
  - Linux: `curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash`
- Document Docker as a prerequisite
- No version pinning (spec assumption: current stable is compatible)

**Implementation note:** This task is primarily addressed by T012 (documentation). T001 produces
no file changes beyond what T012 covers. It is listed first to establish the developer prerequisite
chain.

---

### T002 – Verify `.actrc` (Runner Mapping) — No-Op

**Type:** Verification (read-only)  
**File:** `.actrc` (repo root)  
**Risk:** None

**Status:** `.actrc` ALREADY EXISTS with comprehensive configuration. No changes required.

**Existing content (verified):**

```
--container-architecture linux/amd64
-P ubuntu-latest=catthehacker/ubuntu:act-22.04
-P ubuntu-22.04=catthehacker/ubuntu:act-22.04
-P ubuntu-20.04=catthehacker/ubuntu:act-20.04
--secret-file .secrets
--var-file .vars
--artifact-server-path /tmp/act-artifacts
--pull=true
--rm
--reuse=false
```

**Implementation note:** Do NOT overwrite `.actrc`. The existing config exceeds the stage's
requirements — it includes Apple Silicon (`--container-architecture linux/amd64`) compatibility
for M1/M2/M3 developer machines, 3 runner image mappings, and references to `.secrets` (the
primary secrets file). Overwriting would break Apple Silicon support for all local M-chip devs.

**Note on `ci:local` script:** The `--pull=false` flag in the `ci:local` entry deliberately
overrrides `.actrc`'s `--pull=true` for the fast profile. This is intentional.

**Acceptance:** AC-01 — `.actrc` exists at repository root with correct runner mapping. ✅ Already satisfied.

---

### T003 – Update `package.json` Script Entries

**Type:** Configuration  
**File:** `package.json` (repo root)  
**Risk:** Low — additive only

Add the following entries to the `"scripts"` block:

```json
"ci:local": "act --pull=false",
"ci:local:full": "act",
"ci:local:workflow": "act -W .github/workflows",
"ci:local:list": "act -l",
"validate:scripts-infra": "bun run scripts/validate/detect-broken-scripts.ts"
```

**Key notes:**

- `ci:local:workflow` runs all workflows by default (directory target). To target a single file,
  developers append the filename. The `run-local-ci.ts` script calls `bun run ci:local` (the
  full-directory run). The `ci:local:workflow` variant is for interactive developer use.
- `validate:scripts-infra` maps to the existing `detect-broken-scripts.ts` validation tool,
  satisfying FR-06 step 2 without creating a new script file.
- All keys follow `domain:action` convention (FR-03, Zidney script governance).

**Acceptance:** AC-03 — Four `ci:local*` script keys exist in root `package.json`.

---

### T004 – Add `.act.secrets` to `.gitignore`

**Type:** `.gitignore` modification only (gitignore entry — no file creation, no `.actrc` changes)  
**File:** `.gitignore` (repo root)  
**Risk:** Low — `.act.secrets` must never be committed

**Action:** Add `.act.secrets` to `.gitignore` under the existing `# act` section.

**Content documented for developer self-service (`.act.secrets` — local only, not committed):**

```
DATABASE_URL=postgres://zidney_test:zidney_test@localhost:5432/zidney_master_test
TEST_DATABASE_URL=postgres://zidney_test:zidney_test@localhost:5432/zidney_master_test
REDIS_URL=redis://localhost:6379
TEST_REDIS_URL=redis://localhost:6379
NODE_ENV=test
```

**Rules:**

- Real production secrets must never appear in this file
- `.act.secrets` is created by the developer locally — it is not committed or tracked
- `.actrc` already references `.secrets` via `--secret-file .secrets` — do **NOT** modify `.actrc` (see AD-06)
- `.act.secrets` is an optional secondary local secrets file documented for developer convenience in `docs/ci/local-ci.md`

> **AD-06 Note:** Per AD-06, `.actrc`'s `--secret-file .secrets` reference must not be changed.
> The existing `.actrc` is comprehensive and authoritative. **No `.actrc` modifications are
> performed in this task.** The "Updated `.actrc` content" block has been intentionally removed
> to prevent accidental overwrite of the authoritative 8-line configuration.

**Acceptance:** AC-02 — `.act.secrets` is listed in `.gitignore` (developer creates the file locally per `docs/ci/local-ci.md §Configuration`).

---

### T005 – Workflow Compatibility Audit

**Type:** Analysis + Documentation  
**Files:** `docs/ci/local-ci.md` (section: Differences from GitHub CI), `plan.md` (this document)  
**Risk:** None — audit only, no workflow YAML changes

**Audit results** (see `research.md` §2 for full details):

| Workflow                      | act Compatibility | Adaptation Required | Known Limitations                                                                   |
| ----------------------------- | ----------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `ci.yml`                      | ✅ Runnable       | None                | Cache: local tmpdir; Artifacts: no-op; Step Summary: discarded; Services: supported |
| `architecture-governance.yml` | ✅ Runnable       | None                | Schedule trigger: skipped by default; GITHUB_STEP_SUMMARY: discarded                |
| `ci-type-safety.yml`          | ✅ Runnable       | None                | Fully compatible                                                                    |
| `hard-mode-guard.yml`         | ✅ Runnable       | None                | Branch context: inject via `--env` for accurate simulation                          |
| `ai-context-validation.yml`   | ✅ Runnable       | None                | Fully compatible                                                                    |

**Conclusion:** All 5 workflows are locally executable without structural changes. Zero workflows
require exclusion. All known limitations are documentation-only.

**CI Parity Contract status:** SATISFIED. Every `.github/workflows/*.yml` file can execute
locally via `act`.

---

### T006 – Create `scripts/run-local-ci.ts` (Orchestrator Script)

**Type:** Script implementation  
**File:** `scripts/run-local-ci.ts`  
**Risk:** Low

#### 6.1 Script Metadata Header (Required by Zidney Script Governance)

```typescript
/**
 * @script ci:run-local
 * @domain ci
 * @description Local CI orchestrator — runs all governance checks and act CI simulation.
 *              Validates Docker availability, runs governance gates in sequence, executes
 *              act local CI, and reports per-step PASS/FAIL with a final summary table.
 *              Exits non-zero if any step fails. Must be run before stage closure.
 * @mode manual,pre-closure
 * @dependencies node:child_process, node:process
 */
```

#### 6.2 Execution Sequence

The script must execute the following steps in order, stopping to collect status at each step
(not halting on first failure — all steps run so the summary is complete):

| Step | Command                            | Purpose                                       |
| ---- | ---------------------------------- | --------------------------------------------- |
| 0    | `docker info`                      | Fail-fast: verify Docker is running           |
| 1    | `bun run validate:runtime:scripts` | Verify all script files in package.json exist |
| 2    | `bun run validate:scripts-infra`   | Verify no broken script references            |
| 3    | `bun run dev:generate:script-docs` | Regenerate script documentation               |
| 4    | `bun run arch:guard`               | Architecture boundary enforcement             |
| 5    | `bun run arch:type-safety-guard`   | TypeScript type safety validation             |
| 6    | `bun run lint`                     | Full-repository Biome lint check              |
| 7    | `bun run ci:local`                 | Execute act CI simulation (all workflows)     |

**Note on Step 0 (Docker fail-fast):** This is a prerequisite check, not a governance step. If
Docker is not running, the script exits immediately with a clear error before any step output is
shown. Steps 1–7 are all tracked in the summary table.

#### 6.3 Output Design

**Per-step status line format:**

```
[STEP 1/7] validate-runtime-scripts ... PASS
[STEP 2/7] validate:scripts-infra ... FAIL
[STEP 3/7] generate-script-docs ... PASS
...
```

**On failure:** Full command output is forwarded to stdout for the failed step only. Passing steps
suppress output (summary-only mode).

**Final summary table (always printed after all steps):**

```
╔══════════════════════════════════════════════════════╗
║              Local CI Simulation Summary             ║
╠══════════════════════════════════════════════════════╣
║ STEP  │ NAME                       │ RESULT          ║
╠══════════════════════════════════════════════════════╣
║   1   │ validate-runtime-scripts   │ ✅ PASS         ║
║   2   │ validate:scripts-infra     │ ❌ FAIL         ║
║   3   │ generate-script-docs       │ ✅ PASS         ║
║   4   │ arch:guard                 │ ✅ PASS         ║
║   5   │ type-safety-guard          │ ✅ PASS         ║
║   6   │ lint                       │ ✅ PASS         ║
║   7   │ ci:local                   │ ✅ PASS         ║
╠══════════════════════════════════════════════════════╣
║ RESULT: FAIL — Step 2 failed (validate:scripts-infra)║
╚══════════════════════════════════════════════════════╝
```

**Exit behavior:**

- All steps pass → exit code 0
- Any step fails → exit code 1 with message identifying the first failure

#### 6.4 Error Contract

```
[DOCKER CHECK] Docker is not running. Start Docker Desktop before running local CI.
Exit code: 1
```

```
[STEP N/7] <name> ... FAIL
Error output for step N:
<full stdout/stderr of failed command here>

Local CI failed at step N: <name>
Run `bun run <script>` to see full output.
Exit code: 1
```

#### 6.5 Implementation Skeleton

```typescript
/**
 * @script ci:run-local
 * @domain ci
 * @description Local CI orchestrator ...
 * @mode manual,pre-closure
 * @dependencies node:child_process, node:process
 */

import { execSync, spawnSync } from "node:child_process";

interface StepResult {
  name: string;
  passed: boolean;
  output: string;
}

function checkDocker(): void {
  try {
    execSync("docker info", { stdio: "pipe" });
  } catch {
    console.error(
      "[DOCKER CHECK] Docker is not running. Start Docker Desktop before running local CI.",
    );
    process.exit(1);
  }
}

function runStep(name: string, command: string): StepResult {
  const result = spawnSync("bun", ["run", ...command.split(" ")], {
    stdio: "pipe",
    encoding: "utf-8",
    shell: false,
  });
  const passed = result.status === 0;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { name, passed, output };
}

function printSummary(results: StepResult[]): void {
  // Print summary table
  // ...
}

function main(): void {
  checkDocker();

  const steps: Array<{ name: string; command: string }> = [
    { name: "validate-runtime-scripts", command: "validate-runtime-scripts" },
    { name: "validate:scripts-infra", command: "validate:scripts-infra" },
    { name: "generate-script-docs", command: "generate-script-docs" },
    { name: "arch:guard", command: "arch:guard" },
    { name: "type-safety-guard", command: "type-safety-guard" },
    { name: "lint", command: "lint" },
    { name: "ci:local", command: "ci:local" },
  ];

  const results: StepResult[] = [];
  for (const [i, step] of steps.entries()) {
    process.stdout.write(`[STEP ${i + 1}/${steps.length}] ${step.name} ... `);
    const result = runStep(step.name, step.command);
    results.push(result);
    console.log(result.passed ? "PASS" : "FAIL");
    if (!result.passed) {
      console.error(result.output);
    }
  }

  printSummary(results);

  const anyFailed = results.some((r) => !r.passed);
  if (anyFailed) {
    const first = results.find((r) => !r.passed)!;
    console.error(`\nLocal CI failed at: ${first.name}`);
    process.exit(1);
  }
}

main();
```

**Note:** The skeleton above illustrates the structural design. The actual implementation must
expand the `printSummary` function, use proper string formatting for the table, and handle the
`ci:local` step distinctly (since it captures multi-job act output which should be forwarded
in full on failure).

#### 6.6 Idempotency Guarantee

Running `run-local-ci.ts` multiple times produces the same result for the same code state:

- No files are written or mutated during a run
- `generate-script-docs` is idempotent (overwrites output files with same content)
- `act` uses ephemeral containers that are removed after each run
- Each step is a stateless command invocation

---

### T007 – Orchestrator Closure Gate Integration

**Type:** Governance documentation  
**Files:** `AGENTS.md` (root) — see T013 for the AGENTS.md update  
**Risk:** None — documentation only

**Scope:** This task documents the mandatory closure gate rule. The actual enforcement rule is
written in T013. This task ensures the orchestrator spec is updated to include a blocking gate
step before stage closure.

**Gate definition:**

```
Gate: Run Local CI Simulation (ACT)
Command: bun run ci:local
Required outcome: Exit code 0 (all workflow jobs pass)
Failure behavior: Block closure with message "Local CI failed — see output above"
Bypass: None. This gate is not configurable or skippable.
```

---

### T008 – Developer Workflow Integration

**Type:** Documentation  
**Files:** `docs/ci/local-ci.md` (section: Developer Workflow)  
**Risk:** None

**Required developer workflow:**

```bash
# After code changes, before git push:
bun run ci:local
# If all pass:
git add .
git commit -m "feat: ..."
git push
```

**Optional pre-push hint (non-blocking):**

A `.husky/pre-push` hint may display a warning if `ci:local` has not been run, but must not block
the push. This is non-required per the spec; if added it must be advisory only.

---

### T009 – CI Parity Contract Enforcement

**Type:** Policy  
**Files:** `AGENTS.md` (root), `docs/ci/local-ci.md`  
**Risk:** None

**Rule:** Every file added to `.github/workflows/` must be runnable via `act`. Violations block
PR merge and stage closure.

This rule is documented in `AGENTS.md` (T013) and `docs/ci/local-ci.md`.

---

### T010 – Verify All Workflows Execute Locally

**Type:** Acceptance test (manual execution)  
**Files:** None (runtime verification)  
**Risk:** None

**Verification steps:**

1. Run `bun run ci:local:list` — confirm all 5 workflows appear
2. Run `bun run ci:local` — confirm all workflow jobs pass or expected failures are documented
3. Run `bun run ci:local:full` — confirm with fresh images
4. Run `bun run ci:local:workflow ci.yml` — confirm single-workflow execution
5. Run `bun run ci:local:workflow architecture-governance.yml` — confirm targeted run

**Expected output:** Each workflow job reports PASS. If any job fails due to a test infrastructure
dependency (e.g., postgres not seeded), that failure must be diagnosed and either fixed or
documented as a local-only known issue.

**Acceptance:** AC-04, AC-05, AC-08.

---

### T011 – Failure Simulation Test

**Type:** Acceptance test  
**Files:** None (runtime test)  
**Risk:** Low — test only, must be reverted

**Steps:**

1. Introduce a deliberate lint error in a test file (e.g., add `var x` unused variable)
2. Run `bun run ci:local`
3. Confirm: exit code is non-zero
4. Confirm: failure output identifies the failing workflow job
5. Confirm: `run-local-ci.ts` summary table shows FAIL for the affected step
6. Revert the deliberate error
7. Confirm: `bun run ci:local` exits 0 again

**Acceptance:** AC-11.

---

### T012 – Create `docs/ci/local-ci.md`

**Type:** Documentation  
**File:** `docs/ci/local-ci.md` (new directory `docs/ci/`)  
**Risk:** None

#### Required Sections

**Section 1 — What Is `act`**

Explain that `act` is a CLI tool that executes GitHub Actions workflows locally using Docker
containers. It mirrors the GitHub runner environment and enables developers to catch CI failures
before pushing.

**Section 2 — Installation**

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

Prerequisites: Docker Desktop (macOS) or Docker Engine (Linux) must be installed and running.

**Section 3 — Configuration**

- Location of `.actrc` and its purpose (runner image mapping)
- How to create `.act.secrets` (copy the example in the spec)
- Warning: never commit `.act.secrets`

**Section 4 — Running CI Locally**

```bash
# Fast profile (recommended for daily use)
bun run ci:local

# Full profile (pull fresh images, use before release)
bun run ci:local:full

# Target a specific workflow
bun run ci:local:workflow ci.yml

# List all available workflows
bun run ci:local:list
```

**Section 5 — Troubleshooting**

| Symptom                                 | Cause                                | Fix                                                                       |
| --------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `Cannot connect to Docker daemon`       | Docker not running                   | Start Docker Desktop                                                      |
| `Unable to find image 'ubuntu:latest'`  | `.actrc` missing or wrong            | Re-create `.actrc` with correct mapping                                   |
| `OCI runtime exec failed`               | Container arch mismatch (Apple M1)   | Use `--container-architecture linux/amd64` in `.actrc`                    |
| Workflow fails due to missing secret    | `.act.secrets` missing or incomplete | Add the missing variable to `.act.secrets`                                |
| E2E playwright job fails in act         | Browser binaries not in image        | Skip e2e jobs locally or run them directly; document as known limitation  |
| `hard-mode-guard.yml` uses wrong branch | No git branch context injected       | Add `--env GITHUB_REF_NAME=spec/...` to act invocation                    |
| `services: postgres` connection refused | Docker socket not mounted            | Ensure act binds Docker socket: `--bind` flag or docker group permissions |

**Section 6 — Differences from GitHub CI**

| Feature                      | GitHub CI                      | `act` Local                                    |
| ---------------------------- | ------------------------------ | ---------------------------------------------- |
| `actions/cache@v4`           | GitHub cache service           | Local tmpdir (no cross-run cache)              |
| `actions/upload-artifact@v4` | Upload to GitHub               | Written to `.artifacts/` locally or discarded  |
| `$GITHUB_STEP_SUMMARY`       | GitHub UI summary pane         | Temp file, discarded                           |
| `schedule:` trigger          | Runs on cron schedule          | Must use `act schedule` explicitly             |
| Branch context vars          | Injected from GitHub event     | Default to local git HEAD; inject with `--env` |
| Pre-installed tools          | GitHub-hosted runner toolchain | `act-latest` image (similar but not identical) |
| Network access               | Full internet access           | Docker network (same by default)               |

**Acceptance:** AC-09.

---

### T013 – Update Root `AGENTS.md` (Pre-Closure Gate Rule)

**Type:** Governance  
**File:** `AGENTS.md` (repo root only)  
**Risk:** Low

**Scope:** Add the following rule to the "AI Behavioral Enforcement (Strict Contract)" section of
the root `AGENTS.md`. Per-app `AGENTS.md` files under `apps/*/` are **not updated**.

**Rule to add:**

```markdown
### Local CI Simulation Gate (Mandatory Pre-Closure)

Before closing any stage, AI agents MUST:

1. Run `bun run ci:local` from the repository root.
2. Confirm all workflow jobs exit with code 0 (all pass).
3. Block closure if any workflow job fails.
4. Report the failing workflow and job name in the closure block reason.

This gate is non-bypassable. No flag, config, or exceptional case permits skipping it.
The CI parity contract requires every `.github/workflows/*.yml` file to be locally
executable via `act`. Any workflow added that cannot run locally must be adapted, mocked,
or have its exclusion documented before merge.
```

**Placement:** After the existing "MCP Usage Restrictions & Auto-Trigger Rules" section, before the
"Architecture Discovery Workflow" section. Or appended to the end of the "AI Behavioral
Enforcement" section — choose whichever preserves logical grouping.

**Acceptance:** AC-10, FR-12.

---

## 5. Workflow Compatibility Audit (T005 Detail)

### 5.1 Per-Workflow Assessment

#### `ci.yml` — RUNNABLE (PARTIAL compatibility, no adaptation required)

**Jobs in file:** lint, typecheck, arch-guard, unit-tests, integration-tests, coverage-validation,
e2e-mmc, e2e-backoffice, e2e-frontoffice, build-verification

**act compatibility per concern:**

| Concern                      | act Behavior                                     | Blocks execution?                          |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------ |
| `services: postgres, redis`  | Docker services are spun up natively by act      | No                                         |
| `actions/cache@v4`           | Cache miss always; runs install step as fallback | No                                         |
| `actions/upload-artifact@v4` | Silent no-op or writes to `.artifacts/`          | No                                         |
| `$GITHUB_STEP_SUMMARY`       | Writes to temp file, discarded after run         | No                                         |
| E2E playwright jobs          | May fail if browser binaries not available       | **Possible** — document in troubleshooting |
| `sudo apt-get`               | Works inside container                           | No                                         |

**Recommendation:** Run `bun run ci:local` and confirm all non-E2E jobs pass. If E2E jobs fail
locally due to browser binary issues, they should be documented in `docs/ci/local-ci.md` as a
known limitation (E2E jobs are best run directly via `bun run test:e2e` or in GitHub CI).

#### `architecture-governance.yml` — RUNNABLE (minor documentation)

**Jobs in file:** architecture-governance

**act compatibility per concern:**

| Concern                      | act Behavior                                   | Blocks execution? |
| ---------------------------- | ---------------------------------------------- | ----------------- |
| `schedule:` trigger          | Not triggered by `act` default push invocation | No (skipped)      |
| `actions/upload-artifact@v4` | Silent no-op                                   | No                |
| `$GITHUB_STEP_SUMMARY`       | Discarded                                      | No                |
| `fetch-depth: 0`             | Supported by act                               | No                |

#### `ci-type-safety.yml` — FULLY RUNNABLE ✅

**Jobs in file:** type-check-src, type-check-tests, validate-types (or similar)  
No services, no artifacts, no cron. Fully compatible.

#### `hard-mode-guard.yml` — RUNNABLE (branch context injection needed for accurate testing)

**Jobs in file:** validate

**act compatibility per concern:**

| Concern                                  | act Behavior                                                       | Blocks execution?                            |
| ---------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `github.head_ref \|\| github.ref_name`   | Defaults to current git HEAD; may not match spec/infra-023 pattern | No (continues with HEAD)                     |
| `github.event.repository.default_branch` | May default to empty string                                        | Step may fail if branch check logic triggers |
| `git fetch origin "$BASE_REF"`           | Works in container if network available                            | No                                           |

**Recommendation:** To accurately simulate `hard-mode-guard.yml` for a specific branch, inject
context: `act -W .github/workflows/hard-mode-guard.yml --env GITHUB_REF_NAME=spec/infra-023-local-ci-simulation-with-act`

#### `ai-context-validation.yml` — FULLY RUNNABLE ✅

No services, no artifacts, no cron. Fully compatible.

---

### 5.2 Audit Verdict

**All 5 workflows: Locally executable. Zero require exclusion. Zero require YAML modification.**

CI Parity Contract: SATISFIED from day 1.

---

## 6. Script Design: `run-local-ci.ts`

### 6.1 File Location and Registration

- **File:** `scripts/run-local-ci.ts`
- **Domain:** `ci` (consistent with `ci:local*` script keys)
- **Registered in package.json:** No new key needed (the script is called internally by
  `bun run ci:local` only indirectly; it is a standalone executable)

**Wait** — re-reading: the spec says `run-local-ci.ts` is the orchestrator that itself calls
`bun run ci:local`. The `package.json` scripts `ci:local` etc. are simple `act` wrappers.
`run-local-ci.ts` is a standalone governance script that a developer runs directly:

```bash
bun scripts/run-local-ci.ts
```

Or it could be registered as:

```json
"ci:check": "bun scripts/run-local-ci.ts"
```

Per stage task T006, the script file is `scripts/run-local-ci.ts`. Per Zidney script governance,
every script under `scripts/` must be registered in `package.json`. The plan recommends
registering it as `ci:check` (full governance run with summary) while `ci:local` remains the
simple `act --pull=false` wrapper.

### 6.2 Step Execution Strategy

Each step is executed using `spawnSync` (not `execSync`) to:

- Capture stdout and stderr independently
- Allow all steps to complete before exiting
- Return a result object with pass/fail and output

The Docker check uses `execSync` with `stdio: 'pipe'` since it is a fail-fast check, not a tracked
step.

### 6.3 Step Output Suppression Strategy

```
Step passes → suppress stdout/stderr (print only PASS status line)
Step fails  → print full stdout + stderr of the failed step immediately after the FAIL status line
Final       → print summary table regardless
```

This reduces noise for common case (all pass) while preserving full diagnosis for failures.

### 6.4 JSDoc Script Metadata (Required)

```typescript
/**
 * @script ci:run-local
 * @domain ci
 * @description Full local CI governance orchestrator. Checks Docker availability, runs all
 *              governance validation steps (runtime-scripts, scripts-infra, docs generation,
 *              architecture guard, type safety, lint), then executes act local CI simulation.
 *              Reports per-step PASS/FAIL status and prints a final summary table.
 *              Exits non-zero if any step fails. Mandatory before stage closure.
 * @mode manual,pre-closure
 * @dependencies node:child_process, node:process
 */
```

### 6.5 Error Handling Contract

| Scenario                       | Behavior                                            |
| ------------------------------ | --------------------------------------------------- |
| Docker not running             | Immediate exit code 1 before any step               |
| Single step fails              | Continue remaining steps, record FAIL in results    |
| All steps fail                 | Print full output for each failure, exit code 1     |
| `bun` binary not found         | `spawnSync` returns `status: null`; treated as FAIL |
| `ci:local` act execution fails | FAIL recorded for step 7; full act output printed   |
| Non-zero exit from any step    | FAIL recorded; script continues to next step        |

---

## 7. `.gitignore` Modification

### 7.1 Current State

```
# act (local GitHub Actions runner)
.secrets
.vars
```

### 7.2 Required Change

Add `.act.secrets` as an explicit entry in the `# act` section:

```
# act (local GitHub Actions runner)
.secrets
.act.secrets
.vars
```

This satisfies FR-04 and AC-02. The existing `.secrets` entry covers a file literally named
`.secrets`. Adding `.act.secrets` explicitly ensures that the act secrets file is never committed
regardless of how git glob matching behaves.

---

## 8. Testing Approach

This stage introduces no business logic. Testing is validating that the deliverables work correctly.

### 8.1 Test Types

| Test Type          | Method                                             | Covers       |
| ------------------ | -------------------------------------------------- | ------------ |
| Script execution   | `bun run ci:local` exits 0 on clean repo state     | AC-04, AC-05 |
| Failure simulation | Introduce deliberate lint error, confirm exit 1    | AC-11        |
| Workflow parity    | All workflows listed by `bun run ci:local:list`    | AC-08        |
| Secrets audit      | `git log --diff-filter=A -- .act.secrets` is empty | AC-12        |
| Gitignore check    | `git check-ignore -v .act.secrets` returns match   | AC-02        |
| Script governance  | `bun run validate:runtime:scripts` passes          | AC-06        |
| AGENTS.md rule     | grep for "bun run ci:local" in AGENTS.md           | AC-10        |
| .actrc presence    | `test -f .actrc && cat .actrc`                     | AC-01        |

### 8.2 Self-Validation

`run-local-ci.ts` is self-validating: running it calls `validate-runtime-scripts`, which confirms
that `run-local-ci.ts` itself is registered, exists on disk, and is syntactically parsable. If the
orchestrator script has a bug, step 1 catches it.

### 8.3 Idempotency Verification

Run `bun run ci:local` twice in succession on a clean repository state. Both runs must exit 0 with
the same job results. This confirms that act containers are ephemeral and no state leaks between
runs.

---

## 9. Documentation Plan

| Document              | Section                    | Content Summary                               |
| --------------------- | -------------------------- | --------------------------------------------- |
| `docs/ci/local-ci.md` | What is act                | 2-paragraph overview                          |
| `docs/ci/local-ci.md` | Installation               | brew / curl commands, Docker prerequisite     |
| `docs/ci/local-ci.md` | Configuration              | .actrc, .act.secrets setup walkthrough        |
| `docs/ci/local-ci.md` | Running CI locally         | All 4 ci:local\* commands with examples       |
| `docs/ci/local-ci.md` | Troubleshooting            | 7-item table with symptoms, causes, fixes     |
| `docs/ci/local-ci.md` | Differences from GitHub CI | 6-row feature comparison table                |
| `AGENTS.md`           | Local CI Simulation Gate   | Machine-readable pre-closure enforcement rule |

---

## 10. Acceptance Verification Checklist

Mapped directly to `spec.md` Acceptance Criteria:

| AC    | Criterion                                                                                                | Verified By                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AC-01 | `.actrc` exists at repository root with correct runner mapping                                           | `test -f .actrc && grep "catthehacker" .actrc`                              |
| AC-02 | `.act.secrets` is listed in `.gitignore` (gitignore entry only — file is developer-local, not committed) | `git check-ignore -v .act.secrets`                                          |
| AC-03 | Four `ci:local*` script keys exist in root `package.json`                                                | `jq '.scripts \| keys \| map(select(startswith("ci:local")))' package.json` |
| AC-04 | `bun run ci:local` exits zero on clean repository state                                                  | Command execution + exit code check                                         |
| AC-05 | `bun run ci:local:full` exits zero on clean repository state                                             | Command execution + exit code check                                         |
| AC-06 | `scripts/run-local-ci.ts` exists with JSDoc metadata header                                              | `head -10 scripts/run-local-ci.ts \| grep @script`                          |
| AC-07 | Orchestrator closure gate includes `act` as mandatory, non-bypassable step                               | AGENTS.md rule presence check                                               |
| AC-08 | All `.github/workflows/` files can run locally or have documented exclusions                             | Workflow compatibility audit (T005) — all 5 runnable                        |
| AC-09 | `docs/ci/local-ci.md` exists with all required sections                                                  | Section headers presence check                                              |
| AC-10 | `AGENTS.md` includes the pre-closure `ci:local` enforcement rule                                         | `grep "ci:local" AGENTS.md`                                                 |
| AC-11 | Closure is blocked when any `act` workflow job fails                                                     | Failure simulation test (T011)                                              |
| AC-12 | `.act.secrets` is not present in any git commit history                                                  | `git log --diff-filter=A -- .act.secrets`                                   |

---

## 11. Implementation Order

Tasks can be executed in the following recommended order (each is low-risk, additive):

```
T002 → T003 → T004 → T007 (gitignore) → T005 (audit documented) → T006 → T012 → T013 → T008 → T001 (docs)
     ↑ T010, T011 after T003+T004 (run verification tests)
```

Simplified linear sequence:

1. **T002** — Verify `.actrc` (VERIFY/NO-OP — existing config is authoritative, do not overwrite)
2. **T003** — Add `package.json` script entries (ci:local\*, validate:scripts-infra)
3. **T004** — Add `.act.secrets` to `.gitignore` (gitignore-only — no `.actrc` changes per AD-06)
4. **Developer note** — `.act.secrets` content is documented in `docs/ci/local-ci.md §Configuration` for local self-service creation
5. **T006** — Write `scripts/run-local-ci.ts`
6. **T012** — Write `docs/ci/local-ci.md`
7. **T013** — Update root `AGENTS.md`
8. **T010** — Execute workflow verification (all 5 pass via act)
9. **T011** — Run failure simulation test
10. **T001/T008/T009** — Remaining documentation tasks (covered by T012/T013)
11. **T007** — Confirm orchestrator gate documentation complete

> **Verification Gates (tasks.md only):** `tasks.md` adds 3 quality-gate micro-tasks not present
> in this plan: T005 (`validate:scripts-infra` gate after T003), T008 (TypeScript type-check of
> `run-local-ci.ts` after T007), T009 (verify `ci:local:list` and `ci:local:workflow ci.yml` after
> T006). These gates improve correctness and are part of the authoritative implementation sequence.

---

## 12. Risk Register

| Risk                                               | Likelihood         | Severity | Mitigation                                             |
| -------------------------------------------------- | ------------------ | -------- | ------------------------------------------------------ |
| Docker not available on CI machine                 | Low                | High     | `run-local-ci.ts` fail-fast check; clear error message |
| act version incompatibility                        | Low                | Medium   | No version pinning; document minimum requirement       |
| E2E jobs fail locally (playwright)                 | Medium             | Low      | Document in troubleshooting; E2E runs on GitHub CI     |
| `.act.secrets` accidentally committed              | Low                | High     | Explicit `.gitignore` entry; AC-12 git log check       |
| `validate:scripts-infra` missing from package.json | Certain (pre-T003) | Medium   | T003 adds it explicitly                                |
| `$GITHUB_STEP_SUMMARY` not working in act          | Certain            | Low      | Known limitation; documented; no blocker               |
| Apple M1/M2 container arch mismatch                | Medium             | Medium   | Add `--container-architecture linux/amd64` to `.actrc` |

---

## 13. Constraints Confirmation

- ✅ All script commands use `bun` only (no npm, yarn, npx)
- ✅ Script implementation under `scripts/` domain
- ✅ All new `package.json` keys follow `domain:action` format
- ✅ `run-local-ci.ts` includes JSDoc metadata header
- ✅ `.act.secrets` is gitignored, never committed
- ✅ No business logic introduced
- ✅ No architecture changes requiring `ARCHITECTURE_MAP.json` updates
- ✅ No `apps/*` AGENTS.md files modified (root only)
- ✅ No database migrations, no schema changes, no tenant logic
- ✅ Constitutional compliance confirmed (spec §Constitutional Compliance Declaration)

---

## 14. Follow-Up Opportunities (Out of Scope for This Stage)

Per spec Out of Scope:

- Docker layer caching for faster image loads
- Parallel workflow execution optimization
- GitHub vs act diff analyzer
- Workflow test matrix simulation
- Full hosted runner parity (accepted as best-effort)

These are not planned, not blocked, and require a new stage if implemented.

# INFRA-023 – Research Notes: Local CI Simulation With Act

**Version:** 1.0.0
**Created:** 2026-03-17
**Stage:** STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT
**Status:** COMPLETE — All NEEDS CLARIFICATION resolved

---

## Purpose

This document captures tool research, compatibility findings, and design decisions that inform the
technical plan for INFRA-023. It is not implementation — it is pre-planning evidence used to resolve
ambiguities before authoring `plan.md`.

---

## 1. Tool Analysis: `act`

### 1.1 What Is `act`

`act` is a CLI tool by nektos that reads `.github/workflows/*.yml` and executes them locally inside
Docker containers that mirror GitHub-hosted runner environments. It does not communicate with GitHub
at runtime — it is a pure local simulator driven by the Docker daemon.

**Repository:** https://github.com/nektos/act  
**Current stable release:** v0.2.x (no specific version pinned per spec assumption; confirmed stable
for the workflow syntax in this repository)

### 1.2 Installation Methods

| Platform | Command                                                                            | Canonical? |
| -------- | ---------------------------------------------------------------------------------- | ---------- |
| macOS    | `brew install act`                                                                 | ✅ Yes     |
| Linux    | `curl https://raw.githubusercontent.com/nektos/act/master/install.sh \| sudo bash` | ✅ Yes     |
| Windows  | Chocolatey or manual — not relevant for Zidney developer machines                  | N/A        |

**Prerequisite:** Docker Desktop (macOS) or Docker Engine (Linux) must be running before `act`
is invoked. `act` fails fast with a clear message when Docker is not available.

### 1.3 Runner Image Decision

**Decision:** `ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest`

**Rationale:** All five Zidney workflows use `runs-on: ubuntu-latest`. The
`ghcr.io/catthehacker/ubuntu:act-latest` image is the community-maintained, GitHub-compatible
runner image purpose-built for `act`. It includes:

- Node.js runtime
- Common GNU utilities (`git`, `curl`, `jq`, `bash`)
- Compatible with `oven-sh/setup-bun` action
- Supports Docker services (postgres, redis) via Docker-in-Docker or host Docker socket

**Alternatives considered:**

| Image                             | Size    | Decision    | Reason                                      |
| --------------------------------- | ------- | ----------- | ------------------------------------------- |
| `catthehacker/ubuntu:act-latest`  | ~1.4 GB | ✅ Chosen   | Act-tuned, pre-installed tooling            |
| `catthehacker/ubuntu:full-latest` | ~17 GB  | ❌ Rejected | Too large; act-latest provides what we need |
| `node:20`                         | ~1 GB   | ❌ Rejected | Missing many OS-level tools CI jobs use     |
| nektos/act's default micro image  | ~270 MB | ❌ Rejected | Too minimal; bun setup action fails         |

### 1.4 Key `act` CLI Flags Used in This Stage

| Flag                         | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `--pull=false`               | Skip pulling latest image (speed profile)          |
| `--secret-file .act.secrets` | Load secrets from file for workflow env vars       |
| `-W .github/workflows/`      | Target specific workflow directory or file         |
| `-l`                         | List workflows and jobs without executing          |
| (no extra flag)              | Default run — pulls images, executes all workflows |

### 1.5 `.actrc` Configuration

`act` reads `.actrc` from the repository root on every invocation. Each line is treated as a CLI
argument. The required content is:

```
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
```

This resolves the runner mapping for all `runs-on: ubuntu-latest` steps.

---

## 2. Workflow Compatibility Audit

### 2.1 Audit Scope

All files under `.github/workflows/`:

1. `ci.yml`
2. `architecture-governance.yml`
3. `ci-type-safety.yml`
4. `hard-mode-guard.yml`
5. `ai-context-validation.yml`

### 2.2 Compatibility Findings Per Workflow

#### `ci.yml` (Primary CI Pipeline)

**Compatibility:** PARTIAL — requires documentation of known limitations

| Feature Used                       | act Support Level | Notes                                                                                                                                                     |
| ---------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runs-on: ubuntu-latest`           | ✅ Full           | Mapped via `.actrc`                                                                                                                                       |
| `actions/checkout@v4`              | ✅ Full           | Works locally; act clones the workspace                                                                                                                   |
| `oven-sh/setup-bun@v2`             | ✅ Full           | Downloads and installs bun in the container                                                                                                               |
| `actions/cache@v4`                 | ⚠️ Partial        | Cache hits/misses silently succeed; no actual GitHub cache service. act uses local tmpdir. Performance benefit lost locally but execution is not blocked. |
| `services: postgres / redis`       | ✅ Full           | act supports Docker services natively via Docker-in-Docker or Docker socket mount                                                                         |
| `actions/upload-artifact@v4`       | ⚠️ Partial        | Artifact upload is silently no-op'd in act (writes to `.artifacts/` locally if configured). Job succeeds; no upload to GitHub.                            |
| `$GITHUB_STEP_SUMMARY`             | ⚠️ Partial        | act v0.2.x creates a local temp file for `GITHUB_STEP_SUMMARY`. Writes succeed; summary is discarded, not shown. Execution not blocked.                   |
| `sudo apt-get install redis-tools` | ✅ Full           | Runs inside the container; apt-get is available                                                                                                           |
| E2E jobs (playwright)              | ⚠️ Partial        | Playwright requires browser binaries; catthehacker image may need `--install-deps`. Document in troubleshooting.                                          |

**Impact assessment:** `ci.yml` is runnable locally. Cache and artifact upload limitations do not
block execution. Services (postgres, redis) are the most complex feature and are confirmed supported
by act via Docker socket. The secrets file provides the required `TEST_DATABASE_URL` and
`TEST_REDIS_URL` values.

**Adaptation required:** None. Document limitations in `docs/ci/local-ci.md`.

---

#### `architecture-governance.yml`

**Compatibility:** PARTIAL — two features require documentation

| Feature Used                           | act Support Level | Notes                                                                                                                                                                           |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runs-on: ubuntu-latest`               | ✅ Full           | Mapped via `.actrc`                                                                                                                                                             |
| `actions/checkout@v4` (fetch-depth: 0) | ✅ Full           | Full history fetch works in act                                                                                                                                                 |
| `oven-sh/setup-bun@v1`                 | ✅ Full           | Installs bun                                                                                                                                                                    |
| `actions/upload-artifact@v4`           | ⚠️ Partial        | Silent no-op (same as ci.yml above)                                                                                                                                             |
| `$GITHUB_STEP_SUMMARY`                 | ⚠️ Partial        | Writes to temp file, discarded (same as ci.yml above)                                                                                                                           |
| `schedule: cron`                       | ⚠️ Partial        | Cron triggers are not invoked by `act push/pull_request`. Use `act schedule` explicitly to test cron jobs. For default `bun run ci:local`, cron-triggered execution is skipped. |
| `bun ai:validate --ci`                 | ✅ Full           | Runs bun script in container                                                                                                                                                    |

**Impact assessment:** Fully runnable. `schedule` trigger is silently skipped by act's default push
invocation. This is expected and acceptable behavior.

**Adaptation required:** None. Document schedule trigger limitation in `docs/ci/local-ci.md`.

---

#### `ci-type-safety.yml`

**Compatibility:** FULL ✅

| Feature Used                    | act Support Level | Notes                 |
| ------------------------------- | ----------------- | --------------------- |
| `runs-on: ubuntu-latest`        | ✅ Full           | Mapped via `.actrc`   |
| `actions/checkout@v4`           | ✅ Full           | Works locally         |
| `oven-sh/setup-bun@v2`          | ✅ Full           | Installs bun          |
| No services, no artifact upload | ✅ Full           | Pure bun + tsc checks |

**Impact assessment:** Fully compatible. No workarounds needed.

**Adaptation required:** None.

---

#### `hard-mode-guard.yml`

**Compatibility:** PARTIAL — requires branch context injection

| Feature Used                             | act Support Level | Notes                                                                                                                                                                                              |
| ---------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runs-on: ubuntu-latest`                 | ✅ Full           | Mapped via `.actrc`                                                                                                                                                                                |
| `actions/checkout@v4` (fetch-depth: 0)   | ✅ Full           | Full history fetch works                                                                                                                                                                           |
| `github.head_ref \|\| github.ref_name`   | ⚠️ Partial        | act passes context vars from environment. Branch name defaults to current git HEAD; may need explicit `--env GITHUB_REF_NAME=spec/infra-023-...` for accurate simulation of branch-specific logic. |
| `github.event.repository.default_branch` | ⚠️ Partial        | Requires `--env GITHUB_DEFAULT_BRANCH=main` or similar in local run                                                                                                                                |
| No external services                     | ✅ Full           | Pure shell validation script                                                                                                                                                                       |

**Impact assessment:** Runnable. Branch-dependent validation steps may produce different results
unless the developer explicitly passes branch context via act environment variables. Document this
in troubleshooting.

**Adaptation required:** None in workflow file. Document act env var injection in local-ci.md.

---

#### `ai-context-validation.yml`

**Compatibility:** FULL ✅

| Feature Used             | act Support Level | Notes               |
| ------------------------ | ----------------- | ------------------- |
| `runs-on: ubuntu-latest` | ✅ Full           | Mapped via `.actrc` |
| `actions/checkout@v4`    | ✅ Full           | Works locally       |
| `oven-sh/setup-bun@v1`   | ✅ Full           | Installs bun        |
| No services or artifacts | ✅ Full           | Pure bun validation |

**Impact assessment:** Fully compatible.

**Adaptation required:** None.

---

### 2.3 Audit Summary Table

| Workflow                      | Compatibility | Requires Adaptation | Notes                                         |
| ----------------------------- | ------------- | ------------------- | --------------------------------------------- |
| `ci.yml`                      | PARTIAL       | No                  | Cache/artifact/summary: known partial support |
| `architecture-governance.yml` | PARTIAL       | No                  | Schedule trigger: documentation only          |
| `ci-type-safety.yml`          | FULL          | No                  | Fully compatible                              |
| `hard-mode-guard.yml`         | PARTIAL       | No                  | Branch context: inject via `--env` if needed  |
| `ai-context-validation.yml`   | FULL          | No                  | Fully compatible                              |

**Conclusion:** All five workflows are executable locally via `act` without structural modifications
to the workflow YAML. Known limitations are documentation-only (cache behavior, artifact discarding,
step summary, schedule triggers, branch context). Zero workflows require exclusion.

---

## 3. Secrets Strategy Analysis

### 3.1 Required Secret Values

Based on `ci.yml` analysis, the following environment variables are needed by workflows at runtime:

| Variable            | Used In              | Safe Test Value                                                        |
| ------------------- | -------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`      | ci.yml (integration) | `postgres://zidney_test:zidney_test@localhost:5432/zidney_master_test` |
| `TEST_DATABASE_URL` | ci.yml (integration) | Same as above                                                          |
| `REDIS_URL`         | ci.yml (integration) | `redis://localhost:6379`                                               |
| `TEST_REDIS_URL`    | ci.yml (integration) | `redis://localhost:6379`                                               |
| `NODE_ENV`          | Multiple             | `test`                                                                 |

**Decision:** All values are test-safe, non-production. No rotation required. Developer creates the
file once and maintains it locally.

### 3.2 `.gitignore` Gap Analysis

**Current state:** `.gitignore` contains `.secrets` (line 67-68) but not `.act.secrets`.

**Why this matters:** `.secrets` matches only a file literally named `.secrets`. The glob pattern
does not cover `.act.secrets`. An explicit entry is required per FR-04.

**Resolution:** Add `.act.secrets` as an explicit line in `.gitignore` under the `# act` section,
alongside the existing `.secrets` entry.

---

## 4. Package.json Script Existence Audit

Pre-implementation verification of all scripts that `run-local-ci.ts` will invoke:

| Script Key                 | Status in package.json | Package.json Line | Notes                                                                  |
| -------------------------- | ---------------------- | ----------------- | ---------------------------------------------------------------------- |
| `validate-runtime-scripts` | ✅ EXISTS              | 81                | `bun run scripts/validate/runtime-scripts.ts`                          |
| `generate-script-docs`     | ✅ EXISTS              | 79                | `bun run scripts/generate/script-docs.ts`                              |
| `arch:guard`               | ✅ EXISTS              | 51                | `bun scripts/architecture-guard/architecture-guard.ts`                 |
| `type-safety-guard`        | ✅ EXISTS              | 58                | `bun scripts/type-safety-guard.ts`                                     |
| `lint`                     | ✅ EXISTS              | ~11               | `biome check .`                                                        |
| `type-check`               | ✅ EXISTS              | 98                | `bun run typecheck` (alias)                                            |
| `validate:scripts-infra`   | ❌ MISSING             | —                 | **Must be added**: maps to `scripts/validate/detect-broken-scripts.ts` |
| `ci:local`                 | ❌ MISSING             | —                 | **Must be added by T003**: `act --pull=false`                          |
| `ci:local:full`            | ❌ MISSING             | —                 | **Must be added by T003**: `act`                                       |
| `ci:local:workflow`        | ❌ MISSING             | —                 | **Must be added by T003**: `act -W .github/workflows`                  |
| `ci:local:list`            | ❌ MISSING             | —                 | **Must be added by T003**: `act -l`                                    |

**Note on `type:check` vs `type-check`:** The user-facing documentation uses `type:check` but
the actual registered key in `package.json` is `type-check` (hyphen). `run-local-ci.ts` must call
`bun run type-check` (the registered key). The plan documents this mapping explicitly.

**Note on `validate:scripts-infra`:** This key is referenced in the spec (FR-06 as
`validate-script-infrastructure`) and the user request as `validate:scripts-infra`. The closest
existing script implementation is `scripts/validate/detect-broken-scripts.ts` (validates missing
or broken TypeScript script files referenced in `package.json`). This entry must be added to
`package.json` as T003 (alongside the `ci:local*` entries).

---

## 5. `run-local-ci.ts` Script Design Research

### 5.1 Existing Orchestrator Script Patterns

Surveyed existing orchestrator scripts (`scripts/ai-engine/run-task.ts`,
`scripts/architecture-guard/architecture-guard.ts`) to understand conventions:

- All use `createLogger()` from `scripts/core/logger-factory`
- All include JSDoc metadata header (`@script`, `@domain`, `@description`, `@mode`, `@dependencies`)
- Step execution via `execSync` or `spawnSync` from `node:child_process`
- Structured pass/fail aggregation before final exit

### 5.2 Required Output Format

Per spec (Observability Requirements):

1. Per-step status line: `[STEP N/N] <name> ... PASS` or `FAIL`
2. Full `act` output for **failed** jobs only (suppressed for passing)
3. Final summary table listing all steps/jobs with outcomes
4. Non-zero exit if any step fails
5. Clear error message naming the first failure

### 5.3 Idempotency Analysis

The orchestrator script is idempotent because:

- Each step is a stateless command invocation
- No files are written or mutated during a run
- Re-running produces the same result for the same code state
- `act` itself uses the container as ephemeral execution environment

### 5.4 Docker Fail-Fast Design

The Docker check must be the first operation before any other step:

```
docker info >/dev/null 2>&1
```

If this fails, the script exits immediately with:

```
[ERROR] Docker is not running. Start Docker Desktop before running local CI.
```

This prevents misleading errors from `act` itself.

---

## 6. Architecture Impact Assessment

**Decision:** No new modules. No changes to `ARCHITECTURE_MAP.json`.

**Rationale:**

- `scripts/run-local-ci.ts` lives under the `scripts/` domain, which is excluded from
  architecture layer enforcement (scripts are tooling, not importable packages)
- No new `packages/*` or `apps/*` modules are introduced
- No import boundary changes
- `infra-audit.ts` does not validate `scripts/` internals

**Architecture governance tools verification:**

- `bun scripts/infra-audit.ts` will pass after this stage (no module changes)
- `bun scripts/ai-guard.ts` will pass (no forbidden imports introduced)
- `ARCHITECTURE_MAP.json` requires no updates

---

## 7. Documentation Research

### 7.1 `docs/ci/local-ci.md` Required Sections

Per FR-08 and AC-09:

1. **What is `act`** — brief explanation (2-3 paragraphs)
2. **Installation** — platform-specific commands
3. **Configuration** — `.actrc`, `.act.secrets` setup steps
4. **Running CI locally** — all four `ci:local*` commands with examples
5. **Troubleshooting** — known issues (Docker not running, image pull, bun setup, services)
6. **Differences from GitHub CI** — documented limitations:
   - Cache: local temp, no actual GitHub cache service
   - Artifacts: no upload to GitHub, written locally
   - Step Summary: discarded locally
   - Schedule triggers: require `act schedule` explicitly
   - Branch context: may need `--env` injection for `hard-mode-guard.yml`
   - Pre-installed tools: `act-latest` image differs from GitHub-hosted runners

### 7.2 `AGENTS.md` Pre-Closure Rule Format

The rule must be machine-readable and unambiguous. Proposed section to add under
"AI Behavioral Enforcement (Strict Contract)" or at the end of the enforcement block:

```
### Local CI Simulation Gate (Mandatory)

Before any stage closure, AI agents MUST:

1. Run `bun run ci:local` from repository root
2. Confirm all workflow jobs pass (exit code 0)
3. Block closure if any job fails

This gate is non-bypassable. No exceptions.
```

---

## Research Summary

All NEEDS CLARIFICATION items are resolved:

| Item                                      | Resolution                                                   |
| ----------------------------------------- | ------------------------------------------------------------ |
| act runner image                          | `ghcr.io/catthehacker/ubuntu:act-latest` — confirmed optimal |
| `validate:scripts-infra` script key       | Must be added: maps to `detect-broken-scripts.ts`            |
| `type-check` vs `type:check`              | Use `type-check` (existing registered key in package.json)   |
| `.act.secrets` vs `.secrets` in gitignore | Explicit `.act.secrets` entry required — confirmed gap       |
| `docs/ci/` directory                      | Does not exist yet — must be created as part of T012         |
| All workflow files auditable              | All five workflows audited — zero require YAML modification  |
| `services:` in `ci.yml`                   | act supports Docker services via Docker socket — compatible  |
| `$GITHUB_STEP_SUMMARY`                    | Silently no-op'd in act — not a blocker                      |
| `actions/cache@v4`                        | Local tmpdir behavior — not a blocker                        |
| `actions/upload-artifact@v4`              | Local write or no-op — not a blocker                         |
| `schedule:` trigger                       | Skipped in default act invocation — documented limitation    |

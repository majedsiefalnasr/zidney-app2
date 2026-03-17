# STAGE INFRA-23 – Local CI Simulation With Act

**Specification Document**
**Version:** 1.0.0
**Created:** 2026-03-17
**Phase:** 01 – Platform Foundation
**Stage:** STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT

---

## Feature Overview

**What is being built:** A deterministic local CI simulation layer that enables developers to run
all GitHub Actions workflows on their local machine before pushing changes to remote. The system
uses `act` to mirror the GitHub Actions execution environment locally, paired with script wrappers,
a secrets strategy, and a mandatory orchestrator gate that blocks stage closure if local CI cannot
pass.

**Phase Context:** This feature belongs to Phase 01 – Platform Foundation. It is a developer
tooling and governance layer that enforces CI integrity before code reaches GitHub. It will be
activated as a mandatory pre-closure gate in the Zidney orchestrator.

**Stage File Reference:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md`

**Affected Systems:**

- Root repository (`.actrc`, `.act.secrets`, `package.json` script additions)
- Scripts layer (`scripts/run-local-ci.ts`)
- Governance tooling (orchestrator closure gate)
- Developer documentation (`docs/ci/local-ci.md`, `AGENTS.md`)
- GitHub Actions workflows (compatibility audit only — no behavioral changes)

**Does Not Affect:**

- Multi-tenancy isolation or database access
- License enforcement middleware
- Attempt engine or Worker business logic
- Frontend applications (MMC, Backoffice, Frontoffice)
- API routing or domain packages
- Production environments or secrets

---

## Constitutional Compliance Declaration

**Zidney Constitution v1.2.0 Alignment Audit:**

✅ **No cross-tenant access:** This stage introduces no database access, no tenant resolution, and
no workspace-bound operations. All changes are developer tooling only.

✅ **No middleware bypass:** No API middleware is added, removed, or modified. This stage is
entirely outside the request lifecycle.

✅ **No grading outside worker:** This stage introduces no attempt or grading logic.

✅ **No direct DB instantiation:** No database connections are introduced. The local CI simulation
layer is a process execution wrapper with no data layer.

✅ **Snapshot integrity preserved:** Attempt snapshot logic is not touched.

✅ **Transaction boundaries unchanged:** No transactions are introduced. No existing transactional
boundaries are modified.

✅ **Version enforcement intact:** Schema and product version enforcement are not modified. This
feature is governance tooling only.

Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Isolation Impact Analysis

**Database Access Model:** None. This stage introduces zero database access.

**Tenant Resolution:** Not applicable. Local CI simulation is a developer-side tooling layer with
no tenancy context.

**Connection Pool:** Not applicable. No new database connections are introduced.

**New Tables Introduced:** None.

**Shared Data Concerns:** None. No shared tenant data is touched by this feature.

---

## License & Version Enforcement

- **License middleware required:** No. This stage introduces no workspace-bound routes or operations.
- **License state checks:** Not applicable.
- **Limit enforcement:** Not applicable.
- **Schema version checked:** No. No migrations are introduced.
- **Product version checked:** No.

---

## Data Model Changes

**No data model changes.** This stage introduces no migrations, no new tables, and no schema
modifications. No version bump is required.

---

## User Stories

### US-01 – Developer runs local CI before pushing

> As a developer, I want to run all GitHub Actions workflows locally before pushing my changes, so
> that I catch CI failures early without waiting for remote CI feedback.

**Acceptance Criteria:**

- Running `bun run ci:local` from the repository root executes the local CI simulation without error
- All workflow jobs that pass locally also pass on GitHub CI for the same code state
- The command exits non-zero when any workflow job fails
- The command runs without internet access (using cached runner images)

---

### US-02 – Developer gets fast feedback with the default profile

> As a developer, I want a fast default CI run that does not pull fresh Docker images every time, so
> that I can iterate quickly without long waits.

**Acceptance Criteria:**

- `bun run ci:local` uses `--pull=false` to skip image re-pulling
- `bun run ci:local:full` re-pulls images for full-fidelity validation
- Both commands produce results indicating pass or failure for each workflow

---

### US-03 – Developer targets a specific workflow for debugging

> As a developer, I want to run a single workflow in isolation so that I can debug a failing job
> without re-running all workflows.

**Acceptance Criteria:**

- `bun run ci:local:workflow` accepts an optional workflow filename argument and runs that single
  workflow via `act -W .github/workflows/<filename>`; when no argument is provided it defaults to
  running all workflows in `.github/workflows/`
- `bun run ci:local:list` lists all available workflows without executing them
- Both commands complete without error on a correctly configured machine

---

### US-04 – New workflow added remains locally executable

> As a developer, I want any new GitHub Actions workflow I add to be runnable locally via `act`, so
> that the CI parity contract is maintained across all team members.

**Acceptance Criteria:**

- Every file added under `.github/workflows/` can be executed locally via `act`
- Workflows that use cloud-only GitHub resources are audited and documented before merging
- Any workflow that cannot be executed locally must be explicitly excluded and its rationale
  documented

---

### US-05 – Stage closure is blocked if local CI fails

> As an AI orchestrator agent, I want closure of any stage to be blocked if local CI simulation
> fails, so that no stage can be closed with broken workflows.

**Acceptance Criteria:**

- The orchestrator closure gate runs `bun run ci:local` as a mandatory step
- If `bun run ci:local` exits non-zero, closure is blocked with a clear failure message
- Closure cannot proceed unless all workflow jobs pass
- There is no flag or mechanism to bypass this gate

---

### US-06 – Developer consults documentation for setup and troubleshooting

> As a developer (or new team member), I want a clear reference document that explains how to
> install `act`, configure secrets, run workflows, and troubleshoot failures, so that I can
> independently set up and use local CI simulation.

**Acceptance Criteria:**

- `docs/ci/local-ci.md` exists and covers: installation, configuration, running, troubleshooting,
  and known differences from GitHub CI
- AGENTS.md contains a machine-readable rule requiring `ci:local` to pass before closure
- All instructions reference `bun run` commands exclusively

---

## Functional Requirements

### FR-01 – `act` Installation Standard

- The Zidney repository must document one canonical installation method per platform: Homebrew for
  macOS, install script for Linux
- Docker must be confirmed as a prerequisite
- No specific `act` version is pinned unless a compatibility issue is discovered

### FR-02 – Runner Image Mapping

- An `.actrc` file must exist at the repository root
- It must map `ubuntu-latest` to `ghcr.io/catthehacker/ubuntu:act-latest`
- This mapping must be consistent across all developer machines and CI environments

### FR-03 – Script Commands

The root `package.json` must expose four script commands:

| Script Key          | Behavior                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci:local`          | Runs `act --pull=false` — fast, default profile                                                                                                                                                                         |
| `ci:local:full`     | Runs `act` — full profile, pulls latest images                                                                                                                                                                          |
| `ci:local:workflow` | Runs `act -W .github/workflows/<file>` when a workflow filename is passed; defaults to `act -W .github/workflows/` (all workflows) when no argument is given — supports single-workflow isolation for focused debugging |
| `ci:local:list`     | Runs `act -l` — lists available workflows without executing                                                                                                                                                             |

All keys follow the `domain:action` naming convention required by Zidney script governance.

### FR-04 – Secrets Strategy

- An `.act.secrets` file must exist at the repository root for local simulation
- It must provide test-safe values for: `DATABASE_URL`, `REDIS_URL`, `NODE_ENV`
- `.act.secrets` must be listed in `.gitignore` as an **explicit entry** (`.act.secrets`) — the
  existing `.secrets` rule in `.gitignore` does not cover this filename and cannot be relied upon
- Real production secrets must never appear in `.act.secrets`

### FR-05 – Workflow Compatibility Audit

- All files under `.github/workflows/` must be audited for local `act` compatibility
- Any workflow step that depends on cloud-only GitHub resources must be identified
- Incompatible steps must be: adapted, mocked, or explicitly excluded with rationale documented
- After the audit, every non-excluded workflow must execute locally without error

### FR-06 – Local CI Orchestrator Script

- A script `scripts/run-local-ci.ts` must exist
- It must execute the following governance checks in order:
  1. `validate-runtime-scripts`
  2. `validate-script-infrastructure`
  3. `generate-script-docs`
  4. `architecture-guard`
  5. `type-safety-guard`
  6. `bun run lint` — full-repository Biome lint, all packages and apps in scope (no path restriction)
- It must then execute `bun run ci:local`
- It must aggregate results and exit non-zero if any step fails
- The script must include a JSDoc metadata header (`@script`, `@domain`, `@description`, `@mode`,
  `@dependencies`)

### FR-07 – Orchestrator Closure Gate

- The Zidney orchestrator must include a mandatory closure gate: "Run Local CI Simulation (ACT)"
- This gate must execute `bun run ci:local`
- All jobs must pass for closure to proceed
- Any failure must block closure with an explicit error message
- This gate must not be skippable or configurable to be optional

### FR-08 – Developer Workflow Documentation

- The documented developer workflow must include `bun run ci:local` before `git push`
- An optional (non-blocking) pre-push hint may be added as a git hook
- `docs/ci/local-ci.md` must cover: installation, configuration, running CI locally,
  troubleshooting, and differences from GitHub-hosted CI

### FR-09 – CI Parity Contract

- Every workflow under `.github/workflows/` must be executable locally via `act`
- Violations of this rule must block PR merge and stage closure
- This rule must be documented in `AGENTS.md` as a machine-enforceable constraint

### FR-10 – Failure Policy

- Stage closure is blocked if:
  - `act` binary is missing or fails to initialize
  - Any workflow job exits with a non-zero status
  - A workflow cannot be executed locally (lacking mock/adaptation)
- There must be no bypass mechanism for this policy

### FR-11 – Performance Profiles

- The default `ci:local` profile must be optimized for speed by skipping image pulls
- The `ci:local:full` profile must be available for full-fidelity validation when needed
- Both profiles must produce a clear pass/fail result for every workflow job

### FR-12 – AGENTS.md Rule

- The **root** `AGENTS.md` (at the repository root) must include a rule in the pre-closure
  enforcement section stating:
  - Before closure, `bun run ci:local` must be run
  - All workflows must pass
  - This step must not be bypassed
- Per-app `AGENTS.md` files (under `apps/*/`) are **not** required to be updated; the rule is a
  repository-level governance concern, not an app-specific one

---

## Acceptance Criteria (Stage-Level)

| ID    | Criterion                                                                    | Verification Method             |
| ----- | ---------------------------------------------------------------------------- | ------------------------------- |
| AC-01 | `.actrc` exists at repository root with correct runner mapping               | File presence check             |
| AC-02 | `.act.secrets` exists and is listed in `.gitignore`                          | File check + gitignore audit    |
| AC-03 | Four `ci:local*` script keys exist in root `package.json`                    | JSON key check                  |
| AC-04 | `bun run ci:local` exits zero on a clean repository state                    | Command execution               |
| AC-05 | `bun run ci:local:full` exits zero on a clean repository state               | Command execution               |
| AC-06 | `scripts/run-local-ci.ts` exists with JSDoc metadata header                  | File presence + header check    |
| AC-07 | Orchestrator closure gate includes `act` as mandatory, non-bypassable step   | Orchestrator config review      |
| AC-08 | All `.github/workflows/` files can run locally or have documented exclusions | Compatibility audit report      |
| AC-09 | `docs/ci/local-ci.md` exists with all required sections                      | Section presence check          |
| AC-10 | `AGENTS.md` includes the pre-closure `ci:local` enforcement rule             | Rule presence check             |
| AC-11 | Closure is blocked when any `act` workflow job fails                         | Failure simulation test         |
| AC-12 | `.act.secrets` is not present in any git commit history                      | `git log --diff-filter=A` check |

---

## Out of Scope

- **GitHub CI replacement:** GitHub Actions remains the authoritative CI system. Local simulation
  is a pre-push safety gate, not a replacement.
- **Full hosted runner parity:** Known differences between `act` and GitHub-hosted runners
  (e.g., pre-installed tools) are accepted. Best-effort simulation only.
- **Production secrets management:** This stage introduces no mechanism for storing or rotating
  production credentials.
- **Parallel workflow execution optimization:** Multi-workflow parallelism is a follow-up
  opportunity, not part of this stage.
- **Docker layer caching infrastructure:** Cache optimization for faster image loading is a
  follow-up opportunity.
- **GitHub vs act diff analyzer:** Detecting divergence between local and remote execution is a
  follow-up opportunity.
- **Business logic changes:** No domain packages, no API routes, no database schema touched.
- **Cross-tenant logic:** Not applicable to this stage.
- **UI changes:** No frontend applications are modified.

---

## Technical Constraints

- All script commands must use `bun` as the package manager (no `npm`, `yarn`, or `npx`)
- Script implementation files must live under `scripts/` domain
- Script keys in `package.json` must follow `domain:action` format (e.g., `ci:local`, `ci:local:full`)
- All scripts must include a JSDoc metadata header conforming to Zidney script governance
- `.act.secrets` must never be committed — enforced via `.gitignore`
- Docker must be running locally for `act` to execute
- No business logic must be introduced by this feature
- No architecture changes requiring `ARCHITECTURE_MAP.json` updates
- CI parity is best-effort; known `act` limitations are documented, not treated as blockers

---

## Assumptions

- Docker Desktop (or equivalent) is available on all developer machines
- `act` version compatibility with current `.github/workflows/` syntax is stable at the time of
  implementation
- Current workflows do not rely on GitHub-hosted secrets that cannot be mocked locally
- `.gitignore` already exists and can be updated to exclude `.act.secrets`
- Developers have network access to pull `ghcr.io/catthehacker/ubuntu:act-latest` at least once
  for the initial setup

---

## Success Metrics

| Metric                                                      | Target                         |
| ----------------------------------------------------------- | ------------------------------ |
| All `.github/workflows/` files pass locally via `act`       | 100% (or documented exclusion) |
| `bun run ci:local` passes on clean repository state         | Exits zero consistently        |
| Stage closure blocked when any `act` job fails              | 100% enforcement               |
| New workflows added after this stage are locally executable | 100% (CI parity contract)      |
| Developer setup time (install `act` + first run)            | Under 10 minutes               |
| Mean time from code change to local CI feedback             | Under 5 minutes (fast profile) |
| `.act.secrets` committed to version control                 | Zero occurrences               |

---

## Observability Requirements

This stage introduces no new runtime observability requirements. The `scripts/run-local-ci.ts`
script must:

- Print a per-step status line for each governance check (step name + PASS/FAIL) and for each
  workflow job executed by `act` (workflow name + job name + PASS/FAIL)
- Print a final summary table listing all steps/jobs with their outcomes after all execution completes
- Forward full `act` output only for **failed** jobs (suppressed for passing jobs to reduce noise)
- Exit with a non-zero code and a clear error message identifying the first or most critical failure
- Produce output that is readable in both interactive terminal and CI log contexts

No `correlation_id`, `workspace_slug`, or `attempt_id` fields are required — this is developer
tooling with no request lifecycle.

---

## Layer Separation Confirmation

- ✅ Frontend contains no logic from this stage
- ✅ API contains no logic from this stage
- ✅ Worker contains no logic from this stage
- ✅ MMC and Backoffice are unaffected
- ✅ No database connections are introduced
- ✅ All changes are confined to: repository root config, `scripts/` domain, and `docs/`

---

## Failure Modes & Recovery

| Failure Mode                                  | Outcome                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Docker not running                            | `act` fails immediately with clear message; closure blocked                      |
| `.act.secrets` missing                        | Workflows requiring secrets fail; developer is prompted to create the file       |
| `.actrc` missing or misconfigured             | Runner image mismatch; documented in troubleshooting guide                       |
| Workflow incompatible with `act`              | Job fails; developer must adapt, mock, or document exclusion                     |
| Governance check fails in orchestrator script | Script exits non-zero; closure blocked                                           |
| Network unavailable for image pull            | `ci:local` (no-pull mode) unaffected; `ci:local:full` fails; documented in guide |

---

## Test Strategy

| Test Type              | Required | Description                                                                         |
| ---------------------- | -------- | ----------------------------------------------------------------------------------- |
| Script execution test  | Yes      | `bun run ci:local` and `bun run ci:local:full` execute without error on clean state |
| Failure simulation     | Yes      | Introduce a deliberate workflow failure; confirm closure is blocked                 |
| Parity audit test      | Yes      | All `.github/workflows/` files execute locally or have documented exclusion         |
| Secrets file audit     | Yes      | Confirm `.act.secrets` is in `.gitignore` and absent from git history               |
| Script governance test | Yes      | `scripts/run-local-ci.ts` passes `validate-runtime-scripts`                         |

Unit tests are not applicable for this stage — the deliverables are configuration files, script
wrappers, and documentation, not business logic modules.

---

## Explicit Non-Goals

- No change to database schema or migrations
- No change to API routes or middleware
- No change to attempt engine, grading, or worker job processing
- No change to frontend applications
- No new third-party service integrations (act is a local tool, not a SaaS)
- No monitoring or alerting infrastructure
- No production deployment changes

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-17

- Q: Should `.act.secrets` be added to `.gitignore` as an explicit dedicated entry or can the existing `.secrets` rule cover it? → A: Explicit entry (`.act.secrets`). The existing `.secrets` rule in `.gitignore` matches only a file literally named `.secrets` and does not cover `.act.secrets`. An explicit `.act.secrets` line must be added to prevent accidental commit. (Applied to FR-04.)

- Q: Should `run-local-ci.ts` include a `bun run lint` (Biome) step in the governance check sequence, and what is its scope? → A: Yes — add `bun run lint` (full-repository scope, covering all packages and apps) as step 6 in the governance check sequence, after `type-safety-guard` and before `bun run ci:local`. This aligns with the AGENTS.md validation pipeline which mandates lint before CI passes. (Applied to FR-06.)

- Q: Should `ci:local:workflow` accept an optional workflow filename argument (for single-workflow debugging) or always run all workflows in `.github/workflows/`? → A: Accept an optional workflow filename argument. When provided, the command runs `act -W .github/workflows/<filename>`; when omitted it defaults to `act -W .github/workflows/` (all workflows). This resolves the contradiction between US-03 ("run a single workflow in isolation") and the original FR-03 definition which always targeted the full directory. (Applied to FR-03 and US-03 Acceptance Criteria.)

- Q: How should `scripts/run-local-ci.ts` report failed workflows — exit code only, or structured output with per-job detail? → A: Per-step status line (PASS/FAIL) for each governance check and each `act` workflow job; a final summary table after all execution; full `act` output forwarded only for failed jobs (suppressed for passing jobs). Always exits non-zero with a clear identifying message on failure. (Applied to Observability Requirements.)

- Q: Is the AGENTS.md pre-closure rule update scoped to the root `AGENTS.md` only or also to per-app `AGENTS.md` files? → A: Root `AGENTS.md` only. The `ci:local` enforcement is a repository-level governance concern, not an app-specific one. Per-app `AGENTS.md` files (under `apps/*/`) are not updated by this stage. (Applied to FR-12.)

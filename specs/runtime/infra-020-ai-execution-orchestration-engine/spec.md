# Feature Specification: AI Execution Orchestration Engine

**Feature Branch**: `spec/infra-020-ai-execution-orchestration-engine`  
**Created**: 2026-03-15  
**Status**: In Progress  
**Phase**: 01_PLATFORM_FOUNDATION  
**Stage File**: `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_20_AI_EXECUTION_ORCHESTRATION_ENGINE.md`

## Stage Status

Status: IN PROGRESS  
Step: specify  
Risk Level: LOW

---

## Feature Overview

This stage introduces the **AI Execution Orchestration Engine** — a structured controller layer for AI-driven development workflows inside the Zidney monorepo.

The orchestration engine coordinates context bootstrap, skill activation, task decomposition, subagent scheduling, execution control, architecture validation, and result aggregation. It provides three CLI entry points (`ai:run`, `ai:plan`, `ai:validate`) under `scripts/ai-engine/`, adds execution logging to `docs/architecture/health/ai-execution-logs/`, and registers a CI validation step so AI-driven work remains deterministic, architecture-aware, and reproducible.

This stage transforms the repository from **AI-compatible** to **AI-orchestrated**.

**Affected concerns**:

| Concern             | Affected? | Notes                                      |
| ------------------- | --------- | ------------------------------------------ |
| Isolation           | No        | Tooling only; no tenant data access        |
| License enforcement | No        | No workspace-bound routes introduced       |
| Attempt engine      | No        | No attempt flows involved                  |
| Worker              | No        | No background job processing introduced    |
| Runtime (API)       | No        | No HTTP endpoints or API routes introduced |
| Frontoffice         | No        | No UI or student-facing surfaces involved  |

---

## Constitutional Compliance Declaration

- **No cross-tenant access**: This stage introduces no database access of any kind. All outputs are filesystem-local tooling scripts and log artifacts.
- **No middleware bypass**: No Hono routes introduced; middleware ordering is not affected.
- **No grading outside worker**: Not applicable — this stage does not touch grading or attempt finalization.
- **No direct DB instantiation**: No database connections are created. This is a pure tooling stage.
- **No weakening of snapshot integrity**: Attempt snapshots are not touched.
- **No weakening of transaction boundaries**: No transactional paths are introduced.
- **No weakening of version enforcement**: Schema and product version middleware is not modified. The `ai:validate` command must confirm version enforcement tooling is present and passing.

No ADR exceptions required.

---

## Isolation Impact Analysis

- **Database accessed**: None.
- **Tenant resolution**: Not applicable.
- **Connection pool**: Not applicable — no DB connection is created or obtained.
- **Resolver middleware**: Not applicable.
- **New tables introduced**: None.

Confirmation: No shared tenant data is introduced or accessed.

---

## License & Version Enforcement

- **License middleware required**: No — this stage introduces no workspace-bound routes.
- **License state validation**: Not applicable.
- **Limit enforcement**: Not applicable.
- **Schema version checked**: Not modified. The `ai:validate` script must check that existing schema-version enforcement tooling passes.
- **Product version checked**: Not modified. The `ai:validate` script must check that existing product-version enforcement tooling passes.

---

## Data Model Changes

No data model changes in this stage.

- New tables: None.
- Modified tables: None.
- Migration required: No.
- Version bump required: No.
- Backward compatibility: Not applicable.

---

## Clarifications

### Session 2026-03-15

- Q: Does each orchestration run write to a uniquely-named file (e.g., `{execution_id}.json`) or append to a shared rolling log file? → A: Each run writes to its own file named `{execution_id}.json` under `docs/architecture/health/ai-execution-logs/`. No shared log file is used. This makes concurrent invocations for different tasks inherently safe without file locking.
- Q: Which specific packages may `scripts/ai-engine/` import from — all of `packages/*` or only specific ones? → A: Only `packages/logger` and `packages/config` are permitted. No other packages from `packages/*` may be imported by `scripts/ai-engine/`.
- Q: What criterion defines `ai-architecture-brain.json` as "stale" (vs absent) for the purposes of `ai:validate` detection? → A: The file is considered stale if its filesystem mtime predates the most recently modified TypeScript source file under `packages/` or `apps/`. If no source file is newer than the brain artifact, it is considered fresh. Absent means the file does not exist at the expected path.
- Q: Since FR-011 forbids `console.log` and routes all output to log files, how does the CI step produce visible output for reviewers? → A: Orchestration scripts produce zero stdout/stderr output. The CI job adds a dedicated post-step that reads the JSON artifact and appends a summary to `$GITHUB_STEP_SUMMARY` (matching the `architecture-governance.yml` pattern). The validation artifact is also published via `actions/upload-artifact@v4`, both matching existing CI conventions.
- Q: What are the per-command timeout budget values for `ai:run` and `ai:plan`? SC-010 defines `ai:validate` at 90 s (local) / 120 s (CI) but leaves these two unspecified. → A: `ai:plan` timeout = 120 s (local and CI). `ai:run` timeout = 300 s (local and CI). These values are enforced inside the scripts; a structured error artifact is written before termination if the budget is exceeded.

---

## Transaction Boundaries

Not applicable to this stage. This is a tooling-only feature. No operations write to any database, queue, or external state store. All writes are local filesystem log artifacts and are replaced atomically.

---

## Authoritative Time Usage

Execution log entries written by `run-task.ts` and `validate-execution.ts` MUST use server-process system time sourced from the Node/Bun `Date.now()` runtime. Client time is not accepted as input to any orchestration artifact. This applies only to log timestamping; there is no attempt-timing or deadline logic in this stage.

---

## Idempotency Strategy

The orchestration CLI scripts MUST be safe to re-run:

- Repeated execution of `ai:plan` for the same task description MUST NOT create duplicate plan documents; it MUST overwrite or append deterministically.
- Repeated execution of `ai:validate` MUST NOT create duplicate log entries for the same validation run; it MUST write one result artifact per run identified by a unique execution ID. Each run writes to its own dedicated file named `{execution_id}.json` under `docs/architecture/health/ai-execution-logs/` — no shared rolling log file is used. Concurrent invocations for different tasks are therefore safe without additional file locking.
- Repeated execution of `ai:run` for a previously completed task MUST produce an idempotent outcome: no duplicate architecture violations, no duplicate side effects.

| Guard                   | Applied? | Method                                              |
| ----------------------- | -------- | --------------------------------------------------- |
| Idempotency key         | Yes      | Unique execution ID per run (timestamp + task hash) |
| Unique constraint       | No       | Not persisted to database                           |
| Replay behavior defined | Yes      | Overwrite log artifact by execution ID              |
| Double-submission guard | Yes      | Same execution ID produces same result              |

---

## Observability Requirements

All orchestration CLI scripts MUST emit structured JSON log entries to `docs/architecture/health/ai-execution-logs/`.

Mandatory log fields per execution record:

| Field                     | Required | Description                                              |
| ------------------------- | -------- | -------------------------------------------------------- |
| `execution_id`            | Yes      | Unique identifier for this orchestration run             |
| `task_id`                 | Yes      | Identifier derived from task name or hash                |
| `timestamp`               | Yes      | ISO 8601 server time at execution start                  |
| `command`                 | Yes      | CLI command invoked (`ai:run`, `ai:plan`, `ai:validate`) |
| `skills_activated`        | Yes      | List of skill names loaded for this execution            |
| `files_modified`          | Yes      | Array of relative paths changed during execution         |
| `architecture_violations` | Yes      | Count of violations detected by architecture guard       |
| `validation_result`       | Yes      | `pass` or `fail`                                         |
| `execution_duration_ms`   | Yes      | Wall-clock duration in milliseconds                      |
| `error`                   | Cond.    | Error message if execution fails; null otherwise         |

`console.log` is forbidden in orchestration scripts. Orchestration scripts produce zero stdout/stderr output. All structured JSON output goes exclusively to execution log files. The CI step adds a post-step that reads the artifact and appends a human-readable summary to `$GITHUB_STEP_SUMMARY` (matching the `architecture-governance.yml` convention); the artifact is also published via `actions/upload-artifact@v4`.

---

## Rate Limiting & Abuse Protection

Not applicable to this stage. The orchestration CLI scripts are developer-local and CI tools; they are not exposed as API endpoints or network services. No rate limiting policy is required.

---

## Layer Separation Confirmation

| Rule                                                                                     | Status                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Frontend contains no business logic                                                      | Unaffected                                       |
| API contains no grading logic                                                            | Unaffected                                       |
| Worker contains no HTTP logic                                                            | Unaffected                                       |
| MMC does not access tenant DB                                                            | Unaffected                                       |
| No direct DB creation outside provisioning                                               | Confirmed — this stage creates no DB connections |
| `scripts/ai-engine/` imports only from `packages/logger` and `packages/config` or stdlib | Required — import boundaries enforced            |

Layer separation is not violated. `scripts/ai-engine/` may import ONLY from `packages/logger` (for structured logging) and `packages/config` (for configuration constants). No imports from any other package under `packages/*` or from `apps/*` are permitted.

---

## Failure Modes & Recovery

| Failure                                                                                                                                                    | Behavior                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Architecture guard reports violations                                                                                                                      | `ai:validate` exits with a non-zero code; CI step fails; no artifacts committed                                                |
| Log directory not found                                                                                                                                    | `run-task.ts` creates the directory before writing; no silent failure                                                          |
| Execution timeout exceeded                                                                                                                                 | Scripts enforce a per-command timeout budget and terminate with a structured error artifact                                    |
| Partial log write                                                                                                                                          | Log files are written atomically via a temp-file-then-rename pattern; partial artifacts are not left on disk                   |
| Missing architecture intelligence (`ai-architecture-brain.json` absent)                                                                                    | `ai:validate` detects the missing file and exits non-zero with a named diagnostic.                                             |
| Stale architecture intelligence (`ai-architecture-brain.json` mtime older than most recently modified TypeScript source file under `packages/` or `apps/`) | `ai:validate` detects the staleness, reports a validation failure describing which source files are newer, and exits non-zero. |
| CI step failure                                                                                                                                            | CI pipeline blocks merge; developer receives structured error output                                                           |

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 – Run a Governed AI Task End-to-End (Priority: P1)

As a platform engineer using AI-assisted development, I need a single entry point that bootstraps repository context, activates the correct skills, executes the task, and validates results, so AI-driven work follows predictable rules rather than free-form reasoning.

**Why this priority**: The `ai:run` command is the primary value delivered by this stage. If it does not work end-to-end reliably, the orchestration engine provides no governance value.

**Independent Test**: Invoke `bun ai:run` with a valid task description and confirm it produces a structured execution log, zero architecture violations, and exits zero.

**Acceptance Scenarios**:

1. **Given** a valid task is provided, **When** `bun ai:run` executes, **Then** the engine bootstraps context, activates skills, executes the task, validates architecture, and writes a structured log artifact.
2. **Given** the task execution introduces architecture violations, **When** `bun ai:run` completes, **Then** the command exits non-zero and the log records the violation count.
3. **Given** the same task is run twice, **When** both executions complete, **Then** no duplicate log artifacts are created and results are consistent.

---

### User Story 2 – Plan an AI Task Before Execution (Priority: P2)

As a platform engineer, I need a planning step that decomposes a task into deterministic execution steps before any code is modified, so I can review and approve the execution plan before committing any repository changes.

**Why this priority**: The plan step is a safety gate. It enables human review of AI intent before execution, reducing the risk of unintended side effects.

**Independent Test**: Invoke `bun ai:plan` with a valid task description and confirm it produces a deterministic execution plan document without modifying any source files.

**Acceptance Scenarios**:

1. **Given** a valid task is provided, **When** `bun ai:plan` executes, **Then** a human-readable execution plan is produced without modifying any application source files.
2. **Given** the same task is planned twice, **When** both plan commands complete, **Then** the resulting plan documents are identical in content.
3. **Given** a task contains ambiguous scope, **When** `bun ai:plan` executes, **Then** the plan flags ambiguous areas and requests clarification rather than guessing silently.

---

### User Story 3 – Validate Repository State After AI Execution (Priority: P2)

As a governance maintainer, I need an automated validation command that confirms the repository remains architecture-compliant after AI-driven changes, so regressions are caught before merge.

**Why this priority**: The validate step closes the governance loop. Without it, architectural drift from AI execution would be undetected.

**Independent Test**: After AI-driven changes, invoke `bun ai:validate` and confirm it runs all architecture guards, reports zero violations, and exits zero on a compliant repository.

**Acceptance Scenarios**:

1. **Given** the repository is architecture-compliant, **When** `bun ai:validate` executes, **Then** all governance tools pass and the command exits zero with a structured validation artifact.
2. **Given** the repository contains an architecture violation, **When** `bun ai:validate` executes, **Then** the command exits non-zero and names the violating module or boundary.
3. **Given** architecture intelligence artifacts are stale, **When** `bun ai:validate` executes, **Then** the command detects the mismatch and exits non-zero with an actionable finding.

---

### User Story 4 – CI Enforces Orchestration Validation (Priority: P3)

As a CI pipeline maintainer, I need an AI Execution Validation step in CI so any branch that breaks orchestration governance is blocked from merging automatically.

**Why this priority**: CI enforcement is the last line of defense. Without it, orchestration regressions could land on `main`.

**Independent Test**: Introduce a synthetic architecture violation and confirm the CI step blocks the branch.

**Acceptance Scenarios**:

1. **Given** a branch that passes all architecture rules, **When** the CI validation step runs, **Then** it exits zero and does not block the merge.
2. **Given** a branch that introduces an architecture violation, **When** the CI validation step runs, **Then** it exits non-zero and blocks the merge.
3. **Given** the CI step runs on a repository with stale architecture intelligence, **When** the step completes, **Then** it fails with a diagnostic message rather than a silent pass.

---

### Edge Cases _(resolved via Session 2026-03-15 clarifications)_

- **Concurrent invocations for different tasks**: Each run writes to its own `{execution_id}.json` file; no shared file is used; concurrent invocations are safe without file locking.
- **`ai-architecture-brain.json` missing vs stale**: Absent = file does not exist at expected path; stale = file mtime predates the most recently modified TypeScript source file under `packages/` or `apps/`. Both are detected and exit non-zero with distinct diagnostics.
- **Log directory not writable (permissions error)**: `run-task.ts` attempts directory creation first (FR-023); if creation or write fails due to permissions, the script exits non-zero with a structured error artifact on stderr, then terminates.
- **Required skill file not found**: `ai:run` exits non-zero and writes a structured error artifact naming the missing skill path; no partial task execution proceeds.
- **Scripts invoked outside monorepo root**: Scripts detect absence of the expected `package.json` / `docs/ai/context/` directory at the resolved working directory and exit non-zero with a diagnostic before any filesystem write.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide `scripts/ai-engine/run-task.ts`, `scripts/ai-engine/plan-task.ts`, and `scripts/ai-engine/validate-execution.ts` as the primary orchestration CLI scripts.
- **FR-002**: The root `package.json` MUST expose `ai:run`, `ai:plan`, and `ai:validate` scripts mapped to the corresponding orchestration CLI scripts.
- **FR-003**: The `ai:run` command MUST bootstrap repository context from `docs/ai/context/ai-context-mini.json` before executing any task operations.
- **FR-004**: The `ai:run` command MUST activate only the skills required for the given task from the `.agents/skills/` registry and MUST NOT load unrelated skill domains.
- **FR-005**: The `ai:plan` command MUST decompose the requested task into a deterministic, human-readable execution plan WITHOUT modifying any application source files.
- **FR-006**: The `ai:plan` command MUST produce identical output for the same task when run multiple times (deterministic planning).
- **FR-007**: The `ai:validate` command MUST invoke the existing architecture guard, type-safety guard, and architecture-health tooling (`bun arch:guard`, `bun type-safety-guard`, `bun arch:health`) and aggregate their results into a single validation artifact.
- **FR-008**: The `ai:validate` command MUST detect stale or absent `docs/ai/context/ai-architecture-brain.json` and exit non-zero with an actionable diagnostic rather than silently passing.
- **FR-009**: All three orchestration scripts MUST write structured JSON execution logs to `docs/architecture/health/ai-execution-logs/` with all mandatory fields defined in the Observability Requirements section.
- **FR-010**: Execution log files MUST be written atomically (temp-file-then-rename) to prevent partial writes.
- **FR-011**: Orchestration scripts MUST NOT use `console.log`; all output MUST be structured JSON to log files.
- **FR-012**: Each execution run MUST generate a unique execution ID (timestamp + task hash) and MUST NOT create duplicate log entries for the same run ID.
- **FR-013**: All three orchestration scripts MUST enforce per-command timeout budgets and MUST terminate with a structured error artifact if a budget is exceeded. Budget values: `ai:plan` = 120 s; `ai:run` = 300 s; `ai:validate` = 120 s (CI) / 90 s (local) per SC-010.
- **FR-014**: The `scripts/ai-engine/` module MUST import only from `packages/logger` and `packages/config` (or Node/Bun stdlib); imports from any other package under `packages/*` or from `apps/*` are forbidden.
- **FR-015**: The CI pipeline MUST include an "AI Execution Validation" step that invokes `bun ai:validate`; the step MUST fail the CI job on non-zero exit.
- **FR-016**: The CI validation step MUST publish the resulting validation artifact as a CI artifact for reviewer inspection.
- **FR-017**: The system MUST preserve database-per-tenant isolation and MUST NOT introduce row-based multi-tenancy, cross-tenant joins, shared tenant data, or tenant overrides from request body.
- **FR-018**: The system MUST preserve mandatory license enforcement for all workspace-bound routes; this stage introduces no workspace-bound routes, so that contract is inherited and unchanged.
- **FR-019**: The system MUST preserve strict schema and product version compatibility enforcement; the `ai:validate` command confirms existing version tooling passes.
- **FR-020**: The system MUST preserve server-authoritative time; execution log timestamps MUST use server process time sourced from `Date.now()` — client time is never accepted.
- **FR-021**: This stage MUST NOT introduce new HTTP endpoints, API routes, queue consumers, database tables, or tenant-facing product behavior.
- **FR-022**: Orchestration log artifacts produced by the same execution ID MUST be idempotent: re-running the same command with the same inputs MUST produce the same artifact and MUST NOT create duplicates.
- **FR-023**: The `docs/architecture/health/ai-execution-logs/` directory MUST be created automatically if it does not exist when any orchestration script first writes to it.

### Key Entities

- **Orchestration CLI Script**: One of the three executable TypeScript files (`run-task.ts`, `plan-task.ts`, `validate-execution.ts`) that form the entry points for AI-governed task execution.
- **Execution Log Artifact**: A structured JSON file written to `docs/architecture/health/ai-execution-logs/` for each orchestration run, identified by a unique execution ID.
- **Execution Plan**: A human-readable, deterministic decomposition of a requested task produced by `plan-task.ts` without modifying application source files.
- **Validation Report**: The aggregated output of all architecture governance tools produced by `validate-execution.ts`, indicating `pass` or `fail` with diagnostic details.
- **Architecture Intelligence Artifact**: Machine-readable context files under `docs/ai/context/` (principally `ai-architecture-brain.json`) consumed by orchestration scripts as the authoritative architecture state.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of `ai:run`, `ai:plan`, and `ai:validate` invocations on a compliant repository exit zero and produce a structured execution log artifact.
- **SC-002**: 100% of `ai:validate` runs on a non-compliant repository exit non-zero and identify the violating module or governance boundary.
- **SC-003**: 100% of execution log artifacts contain all mandatory fields: `execution_id`, `task_id`, `timestamp`, `command`, `skills_activated`, `files_modified`, `architecture_violations`, `validation_result`, and `execution_duration_ms`.
- **SC-004**: 0 duplicate log artifacts are produced when the same execution ID is reused across re-runs of any orchestration command.
- **SC-005**: 100% of `ai:plan` runs for the same task description produce identical plan output (deterministic planning verified in at least two consecutive runs).
- **SC-006**: 100% of cases where `ai-architecture-brain.json` is absent or stale are detected by `ai:validate` and result in a non-zero exit with a named diagnostic.
- **SC-007**: 0 changes introduced by this stage weaken database-per-tenant isolation, license enforcement coverage, version compatibility enforcement, or server-authoritative time guarantees.
- **SC-008**: 0 new HTTP endpoints, API routes, queue consumers, or database tables are introduced by this stage.
- **SC-009**: 100% of CI validation runs publish a validation artifact accessible to reviewers.
- **SC-010**: 95% of local `ai:validate` runs on a compliant repository complete within 90 seconds; 95% of CI `ai:validate` runs complete within 120 seconds during validation.
- **SC-011**: 100% of orchestration scripts enforce import boundaries: no imports from `apps/*` or from any `packages/*` other than `packages/logger` and `packages/config` are present in `scripts/ai-engine/`.
- **SC-012**: 100% of execution log writes use atomic (temp-file-then-rename) writes, with zero partial log artifacts observable after any single run.

---

## Assumptions & Dependencies

- This stage is infrastructure governance tooling only; it does not introduce new tenant-facing product capabilities, API routes, or runtime behavior.
- Existing ADRs, architecture contracts, module boundaries, and trust-chain rules remain authoritative for all decisions in this stage.
- Existing runtime enforcement for tenant resolution, license checks, compatibility validation, server-authoritative time, attempt snapshots, and worker-finalized grading is unchanged by this stage.
- The architecture intelligence artifacts under `docs/ai/context/` are maintained by `bun scripts/infra-audit.ts` and are assumed to exist or be regenerable before orchestration scripts are invoked.
- The project already has `bun arch:guard`, `bun type-safety-guard`, and `bun arch:health` commands available; `ai:validate` orchestrates them rather than reimplementing their logic.
- No new packages are introduced; `scripts/ai-engine/` imports only from `packages/logger`, `packages/config`, and Node/Bun stdlib.

---

## In Scope

- Three orchestration CLI scripts under `scripts/ai-engine/` (`run-task.ts`, `plan-task.ts`, `validate-execution.ts`).
- Three `package.json` scripts: `ai:run`, `ai:plan`, `ai:validate`.
- Structured JSON execution logging to `docs/architecture/health/ai-execution-logs/`.
- CI pipeline step: "AI Execution Validation" running `bun ai:validate`.
- Idempotent, atomic execution log artifact management.
- Validation that existing architecture governance tooling passes as part of `ai:validate`.

---

## Out of Scope

- Redesigning Zidney architecture, layer directions, or dependency rules.
- Changing database topology, tenant resolution semantics, or workspace identity rules.
- Changing license lifecycle behavior, middleware ordering, or compatibility policy.
- Changing attempt engine execution, grading, timing, snapshot, or worker authority behavior.
- Adding tenant-facing UI, product features, API endpoints, or worker queue consumers.
- Introducing new architecture exceptions, boundary waivers, or ADR changes.
- Implementing AI reasoning logic or LLM integrations; the scripts are deterministic orchestration controllers, not AI inference engines.
- Persistent storage of execution logs beyond the local filesystem (no DB, no external log service).

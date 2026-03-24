# Feature Specification: Build, Test, and Repository Cleanliness Enforcement

**Feature Branch**: `spec/fix-03-build-test-and-repository-cleanliness-enforcement`
**Created**: 2026-03-24
**Status**: Draft
**Stage File**: `specs/phases/0X_FIXES/STAGE_FIX_03_BUILD_TEST_AND_REPOSITORY_CLEANLINESS_ENFORCEMENT.md`

---

## Overview

This stage introduces a unified, policy-engine-driven enforcement layer that guarantees the workspace
builds cleanly, the full test suite passes in isolation, and the repository contains no stale or
unauthorized generated artifacts.

All validation rules are registered in the shared Policy Engine (INFRA-29). No validation logic
may live in CI workflows, Husky hooks, or the orchestrator directly — those callers MUST invoke
`policyEngine.check(context)` via `bun run validate:policy`.

---

## User Scenarios & Testing

### User Story 1 — Developer runs pre-push validation and receives a unified result (Priority: P1)

A developer about to push commits runs `bun run validate:policy --changed`. The system uses
GitNexus context to limit execution to affected modules, checks the environment, auto-fixes lint
and formatting issues, runs the relevant build and test steps, and reports a single pass/fail
result with structured error output.

**Why this priority**: This is the daily-driver gate. It catches regressions before they reach CI
and replaces the current patchwork of direct `build`/`test` invocations.

**Independent Test**: Run `bun run validate:policy --changed` against a branch that has only
passing changes. Result must be exit-0 with no errors reported.

**Acceptance Scenarios**:

1. **Given** the environment is ready and all changed modules compile and their tests pass,
   **When** the developer runs `bun run validate:policy --changed`,
   **Then** the process exits with code 0 and prints a structured summary with no errors.

2. **Given** a changed file contains a lint violation,
   **When** `validate:policy --changed` runs,
   **Then** `RULE_FIX_03_AUTO_FIX_ATTEMPT` corrects it automatically, reruns the check, and
   exits 0 if the correction resolves the issue; otherwise exits non-zero with a clear error
   referencing the specific rule that failed.

3. **Given** the environment is missing a required service (PostgreSQL or Redis),
   **When** `validate:policy --changed` runs,
   **Then** `RULE_FIX_03_ENVIRONMENT_READY` fails immediately with exit non-zero and a
   machine-readable error message before any build or test step executes.

---

### User Story 2 — CI pipeline runs full validation without duplicating direct commands (Priority: P1)

CI replaces all direct `bun run build` and `bun run test` invocations with
`bun run validate:policy --full`. The full rule set executes in the prescribed order. CI fails if
any `error`-severity rule fails; it passes with warnings only if all errors are resolved and
deferred issues are documented.

**Why this priority**: Eliminates divergence between local and CI behavior. A single policy
invocation governs both.

**Independent Test**: Trigger a CI run on a clean branch. The pipeline must call only
`validate:policy --full`; no direct `build` or `test` commands are allowed in the workflow.

**Acceptance Scenarios**:

1. **Given** all rules pass on a clean workspace,
   **When** CI executes `bun run validate:policy --full`,
   **Then** the pipeline exits 0 and all rule results are reported in the CI log.

2. **Given** a failing unit test exists,
   **When** CI executes `validate:policy --full`,
   **Then** `RULE_FIX_03_TEST_PASS` fails with severity `error`, the pipeline exits non-zero,
   and the log identifies the failing test.

3. **Given** only warning-level rules fail and all deferred issues are documented,
   **When** CI executes `validate:policy --full`,
   **Then** the pipeline exits 0 and the warning summary is reported.

---

### User Story 3 — Repository remains clean of unauthorized generated artifacts (Priority: P2)

After any script execution, the repository must contain only files belonging to the approved
artifact allowlist. Any new files outside that list — coverage reports, temp dirs, test
screenshots, untracked build outputs — cause `RULE_FIX_03_REPO_CLEAN` and
`RULE_FIX_03_NO_ARTIFACT_DRIFT` to fail.

**Why this priority**: Prevents accidental commits of generated artifacts and keeps the working
tree predictable for all contributors.

**Independent Test**: Run a script that normally produces coverage output, then run
`bun run repo:assert-clean`. The command must detect the unauthorized artifact and exit non-zero.

**Acceptance Scenarios**:

1. **Given** a script run produced files outside the approved allowlist (`docs/ai/context/*`,
   `docs/architecture/intelligence/*`, committed `dist/`),
   **When** `RULE_FIX_03_REPO_CLEAN` executes,
   **Then** it fails with a list of violating paths and exits non-zero.

2. **Given** no scripts were run and the working tree is clean,
   **When** `RULE_FIX_03_REPO_CLEAN` executes,
   **Then** it passes and exits 0.

3. **Given** a snapshot was taken before script execution and new files appear in prohibited
   directories afterward,
   **When** `RULE_FIX_03_NO_ARTIFACT_DRIFT` runs the post-execution diff,
   **Then** it reports all drifted paths and fails.

---

### User Story 4 — Tests run in isolation with no cross-test state leakage (Priority: P2)

Test suites initialize fresh database and Redis state before each run via dedicated scripts.
`RULE_FIX_03_TEST_ISOLATION` verifies that no state persists across test boundaries.

**Why this priority**: State leakage is a source of flaky or order-dependent tests that undermine
confidence in the suite.

**Independent Test**: Run the full test suite twice in sequence without resetting state between
runs; `RULE_FIX_03_TEST_ISOLATION` must detect the dirty state on the second run.

**Acceptance Scenarios**:

1. **Given** the test database contains rows from a previous run,
   **When** `RULE_FIX_03_TEST_ISOLATION` executes,
   **Then** it invokes `scripts/init-test-db.sh` and `scripts/reset-test-redis.sh`, confirms
   a clean slate, and proceeds.

2. **Given** a test modifies shared mutable global state without cleanup,
   **When** `RULE_FIX_03_TEST_ISOLATION` detects the leaked state,
   **Then** it fails with the identity of the leaking test and exits non-zero.

---

### User Story 5 — Orchestrator blocks stage closure until all errors are resolved (Priority: P3)

Before the orchestrator marks any stage closed, it runs `policy:check --full`. If any
`error`-severity rule fails, closure is blocked. If only warnings remain and deferred issues are
documented, closure is allowed.

**Why this priority**: Enforces the governance contract that no stage advances with known
blocking issues.

**Acceptance Scenarios**:

1. **Given** an unresolved `error`-severity rule failure,
   **When** the orchestrator attempts stage closure,
   **Then** it is blocked and the rule ID and failure reason are reported.

2. **Given** all errors are resolved and only documented warnings remain,
   **When** the orchestrator attempts stage closure,
   **Then** closure is allowed and the warning summary is recorded in the stage runtime.

---

### Edge Cases

- What happens when `bun run validate:policy --changed` is invoked with no changed files?
  → The system reports a no-op success (exit 0) without executing any rule.
- What happens when a policy rule itself throws an uncaught exception?
  → The rule is treated as an `error`-severity failure with a structured crash report; no
  silent failures are allowed.
- What happens when `auto-fix` changes a file that then fails typecheck?
  → The fix is reverted, the original violation is reported as an `error`, and the structured
  report includes the revert action.
- What happens when coverage falls below threshold on a module that has no changes?
  → `RULE_FIX_03_COVERAGE_THRESHOLD` emits a `warning`, not an error, and deferred
  documentation is generated.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a single entry-point command (`validate:policy`) that
  accepts `--changed` and `--full` flags and routes to the correct rule set.

- **FR-002**: All policy rules MUST implement the `PolicyRule` interface
  (`id`, `domain`, `severity`, `run(context) → Promise<PolicyResult>`).

- **FR-003**: Rules MUST execute in the defined order:
  1. RULE_FIX_03_ENVIRONMENT_READY
  2. RULE_FIX_03_AUTO_FIX_ATTEMPT
  3. RULE_FIX_03_BUILD_PASS
  4. RULE_FIX_03_TEST_PASS
  5. RULE_FIX_03_TEST_ISOLATION
  6. RULE_FIX_03_REPO_CLEAN
  7. RULE_FIX_03_NO_ARTIFACT_DRIFT
  8. RULE_FIX_03_ARTIFACT_ALLOWLIST
  9. Optional: coverage, flaky detection, performance, snapshot consistency

- **FR-004**: `--changed` mode MUST use GitNexus context to limit execution to impacted modules;
  full workspace execution is forbidden in `--changed` mode.

- **FR-005**: `--full` mode MUST execute all rules across the entire workspace with no module
  filtering.

- **FR-006**: All rules MUST be registered in `scripts/policy-engine/registry.ts`; no rule may
  execute outside this registry.

- **FR-007**: Supporting scripts (`repo:assert-clean`, `repo:detect-artifacts`,
  `repo:hash-build`, `validate:runtime-env`) MUST exit non-zero on failure and produce
  machine-readable (JSON) output.

- **FR-008**: CI workflows MUST replace all direct `build` and `test` invocations with
  `bun run validate:policy --full`.

- **FR-009**: Husky pre-push hook MUST invoke `bun run validate:policy --changed`.

- **FR-010**: The orchestrator closure step MUST invoke `policy:check --full` and block if any
  `error`-severity rule fails.

- **FR-011**: Artifact allowlist enforcement MUST permit only `docs/ai/context/*`,
  `docs/architecture/intelligence/*`, and explicitly-committed `dist/`; all other generated
  files outside this list MUST cause a rule failure.

- **FR-012**: Test isolation enforcement MUST invoke `scripts/init-test-db.sh` and
  `scripts/reset-test-redis.sh` to guarantee a clean state before the suite runs.

- **FR-013**: `RULE_FIX_03_AUTO_FIX_ATTEMPT` MUST run `lint:fix`, `format`, and `typecheck`
  before any `error`-severity rule is evaluated; if auto-fix resolves all issues, subsequent
  rules run against the corrected state.

- **FR-014**: Any rule failure MUST produce a structured output that includes: rule ID, domain,
  severity, human-readable message, and (where applicable) the list of violating paths or test
  names.

- **FR-015**: Deferred failures MUST be classified with a structured report identifying the rule,
  reason for deferral, and a suggested follow-up stage or task.

### Non-Functional Constraints

- **NFC-001**: No architecture redesign. This stage wires existing build/test/lint commands
  into the policy engine; it does not redesign the tools themselves.
- **NFC-002**: Database-per-tenant architecture MUST be preserved. Test isolation scripts MUST
  operate on per-tenant test instances; no shared tenant tables in test databases.
- **NFC-003**: License middleware MUST remain mandatory on all workspace routes. Test suites
  covering API routes MUST include license middleware in their setup.
- **NFC-004**: Server-authoritative time MUST be the only time source used in tests. Tests MUST
  NOT inject client-supplied timestamps.
- **NFC-005**: All writes in test setup/teardown MUST be transactional to prevent partial state.
- **NFC-006**: Idempotency is required for all `repo:assert-clean`, `repo:snapshot`, and
  `repo:detect-artifacts` commands — repeated invocations MUST produce identical results given
  identical repository state.
- **NFC-007**: Version compatibility between Bun runtime, Node engines, and installed package
  versions MUST be verified as part of `RULE_FIX_03_ENVIRONMENT_READY`.

### Key Entities

- **PolicyRule**: A registered validation unit with `id`, `domain`, `severity`, and an async
  `run` method returning a structured `PolicyResult`.
- **PolicyContext**: Runtime context passed to every rule — includes changed-file list (GitNexus
  output), environment flags, workspace root, and mode (`changed` | `full`).
- **PolicyResult**: Structured output from a rule — `passed: boolean`, `severity`, `messages[]`,
  `violatingPaths[]`, optional `deferralReport`.
- **ArtifactSnapshot**: A point-in-time record of tracked and untracked files used by drift
  detection rules.
- **DeferralReport**: A structured document that classifies an unfixable failure, records the
  rule ID, reason, and a recommended follow-up task or stage.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `bun run validate:policy --changed` completes in under 60 seconds on a typical
  feature branch with fewer than 20 changed files.

- **SC-002**: `bun run validate:policy --full` completes in under 10 minutes on the full
  workspace against a clean main branch.

- **SC-003**: Zero CI pipeline failures attributable to direct `build` or `test` invocations
  surviving alongside `validate:policy` calls after this stage closes.

- **SC-004**: 100% of `error`-severity rule failures produce structured, machine-readable output
  with no silent exits.

- **SC-005**: Repository working tree is reported clean (exit 0) immediately after any policy
  engine run on a clean branch with no side-effect scripts executed.

- **SC-006**: Test suite passes with zero state-leakage failures after this stage closes.

- **SC-007**: Coverage thresholds (global ≥ 70%, critical modules ≥ 80%) are reported on every
  `--full` run; breach emits a `warning` and is captured in the run summary.

- **SC-008**: All 14 policy rules are registered, discoverable via `registry.ts`, and invokable
  individually for debugging without requiring a full pipeline run.

---

## Assumptions

- The policy engine infrastructure (INFRA-29) has a sufficiently stable interface that
  `PolicyRule` and `PolicyContext` types can be consumed without modification in this stage.
- GitNexus context generation (`bun run arch:gitnexus:context`) is available and produces
  accurate changed-file sets before `--changed` mode runs.
- Existing `scripts/init-test-db.sh` and `scripts/reset-test-redis.sh` scripts are functional
  and need only to be wired into `RULE_FIX_03_TEST_ISOLATION` without rewriting.
- CI workflow files are editable in this stage without triggering a separate infra-change review.
- Worker-only grading flows (Attempt Engine) are not directly tested in this stage; their
  existing tests pass under the standard `bun run test` invocation.
- Snapshot integrity for attempt grading is preserved because this stage does not modify any
  attempt, question, or grading domain packages.

# INFRA_AUDIT_CHECKLIST — Feature Specification

**Stage:** INFRA_AUDIT_CHECKLIST  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/INFRA_AUDIT_CHECKLIST.md`  
**Runtime Dir:** `specs/runtime/infra-002-audit-checklist/`  
**Branch:** `infra-002-audit-checklist`  
**Base Branch:** `develop`  
**Authored:** 2026-03-04  
**Status:** DRAFT — Specification Step

---

## Overview

This stage delivers a complete, non-destructive infrastructure audit of the Zidney monorepo's
testing toolchain, linting configuration, CI pipeline, Bun runtime compatibility, and documentation
coverage. The output is a written Gap Report, a Risk Classification table, and a Safe Rollout Plan
that together constitute the authoritative baseline required before any governance enforcement
tooling (coverage gates, Husky hooks, consolidated Vitest configs, tightened ESLint rules, E2E CI
gates) may be introduced. No source code, schema, configuration, or workflow files are modified
during this stage; the only permitted new artifact is a read-only Bun-compatible audit script at
`scripts/infra-audit.ts`.

---

## Problem Statement

The Zidney monorepo currently has no verified, documented baseline for its test infrastructure,
linting rules, or CI enforcement posture. Before enforcing coverage thresholds, consolidating Vitest
configurations, enabling Husky commit hooks, or tightening ESLint rules across all packages and
apps, the current state must be precisely understood. Without this baseline:

- Enforcement changes may silently break existing workflows.
- Conflicting Vitest environments across apps may produce false-positive test results.
- ESLint/Prettier conflicts may cause formatter fights in CI.
- Coverage thresholds set without a measured baseline may be arbitrary and block legitimate work.
- CI pipeline gaps may allow non-compliant code to reach `develop` or `main`.
- Technical debt masking may occur if flaky/skipped tests are not counted before governance locks.

This audit stage eliminates that uncertainty before any enforcement is activated.

---

## Goals

1. Produce a complete **Vitest Configuration Inventory** enumerating every `vitest.config.*` /
   `vitest.workspace.*` file in the monorepo and classifying its environment, globals, coverage, and
   custom reporter settings.
2. Produce a **Test Distribution Audit** with exact counts of unit, integration, and E2E tests per
   app and package, plus the current raw coverage baseline.
3. Produce an **ESLint Configuration Audit** enumerating every ESLint config file, its rule severity
   map, and any Prettier/ESLint conflict risk classification.
4. Produce a **CI Pipeline Audit** documenting every workflow in `.github/workflows/`, its
   lint/type-check/test/coverage-gate status, and any enforcement gaps.
5. Verify **Bun Runtime Compatibility** — confirm `bun install`, `bun test`, `bun run lint`, and
   `bun run build` execute without error across the monorepo.
6. Produce a **README Coverage Audit** confirming the presence and completeness of README files for
   all `apps/*` and `packages/*` directories.
7. Produce a **Technical Debt Snapshot** recording TypeScript error count, ESLint error/warning
   counts, and the number of flaky or skipped tests at the time of audit.
8. Calculate an **Enforcement Readiness Score** across six governance areas to determine whether the
   monorepo is ready for enforcement, partially ready, or blocked.
9. Deliver the final **Gap Report**, **Risk Classification**, and **Safe Rollout Plan** as written,
   versioned artifacts in the runtime directory.
10. Create `scripts/infra-audit.ts` as a repeatable, non-destructive Bun-compatible audit script to
    automate data collection for Goals 1–7.

---

## Non-Goals

- No Vitest configuration consolidation or changes during this stage.
- No ESLint rule changes or severity upgrades.
- No Prettier rule changes or installation of new formatters.
- No introduction of Husky hooks or commit-msg linting.
- No CI workflow modifications.
- No coverage threshold changes.
- No new test files.
- No schema migrations.
- No backend code changes of any kind.
- No frontend code changes of any kind.
- No database-per-tenant isolation changes (not applicable to this tooling stage, but noted per
  constitution).
- No architectural redesign.
- No ADR authoring (ADRs may be referenced, not created during this stage).
- This stage does not implement governance enforcement — it only audits readiness for the subsequent
  `STAGE_INFRA_GOVERNANCE` stage.

---

## User Stories

**US1 — Vitest Configuration Inventory**  
As a platform engineer, I want a complete inventory of all Vitest configuration files across the
monorepo, so that I can identify inconsistencies before attempting consolidation.

**US2 — Test Distribution Audit**  
As a platform engineer, I want accurate counts of unit, integration, and E2E tests per app and
package, so that I can set coverage thresholds from a real baseline rather than a guess.

**US3 — ESLint Configuration Audit**  
As a platform engineer, I want a full mapping of all ESLint config files, their rule severities, and
their Prettier conflict risk, so that tightening rules does not break the formatter pipeline.

**US4 — CI Pipeline Audit**  
As a platform engineer, I want a row-per-workflow table documenting lint, type-check, unit,
integration, E2E, and coverage-gate status, so that I know exactly which pipeline steps are missing
or unguarded.

**US5 — Bun Compatibility Check**  
As a platform engineer, I want verified evidence that `bun install`, `bun test`, `bun run lint`, and
`bun run build` all succeed without errors, so that runtime incompatibilities are identified before
enforcement tooling depends on Bun.

**US6 — README Coverage Audit**  
As a platform engineer, I want a pass/fail record of README presence and section completeness for
each `apps/*` and `packages/*` directory, so that documentation gaps are catalogued before
governance rules mandate them.

**US7 — Technical Debt Snapshot**  
As a platform engineer, I want a point-in-time snapshot of TypeScript error count, ESLint error
count, ESLint warning count, and skipped or flaky test count, so that future enforcement cannot be
accused of masking pre-existing debt.

**US8 — Enforcement Readiness Score**  
As a platform engineer, I want a scored readiness table for six governance areas (Vitest
Consolidation, Coverage Threshold, E2E Isolation, ESLint Enforcement, Husky Hooks, CI Matrix), so
that the `STAGE_INFRA_GOVERNANCE` implementation can prioritise which areas to tackle first.

**US9 — Repeatable Audit Script**  
As a platform engineer, I want a single Bun-compatible script (`scripts/infra-audit.ts`) that I can
re-run at any time to regenerate the audit data, so that the baseline can be refreshed without
manual counting.

**US10 — Written Gap Report, Risk Classification, and Safe Rollout Plan**  
As a platform engineer, I want the audit stage to conclude with three versioned written documents
(Gap Report, Risk Classification, Safe Rollout Plan), so that the governance implementation stage
has a clear, approved roadmap to follow.

---

## Functional Requirements

### FR-US1: Vitest Configuration Inventory

- FR-US1-1: The audit must locate all files matching `vitest.config.ts`, `vitest.config.js`,
  `vitest.workspace.ts`, and any inline `"test"` key in `package.json` across the entire monorepo,
  excluding `node_modules`.
- FR-US1-2: For each config found, the audit must record: file path, `test.environment`, whether
  `globals` is enabled, whether coverage is enabled, and any custom reporters.
- FR-US1-3: The audit must flag any two configs that define conflicting values for the same property
  (e.g., different `environment` settings in different apps).
- FR-US1-4: Consolidation risk must be classified as LOW, MEDIUM, or HIGH.

### FR-US2: Test Distribution Audit

- FR-US2-1: The audit must count files matching `**/*.test.ts` under `apps/*/src/` and
  `packages/*/src/` and report totals per directory as unit tests.
- FR-US2-2: The audit must count files under `apps/*/tests/integration/` and `tests/integration/` as
  integration tests.
- FR-US2-3: The audit must detect presence of Playwright config files and E2E test directories per
  app and record CI integration status.
- FR-US2-4: The audit must execute `bun test --coverage` (read-only) and record raw Lines%,
  Functions%, Statements%, and Branches% as the coverage baseline. Thresholds must not be changed.

### FR-US3: ESLint Configuration Audit

- FR-US3-1: The audit must locate all `.eslintrc.*`, `eslint.config.*`, and `package.json` ESLint
  override sections across the monorepo.
- FR-US3-2: For each config, the audit must extract the severity (error/warn/off) for at least:
  `no-unused-vars`, `@typescript-eslint/no-explicit-any`, `no-console`, and
  `vue/multi-word-component-names`.
- FR-US3-3: The audit must check whether `eslint-config-prettier` and `prettier` are installed and
  whether any formatting rules are duplicated in ESLint, classifying the risk as SAFE, NEEDS
  ALIGNMENT, or CONFLICT PRESENT.

### FR-US4: CI Pipeline Audit

- FR-US4-1: The audit must inspect every YAML file under `.github/workflows/`.
- FR-US4-2: For each workflow, the audit must record which of the following steps are present and
  enforced: Lint, Type Check, Unit Tests, Integration Tests, E2E Tests, Coverage Gate.
- FR-US4-3: The audit must flag any workflow where a merge gate step is absent or only informational
  (non-failing).

### FR-US5: Bun Compatibility Check

- FR-US5-1: The audit must execute and record the exit code of: `bun install`, `bun test`,
  `bun run lint`, `bun run build`.
- FR-US5-2: Any non-zero exit code or compatibility warning must be documented with the exact error
  output.
- FR-US5-3: Known Node.js-only tooling incompatible with Bun must be identified and listed.

### FR-US6: README Coverage Audit

- FR-US6-1: The audit must verify README presence for every directory directly under `apps/` and
  `packages/`.
- FR-US6-2: For each README found, the audit must verify presence of these sections: Purpose,
  Responsibilities, Dependencies, Public API (packages only), How to Run Tests, Environment
  Variables, Known Boundaries.
- FR-US6-3: Missing READMEs must be classified as HIGH documentation debt. Incomplete READMEs must
  be classified as MEDIUM.

### FR-US7: Technical Debt Snapshot

- FR-US7-1: The audit must run `bun run tsc --noEmit` (read-only) and record the total TypeScript
  error count.
- FR-US7-2: The audit must run `bun run lint` (read-only) and record total ESLint error count and
  warning count.
- FR-US7-3: The audit must scan for `.skip`, `.todo`, `xit`, `xdescribe` markers in test files and
  record a skipped-test count per app.
- FR-US7-4: The audit must scan test output for known flaky test markers and record a flaky-test
  count if determinable.

### FR-US8: Enforcement Readiness Score

- FR-US8-1: After completing all prior audits (US1–US7), the audit must populate a Readiness Score
  table with READY or NEEDS WORK for each of: Vitest Consolidation, Coverage Threshold, E2E
  Isolation, ESLint Enforcement, Husky Hooks, CI Matrix.
- FR-US8-2: An overall readiness verdict must be assigned: READY FOR ENFORCEMENT, PARTIAL — FIX
  REQUIRED, or NOT READY.
- FR-US8-3: Each NEEDS WORK entry must include a one-sentence justification.

### FR-US9: Repeatable Audit Script

- FR-US9-1: `scripts/infra-audit.ts` must be created using the template provided in the stage file.
- FR-US9-2: The script must: locate all Vitest configs, ESLint configs, Playwright configs, test
  files; perform README presence scan; write results to `infra-audit-report.json`.
- FR-US9-3: The script must be runnable via `bun run scripts/infra-audit.ts` without errors.
- FR-US9-4: The script must not modify any file other than writing `infra-audit-report.json` to the
  repo root.
- FR-US9-5: The script must skip `node_modules` and `.git` directories.

### FR-US10: Written Gap Report, Risk Classification, Safe Rollout Plan

- FR-US10-1: A **Gap Report** must be written as a structured markdown document listing every gap
  identified in US1–US8.
- FR-US10-2: A **Risk Classification** must assign a risk level (LOW / MEDIUM / HIGH / CRITICAL) to
  each identified gap, with a one-sentence rationale.
- FR-US10-3: A **Safe Rollout Plan** must sequence the recommended remediation steps from lowest to
  highest risk, ensuring no step is taken before its predecessor is verified complete.
- FR-US10-4: All three documents must be stored under
  `specs/runtime/infra-002-audit-checklist/reports/`.
- FR-US10-5: The audit stage must not proceed to `STAGE_INFRA_GOVERNANCE` implementation until these
  three documents are reviewed and approved.

---

## Non-Functional Requirements

### Performance

- NFR-P1: The `scripts/infra-audit.ts` script must complete a full monorepo scan in under 30 seconds
  on a machine with ≥8 GB RAM.
- NFR-P2: All read-only audit commands (`bun test --coverage`, `bun run tsc --noEmit`,
  `bun run lint`) must be run sequentially, not in parallel, to avoid masking resource contention
  issues.

### Security

- NFR-S1: The audit script must not read, write, or log any secrets, `.env` content, or credential
  files.
- NFR-S2: The audit script must not make any network requests.
- NFR-S3: The `infra-audit-report.json` output must not be committed to the repository (it must be
  gitignored or treated as ephemeral output).

### Isolation

- NFR-I1: No tenant database connection, resolver, or migration may be invoked at any point during
  this audit stage; the audit is toolchain-only.
- NFR-I2: The audit must not alter the `node_modules` directory; it is strictly read access.

### Observability

- NFR-O1: The audit script must emit structured console output with section headers so progress can
  be tracked if piped to a log file.
- NFR-O2: The written Gap Report must include the exact timestamp (`ISO 8601`) at which the audit
  data was collected.
- NFR-O3: All audit counts (test file counts, error counts) must be reproducible by re-running the
  audit script unchanged.

### Governance

- NFR-G1: This stage is strictly READ-ONLY for all source, schema, and CI files. The only permitted
  write operations are: creating `scripts/infra-audit.ts` and writing `infra-audit-report.json` at
  runtime.
- NFR-G2: Stage status must remain DRAFT until specification review is complete, then transition to
  IN PROGRESS when audit execution begins.
- NFR-G3: The stage must not be marked COMPLETE until all three output documents (Gap Report, Risk
  Classification, Safe Rollout Plan) are present, non-empty, and cross-referenced.

---

## Acceptance Criteria

### AC-US1: Vitest Configuration Inventory

- AC-US1-1: A table listing all discovered Vitest config files is present in the Gap Report, with
  columns: Location, Environment, Custom Coverage, Notes.
- AC-US1-2: Every config file found in the monorepo (excluding `node_modules`) is present in the
  table.
- AC-US1-3: A consolidation risk level (LOW / MEDIUM / HIGH) is assigned and justified.

### AC-US2: Test Distribution Audit

- AC-US2-1: Test counts for unit and integration tests are documented per `apps/*` and `packages/*`
  directory.
- AC-US2-2: E2E test presence is confirmed or denied for each app with a Playwright config status
  column.
- AC-US2-3: A four-metric coverage baseline (Lines%, Functions%, Statements%, Branches%) is recorded
  and dated.

### AC-US3: ESLint Configuration Audit

- AC-US3-1: All ESLint config files are listed with their extends and overrides.
- AC-US3-2: Severity for the four specified rules is recorded for each config.
- AC-US3-3: Prettier conflict risk is classified as SAFE, NEEDS ALIGNMENT, or CONFLICT PRESENT with
  justification.

### AC-US4: CI Pipeline Audit

- AC-US4-1: A workflow audit table is present with one row per `.github/workflows/*.yml` file.
- AC-US4-2: Each row documents: Lint, Type Check, Unit, Integration, E2E, Coverage Gate — as
  Present/Absent/Informational.
- AC-US4-3: Missing merge gates are flagged as gaps in the Gap Report.

### AC-US5: Bun Compatibility Check

- AC-US5-1: Exit codes for all four Bun commands are recorded.
- AC-US5-2: Any non-zero exit is accompanied by the full error message in the report.
- AC-US5-3: A compatibility verdict of FULLY COMPATIBLE, PARTIALLY COMPATIBLE, or INCOMPATIBLE is
  assigned.

### AC-US6: README Coverage Audit

- AC-US6-1: Every `apps/*` and `packages/*` directory is listed with README present/absent.
- AC-US6-2: For each present README, a section-completeness check is recorded.
- AC-US6-3: Debt classification (HIGH for missing, MEDIUM for incomplete) is applied.

### AC-US7: Technical Debt Snapshot

- AC-US7-1: TypeScript error count from `bun run tsc --noEmit` is recorded and dated.
- AC-US7-2: ESLint error count and warning count from `bun run lint` are recorded and dated.
- AC-US7-3: Skipped test count per app is recorded.

### AC-US8: Enforcement Readiness Score

- AC-US8-1: Readiness table is present with READY or NEEDS WORK for all six areas.
- AC-US8-2: Overall verdict is assigned.
- AC-US8-3: Every NEEDS WORK entry has a one-sentence justification.

### AC-US9: Repeatable Audit Script

- AC-US9-1: `scripts/infra-audit.ts` exists and lints without errors.
- AC-US9-2: Running `bun run scripts/infra-audit.ts` produces `infra-audit-report.json` without
  error.
- AC-US9-3: The JSON output contains all 11 required top-level keys: `timestamp`, `gitSha`,
  `vitestConfigs`, `eslintConfigs`, `playwrightConfigs`, `totalTestFiles`, `readmeAudit`,
  `skippedTests`, `flakyTests`, `consolidationRisk`, `prettierConflictRisk`.
- AC-US9-4: The script makes no modifications to any tracked file.

### AC-US10: Written Deliverables

- AC-US10-1: `reports/GAP_REPORT.md` exists, is non-empty, and references findings from US1–US8.
- AC-US10-2: `reports/RISK_CLASSIFICATION.md` exists and assigns a risk level with rationale for
  each gap.
- AC-US10-3: `reports/SAFE_ROLLOUT_PLAN.md` exists and sequences remediation steps from lowest to
  highest risk.
- AC-US10-4: All three documents are cross-referenced (each references the others).
- AC-US10-5: No `STAGE_INFRA_GOVERNANCE` implementation task may be opened until these documents
  exist.

---

## Dependencies

| Dependency                                  | Type               | Notes                                                                                             |
| ------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `STAGE_INFRA_01_TYPESCRIPT_STABILIZATION`   | Predecessor Stage  | TypeScript stabilization should be complete or in known state before audit counts are meaningful. |
| `.github/workflows/`                        | Existing Artifact  | CI audit (US4) requires that workflow files exist to inspect.                                     |
| `vitest.config.ts` (root + per-app)         | Existing Artifacts | Inventory audit (US1) requires these files to exist.                                              |
| `eslint.config.mjs` (root + per-app)        | Existing Artifacts | ESLint audit (US3) requires these files to exist.                                                 |
| Bun runtime (≥1.0)                          | Toolchain          | All script execution depends on Bun being installed in the dev environment.                       |
| `packages/` and `apps/` directory structure | Existing Artifacts | README audit (US6) and test counts (US2) depend on this structure.                                |
| `STAGE_INFRA_GOVERNANCE`                    | Successor Stage    | This audit stage must complete and be approved before STAGE_INFRA_GOVERNANCE may begin.           |

---

## Risks

| ID  | Risk                                                                                                                                         | Likelihood | Impact | Mitigation                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Coverage baseline run fails due to pre-existing test errors, making it impossible to record a clean baseline.                                | MEDIUM     | HIGH   | Record partial coverage with error log; document broken tests as debt items; do not block audit on test failure.                            |
| R2  | `bun test` produces non-deterministic output (flaky tests) causing different counts on different runs.                                       | LOW        | MEDIUM | Run coverage twice; flag test counts as approximate if variance detected; note in Gap Report.                                               |
| R3  | Vitest configs are spread across deeply nested directories and missed by the audit script's search.                                          | LOW        | MEDIUM | Confirm `scripts/infra-audit.ts` uses recursive directory traversal excluding only `node_modules` and `.git`.                               |
| R4  | ESLint config uses flat config format (`eslint.config.mjs`) which differs from legacy `.eslintrc.*` parsing.                                 | MEDIUM     | LOW    | Audit both formats explicitly; the script searches by filename pattern so both are captured.                                                |
| R5  | Bun has silent incompatibilities with certain Node.js-only packages (e.g., native bindings), which only surface during `bun test` execution. | LOW        | MEDIUM | Document any non-zero Bun command exit codes with full error output; classify as INCOMPATIBLE if blocking.                                  |
| R6  | Stage status drift — audit findings tempt engineers to begin remediation before the Gap Report is formally approved.                         | MEDIUM     | HIGH   | Governance rule: no `STAGE_INFRA_GOVERNANCE` task may be opened until all three output documents are reviewed. Enforce via stage lifecycle. |
| R7  | `infra-audit-report.json` is accidentally committed to the repository, exposing file path metadata.                                          | LOW        | LOW    | Add `infra-audit-report.json` to `.gitignore` before running the script.                                                                    |
| R8  | TypeScript error count measured during audit is later disputed as representing a different codebase state.                                   | LOW        | MEDIUM | Record the git commit SHA in the audit report alongside every metric.                                                                       |

---

## Glossary

| Term                               | Definition                                                                                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INFRA_AUDIT_CHECKLIST**          | The name of this stage; a non-destructive pre-enforcement audit of the monorepo's testing and linting infrastructure.                                                         |
| **Gap Report**                     | A structured written document listing every identified gap between the current monorepo state and the target governance posture.                                              |
| **Risk Classification**            | A table assigning LOW / MEDIUM / HIGH / CRITICAL risk levels to each identified gap, used to prioritise remediation.                                                          |
| **Safe Rollout Plan**              | A sequenced, dependency-ordered plan describing which governance enforcement steps to activate and in what order, derived from the audit findings.                            |
| **Enforcement Readiness Score**    | A six-area READY / NEEDS WORK verdicts table that summarises whether each governance area is safe to enforce.                                                                 |
| **Coverage Baseline**              | The raw Lines%, Functions%, Statements%, and Branches% coverage numbers measured from the current test suite, recorded before any threshold is set.                           |
| **Vitest Configuration Inventory** | A complete enumeration of all Vitest config files across the monorepo with their environment and coverage settings.                                                           |
| **Technical Debt Snapshot**        | A point-in-time count of TypeScript errors, ESLint errors/warnings, and skipped/flaky tests, used to prevent pre-existing debt from being masked by future enforcement gates. |
| **Consolidation Risk**             | A LOW / MEDIUM / HIGH classification indicating how difficult or risky it would be to merge multiple Vitest configs into one.                                                 |
| **STAGE_INFRA_GOVERNANCE**         | The successor stage that implements governance enforcement tooling; it may not begin until this audit is complete and approved.                                               |
| **Monorepo**                       | The single Git repository containing all Zidney apps (`apps/*`) and shared packages (`packages/*`).                                                                           |
| **Bun**                            | The JavaScript runtime and package manager used by Zidney (`bun install`, `bun test`, `bun run`).                                                                             |
| **Flat ESLint Config**             | The `eslint.config.*` format introduced in ESLint v9, as distinct from the legacy `.eslintrc.*` format.                                                                       |
| **Playwright**                     | The E2E testing framework; presence of its config file is audited per app in the E2E section.                                                                                 |

---

## Clarifications

### Session 2026-03-04

**CL1 — Coverage Baseline Scope (Test Suite Inclusion vs. DB Isolation)** Q: FR-US2-4 requires
running `bun test --coverage` to record the coverage baseline. However, NFR-I1 prohibits invoking
any tenant database connection during this audit stage. If `bun test --coverage` executes
integration or API tests that attempt DB connections, a conflict arises between recording a complete
coverage baseline and the tenant isolation constraint. Should the coverage run be limited to unit
tests only, or should all tests be attempted with DB-touching failures documented as-is? A: Run the
full test suite via `bun test --coverage` in a local test environment where DB connections are
expected to fail gracefully. Any integration test failures caused by a missing or unavailable DB
must be recorded as "DB-GATED" entries in `infra-audit-report.json`. The coverage baseline captures
whatever succeeds; no filtering by test type is applied at the script level. This aligns with the R1
mitigation: "Record partial coverage with error log; document broken tests as debt items; do not
block audit on test failure." Rationale: Filtering tests by type before running would alter the
measurement and underreport real coverage gaps. The audit goal is to record the current state,
including failures caused by environment constraints.

**CL2 — Audit Script Re-run Behavior (Idempotency of `infra-audit-report.json`)** Q: FR-US9-4 states
the script must not modify any tracked file and must write `infra-audit-report.json` to the repo
root. The spec does not specify what happens when `infra-audit-report.json` already exists from a
previous run. Should the script overwrite silently, emit a warning and overwrite, or append a
timestamped variant? A: The script must overwrite `infra-audit-report.json` silently on every run
without prompting. The file is ephemeral (gitignored per R7 mitigation) and NFR-O3 requires
reproducibility across runs, making silent overwrite the correct default. Versioning or appending
would violate the "single source of truth" intent of the audit report. The `timestamp` field inside
the JSON (required by AC-US9-3) serves as the run-identity record. Rationale: A read-only audit
stage that produces a non-idempotent output artifact would undermine the repeatability guarantee in
NFR-O3. Silent overwrite is the standard pattern for generated report files.

**CL3 — Secrets Exclusion Pattern Scope (NFR-S1)** Q: NFR-S1 prohibits the audit script from reading
`.env` content or credential files, but does not enumerate which filename patterns qualify as secret
files. The spec mentions `.env` explicitly but does not clarify whether `.env.*`, `*.pem`, `*.key`,
`*.secret`, or `docker-compose.override.yml` are also excluded. A: The audit script must skip —
without opening or reading — any file matching the following patterns during all filesystem scans:
`.env`, `.env.*`, `*.pem`, `*.key`, `*.secret`, `*.p12`, `*.pfx`, and `docker-compose.override.yml`.
If the script encounters one of these files during directory traversal, it must log the filename as
"SKIPPED (secret pattern)" in the console output and exclude it from all audit results. No other
credential patterns need be enumerated for this stage. Rationale: Enumerating an explicit exclusion
list prevents accidental credential exposure through pattern-matching ambiguity and satisfies
NFR-S1's intent without requiring a runtime secret-detection library.

**CL4 — Audit Script Error Handling on Parse Failure** Q: The spec defines what the audit script
must collect but does not specify behaviour when a discovered file cannot be parsed (e.g., a
malformed Vitest config, a YAML syntax error in a CI workflow file, or a `package.json` with invalid
JSON). Should the script abort the entire run on the first parse error, or log the failure and
continue? A: The script must catch parse errors per file, log the file path and error message to the
console as a structured warning, and continue processing all remaining files. The failed file must
appear in `infra-audit-report.json` with a `"status": "PARSE_ERROR"` field alongside its path. The
overall script exit code must remain 0 (success) as long as the filesystem scan completes, ensuring
the Gap Report is always produced even in partially degraded conditions. Rationale: Aborting on
first failure would prevent the audit from producing a complete picture in repositories with known
configuration debt — precisely the state this audit is designed to document.

**CL5 — Flaky Test Detection Method (FR-US7-4)** Q: FR-US7-4 requires the audit to "scan test output
for known flaky test markers" but does not define what constitutes a "known flaky test marker."
There are at least three possible approaches: scanning source files for comment or API markers,
reading previous CI run logs, or parsing Vitest retry configuration. Which method is in scope? A:
The script must perform a static scan of test source files only (no external CI log access, no
network requests per NFR-S2). The scan must detect the following patterns: `.retry(`, `// flaky`,
`// FLAKY`, `// unstable`, `// UNSTABLE`, and the Vitest config key `retry:` with a value ≥ 1. The
resulting flaky-test count is labelled `"detectionMethod": "STATIC_SCAN_ONLY"` in
`infra-audit-report.json` and must be described as best-effort in the Gap Report. Rationale: CI log
inspection would require network access or credentials (violating NFR-S2 and NFR-S1). Static source
scanning is deterministic, reproducible, and fully contained within the local filesystem.

**CL6 — README Section Completeness Threshold (FR-US6-2)** Q: FR-US6-2 requires verifying the
presence of seven named sections in each README. The spec does not define what "presence" means —
specifically whether a markdown heading alone satisfies the check, or whether the section must also
contain non-empty body content. A: A section is considered PRESENT only if (a) a markdown heading
matching the section name (case-insensitive, `#` through `###` depth) exists AND (b) at least one
non-blank, non-heading line of body text follows before the next heading. A heading with no body
content must be classified as `PRESENT_EMPTY`, which is treated identically to MISSING for the
purpose of MEDIUM debt classification per FR-US6-3. The `PRESENT_EMPTY` status must appear as a
distinct column value in the README audit table so it can be distinguished from a completely absent
section. Rationale: An empty heading gives false confidence that documentation exists.
Distinguishing `PRESENT_EMPTY` from `PRESENT` enables more precise remediation prioritisation in the
Safe Rollout Plan.

**CL7 — Enforcement Readiness Score Verdict Thresholds (FR-US8-2)** Q: FR-US8-2 defines three
possible overall verdicts (READY FOR ENFORCEMENT, PARTIAL — FIX REQUIRED, NOT READY) but does not
specify at what count of NEEDS WORK areas each verdict applies. Without a defined threshold, two
auditors could assign different verdicts from the same score table. A: The verdict must be
determined by the following rule applied to the six governance areas: 0 areas NEEDS WORK →
`READY FOR ENFORCEMENT`; 1–3 areas NEEDS WORK → `PARTIAL — FIX REQUIRED`; 4–6 areas NEEDS WORK →
`NOT READY`. This threshold rule must be documented verbatim in the Gap Report immediately above the
readiness score table so it is visible for review. The threshold itself is not a governance
enforcement gate — it is an auditor convention, and the STAGE_INFRA_GOVERNANCE implementer may
override it with explicit justification. Rationale: Without a numeric threshold, the verdict becomes
subjective and non-reproducible across audit runs or reviewers, undermining the auditability goal of
NFR-O3.

**CL8 — Cross-Referencing Requirement Definition (AC-US10-4)** Q: AC-US10-4 requires that all three
output documents (Gap Report, Risk Classification, Safe Rollout Plan) "cross-reference" each other,
but does not define what cross-referencing means in practice. Does a plain text mention of the other
document names satisfy this, or must relative markdown links be used? A: Cross-referencing is
satisfied only by a dedicated "Related Documents" section (or equivalent heading) in each output
document that lists the other two documents as relative markdown links using their filenames.
Example: `[RISK_CLASSIFICATION.md](./RISK_CLASSIFICATION.md)`. A plain text mention without a link
does not satisfy this requirement. The "Related Documents" section must appear at the top of each
document (before the first audit content section) so reviewers can navigate between documents
without scrolling. Rationale: Markdown links are machine-verifiable and enable tooling to validate
document graph completeness in CI, whereas plain text mentions provide no navigability or automated
verifiability.

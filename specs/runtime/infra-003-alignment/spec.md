# Feature Specification: Infrastructure & Governance Alignment

**Feature Branch**: `infra-003-alignment`
**Created**: 2026-03-04
**Status**: Draft
**Stage**: STAGE_INFRA_03_ALIGNMENT
**Phase**: 01_PLATFORM_FOUNDATION
**Category**: Infrastructure / Governance Alignment

---

## Overview

This stage prepares the Zidney monorepo to safely enforce governance rules in the subsequent **STAGE_INFRA_GOVERNANCE** stage.

The previous audit stage (`infra-002-audit-checklist`) revealed structural inconsistencies: fragmented Vitest configuration, absent E2E framework, missing documentation, low test coverage baseline, and ESLint/Prettier misalignment.

This stage **does not enforce governance yet**. It **aligns the repository structure** so that governance enforcement can occur without breaking CI or developer workflow. It is a **transitional stage between audit and enforcement**.

**Key principle**: No business logic changes. No tenant database changes. No changes to license middleware or attempt engine. Pure infrastructure and tooling alignment.

---

## Context: Zidney Constitutional Constraints

This stage operates entirely in infrastructure space. The following Zidney constitutional rules are acknowledged but **do not require new implementation** in this stage:

- Database-per-tenant isolation is unchanged — no migration files, no schema changes
- License middleware is unchanged — no route modifications
- Attempt engine integrity is unchanged — no grading logic
- No cross-tenant joins introduced — no new data access paths
- Worker execution model unchanged — no job logic
- Concurrency guarantees unchanged — no transaction logic

**Constitutional compliance for this stage**: Verified. This stage introduces no architectural drift.

---

## User Scenarios & Testing

### User Story 1 — Developer Can Run All Tests From Repo Root (Priority: P1)

A developer clones the repository and runs a single command from the repo root to execute all unit and integration tests across all apps and packages.

**Why this priority**: The foundation of all governance enforcement. If test execution is fragmented, CI cannot be built reliably. This is the most critical unblocking step.

**Independent Test**: Can be tested by running `bun run test` from the repository root and confirming tests from all apps and packages execute under a single Vitest runner.

**Acceptance Scenarios**:

1. **Given** the repository is freshly cloned with dependencies installed, **When** `bun run test` is executed at the repo root, **Then** Vitest discovers and runs tests from all apps and packages in a single invocation.
2. **Given** the root `vitest.config.ts` uses the projects configuration, **When** coverage is collected, **Then** a single coverage report is generated covering all modules.
3. **Given** some apps use `jsdom` and packages use `node` environments, **When** tests run, **Then** each app/package uses the correct test environment defined in its own config.

---

### User Story 2 — Developer Can Run E2E Tests for UI Applications (Priority: P2)

A developer or CI process can execute browser-based end-to-end tests for the MMC, Backoffice, and Frontoffice applications using Playwright.

**Why this priority**: Validates that the UI apps boot and render correctly at a browser level — critical before governance enforcement activates E2E gates in CI.

**Independent Test**: Can be tested by running Playwright smoke tests for each UI app and confirming that the app loads and the login page renders without errors.

**Acceptance Scenarios**:

1. **Given** Playwright is installed, **When** `bun run test:e2e` is executed inside `apps/mmc`, **Then** the smoke test confirms the application loads in a browser context.
2. **Given** Playwright config exists at `apps/backoffice/playwright.config.ts`, **When** smoke tests run, **Then** they confirm the Backoffice renders its login or root route.
3. **Given** Playwright config exists at `apps/frontoffice/playwright.config.ts`, **When** smoke tests run, **Then** they confirm the Frontoffice renders its root route.
4. **Given** a shared `tests/e2e/app-load.spec.ts` smoke test exists, **When** it runs, **Then** it verifies browser boot without runtime errors.

---

### User Story 3 — Engineer Formats Code Without ESLint/Prettier Conflicts (Priority: P2)

A developer runs `bun run format` and `bun run lint` without receiving conflicting rule errors between ESLint and Prettier.

**Why this priority**: Prevents CI from failing on formatting inconsistencies. Required before governance CI gates activate.

**Independent Test**: Can be tested by running `bun run format:check` followed by `bun run lint` on the codebase and confirming zero conflicting errors.

**Acceptance Scenarios**:

1. **Given** Prettier is installed at the repo root, **When** `bun run format` is executed, **Then** all files are formatted consistently and no errors are thrown.
2. **Given** `eslint-config-prettier` is installed, **When** `bun run lint` is executed, **Then** ESLint does not report formatting errors that duplicate Prettier's responsibility.
3. **Given** both tools are configured, **When** a developer saves a file in VS Code, **Then** auto-format and auto-fix do not produce conflicting changes.

---

### User Story 4 — Developer Understands App or Package Purpose From README (Priority: P3)

A new developer joining the team can open any app or package directory and immediately understand its purpose, dependencies, test commands, and boundaries from a README file.

**Why this priority**: Reduces onboarding time and prevents architectural drift. Secondary to test infrastructure but important for governance documentation.

**Independent Test**: Can be tested by confirming a README exists in every `apps/*` and `packages/*` directory and that each README contains all required sections.

**Acceptance Scenarios**:

1. **Given** the repository contains apps and packages, **When** a developer inspects `apps/api/README.md`, **Then** it contains Purpose, Responsibilities, Dependencies, How to Run Tests, Environment Variables, and Known Boundaries sections.
2. **Given** `packages/domain-core/README.md` exists, **When** reviewed, **Then** it contains a Public API section in addition to standard sections.
3. **Given** all READMEs are present, **When** CI validates documentation coverage, **Then** no app or package directory is missing a README.

---

### User Story 5 — Skipped and Flaky Tests Are Addressed (Priority: P3)

Every skipped test in the codebase either has a documented reason or has been re-enabled. Flaky tests are stabilized or quarantined with explanation.

**Why this priority**: CI must not silently skip tests. Governance enforcement requires a reliable, stable test baseline.

**Independent Test**: Can be tested by running the full test suite and confirming no unexplained `skip` markers exist and no tests fail intermittently across 3 consecutive runs.

**Acceptance Scenarios**:

1. **Given** a test is marked as skipped, **When** reviewed, **Then** either it is re-enabled or it carries a documented reason (as a code comment or TODO).
2. **Given** a test was identified as flaky in the audit report, **When** the test suite runs 3 consecutive times, **Then** it produces consistent results.
3. **Given** a flaky test cannot be immediately stabilized, **When** committed to the repository, **Then** it is explicitly quarantined with a tracking comment.
4. **Given** CI runs the test suite, **When** tests execute, **Then** skipped tests are visible in the CI report and not silently ignored.

---

### Edge Cases

- What happens when a sub-app's local `vitest.config.ts` conflicts with the root projects config? → The root config takes precedence for coverage; per-project configs govern environment and setup.
- What happens when a Playwright smoke test fails because the dev server is not running? → Smoke tests must document their prerequisite (app server must be running) and CI must start the server before E2E execution.
- What happens when an existing test uses `describe.skip` without explanation? → Treated as an unjustified skip; must be addressed (re-enabled or documented) in T006.
- What happens when a package has no existing tests and no unit test directory? → An empty `tests/unit/` directory with a placeholder `.gitkeep` is acceptable as structural scaffolding.
- What happens if `eslint-config-prettier` disables a rule currently relied upon? → The rule must be explicitly reviewed; if needed, re-enabled as a non-formatting ESLint rule with documentation.

---

## Requirements

### Functional Requirements

**T001 — Vitest Configuration Consolidation**

- **FR-001**: The repository MUST have exactly one root `vitest.config.ts` that uses Vitest's `projects` configuration to reference all apps and packages.
- **FR-002**: Coverage configuration (thresholds, reporters, output directory) MUST be centralized in the root `vitest.config.ts` only.
- **FR-003**: Duplicate coverage configuration in app-level or package-level Vitest configs MUST be removed.
- **FR-004**: Each app or package `vitest.config.ts` MUST only declare environment (`node` or `jsdom`) and setup files; it MUST NOT redefine coverage settings.
- **FR-005**: The root config MUST reference apps via `./apps/*` and packages via `./packages/*` glob patterns.

**T002 — Test Directory Structure Normalization**

- **FR-006**: Every app (`apps/*`) MUST contain the directory structure `tests/unit/`, `tests/integration/`, and `tests/e2e/`.
- **FR-007**: Every package (`packages/*`) MUST contain the directory structure `tests/unit/`.
- **FR-008**: Existing test files MUST be relocated to their correct directories if they are currently misplaced.
- **FR-009**: Empty directories MUST contain a `.gitkeep` placeholder to maintain structure in version control.

**T003 — Playwright Installation**

- **FR-010**: Playwright MUST be installed as a development dependency at the repository root.
- **FR-011**: A `playwright.config.ts` file MUST be created at `apps/mmc/playwright.config.ts`.
- **FR-012**: A `playwright.config.ts` file MUST be created at `apps/backoffice/playwright.config.ts`.
- **FR-013**: A `playwright.config.ts` file MUST be created at `apps/frontoffice/playwright.config.ts`.
- **FR-014**: A reference/documentation file MUST be created at `tests/e2e/app-load.spec.ts` that documents the per-app smoke test pattern for contributors. This file is NOT a runnable Playwright test (no root-level `playwright.config.ts` exists); it exists as a code-comment guide. Runnable smoke tests are created per-app (FR-011–FR-013 + per-app `tests/e2e/smoke.spec.ts`).
- **FR-015**: Each Playwright config MUST define the base URL, test directory, and browser target(s).

**T004 — ESLint and Prettier Alignment**

- **FR-016**: Prettier MUST be installed as a development dependency at the repository root.
- **FR-017**: `eslint-config-prettier` MUST be installed and referenced in the ESLint flat config (`eslint.config.mjs`).
- **FR-018**: The ESLint flat config MUST disable all rules that duplicate Prettier's formatting responsibility.
- **FR-019**: A `bun run format` script MUST be added to the root `package.json` that runs Prettier over the full codebase.
- **FR-020**: A `bun run format:check` script MUST be added to the root `package.json` that verifies formatting without mutation.
- **FR-021**: A `.prettierrc` or `prettier.config.mjs` configuration file MUST be created at the repository root defining consistent formatting rules.

**T005 — Flaky Test Stabilization**

- **FR-022**: Every test identified as flaky in the audit report (`infra-audit-report.json`) MUST be investigated.
- **FR-023**: Flaky tests caused by race conditions or unhandled async MUST be stabilized with deterministic assertions and proper `await` usage.
- **FR-024**: Flaky tests that cannot be immediately stabilized MUST be explicitly quarantined with a `// QUARANTINE: <reason> <tracking-ref>` comment.
- **FR-025**: No test MUST rely on wall-clock timing or non-deterministic ordering.

**T006 — Skipped Test Review**

- **FR-026**: Every test file containing `.skip` or `xit` or `xtest` or `xdescribe` MUST be reviewed.
- **FR-027**: Each skipped test MUST either be re-enabled (if the underlying issue is resolved) or annotated with a documented reason: `// SKIP REASON: <explanation>`.
- **FR-028**: CI MUST report skipped tests visibly — skips MUST NOT be silently ignored.
- **FR-029**: `it.skip` without explanation MUST be treated as a CI warning.

**T007 — README Creation**

- **FR-030**: Every directory in `apps/*` MUST contain a `README.md` file.
- **FR-031**: Every directory in `packages/*` MUST contain a `README.md` file.
- **FR-032**: Each README MUST include the following sections: Purpose, Responsibilities, Dependencies, How to Run Tests, Environment Variables, Known Boundaries.
- **FR-033**: READMEs for packages MUST additionally include a Public API section.
- **FR-034**: READMEs MUST be written for an onboarding developer, not just an expert. Plain language required.

**T008 — CI Pipeline Preparation**

- **FR-035**: CI pipeline configuration MUST support sequential execution of: lint, type-check, unit tests, integration tests, and E2E tests.
- **FR-036**: CI MUST be capable of running each stage independently (parallelizable where appropriate).
- **FR-037**: Coverage enforcement gates MUST NOT be activated in this stage — coverage collection in CI is allowed but thresholds are not enforced.
- **FR-038**: CI MUST fail if linting errors are detected.
- **FR-039**: CI MUST fail if type-check errors are detected.

---

### Non-Functional Requirements

- **NFR-001**: All changes MUST be backward-compatible — no breaking changes to existing test behavior.
- **NFR-002**: The consolidation MUST NOT change existing test assertions, only their organization and runner configuration.
- **NFR-003**: Playwright installation MUST NOT increase non-E2E test suite execution time.
- **NFR-004**: README files MUST be maintained in English.
- **NFR-005**: All configuration files MUST be consistent with the existing TypeScript toolchain (no new language runtimes introduced).
- **NFR-006**: Prettier and ESLint alignment MUST NOT require manual reformatting of all files in a single commit — a gradual or automated format pass is acceptable.
- **NFR-007**: This stage MUST NOT modify any migration files, tenant schemas, or license enforcement logic.
- **NFR-008**: This stage MUST NOT introduce new npm/bun packages that affect the production build bundle.

---

### Key Entities

- **Vitest Root Config** (`vitest.config.ts`): The single authoritative test runner configuration. Controls projects, coverage settings, and global test environment defaults.
- **Playwright Config** (per UI app): Per-application E2E configuration defining base URL, test directory, browser targets, and reporter settings.
- **ESLint Flat Config** (`eslint.config.mjs`): Existing flat-config ESLint setup extended with Prettier integration.
- **Prettier Config** (`.prettierrc` or `prettier.config.mjs`): Root-level formatting rules authoritative for the entire monorepo.
- **README** (per app/package): Onboarding documentation file. Not a living technical spec — a stable reference document.
- **Test Directory Structure**: The canonical `tests/unit/`, `tests/integration/`, `tests/e2e/` hierarchy per app; `tests/unit/` per package.

---

## Scope

### In Scope

- Root `vitest.config.ts` consolidation using Vitest projects
- Coverage configuration centralization
- Test directory structure normalization across all apps and packages
- Playwright installation and per-UI-app configuration
- Initial Playwright smoke tests for MMC, Backoffice, and Frontoffice
- Prettier installation and root configuration
- `eslint-config-prettier` installation and ESLint flat config update
- `bun run format` and `bun run format:check` scripts in root `package.json`
- Flaky test investigation and stabilization (or quarantine)
- Skipped test review and documentation
- README creation for all apps and packages
- CI pipeline configuration to support the 5-stage test execution sequence
- Coverage collection in CI (no threshold enforcement)

### Out of Scope

- Coverage threshold enforcement (deferred to STAGE_INFRA_GOVERNANCE)
- Husky git hooks (deferred to STAGE_INFRA_GOVERNANCE)
- Mandatory coverage gates in CI (deferred)
- New feature tests (no new business logic)
- Tenant database schema changes
- License middleware changes
- Attempt engine changes
- Worker job logic changes
- New application routes or API endpoints
- Performance optimization of test execution
- Playwright tests beyond initial smoke tests
- Test data seeding for E2E (deferred)
- Auto-formatting enforcement as a pre-commit hook (deferred)

---

## Assumptions

1. The repository already has a root `package.json` with Bun as the package manager — all install commands use `bun add`.
2. The existing ESLint flat config (`eslint.config.mjs`) is operational and only requires the Prettier integration extension.
3. Playwright will be installed as a root devDependency with per-app config files; the apps themselves run as development servers during E2E tests.
4. Coverage baselines are recorded but no minimum thresholds are configured — this is intentional per stage design.
5. The team will address flaky tests pragmatically: stabilize if straightforward, quarantine with a comment if complex.
6. READMEs are created now as initial documentation and may be updated as the platform evolves.
7. "CI pipeline preparation" refers to updating existing CI workflow files (e.g., GitHub Actions), not introducing a new CI system.
8. Smoke tests for Playwright are minimal by design — they verify app boots and renders, not full user flows.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A developer can run all unit and integration tests across the full monorepo with a single command from the repository root.
- **SC-002**: All 3 UI applications (MMC, Backoffice, Frontoffice) have Playwright configurations and at least one passing smoke test each.
- **SC-003**: Running `bun run lint` and `bun run format:check` produces zero conflicting errors between ESLint and Prettier.
- **SC-004**: Every `apps/*` and `packages/*` directory contains a README with all required sections — 100% README coverage.
- **SC-005**: Zero unexplained skip markers remain in the test codebase after review.
- **SC-006**: The CI pipeline successfully executes all 5 stages (lint, type-check, unit, integration, E2E) in sequence without configuration errors.
- **SC-007**: Coverage reports are generated and stored per CI run without enforcing thresholds (collection-only mode).
- **SC-008**: The repository reaches **Governance Ready** status, enabling STAGE_INFRA_GOVERNANCE to begin.

### Alignment Gate (Validation Checklist)

All 8 validation checks from the stage file must pass:

| Validation | Description                                               | Status |
| ---------- | --------------------------------------------------------- | ------ |
| V001       | Exactly one root Vitest config with projects setup        | —      |
| V002       | All modules have correct test directory structure         | —      |
| V003       | Playwright installed with per-app configs and smoke tests | —      |
| V004       | Prettier installed and ESLint flat config references it   | —      |
| V005       | All skipped tests reviewed and documented                 | —      |
| V006       | Flaky tests stabilized or quarantined                     | —      |
| V007       | All apps and packages have complete READMEs               | —      |
| V008       | CI supports lint + type-check + unit + integration + E2E  | —      |

**All 8 validations must PASS before this stage is marked ALIGNMENT COMPLETE.**

---

## Dependencies

- **Upstream**: `infra-002-audit-checklist` (audit findings are the primary input)
- **Upstream**: `infra-audit-report.json` (identifies flaky tests and structural gaps)
- **Downstream**: `STAGE_INFRA_GOVERNANCE` (cannot begin until this stage is complete)
- **Tooling**: Bun package manager, existing Vitest setup, existing ESLint flat config

---

## Known Boundaries

- This spec covers **tooling and structure only** — no application behavior changes.
- Playwright smoke tests are deliberately minimal. Full E2E test suites are out of scope.
- Coverage threshold enforcement is deliberately excluded — it belongs to STAGE_INFRA_GOVERNANCE.
- This stage does not introduce any new ADRs — it implements existing governance decisions.
- No changes to the Zidney trust chain: Isolation → License → Authentication → Attempt → Runtime → Frontoffice.

---

## Clarifications

### Session 2026-03-04

**Q1: Should per-app `vitest.config.ts` files be deleted entirely after root projects consolidation, or kept as minimal overrides?**
A: Keep per-app `vitest.config.ts` files as minimal overrides. Each must retain only the `environment` (`node` or `jsdom`) and `setupFiles` declarations. All coverage settings must be removed from per-app configs and centralized in the root config only. Deleting per-app configs entirely would lose per-environment isolation (e.g., `jsdom` for UI apps vs. `node` for packages), which is required by FR-003 and FR-004. This aligns with the stage design statement: "Per-project configuration may remain minimal."

**Q2: Should Playwright smoke tests be excluded from the regular `bun run test` command, or are they part of the default test run?**
A: Playwright smoke tests are excluded from `bun run test`. They run only via a dedicated `bun run test:e2e` command (or equivalent per-app script). The regular `bun run test` invocation targets Vitest only (unit + integration). This separation is required because E2E tests depend on a running dev server (as stated in the Edge Cases section), and conflating them with the Vitest runner would break CI sequential staging (FR-035). The root `vitest.config.ts` projects glob (`./apps/*`, `./packages/*`) must exclude Playwright config and spec files.

**Q3: What is the mechanism for quarantining flaky tests so that CI reports them visibly but does not fail the build?**
A: Quarantined tests use `it.skip(...)` (or `test.skip(...)`) co-located with a `// QUARANTINE: <reason> <tracking-ref>` comment on the line immediately above the test definition. No separate test file pattern or dedicated quarantine directory is introduced. CI must run with a verbose reporter (e.g., `--reporter=verbose`) so skipped tests appear explicitly in CI output logs — they must never be silently suppressed (FR-028). A quarantined test that is skipped without the required comment is treated as an unjustified skip (FR-029 CI warning). There is no CI flag to bulk-suppress quarantined tests; each must be individually marked.

**Q4: Should README files follow an existing internal template, or are they free-form documents structured around the required sections?**
A: READMEs are free-form documents structured around the required sections defined in FR-032 and FR-033 (Purpose, Responsibilities, Dependencies, How to Run Tests, Environment Variables, Known Boundaries; plus Public API for packages). No existing internal template file exists in the repository. Authors must treat the section list as a mandatory checklist, but section content and prose style are at the author's discretion. The only hard constraint is FR-034: plain language written for an onboarding developer, not an expert. CI validation of README coverage (SC-004) checks for file existence and required section headings, not content quality.

**Q5: Should `eslint-config-prettier` be applied globally in the root `eslint.config.mjs`, or scoped to specific apps that use Prettier-sensitive rules?**
A: Apply globally in the root `eslint.config.mjs` only. The flat config at the repo root is the single authoritative ESLint configuration for the entire monorepo (as defined in the Key Entities section). Per-app ESLint configs are not part of this stage's scope. Applying `eslint-config-prettier` globally ensures consistent Prettier/ESLint boundary enforcement across all apps and packages (FR-017, FR-018) and prevents any app from accidentally reactivating formatting rules that Prettier owns. If a specific rule disabled by `eslint-config-prettier` is required for correctness (not formatting), it must be explicitly re-enabled in the root config with a documented comment (as noted in the Edge Cases section).

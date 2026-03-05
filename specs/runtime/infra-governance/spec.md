# Specification: Infrastructure Governance

**Phase:** 01_PLATFORM_FOUNDATION
**Stage:** STAGE_INFRA_GOVERNANCE
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_GOVERNANCE.md`
**Spec Version:** 1.0.0
**Date:** 2026-03-05
**Status:** DRAFT

---

## Feature Overview

This stage defines and locks the mandatory infrastructure governance model for the Zidney monorepo. It covers how code quality, test execution, formatting, commit hygiene, CI enforcement, and documentation standards are structured and enforced across all apps and packages.

This is a **constitutional-level stage**. All future stages in all phases must comply. It does not introduce new application features; it establishes the contractual tooling baseline that makes all other stages safe to implement.

**Scope:** Monorepo-wide — applies to `apps/*` and `packages/*`.

**What this stage governs:**

- Testing Architecture: mandatory separation of Unit, Integration, and E2E test tiers
- Per-App E2E Isolation: each app owns its Playwright configuration in full isolation
- Vitest Monorepo Configuration: projects-based root orchestration (workspace file retained as the projects source)
- Playwright E2E Structure: per-app isolation contract
- ESLint + Prettier Integration: conflict-free, Bun-compatible linting and formatting
- Commit Hooks: Husky pre-commit and pre-push gates
- CI Enforcement Matrix: GitHub Actions pipeline enforcing the full quality gate sequence
- README Governance: documentation completeness standard for all apps and packages

**What this stage does NOT do:**

- Does not add new product features or user-facing behavior
- Does not modify tenant isolation, license middleware, attempt engine, or database models
- Does not invalidate or rewrite existing passing tests
- Does not escalate existing ESLint warnings to errors without explicit review
- Does not perform mass migration of legacy test paths

---

## Constitutional Compliance Declaration

This stage is tooling and CI infrastructure only. It does not interact with the application trust chain.

Confirmed:

- No cross-tenant access introduced
- No middleware bypass introduced
- No grading logic outside Worker
- No direct DB instantiation
- No weakening of snapshot integrity
- No weakening of transaction boundaries
- No weakening of version enforcement

No ADR is required. This stage is tooling-only and does not alter any architectural runtime behavior.

---

## Isolation Impact Analysis

Not applicable. This stage introduces no database access, no tenant resolution, and no connection pool usage.

Confirmed: no shared tenant data, no master DB access, no tenant DB access.

---

## License & Version Enforcement

Not applicable. This stage does not involve workspace-bound routes, license middleware, schema versions, or product versions.

---

## Data Model Changes

None. No tables, no migrations, no version bumps.

---

---

## User Scenarios & Acceptance Criteria

### Actor Definition

The primary actors for this stage are:

- **Developer** — any engineer contributing to the Zidney monorepo
- **CI System** — GitHub Actions pipeline executing automated quality gates
- **Stage Author** — person implementing a new stage or feature in the future

---

### Scenario 1: Developer runs tests locally

**Given** a developer has the repository checked out and dependencies installed,
**When** they run `bun test` or a tier-specific command (`bun run test:unit`, `bun run test:integration`),
**Then** the correct test tier executes in isolation, results are reported per project, and coverage is measured against defined thresholds.

**Acceptance:**

- Unit tests do not start a network or database
- Integration tests connect to a controlled test database only
- E2E tests do not run as part of unit or integration invocations
- Each test tier can be invoked independently without side effects

---

### Scenario 2: Developer commits code

**Given** a developer has staged changes and runs `git commit`,
**When** the pre-commit hook executes,
**Then** ESLint runs with auto-fix on staged TypeScript and Vue files, Prettier rewrites staged files to canonical format, and the commit is blocked if any lint error remains after auto-fix.

**Acceptance:**

- ESLint runs only on staged files (not the entire repository)
- Prettier formatting is applied automatically before committing
- Commit is blocked on unfixed lint errors
- Commit is not blocked by Prettier-only reformatting (fix is applied silently)

---

### Scenario 3: Developer pushes code

**Given** a developer attempts to push a branch,
**When** the pre-push hook executes,
**Then** full lint, type check, and unit test suite must all pass before the push is allowed.

**Acceptance:**

- Push blocked if any lint error is present
- Push blocked if TypeScript type check fails
- Push blocked if any unit test fails
- Push succeeds when all three quality gates pass

---

### Scenario 4: CI pipeline validates a pull request

**Given** a pull request is opened or updated against `main`,
**When** the GitHub Actions CI workflow runs,
**Then** all jobs in the enforcement matrix execute in the defined sequence, and the PR cannot be merged until all jobs pass.

**Acceptance:**

- Lint job runs first
- Type check job runs in parallel with or after lint
- Unit test job runs after lint and type check
- Integration test job runs after unit tests
- E2E tests execute per-app (mmc, backoffice, frontoffice) in parallel or sequential matrix
- Coverage validation runs and fails if thresholds are not met
- Build verification runs last
- All jobs must report green before merge is allowed
- No job may be skipped or bypassed

---

### Scenario 5: New app is added to the monorepo

**Given** a developer creates a new app under `apps/`,
**When** they attempt to merge it,
**Then** the new app must have a `README.md`, a Vitest project entry in `vitest.workspace.ts`, a Playwright config (if it has UI), and its tests must pass coverage thresholds.

**Acceptance:**

- Missing `README.md` is caught by governance audit
- Missing Vitest project entry means tests are excluded from CI — unacceptable
- Playwright config missing blocks E2E stage advancement
- Coverage below threshold blocks merge

---

### Scenario 6: Developer navigates test failures

**Given** the CI pipeline reports a test failure,
**When** the developer reads the failure output,
**Then** they can identify which test tier failed, which project the failure belongs to, and the precise assertion that failed.

**Acceptance:**

- Test output identifies project name (e.g., `mmc`, `api`, `backoffice`)
- Test output identifies test tier (unit / integration / E2E)
- Failure message includes file path and test name
- No ambiguous "test failed somewhere" output without context

---

### Scenario 7: Existing tests are not disrupted by consolidation

**Given** the monorepo has existing passing tests in various locations,
**When** this stage is applied,
**Then** all previously passing tests continue to pass without modification.

**Acceptance:**

- No existing test file is deleted or moved during initial stage application
- No existing `*.test.ts` file becomes invalid
- Coverage baselines are measured before thresholds are enforced
- Legacy test paths may temporarily remain and are migrated gradually

---

## Functional Requirements

### FR-01: Test Tier Separation

1. All test files must belong to exactly one of three tiers: Unit, Integration, or E2E.
2. Unit test files must match the glob `apps/*/src/**/*.test.ts` or `packages/*/src/**/*.test.ts`.
3. Integration test files must match the glob `apps/*/tests/integration/**/*.test.ts` or `tests/integration/**/*.test.ts`.
4. E2E test files must match the glob `apps/*/tests/e2e/**/*.spec.ts`.
5. A test file that does not match any canonical glob must be classified and relocated during gradual migration.
6. Tests in each tier must be executable independently of the other tiers.

---

### FR-02: Unit Test Requirements

1. Unit tests must not initiate network connections.
2. Unit tests must not connect to real databases.
3. Unit tests must run entirely in memory with mocked dependencies.
4. Unit test coverage must meet or exceed the global threshold (85% lines, 85% functions, 85% statements, 80% branches).
5. Any unit test that would fail the coverage threshold must be accompanied by a documented coverage exception or additional tests.

---

### FR-03: Integration Test Requirements

1. Integration tests may connect to a controlled test database and/or Redis instance.
2. Integration tests must validate real execution paths through API routes, middleware chains, and service orchestration.
3. Integration tests must assert RFC 7807 error response compliance where applicable.
4. Integration tests must validate tenant isolation boundaries (no cross-tenant data access).
5. Integration tests must not depend on browser automation; that is the E2E tier's responsibility.

---

### FR-04: E2E Test Requirements — Per-App Isolation (LOCKED)

1. Each frontend application (`mmc`, `backoffice`, `frontoffice`) must have its own Playwright configuration file at `apps/<app>/playwright.config.ts`.
2. Each app's Playwright configuration must define its own `baseURL` pointing to that app's local development server.
3. E2E tests must not import fixtures or helpers from another app's test directory.
4. Authentication bootstrap (sign-in, session setup) must be implemented per-app and must not be shared across apps.
5. Each app's E2E suite must support headless execution in CI.
6. Each app's E2E suite must collect traces on test failure.
7. E2E tests must cover at minimum: authentication flow, one critical happy path, and one isolation boundary (e.g., license enforcement where applicable).
8. CI must run E2E per-app in a matrix — no single shared E2E runner for the entire monorepo.

---

### FR-05: Vitest Monorepo Configuration

1. The root `vitest.config.ts` must act as the global orchestrator using a `workspace` reference.
2. The root `vitest.workspace.ts` must define all test projects across apps and packages.
3. No app or package may introduce a standalone `vitest.config.ts` that operates independently of the root workspace.
4. Each project entry in `vitest.workspace.ts` must declare its environment (`node` or `jsdom`), plugins, setup files, and resolve aliases as required.
5. Coverage configuration must be defined at the root level only — no per-project coverage config is allowed.
6. Global coverage thresholds must be set to: Lines ≥ 85%, Functions ≥ 85%, Statements ≥ 85%, Branches ≥ 80%.
7. Coverage failure must block merge.

---

### FR-06: ESLint Configuration

1. The root `eslint.config.mjs` is the single authoritative ESLint configuration for the entire monorepo.
2. No per-app ESLint configuration override is allowed unless explicitly required by a specific app's framework and justified in that app's `AGENTS.md`.
3. The configuration must include: `@typescript-eslint`, `eslint-plugin-vue`, `eslint-plugin-import-x`.
4. The configuration must include `eslint-config-prettier` as the final flat config entry to suppress any formatting-related ESLint rules that conflict with Prettier.
5. `no-console` must be set to at minimum `warn` in production source files.
6. `@typescript-eslint/no-explicit-any` must be set to at minimum `warn`.
7. Existing rules must not be escalated from `warn` to `error` without an explicit review and documented rationale.
8. ESLint errors must block commit (via Husky pre-commit) and block CI (via lint job).

---

### FR-07: Prettier Configuration

1. The root `prettier.config.mjs` is the single authoritative Prettier configuration.
2. No per-app Prettier configuration override is allowed.
3. Prettier must be compatible with Vue 3 `<script setup>`, TypeScript, and Tailwind CSS class ordering (if the Tailwind Prettier plugin is adopted).
4. Prettier formatting check must run in CI and fail if any staged file does not conform.
5. Prettier auto-format must run in the pre-commit hook before the commit is finalized.

---

### FR-08: Commit Hooks — Pre-Commit Gate

1. Husky must be installed and its hooks must be active for all developers who install dependencies.
2. The pre-commit hook must run lint-staged, which must run:
   - `eslint --fix` on staged `.ts`, `.tsx`, `.vue` files
   - `prettier --write` on staged `.ts`, `.tsx`, `.vue`, `.md`, `.json` files
3. The pre-commit hook must run the AI architecture guard (`scripts/ai-guard.ts`) to check for architecture drift.
4. The pre-commit hook must run the infrastructure audit script (`scripts/infra-audit.ts --quick`).
5. Commit must be blocked if any lint error remains after auto-fix.
6. Commit must not be blocked by Prettier reformatting alone (reformatting is applied automatically).

---

### FR-09: Commit Hooks — Pre-Push Gate

1. The pre-push hook must run: full ESLint, TypeScript type check (`bun run typecheck`), and unit tests.
2. Push must be blocked if lint fails.
3. Push must be blocked if type check fails.
4. Push must be blocked if any unit test fails.
5. The pre-push hook must complete within a reasonable time (target: under 3 minutes on a standard developer machine).

---

### FR-10: CI Enforcement Matrix

The GitHub Actions CI pipeline must enforce the following sequence:

| Step | Job Name            | Depends On        | Failure Blocks Merge |
| ---- | ------------------- | ----------------- | -------------------- |
| 1    | Lint                | —                 | Yes                  |
| 2    | Type Check          | —                 | Yes                  |
| 3    | Unit Tests          | Lint, Type Check  | Yes                  |
| 4    | Integration Tests   | Unit Tests        | Yes                  |
| 5    | E2E: MMC            | Integration Tests | Yes                  |
| 5    | E2E: Backoffice     | Integration Tests | Yes                  |
| 5    | E2E: Frontoffice    | Integration Tests | Yes                  |
| 6    | Coverage Validation | Unit Tests        | Yes                  |
| 7    | Build Verification  | All prior jobs    | Yes                  |

Rules:

1. No job may be removed or skipped without an ADR.
2. No workflow `continue-on-error: true` is allowed on any of the above jobs.
3. Branch protection rules must require all jobs to pass before merge.
4. Integration tests must spin up PostgreSQL and Redis as GitHub Actions services.
5. E2E jobs must install Playwright browsers before running.
6. CI must use `bun install --frozen-lockfile` to ensure dependency reproducibility.

---

### FR-11: README Governance Standard

Every app under `apps/*` and every package under `packages/*` must contain a `README.md` that includes all of the following sections:

1. **Purpose** — one-paragraph description of what this app/package does
2. **Responsibilities** — what this unit owns and is accountable for
3. **Dependencies** — direct dependencies on other apps or packages
4. **Public API** — exported functions, components, or types (packages only; optional for apps)
5. **How to Run Tests** — exact commands to run unit, integration, and E2E tests as applicable
6. **Environment Variables** — all required and optional environment variables with descriptions
7. **Known Boundaries** — what this unit must NOT do (e.g., "does not access tenant DB directly")

An app or package without a complete `README.md` is considered undocumented and cannot be merged.

---

### FR-12: Hard Mode Enforcement Rules

The following rules are mandatory for all future stages:

1. No new app may be merged without a Vitest project entry and a `README.md`.
2. No new package may be merged without a `README.md` and unit tests.
3. No stage may be marked `PRODUCTION_READY` without passing E2E tests for any UI it touches.
4. No merge is allowed with test coverage below the defined thresholds.
5. No CI bypass (`--no-verify`, `force-push to main`, skipping jobs) is allowed.
6. No `console.log` in production source files (enforced by `no-console: error` in CI strict mode; `warn` in local).

---

## Success Criteria

The following criteria define when this stage is complete. All are measurable and technology-agnostic:

1. **Test suite runs cleanly in all three tiers** — Unit, Integration, and E2E tests each run in isolation without cross-tier interference on any developer machine and in CI.

2. **All tests pass on the main branch** — Zero test failures across all tiers on the `main` branch immediately after stage completion.

3. **Coverage meets defined thresholds** — The monorepo-wide test coverage meets or exceeds 85% lines, 85% functions, 85% statements, and 80% branches as reported by the centralized coverage run.

4. **Developers are blocked from committing invalid code** — A developer cannot successfully commit code with unfixed lint errors. This is verified by attempting to commit a file with a known lint violation and observing the commit rejection.

5. **CI pipeline enforces the full quality gate** — Opening a pull request with a lint error, type error, or failing test results in a CI failure that prevents merge. This is verified by the existing CI workflow passing all required checks on a clean branch.

6. **Every app and package has a complete README** — A governance audit script or manual review confirms that all required README sections are present in every `apps/*` and `packages/*` directory.

7. **E2E suites run per-app without cross-app dependency** — Running the E2E suite for `mmc` does not require starting the `backoffice` or `frontoffice` servers. Each E2E config is independently runnable.

8. **Existing tests remain green** — All tests that were passing before this stage's application continue to pass after it.

9. **New stages comply with this governance model** — The next stage implemented after this one has its tests, README, and CI gate compliant with the rules defined here.

---

## Assumptions

The following assumptions are made and have been documented as reasonable defaults:

1. **pnpm remains the package manager** — The `package.json` uses `pnpm` as the package manager. Husky hooks and lint-staged configuration must be compatible with pnpm workspaces, not npm or yarn.

2. **Bun is the runtime and script executor** — All `bun run <script>` invocations in CI and hooks use Bun. No Node.js-specific shims are needed for the tooling layer.

3. **Coverage thresholds are applied after an initial baseline measurement** — Thresholds are not enforced retroactively against code that was written before the thresholds were established. The first measurement after stage completion sets the enforced baseline.

4. **lint-staged applies ESLint and Prettier only to staged files** — lint-staged is configured at the root with path globs targeting TypeScript, Vue, Markdown, and JSON files.

5. **E2E tests run against a locally started development server** — CI starts each app's dev server before running that app's E2E suite. No separate staging environment is required for E2E in this stage.

6. **Playwright uses Chromium only in CI** — For CI efficiency, E2E runs use Chromium. Multi-browser E2E expansion is out of scope for this stage.

7. **Husky hooks are installed automatically on `bun install`** — The `prepare` script in `package.json` runs `husky` to install hooks. Developers who skip `prepare` are responsible for manually installing hooks.

8. **The existing `vitest.workspace.ts` approach is already aligned with `projects`-based orchestration** — The existing `vitest.config.ts` already uses a `workspace` reference. This stage formalizes and locks that contract rather than rebuilding from scratch.

---

## Constraints

1. This stage must be applied without breaking any currently passing test.
2. ESLint rule severity must not be escalated (warn → error) without separate documented review.
3. No existing test file may be deleted or moved as part of the initial stage application.
4. No new app-level Vitest config may be introduced unless it is a project entry in `vitest.workspace.ts`.
5. Prettier config is root-only; per-app overrides are forbidden.
6. E2E apps must remain fully isolated — no shared authentication or fixture state across apps.
7. CI jobs must use reproducible installs (`--frozen-lockfile`).
8. Branch protection on `main` must require all CI checks to pass; no manual override without documented incident rationale.

---

## Out of Scope

- Application feature development
- Database schema changes
- Tenant isolation mechanisms
- License enforcement
- Attempt engine
- Multi-browser Playwright coverage (deferred to a future stage)
- Performance benchmarks (covered by dedicated performance stage)
- Accessibility testing (deferred to a future stage)
- Visual regression testing (deferred to a future stage)
- Dependency security scanning (deferred to a dedicated security stage)

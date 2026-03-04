# STAGE_INFRA_03_ALIGNMENT

Phase: 01_PLATFORM_FOUNDATION  
Category: Infrastructure / Governance Alignment  
Status: DESIGN SPECIFICATION

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: MEDIUM
Last Updated: 2026-03-04T00:00:00.000Z

Tasks Generated:

- Total: 72 atomic tasks
- Phase 1 (T001-T015): Vitest consolidation — 15 tasks
- Phase 2 (T016-T027): Test directory normalization — 12 tasks
- Phase 3 (T028-T038): Playwright installation — 11 tasks
- Phase 4 (T039-T043): ESLint + Prettier alignment — 5 tasks
- Phase 5 (T044-T047): Flaky test stabilization — 4 tasks
- Phase 6 (T048-T057): Skipped test review — 10 tasks
- Phase 7 (T058-T070): README creation — 13 tasks
- Phase 8 (T071-T072): CI pipeline — 2 tasks

Deferred Scope:

- Coverage threshold enforcement (STAGE_INFRA_GOVERNANCE)
- Husky hooks (STAGE_INFRA_GOVERNANCE)
- No business logic, tenant DB, or migration changes

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation

Notes:
Atomic task set generated. Drift analysis gate pending.

---

# 1. Purpose

This stage prepares the Zidney monorepo to safely enforce the governance rules defined in **STAGE_INFRA_GOVERNANCE**.

The previous **INFRA_AUDIT_CHECKLIST** revealed structural inconsistencies across the repository (testing architecture, Vitest configuration fragmentation, missing documentation, and tooling misalignment).

This stage **does not enforce governance yet**.  
Instead it **aligns the repository structure** so enforcement can occur without breaking CI or developer workflow.

This is a **transitional stage between audit and enforcement**.

---

# 2. Inputs

Inputs to this stage:

- `infra-audit-report.json`
- `INFRA_AUDIT_CHECKLIST.md`
- Existing CI workflows
- Current Vitest / ESLint / TypeScript configs

Audit findings expected:

- Multiple Vitest configs
- Missing E2E framework
- Low unit-test coverage
- README absence
- Prettier / ESLint misalignment
- Flaky or skipped tests

---

# 3. Goals

This stage must achieve the following:

1. Consolidate test configuration safely
2. Establish a formal **Unit / Integration / E2E** test architecture
3. Prepare CI pipeline for future governance gates
4. Align ESLint and Prettier formatting rules
5. Stabilize skipped / flaky tests
6. Introduce missing repository documentation

After completion, the repository becomes **Governance Ready**.

---

# 4. Test Architecture Standardization

Zidney testing architecture must follow this hierarchy.

## 4.1 Unit Tests

Location:

packages/_/tests/unit
apps/_/tests/unit

Characteristics:

- Pure logic validation
- No database
- No network
- No Redis
- No filesystem

Goal:

At least one unit test suite per domain module.

---

## 4.2 Integration Tests

Location:

apps/\*/tests/integration

Characteristics:

- API endpoints
- Database interaction
- Worker orchestration
- Cross-module flows

Integration tests validate:

- middleware chain
- tenant resolution
- license enforcement
- attempt engine flows

---

## 4.3 E2E Tests

Each app must own its own E2E environment.

Example:

apps/mmc/tests/e2e
apps/backoffice/tests/e2e
apps/frontoffice/tests/e2e

Tool:

Playwright

E2E tests validate:

- browser navigation
- authentication flow
- UI/API interaction
- session persistence
- permission guards

---

# 5. Vitest Configuration Alignment

Current state:

Multiple Vitest configurations exist across the repository.

Goal:

Adopt a **single root Vitest configuration using projects**.

Example structure:

vitest.config.ts

```
export default defineConfig({
  test: {
    projects: [
      "./apps/*",
      "./packages/*"
    ]
  }
})
```

Per-project configuration may remain minimal.

All coverage settings must be centralized.

---

# 6. Coverage Policy Preparation

Coverage thresholds should not be enforced yet.

Instead record baseline coverage:

- Lines
- Functions
- Branches
- Statements

Future enforcement stage will introduce:

Minimum Coverage Targets

Example (future):

Lines ≥ 80%  
Branches ≥ 70%

---

# 7. ESLint + Prettier Alignment

This stage must align linting and formatting tools.

Requirements:

- ESLint uses flat config (already present)
- Prettier installed at repository root
- `eslint-config-prettier` disables conflicting rules

Formatting responsibility:

Prettier → formatting  
ESLint → code correctness

---

# 8. Flaky and Skipped Test Stabilization

Audit revealed:

- skipped tests
- flaky tests

Actions required:

1. Identify cause of flakiness
2. Convert unstable tests to deterministic form
3. If required, quarantine flaky tests temporarily
4. Remove unjustified `skip` markers

CI must run tests **without silent skipping**.

---

# 9. Repository Documentation Alignment

Each application and package must include a README.

Required sections:

Purpose  
Responsibilities  
Dependencies  
Public API (packages only)  
How to run tests  
Environment variables  
Known boundaries

Documentation improves onboarding and prevents architectural drift.

---

# 10. CI Preparation

CI pipelines must be prepared to support governance.

Future CI stages will enforce:

1. lint
2. type-check
3. unit tests
4. integration tests
5. e2e tests
6. coverage gates

This stage only ensures CI **can support this structure**.

---

# 11. Task Breakdown (Implementation Guidance)

This section provides an execution-ready task list so an implementation AI or developer can apply the alignment safely and incrementally.

Tasks must be executed **in order** unless explicitly marked as parallelizable.

---

## T001 — Consolidate Vitest Configuration

Actions:

- Introduce a single root `vitest.config.ts`
- Use Vitest **projects configuration**
- Reference apps and packages:

Example:

```
test: {
  projects: [
    "./apps/*",
    "./packages/*"
  ]
}
```

- Move coverage configuration to the root config
- Remove duplicated coverage settings from sub-configs

Output:

- One authoritative Vitest configuration
- Consistent test environment configuration

---

## T002 — Normalize Test Directory Structure

Ensure every module follows the structure:

```
tests/
  unit/
  integration/
  e2e/
```

For apps:

```
apps/<app>/tests/unit
apps/<app>/tests/integration
apps/<app>/tests/e2e
```

For packages:

```
packages/<pkg>/tests/unit
```

Move existing tests into correct folders.

---

## T003 — Introduce Playwright for UI Applications

Install Playwright.

Add configuration per UI application:

```
apps/mmc/playwright.config.ts
apps/backoffice/playwright.config.ts
apps/frontoffice/playwright.config.ts
```

Create initial smoke tests:

```
tests/e2e/app-load.spec.ts
```

Purpose:

- Ensure browser boot
- Validate routing and login pages render

---

## T004 — Align ESLint and Prettier

Actions:

- Install Prettier at repository root
- Install `eslint-config-prettier`
- Ensure ESLint does not enforce formatting rules already handled by Prettier

Add formatting scripts:

```
bun run format
bun run format:check
```

---

## T005 — Stabilize Flaky Tests

From audit report:

- Identify flaky tests
- Investigate timing issues
- Remove race conditions
- Stabilize async assertions

If stabilization is not possible immediately:

Mark as quarantined.

---

## T006 — Review Skipped Tests

Actions:

- Review every skipped test
- Either:
  - fix and re-enable
  - convert into TODO with explanation

Silent skipping is not allowed in CI.

---

## T007 — Create README Files

Add README files to:

```
apps/*
packages/*
```

Each README must include:

- Purpose
- Responsibilities
- Dependencies
- Public API (packages)
- How to run tests
- Environment variables
- Known boundaries

---

## T008 — Prepare CI Pipeline

CI must support:

1. lint
2. type-check
3. unit tests
4. integration tests
5. e2e tests

At this stage:

CI configuration should be **prepared**, but enforcement gates remain disabled.

---

# 12. Validation Checklist (Alignment Gate)

Before this stage can be marked **ALIGNMENT COMPLETE**, the following validation checks must pass.

This acts as a **hard validation gate** similar to Zidney guardian checks.

All items must be verified.

---

## V001 — Vitest Consolidation

Validation:

- Exactly **one root `vitest.config.ts`**
- Root config uses **projects configuration**
- No duplicated coverage configuration in app or package configs
- Test environments correctly defined (`node` or `jsdom`)

Result:

PASS / FAIL

---

## V002 — Test Architecture Compliance

Validation:

Each module contains correct directory structure:

```
tests/unit
tests/integration
tests/e2e (apps only)
```

Checks:

- packages contain **unit tests**
- apps contain **unit + integration**
- UI apps contain **e2e**

Result:

PASS / FAIL

---

## V003 — Playwright Installation

Validation:

- Playwright installed
- Config files present:

```
apps/mmc/playwright.config.ts
apps/backoffice/playwright.config.ts
apps/frontoffice/playwright.config.ts
```

- Smoke test present:

```
tests/e2e/app-load.spec.ts
```

Result:

PASS / FAIL

---

## V004 — ESLint + Prettier Alignment

Validation:

- `prettier` installed
- `eslint-config-prettier` installed
- ESLint flat config references Prettier
- Formatting rules not duplicated

Result:

PASS / FAIL

---

## V005 — Skipped Tests Audit

Validation:

- All skipped tests reviewed
- Each skip has documented reason OR removed
- CI does not silently ignore skipped tests

Result:

PASS / FAIL

---

## V006 — Flaky Test Stabilization

Validation:

- Flaky tests stabilized OR quarantined
- No nondeterministic timing failures
- Async tests properly awaited

Result:

PASS / FAIL

---

## V007 — README Coverage

Validation:

Each directory contains README:

```
apps/*
packages/*
```

Required sections present:

- Purpose
- Responsibilities
- Dependencies
- Public API (packages)
- How to run tests
- Environment variables
- Known boundaries

Result:

PASS / FAIL

---

## V008 — CI Capability Verification

Validation:

CI supports execution of:

- lint
- type-check
- unit tests
- integration tests
- e2e tests

Note:

Coverage enforcement **not enabled yet**.

Result:

PASS / FAIL

---

Alignment Verdict:

If **all validations PASS**:

Repository becomes **GOVERNANCE READY**

Next stage may begin:

STAGE_INFRA_GOVERNANCE

---

# 13. Completion Criteria

This stage is complete when:

- Vitest configuration consolidated
- Unit / Integration / E2E directories created
- Playwright installed for UI apps
- ESLint + Prettier aligned
- Skipped tests reviewed
- Flaky tests stabilized
- README files added to apps and packages

After these conditions are satisfied:

The repository becomes **Governance Ready**.

---

# 14. Next Stage

After this stage:

Proceed to:

STAGE_INFRA_GOVERNANCE

This stage activates enforcement:

- coverage thresholds
- CI gates
- Husky hooks
- formatting enforcement
- E2E execution in CI

---

Status after completion:

ALIGNMENT COMPLETE → READY FOR GOVERNANCE ENFORCEMENT

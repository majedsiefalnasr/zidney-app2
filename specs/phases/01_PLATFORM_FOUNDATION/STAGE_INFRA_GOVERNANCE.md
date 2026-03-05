# STAGE_INFRA_GOVERNANCE

Phase: 01_PLATFORM_FOUNDATION  
Stage Type: Infrastructure Governance  
Scope: Monorepo-wide (apps + packages + CI)

---

## Stage Status

Status: DRAFT
Step: pre_step
Risk Level: UNKNOWN
Initiated: 2026-03-05T00:00:00.000Z

Scope Open:

- Specification pending

Constitutional Compliance:

- Pending constitutional audit

Notes:
Stage initialized. Specification in progress.

---

# 1. Purpose

This stage defines the mandatory infrastructure governance model for Zidney:

- Testing Architecture (Unit / Integration / E2E separation)
- Per-App E2E Isolation Model
- Vitest Monorepo Configuration
- Playwright E2E Structure
- ESLint + Prettier Integration (Bun compatible)
- Commit Hooks (Husky + lint-staged)
- CI Enforcement Matrix
- README Governance Standard

This stage is constitutional-level.  
All future stages must comply.

---

# 1.1 Backward Compatibility & Alignment With Existing Infrastructure

Zidney already contains:

- Existing Vitest test suites
- Existing ESLint configuration
- Existing CI pipelines
- Existing coverage baselines
- Previously completed TEST stages

This stage does **NOT** invalidate prior work.

Instead, it enforces:

1. Alignment — Existing tests must be mapped to Unit / Integration / E2E classification.
2. Consolidation — Multiple Vitest configs must be unified under root projects configuration.
3. Normalization — Coverage thresholds applied globally without breaking historical baselines immediately.
4. Incremental Enforcement — No destructive rewrite of existing tests required.

---

## Alignment Rules for Existing Tests

- Existing `*.test.ts` files remain valid.
- Tests must be categorized into:
  - Unit
  - Integration
  - E2E (if browser-level)
- Legacy test paths may remain temporarily but must be migrated gradually to the standardized structure.

---

## ESLint Compatibility Rule

If ESLint configuration already exists:

- It must be preserved.
- Prettier must integrate via `eslint-config-prettier` without removing existing rules.
- No breaking rule escalation (warnings → errors) without explicit review.

---

## Migration Strategy (Non-Disruptive)

This stage must be applied using:

- Gradual Vitest consolidation (root projects config)
- Coverage threshold enforcement after baseline measurement
- E2E addition without breaking existing CI
- Husky introduction only after developer workflow validation

No mass refactor allowed unless required by structural conflict.

---

This ensures governance evolution without destabilizing completed stages.

---

# 2. Testing Architecture (Authoritative Model)

Zidney enforces strict test separation:

## 2.1 Unit Tests

Tool: Vitest  
Location:

- apps/_/src/\*\*/_.test.ts
- packages/_/src/\*\*/_.test.ts

Scope:

- Pure functions
- Domain services
- Utilities
- State stores (mocked dependencies only)

Must:

- Run in isolation
- Not require network
- Not require DB
- Have &gt;= 85% coverage threshold

---

## 2.2 Integration Tests

Tool: Vitest  
Location:

- apps/_/tests/integration/\*\*/_.test.ts

Scope:

- API routes (mock DB or test DB)
- Middleware chains
- Service orchestration
- Worker job execution (controlled environment)

Must:

- Validate real execution paths
- Assert RFC 7807 compliance
- Validate isolation boundaries

---

## 2.3 E2E Tests (Per-App Isolation Model — LOCKED)

Tool: Playwright  
Structure:

apps/mmc/tests/e2e/  
apps/backoffice/tests/e2e/  
apps/frontoffice/tests/e2e/

Rules:

- Each app owns its E2E config
- Each app has isolated Playwright config
- No global shared E2E project
- No cross-app dependency in E2E
- Authentication bootstrap must be per-app
- CI runs E2E per app matrix

This enforces architectural boundaries.

---

# 3. Vitest Monorepo Configuration

Root-level only:

- vitest.config.ts
- vitest.base.ts

Use projects configuration (workspace deprecated).

Each app extends root config.
No standalone rogue configs allowed.

Coverage thresholds (global):

- Lines: 85%
- Functions: 85%
- Statements: 85%
- Branches: 80%

Failure blocks merge.

---

# 4. Playwright Governance

Each app:

- Has its own playwright.config.ts
- Has its own test fixtures
- Uses environment-specific baseURL
- Must support headless CI execution
- Must support trace collection on failure

E2E must validate:

- Auth flow
- Critical happy path
- Critical isolation boundary
- License enforcement (if applicable)

---

# 5. Code Formatting & Linting

## 5.1 ESLint

Authoritative static analysis tool.

- @typescript-eslint required
- Vue plugin required
- No unused vars
- No implicit any
- No console.log in production builds

Lint errors block commit.

---

## 5.2 Prettier

Integrated with ESLint via eslint-config-prettier.

Goals:

- Deterministic formatting
- No stylistic ESLint conflicts
- Compatible with:
  - Vue 3 + &lt;script setup&gt;
  - Tailwind
  - TypeScript
  - Bun

Prettier rules defined at root only.

No per-app overrides allowed unless justified.

---

# 6. Commit Enforcement

Tools:

- Husky
- lint-staged

Pre-commit must run:

- eslint --fix on staged files
- prettier --write on staged files
- vitest related tests (optional lightweight mode)

Pre-push must run:

- Full lint
- Type check
- Unit tests

Push blocked on failure.

---

# 7. CI Enforcement Matrix

GitHub Actions must enforce:

1. Install (Bun)
2. Type Check
3. Lint
4. Unit Tests
5. Integration Tests
6. E2E (per app matrix)
7. Coverage validation
8. Build verification

All must pass before merge.

No bypass allowed.

---

# 8. README Governance Standard

Each:

apps/_  
packages/_

Must contain README.md including:

- Purpose
- Responsibilities
- Dependencies
- Public API (if package)
- How to run tests
- Environment variables
- Known boundaries

No undocumented app allowed.

---

# 9. Hard Mode Enforcement

This stage is Hard Mode compliant.

Rules:

- No new app without test config
- No new package without README
- No stage marked PRODUCTION_READY without E2E
- No merge with coverage below threshold
- No CI bypass

Violation = BLOCKED.

---

# 10. Success Criteria

Stage complete when:

- Root Vitest projects config implemented
- Playwright configured per app
- ESLint + Prettier conflict-free
- Husky + lint-staged active
- CI pipeline enforces full matrix
- README files present in all apps & packages

Status upon completion:
INFRASTRUCTURE LOCKED

This stage governs all future development.

# Specification: TypeScript Infrastructure Stabilization

**Feature ID:** `infra-001-typescript-stabilization`
**Phase:** `01_PLATFORM_FOUNDATION`
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_01_TYPESCRIPT_STABILIZATION.md`
**Stage Status:** DRAFT → IN PROGRESS
**Type:** Infrastructure Hardening (non-feature)
**Branch:** `infra-001-typescript-stabilization`
**Initiated:** 2026-02-27T00:00:00Z
**Spec Author:** SpecKit (speckit.specify)

---

## Feature Overview

### What Is Being Stabilized

This stage hardens the TypeScript type-safety infrastructure across the entire Zidney monorepo. It does **not** introduce new user-facing features. It resolves a baseline audit finding of 800+ pre-existing TypeScript errors accumulated during earlier feature delivery.

The work covers:

- Eliminating all implicit `any` usage
- Enforcing `"strict": true` uniformly across all packages
- Standardizing `tsconfig` inheritance so no sub-package weakens the root contract
- Aligning domain, API, worker, and test type contracts
- Adding a mandatory CI gate that blocks merges on any type error

### Phase Mapping

- Phase: `01_PLATFORM_FOUNDATION`
- This stage is a prerequisite for:
  - Promoting `STAGE_TEST_01_PLATFORM_FOUNDATION` to PRODUCTION READY
  - Enabling strict CI type gates
  - Declaring the runtime stack production-safe

### Impact on Existing Systems

| Area                | Impact                                   |
| ------------------- | ---------------------------------------- |
| Isolation           | None — no data access model changes      |
| License enforcement | None — middleware untouched              |
| Attempt engine      | None — no behavioral changes             |
| Worker              | Type contracts cleaned; no logic changes |
| Runtime             | Type contracts cleaned; no logic changes |
| Frontoffice         | Out of scope for this stage              |

---

## Constitutional Compliance Declaration

This stage reinforces — and does not weaken — the Zidney Constitution v1.2.0.

Confirmed explicitly:

| Rule                                   | Status       |
| -------------------------------------- | ------------ |
| No cross-tenant access introduced      | ✅ Confirmed |
| No middleware bypass introduced        | ✅ Confirmed |
| No grading logic moved outside worker  | ✅ Confirmed |
| No direct DB instantiation introduced  | ✅ Confirmed |
| No weakening of snapshot integrity     | ✅ Confirmed |
| No weakening of transaction boundaries | ✅ Confirmed |
| No weakening of version enforcement    | ✅ Confirmed |

This is a type-layer change only. No runtime behavior is modified. No architectural invariant is altered.

If any type fix during Pass 2 (Domain Contract Alignment) requires an interface change that affects a middleware contract or a domain boundary, an ADR must be raised before that change is merged.

---

## Purpose

The Zidney monorepo accumulated 800+ TypeScript errors during rapid feature delivery in Phase 1. Although test suites pass, the absence of strict type enforcement means:

- Runtime assumptions that are not expressed in types can silently drift
- Implicit `any` hides contract mismatches between API, domain, and worker layers
- CI cannot currently block type regressions
- The monorepo cannot be called production-safe without explicit type contracts

This stage eliminates that gap. It produces a type-clean, strictly-typed monorepo where the build is deterministic, contracts are explicit, and CI enforces correctness going forward.

**Core Philosophy Alignment:**

| Principle                                  | How This Stage Upholds It                                      |
| ------------------------------------------ | -------------------------------------------------------------- |
| Isolation over convenience                 | Explicit types enforce layer boundaries at compile time        |
| Stability over speed                       | Type errors caught at compile-time, not runtime                |
| Determinism over magic                     | Strict tsconfig produces consistent, reproducible build output |
| Explicit governance over implicit behavior | All `any` replaced with explicit contracts                     |

---

## Objectives

1. Reduce TypeScript error count to **zero** across the full monorepo
2. Enforce `"strict": true` in every package — no local weakening permitted
3. Eliminate all implicit `any` — parameters, return types, and variables
4. Remove all unsafe type assertions where a correct type is available
5. Standardize `tsconfig` inheritance: all sub-packages extend `tsconfig.base.json`
6. Enable CI hard-fail: `pnpm typecheck` must return exit code `0` or the pipeline blocks
7. Ensure test files comply with strict typing — no `any` in mocks or test helpers
8. Validate cross-package type contracts: API ↔ domain ↔ worker message contracts are type-aligned
9. Allow `// @ts-ignore` only with a documented justification comment — undocumented suppressions are forbidden

---

## Scope

### Included

| Target                | Description                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `apps/api`            | All route handlers, middleware, DB access layers, and typed request/response shapes       |
| `apps/worker`         | Job handlers, queue message types, domain service calls                                   |
| `apps/mmc`            | Vue 3 components that consume typed API contracts; TypeScript config enforcement          |
| `packages/*`          | All shared domain, validation, config, logger, redis-utils, types, and ui-system packages |
| Shared domain modules | Cross-package type contracts (DTOs, domain entities, error types)                         |
| Test files            | Unit tests, integration tests, and test helpers in `tests/` and `apps/*/tests/`           |
| Migration scripts     | Any migration files that are TypeScript-typed (or should be)                              |

### Excluded

| Target                | Reason                                                  |
| --------------------- | ------------------------------------------------------- |
| Generated files       | Auto-generated output must not be manually type-patched |
| `node_modules`        | Third-party code outside project control                |
| Temporary scaffolding | Files marked for deletion in active branches            |
| `apps/frontoffice`    | Deferred to a future frontend stabilization stage       |
| `apps/backoffice`     | Deferred to a future frontend stabilization stage       |

---

## Functional Requirements

### FR-01: Root tsconfig Strict Contract

The root `tsconfig.base.json` must declare the following compiler options as the baseline for the entire monorepo:

```
strict: true
noImplicitAny: true
strictNullChecks: true
noUnusedLocals: true
noUnusedParameters: true
noFallthroughCasesInSwitch: true
noUncheckedIndexedAccess: true
```

No sub-package `tsconfig` may override or weaken any of these settings.

**Acceptance Criterion:** Any sub-package that attempts to set `strict: false` or `noImplicitAny: false` must be rejected at code review and blocked by linting rules.

---

### FR-02: Sub-Package tsconfig Inheritance

Every sub-package in `apps/*` and `packages/*` must extend from `tsconfig.base.json`. Direct compiler option declarations that duplicate or contradict the root are forbidden.

**Acceptance Criterion:** All `tsconfig.json` files reference `tsconfig.base.json` in their `extends` field.

---

### FR-03: Zero Implicit Any

All function parameters, return types, variable declarations, and object shapes must have explicit, non-`any` types. Cases where a genuine union or unknown type is needed must use `unknown` with explicit narrowing.

**Acceptance Criterion:** `pnpm typecheck` produces no `implicit any` errors.

---

### FR-04: Zero Unsafe Type Assertions

`as AnyType` assertions that hide a real type mismatch must be replaced with proper type guards or correct declarations. The only permitted assertions are narrowing from `unknown` with validation.

**Acceptance Criterion:** No `as any` in the codebase (enforced by ESLint `@typescript-eslint/no-explicit-any` rule where applicable).

---

### FR-05: Domain Contract Alignment

API DTO types and worker message types must derive from or be structurally compatible with their corresponding domain entity types. Type drift between layers is not permitted.

**Acceptance Criterion:** No type casting required between domain return values and API response shapes; worker job payloads are typed and match the expected domain input contracts.

---

### FR-06: Strict Null Handling

All optional chaining and nullish coalescing usage must be backed by explicit null/undefined guards or proper type narrowing. Unsafe access to potentially-undefined values must be replaced with explicit checks.

**Acceptance Criterion:** No `!` non-null assertions except in cases documented with a justification comment; no access to potentially-undefined array elements without a guard.

---

### FR-07: Test File Type Compliance

All test files, including mock factories, test helpers, and fixture builders, must be strictly typed. Test-specific `any` casts that exist only to bypass TypeScript checking are forbidden.

**Acceptance Criterion:** `pnpm typecheck` runs against test files and returns zero errors.

---

### FR-08: CI Type Gate

The CI pipeline must include a mandatory `pnpm typecheck` step that runs before any merge. This step must fail the pipeline with a non-zero exit code if any TypeScript error exists.

**Acceptance Criterion:** A CI configuration entry exists for the typecheck job; no pull request can be merged if this job fails.

---

### FR-09: Documented ts-ignore Policy

Any remaining `// @ts-ignore` or `// @ts-expect-error` comment must be accompanied by an inline explanation of why the suppression is necessary and a reference to an issue or known limitation. Suppressions without documentation are forbidden.

**Acceptance Criterion:** No bare `// @ts-ignore` exists in the codebase; all suppressions include a comment of at least one sentence.

---

## User Scenarios & Testing

> Note: This is an infrastructure stage. The "users" are engineers, CI systems, and future AI agents operating in the codebase. Scenarios are framed accordingly.

### Scenario 1: Engineer Runs Type Check Locally

**Given** an engineer clones or pulls the monorepo
**When** they run `pnpm typecheck` from the repo root
**Then** the command completes with exit code `0` and zero error lines in output

### Scenario 2: CI Pipeline Blocks a Type-Unsafe Pull Request

**Given** a developer submits a PR that introduces an implicit `any` or a type mismatch
**When** CI runs the typecheck job
**Then** the job fails, the PR is blocked from merging, and the error is reported in the CI log

### Scenario 3: New Package Inherits Root Strict Contract

**Given** a developer adds a new package under `packages/`
**When** they configure the `tsconfig.json`
**Then** it must extend `tsconfig.base.json`; any attempt to weaken strict settings is rejected at review

### Scenario 4: Cross-Package Type Contract Validated

**Given** the API layer calls a domain function and passes the result to a worker message
**When** the typecheck runs
**Then** no casting is needed and type compatibility is verified at compile time

### Scenario 5: Test Mock Fails Without Explicit Types

**Given** a test mock is written without explicit type annotations
**When** the typecheck runs
**Then** the missing type annotation is reported as an error and the test file must be corrected

---

## Success Criteria

The stage is complete when all of the following are met:

| #     | Criterion                                                                                       | Verification Method                                      |
| ----- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| SC-01 | The full monorepo type check completes with zero errors                                         | `pnpm typecheck` exits with code `0`                     |
| SC-02 | Every included package compiles cleanly with no warnings elevated to errors                     | Package-level `tsc --noEmit` passes for each             |
| SC-03 | CI enforces type correctness — any future regression blocks a merge                             | CI pipeline history shows a blocking typecheck job       |
| SC-04 | No unsuppressed `@ts-ignore` exists in the codebase                                             | Automated grep in CI; suppressions require documentation |
| SC-05 | All test files compile clean under strict mode                                                  | `pnpm typecheck` covers test file paths                  |
| SC-06 | Domain, API, and worker type contracts are structurally aligned — no cross-layer casts required | Manual code review of domain call sites                  |
| SC-07 | `tsconfig` inheritance is uniform — no sub-package weakens the root contract                    | Automated config audit script or lint rule               |

---

## Migration Strategy

The cleanup is structured in five sequential passes. Each pass must be committed independently to preserve reviewability and to allow targeted rollback if a pass introduces regressions.

### Pass 1 — Remove Implicit Any

**Goal:** Eliminate all function signatures, parameters, and variables that lack explicit types.

**Activities:**

- Add explicit parameter types to all functions
- Add explicit return types to exported functions
- Replace `any` variable declarations with typed alternatives
- Define missing interfaces and type aliases for repeated shapes

**Exit Gate:** `implicit any` errors reach zero.

---

### Pass 2 — Domain Contract Alignment

**Goal:** Ensure types are consistent across the API ↔ domain ↔ worker boundary.

**Activities:**

- Audit API DTO types against domain entity types
- Verify worker job message types match domain input contracts
- Consolidate duplicate type declarations into `packages/types`
- Remove ad-hoc inline type definitions that duplicate package types

**Exit Gate:** No cross-layer casts required; type-only imports used where structural sharing is needed.

---

### Pass 3 — Strict Null Handling

**Goal:** Eliminate unsafe optional access and missing null guards.

**Activities:**

- Replace unsafe `!` non-null assertions with explicit guards
- Add `undefined` checks before array index access (`noUncheckedIndexedAccess`)
- Replace silent optional chaining on non-optional paths with explicit checks
- Ensure all promise rejections and DB query results handle the `null` case explicitly

**Exit Gate:** `strictNullChecks`-related errors reach zero.

---

### Pass 4 — Cross-Package Imports

**Goal:** Fix type-related import issues arising from inter-package dependencies.

**Activities:**

- Resolve circular type dependencies
- Replace value imports with `import type` where only types are needed
- Verify all `packages/*` export declarations are typed correctly
- Ensure no `apps/*` imports leak across the app boundary

**Exit Gate:** All inter-package imports resolve without type errors.

---

### Pass 5 — Test Strict Compliance

**Goal:** Bring all test files, mocks, and test utilities into strict compliance.

**Activities:**

- Remove `any` from test mock factories and typed stubs
- Type all `vi.fn()` / mock function return values explicitly
- Ensure test helper constructors use the same types as production code
- Validate that typed fixture builders conform to domain types

**Exit Gate:** `pnpm typecheck` run against all test directories returns zero errors; full test suite passes after all passes.

---

## Risk Management

### Risk 1: Large Refactor Surface

**Description:** The 800+ error baseline means changes touch many files across many packages. A single incorrect type fix can hide or propagate a new error.

**Likelihood:** High  
**Impact:** Medium (type-only, no runtime behavior change if done correctly)

**Mitigation:**

- Each pass is committed independently — no bulk commits spanning multiple passes
- Typecheck is run locally after every file change before committing
- Full test suite is run after each pass is complete
- Domain-by-domain cleanup order (domain packages first, then API/worker, then tests)

---

### Risk 2: Hidden Runtime Assumptions

**Description:** Some code may rely on a value being `undefined` in a way that the current non-strict types mask. Making the type explicit could reveal a genuine logic bug that was previously silent.

**Likelihood:** Medium  
**Impact:** High (could indicate a real defect, not just a type issue)

**Mitigation:**

- When a type fix reveals an apparent logic error, a separate fix issue must be opened — the type fix and logic fix must not be bundled
- Runtime smoke tests executed after each pass
- Full integration test suite run after all passes complete
- Any logic-layer finding escalated before proceeding to the next pass

---

### Risk 3: Third-Party Type Definitions

**Description:** Some dependencies may have incomplete or incorrect `@types/*` packages that produce errors even after correct local typing.

**Likelihood:** Low  
**Impact:** Low

**Mitigation:**

- Add a module declaration (`declare module`) with documented justification for any third-party package that lacks accurate types
- Pin `@types/*` versions in `package.json` to avoid future type regressions from upstream changes

---

## Assumptions

1. `pnpm` is the package manager and `pnpm typecheck` is the canonical type check command at the monorepo root.
2. The CI system supports per-job blocking on non-zero exit codes (standard behavior for GitHub Actions / equivalent).
3. `apps/frontoffice` and `apps/backoffice` are explicitly excluded from this pass; they will be addressed in a future stabilization stage.
4. Generated files (Drizzle schema output, auto-generated client types) are excluded from manual type patching. If generated types need correction, the generator configuration is updated, not the output files.
5. `// @ts-expect-error` is treated the same as `// @ts-ignore` — both require an inline documentation comment.
6. No changes to runtime behavior are permitted during this stage. If a type fix reveals a logic defect, a separate issue is opened.

---

## Isolation Impact Analysis

**This stage performs no database access.**

| Item                          | Assessment     |
| ----------------------------- | -------------- |
| Database accessed             | None           |
| Tenant resolver used          | Not applicable |
| New tables introduced         | None           |
| Cross-tenant joins introduced | None           |
| Shared tenant data risk       | None           |

Isolation guarantees are **reinforced**, not weakened, by this stage. Explicit typing makes layer boundaries between tenant-scoped and non-scoped code verifiable at compile time.

---

## License & Version Enforcement

**This stage does not modify middleware.**

| Item                           | Assessment                     |
| ------------------------------ | ------------------------------ |
| License middleware required    | Not applicable (no new routes) |
| Schema version check required  | Not applicable                 |
| Product version check required | Not applicable                 |
| Limit enforcement changed      | No                             |

No license or version enforcement logic is altered. If a type fix in Pass 2 touches a middleware interface, the fix must be reviewed against the middleware contract before merging.

---

## Layer Separation Confirmation

| Constraint                                 | Confirmed                            |
| ------------------------------------------ | ------------------------------------ |
| Frontend contains no business logic        | ✅ No UI layer changes in this stage |
| API contains no grading logic              | ✅ No grading logic changes          |
| Worker contains no HTTP logic              | ✅ No worker logic changes           |
| MMC does not access tenant DB              | ✅ Unchanged                         |
| No direct DB creation outside provisioning | ✅ Unchanged                         |

---

## Observability Requirements

No new log lines are introduced by this stage. However, as a prerequisite quality gate:

- All structured log calls in `apps/api` and `apps/worker` must have typed arguments after this stage — no `any`-typed log payloads permitted
- `packages/logger` must export a typed logging interface used uniformly across both apps

These are type-contract requirements, not behavioral changes.

---

## Test Strategy

| Test Type                 | Requirement                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Type check (compile-time) | `pnpm typecheck` must exit `0` — this is the primary test artifact                   |
| Unit tests                | Existing unit tests must pass after every pass                                       |
| Integration tests         | Existing integration tests must pass after all passes complete                       |
| Smoke tests               | Runtime smoke tests must pass after all passes complete                              |
| Regression baseline       | Error count must monotonically decrease pass-by-pass (no regressions between passes) |

No new test cases are required by this stage beyond verifying type compliance. If a pass reveals a logic defect, that defect's test is written in a separate issue.

---

## ADR References

The following ADRs govern constraints relevant to implementation decisions during this stage:

| ADR      | Title                                | Relevance                                                                                      |
| -------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| ADR-0001 | Database Per Tenant                  | Confirms isolation model; type fixes in DB access layers must preserve tenant resolver pattern |
| ADR-0004 | Single Runtime Engine                | Worker and API share a single runtime contract; type contracts must be consistent across both  |
| ADR-0007 | Product Version Compatibility        | Version compatibility checks are typed; Pass 2 must not alter these type signatures            |
| ADR-0008 | Formalize Semantic Versioning Policy | Any version-related type declarations must conform to SemVer semantics                         |

No ADR modifications are required or permitted by this stage.

---

## Constitutional Alignment Summary

| Principle             | Stage Contribution                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Determinism           | Strict `tsconfig` + CI gate produces identical, reproducible type outcomes on every build |
| Explicit contracts    | All `any` replaced with named types; domain contracts verified at compile time            |
| Isolation safety      | Type boundaries between tenant-scoped and non-scoped code become compile-time verifiable  |
| Operational integrity | Type-clean codebase reduces the surface for silent defects in production operations       |
| CI enforceability     | Hard-fail type gate added to the pipeline; future regressions blocked automatically       |

---

## Exit Conditions

This stage is complete and may be promoted when:

1. `pnpm typecheck` returns exit code `0`
2. All five migration passes are committed and reviewed
3. CI typecheck gate is active and blocking
4. No undocumented `@ts-ignore` exists in the codebase
5. All included packages compile cleanly
6. Full test suite passes
7. Manual review confirms domain ↔ API ↔ worker type alignment

Upon completion:

- `STAGE_TEST_01_PLATFORM_FOUNDATION` is updated to reflect this stage's closure
- Stage status advances from IN PROGRESS → BACKEND CLOSED
- CI strict type enforcement is locked for all future PRs

---

_Compliant with Zidney Constitution v1.2.0 — Infrastructure hardening stage. No behavioral changes introduced._

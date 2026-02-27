# Implementation Plan: TypeScript Infrastructure Stabilization

**Feature ID:** `infra-001-typescript-stabilization`
**Phase:** `01_PLATFORM_FOUNDATION`
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_01_TYPESCRIPT_STABILIZATION.md`
**Stage Status:** DRAFT → IN PROGRESS
**Type:** Infrastructure Hardening (non-feature)
**Branch:** `infra-001-typescript-stabilization`
**Planned:** 2026-02-27
**Plan Author:** SpecKit (speckit.plan)

---

## Technical Context

### Codebase State (Validated Against Actual Codebase)

| Item                     | State                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| Confirmed error count    | **866** (tsc --noEmit, root tsconfig.json)                              |
| Script name discrepancy  | Root `package.json` has `"type-check"`, not `"typecheck"` — must rename |
| noUncheckedIndexedAccess | **MISSING** from tsconfig.base.json — must be added                     |
| apps/api strict state    | `strict: false` — CRITICAL override, must be removed                    |
| domain-core implicit any | `noImplicitAny: false` — CRITICAL override, must be removed             |
| @ts-ignore in source     | Zero actual suppressions in project source                              |
| Missing tsconfigs        | `packages/redis-utils`, `packages/types` lack tsconfig.json             |
| packages/config          | No source files — skip tsconfig creation                                |

### Error Distribution Summary

| Area                   | Errors | % of Total |
| ---------------------- | ------ | ---------- |
| `tests/unit`           | 304    | 35%        |
| `tests/integration`    | 271    | 31%        |
| `apps/api`             | 120    | 14%        |
| `packages/domain-core` | 66     | 8%         |
| `tests/load`           | 27     | 3%         |
| `apps/worker`          | 25     | 3%         |
| Other (mmc, perf, etc) | ~53    | 6%         |

**Key insight:** Tests account for ~73% of errors. Production source accounts for ~27%. Fix Passes 1–4 (production) first; Pass 5 (tests) last.

### Dependencies

- `packages/domain-core` → `apps/api`, `apps/worker` — domain must be fixed first.
- `packages/types`, `packages/validation`, `packages/logger` → depended on by all apps — fix these early in Pass 1.
- `tests/*` → depends on all production types — fix last (Pass 5).

---

## Constitution Check

| Rule                                   | Assessment                                                         | Gate |
| -------------------------------------- | ------------------------------------------------------------------ | ---- |
| No cross-tenant access introduced      | ✅ No data access changes — type layer only                        | PASS |
| No middleware bypass introduced        | ✅ No middleware logic changes — type annotations only             | PASS |
| No grading logic moved outside worker  | ✅ No grading logic touched                                        | PASS |
| No direct DB instantiation introduced  | ✅ No DB access patterns changed                                   | PASS |
| No weakening of snapshot integrity     | ✅ No attempt engine code touched                                  | PASS |
| No weakening of transaction boundaries | ✅ No transaction logic changed                                    | PASS |
| No weakening of version enforcement    | ✅ No middleware contracts changed                                 | PASS |
| Import boundary maintained             | ✅ No new cross-app imports — type-only imports added where needed | PASS |
| Stage lifecycle status valid           | ✅ DRAFT → IN PROGRESS is valid transition for planning work       | PASS |

**ADR alignment:**

| ADR      | Constraint                                    | Status                                                          |
| -------- | --------------------------------------------- | --------------------------------------------------------------- |
| ADR-0001 | DB-per-tenant isolation must be preserved     | ✅ No DB access model changes — type layer is additive only     |
| ADR-0004 | API + Worker share single runtime contract    | ✅ Pass 2 aligns type contracts across layers — no logic change |
| ADR-0007 | Product version compatibility types must hold | ✅ Pass 2 must not alter version compatibility type signatures  |
| ADR-0008 | SemVer policy applies to any version types    | ✅ No version-semantic changes planned                          |

**Escalation conditions (any of these → STOP and raise ADR before continuing):**

1. Pass 2 type fix requires changing a middleware contract interface
2. Pass 2 type fix reveals logic bug in critical path (attempt engine, license enforcement, tenant resolver)
3. Any type fix requires breaking change to a package's public export
4. `noUncheckedIndexedAccess` addition triggers errors in tenant resolver or middleware — must review before fixing

**Gates: ALL PASS. Planning authorized.**

---

## Phase 0: Research

> Resolved. See `research.md` for full findings. Summary:

- Baseline confirmed at **866 errors**
- `apps/api/tsconfig.json` has `strict: false` — most critical violation
- `packages/domain-core/tsconfig.json` has `noImplicitAny: false` — second critical violation
- `packages/redis-utils` and `packages/types` are missing `tsconfig.json` files
- `tsconfig.base.json` is missing `noUncheckedIndexedAccess: true` (not in `strict` umbrella)
- Root `package.json` defines `"type-check"` not `"typecheck"` — must rename
- Zero actual `@ts-ignore` suppressions in project source
- Test files account for 73% of errors; domain-core must precede api/worker in fix order

---

## Phase 1: Design Artifacts

> Infrastructure stage. No DB tables, no new endpoints, no worker jobs.

---

### Design Decision 1: tsconfig.base.json Changes

**Target file:** `/tsconfig.base.json`

**Changes required:**

Add three missing compiler options:

```jsonc
{
  "compilerOptions": {
    // ... existing options ...
    "noImplicitAny": true, // ADD: explicit per FR-01 (implied by strict, but required explicitly)
    "strictNullChecks": true, // ADD: explicit per FR-01 (implied by strict, but required explicitly)
    "noUncheckedIndexedAccess": true, // ADD: NOT part of strict umbrella — this is a new enforcement
  },
}
```

**Execution:**

1. Add the three options to `tsconfig.base.json`
2. Run `npx tsc --noEmit 2>&1 | grep "error TS" | wc -l` immediately after — record delta from 866 baseline
3. If `noUncheckedIndexedAccess` adds > 50 new errors beyond 866, document count before starting passes
4. Do not fix errors in this commit — this commit only adds the tsconfig options

**Constraint:** No existing options may be removed, weakened, or reordered. Additions only.

**Acceptance gate:** tsconfig.base.json contains all 7 options from FR-01. Commit independently.

---

### Design Decision 2: tsconfig Inheritance Fix Strategy Per Package

**Packages with violations requiring fixes:**

| Package / App                        | Current Issue                                                                | Action                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/api/tsconfig.json`             | `strict: false`, `noUnusedLocals: false`, `noUnusedParameters: false`        | Remove all three override lines                                              |
| `apps/api/tsconfig.app.json`         | `noUnusedLocals: false`, `noUnusedParameters: false`                         | Remove both override lines                                                   |
| `packages/domain-core/tsconfig.json` | `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false` | Remove all three override lines                                              |
| `packages/ui-system/tsconfig.json`   | `noUnusedLocals: false`, `noUnusedParameters: false`                         | Remove both override lines (ui-system is a shared package with real exports) |

**Rule after fix:** A sub-package tsconfig may ONLY declare options in these categories:

- `include` / `exclude` / `files` — specifying file scope
- `compilerOptions.types` — specifying type roots
- `compilerOptions.lib` — specifying runtime library
- `compilerOptions.typeRoots` — specifying type root paths
- `compilerOptions.jsx`, `compilerOptions.target` — platform-specific overrides
- `emitDeclarationOnly`, `declaration`, `declarationDir` — build output (packages only)

Forbidden in sub-package tsconfig: any strict/null flag override.

**Execution order:** Remove overrides BEFORE starting Pass 1 — this makes errors visible for fixing.

**Commit strategy:** One commit per tsconfig fix. Do not bundle multiple tsconfig changes in one commit.

---

### Design Decision 3: tsconfig.test.json Creation (CL-01)

**Target file:** `/tsconfig.test.json`

**Content:**

```jsonc
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "types": ["node", "vitest/globals"],
  },
  "include": [
    "tests/**/*",
    "apps/*/tests/**/*",
    "**/*.test.ts",
    "**/*.spec.ts",
  ],
  "exclude": ["node_modules", "dist", "**/node_modules/**"],
}
```

**Scope:** Overrides `noUnusedLocals` and `noUnusedParameters` ONLY — these two flags generate false positives for unused `_ctx` parameters, intentional dead-parameter patterns, and fixture helpers in test code. All other strict settings remain enforced in test files (including `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`).

**Usage:** Pass 5 uses `tsconfig.test.json` as the typecheck scope. The CI gate uses two separate commands — one for source and one for tests — to ensure each is validated against the correct strict configuration (see Design Decision 7).

**Implementation approach (selected):** Two-step CI typecheck with a standalone `tsconfig.test.json`:

- Root `tsconfig.json` → updated to `exclude` test paths (`tests/**`, `**/*.test.ts`, `**/*.spec.ts`)
- `tsconfig.test.json` → extends `tsconfig.base.json`, adds `noUnusedLocals/Parameters: false`, includes test paths
- CI runs `pnpm typecheck:src` (root tsconfig, production code only) AND `pnpm typecheck:tests` (tsconfig.test.json, test code only)
- Both commands must exit 0 for the CI gate to pass

This approach is simpler than TypeScript project references, avoids `references`-graph tooling requirements, and guarantees that the CI gate is achievable — `noUnusedLocals/Parameters: true` only applies to production source, where it catches real defects. Test files are validated against all other strict settings.

**Architecture Checker resolution (2026-02-27):** The previous plan selected the simpler alternative while relying on a guarantee only the preferred approach provided. This update explicitly resolves that inconsistency by adopting the two-step CI approach.

**Acceptance gate:** `tsconfig.test.json` exists, extends `tsconfig.base.json`, only disables the two permitted options. Root `tsconfig.json` excludes test paths. `pnpm typecheck:src` and `pnpm typecheck:tests` both exit 0.

---

### Design Decision 4: Pass 1–5 Execution Strategy

**Overview:** Five sequential passes within each package; passes can run in parallel across packages. Each pass produces an independent commit. Each commit must leave the codebase at a lower error count than before.

#### Pass 1 — Remove Implicit Any

**Scope:** `apps/api/src/`, `apps/worker/src/`, `packages/domain-core/src/`, `packages/*/src/`

**Priority order (dependency graph):**

1. `packages/types`, `packages/validation`, `packages/logger`, `packages/redis-utils` — foundational, no internal dependencies
2. `packages/domain-core` — depends on types, validation, logger
3. `apps/api` — depends on domain-core
4. `apps/worker` — depends on domain-core
5. `apps/mmc` — depends on types and validation

**Activities:**

- Add explicit parameter types to all functions
- Add explicit return types to all exported functions
- Replace `any` variable declarations with typed alternatives
- Define missing interfaces and type aliases for repeated shapes
- Fix `tests/test-helpers.ts` vitest `expect` scope issue (add vitest globals type reference)

**Exit gate:** `implicit any` error count reaches zero in the in-scope files. Run `npx tsc --noEmit 2>&1 | grep "implicit" | wc -l` — must return 0.

**Commit message format:** `fix(ts): Pass 1 — remove implicit any from <package-name>`

#### Pass 2 — Domain Contract Alignment

**Scope:** API DTOs ↔ domain entities ↔ worker message contracts

**Activities:**

- Audit `apps/api` route handler return types against `packages/domain-core` function return types
- Verify `apps/worker` job payload types match `packages/domain-core` input contracts
- Consolidate duplicate type declarations into `packages/types`
- Replace ad-hoc inline types with imports from appropriate packages
- Add `import type` where only type-level imports are needed

**Parallelism:** API alignment and worker alignment can run in parallel across the two apps, since they depend on the same domain-core types.

**Escalation trigger:** If an interface must change to achieve type alignment and that interface is in middleware or crosses an ADR boundary → STOP. Open ADR. Stub with `unknown` + call-site narrowing as interim type.

**Exit gate:** No cross-layer casts required (`as SomeType` from domain return to API response). Run `npx tsc --noEmit 2>&1 | grep "packages/domain-core\|apps/api\|apps/worker" | wc -l` — must return 0.

**Commit message format:** `fix(ts): Pass 2 — domain contract alignment in <area>`

#### Pass 3 — Strict Null Handling

**Scope:** All in-scope packages and apps

**Activities:**

- Replace unsafe `!` non-null assertions with explicit guards
- Add `undefined` checks before array index access (`noUncheckedIndexedAccess` violations)
- Replace silent optional chaining on non-optional paths with explicit checks
- Ensure all DB query results handle the `null` case explicitly
- Ensure all promise rejections are typed

**Focus areas (from error distribution):**

- `apps/api/src/middleware/` (25 + 24 errors currently visible)
- `apps/worker/src/handlers/provision-workspace-handler.ts` (15 errors)

**Exit gate:** `strictNullChecks`-related and `noUncheckedIndexedAccess`-related errors reach zero.

**Commit message format:** `fix(ts): Pass 3 — strict null handling in <package-name>`

#### Pass 4 — Cross-Package Imports

**Scope:** All inter-package import declarations

**Activities:**

- Resolve circular type dependencies
- Replace value imports with `import type` where only types are needed
- Verify all `packages/*` export declarations are typed correctly
- Ensure no `apps/*` imports cross the app boundary (import boundary audit)
- Add `tsconfig.json` to `packages/redis-utils` and `packages/types`

**Exit gate:** All inter-package imports resolve without type errors. Import boundary rules confirmed.

**Commit message format:** `fix(ts): Pass 4 — cross-package import types in <package-name>`

#### Pass 5 — Test Strict Compliance

**Scope:** `tests/**/*`, `apps/*/tests/**/*`

**Activities:**

- Remove `any` from test mock factories and typed stubs
- Type all `vi.fn()` / mock function return values explicitly
- Ensure test helper constructors use the same types as production code
- Fix mmc test files (93 + 63 + 37 + 36 errors — highest priority)
- Fix integration/products test files (25 + 24 + 19 + 19 + 19 + 16 + 12 errors)
- Fix load/performance test files (27 + 11 errors)
- Use `tsconfig.test.json` for final verification

**Order (by error count, highest priority first):**

1. `tests/unit/mmc/` (229 errors)
2. `tests/integration/mmc/` (85 errors)
3. `tests/integration/products/` (114 errors)
4. `tests/unit/types/test_product_types.ts` (35 errors)
5. `tests/load/` (27 errors)
6. Remaining test files

**Exit gate:** `npx tsc --noEmit --project tsconfig.test.json` returns exit code 0 AND `npx tsc --noEmit` (root) returns exit code 0. Full test suite (`pnpm test`) passes.

**Commit message format:** `fix(ts): Pass 5 — test strict compliance in <test-area>`

---

### Design Decision 5: Vendor Stub Creation Convention (CL-03)

**Location:** `packages/types/src/vendor/`

**When to use:** If a third-party package has no `@types/*` package and ships no type declarations.

**Process:**

1. First, search npmjs.com and DefinitelyTyped for existing `@types/<package-name>` package.
2. If found: `pnpm add -D @types/<package-name>` at the appropriate workspace scope.
3. If not found: Create `packages/types/src/vendor/<library-name>.d.ts`.

**Stub template:**

```ts
// vendor-stub: <library-name>
// ts-ignore: library ships no type declarations; stub pending @types adoption [INFRA-001]
// Last reviewed: 2026-02-27
declare module '<library-name>' {
  // Add minimal declarations needed for current usage
  // Do NOT use 'any' unless absolutely unavoidable
  // Prefer 'unknown' with call-site narrowing
}
```

**Naming convention:** `packages/types/src/vendor/<npm-package-name>.d.ts`

- Scoped packages: `@scope/package` → `@scope__package.d.ts`

**Export:** The vendor directory does NOT need to export from `packages/types/src/index.ts`. It is included automatically via the `packages/types/tsconfig.json` `include` field (`src/**/*`).

**Audit trail:** The commit message for any vendor stub creation must include the package name and the npm registry confirmation of no `@types` package: `fix(ts): add vendor stub for <library-name> — no @types available [INFRA-001]`

**Current status:** No vendor stubs are currently needed (no missing `@types` packages identified in research). This convention is documented for future use during passes.

---

### Design Decision 6: ts-ignore Policy Enforcement (CL-05)

**Required comment format (FR-09, amended CL-05):**

```ts
// @ts-ignore: <reason> [<issue-ref>]
```

Example:

```ts
// @ts-ignore: library missing type declarations [INFRA-001]
```

**Important format change:** CL-05 was revised (post-clarification audit) from a two-line preceding-comment style to a single inline directive. The description is written directly on the same line as `// @ts-ignore`. This format is fully compatible with `@typescript-eslint/ban-ts-comment`'s `descriptionFormat` option, which enforces description text inline — making both the policy and the lint rule internally consistent and mutually enforcing.

**Enforcement mechanism:** `@typescript-eslint/ban-ts-comment` ESLint rule with `descriptionFormat` enforcement, run as part of `pnpm lint` in CI (see Design Decision 7 for CI gate).

**ESLint config addition:**

```json
{
  "@typescript-eslint/ban-ts-comment": [
    "error",
    {
      "ts-ignore": { "descriptionFormat": "^: .+ \\[.+\\]$" }
    }
  ]
}
```

This pattern matches `: reason text [issue-ref]` — the portion after `@ts-ignore` on the same line.

**Preferred approach:** Use ESLint `@typescript-eslint/ban-ts-comment` with the above `descriptionFormat`. This runs as part of `pnpm lint` and is executed in CI alongside typecheck (see Design Decision 7 `pnpm lint` step).

**Code review rule:** Any PR containing a bare `// @ts-ignore` without the required justification, or a `// @ts-expect-error` without justification, must be blocked at review. This is a hard gate.

**Current baseline:** Zero existing suppressions in project source. This is a forward-only enforcement rule.

---

### Design Decision 7: CI Gate

**Commands:** `pnpm typecheck:src` (production source) + `pnpm typecheck:tests` (test files)

**Prerequisite:** Rename `"type-check"` to `"typecheck:src"` and add `"typecheck:tests"` + `"typecheck"` (aggregator) in root `package.json`. This is a Day 0 task — before any pass begins.

**Root package.json change:**

```json
{
  "scripts": {
    "typecheck:src": "tsc --noEmit",
    "typecheck:tests": "tsc --noEmit -p tsconfig.test.json",
    "typecheck": "pnpm typecheck:src && pnpm typecheck:tests"
  }
}
```

**Note:** `pnpm typecheck:src` uses root `tsconfig.json` (which excludes test paths — see Design Decision 3). `pnpm typecheck:tests` uses `tsconfig.test.json` (which relaxes `noUnusedLocals`/`noUnusedParameters` for test paths only).

**CI pipeline integration (GitHub Actions pattern):**

```yaml
name: Type Check & Lint
on:
  pull_request:
    branches: ['**']
  push:
    branches: ['main', 'develop']

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: pnpm/action-setup@fe02b74ab94a2950ada7f64132bfb13ba15ae9f1 # v3.0.0
        with:
          version: '9'
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
        with:
          node-version: '22'
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Type check (source)
        run: pnpm typecheck:src
      - name: Type check (tests)
        run: pnpm typecheck:tests
      - name: Lint
        run: pnpm lint
```

**Gate behavior:**

- `typecheck:src`, `typecheck:tests`, and `pnpm lint` must all exit code 0 → pipeline continues
- Any exits non-zero → pipeline blocked; PR cannot be merged

**Scope:** `pnpm typecheck:src` covers `apps/*/src/**/*` and `packages/*/src/**/*` (all strict rules including `noUnusedLocals/Parameters`). `pnpm typecheck:tests` covers `tests/**/*`, `apps/*/tests/**/*`, and `**/*.test.ts` under relaxed unused-param rules. Together they cover all in-scope files.

**Timing:** Both typecheck CI jobs run before any merge. They are prerequisites for merge — not post-merge checks.

**Architecture Checker resolution (2026-02-27):** pnpm version pinned to `'9'` (was `latest`) to ensure deterministic CI behavior. Two-step gate adopted to resolve tsconfig.test.json scope inconsistency from the original plan.

---

### Design Decision 8: Test Suite Run Cadence (CL-02)

**Rule:** The full test suite (`pnpm test`) must be run after each pass is complete, before the next pass begins.

**Rationale:** Type fixes are supposed to be non-behavioral. A test failure after a type fix is an indicator that the fix changed behavior — this must be caught immediately, not after all passes.

**Per-pass cadence:**

| Pass | After completion                                                     |
| ---- | -------------------------------------------------------------------- |
| P1   | `pnpm typecheck` (scope: affected package) + `pnpm test`             |
| P2   | `pnpm typecheck` (scope: api + worker + domain-core) + `pnpm test`   |
| P3   | `pnpm typecheck` (full root) + `pnpm test`                           |
| P4   | `pnpm typecheck` (full root) + `pnpm test`                           |
| P5   | `pnpm typecheck` (full root) + `pnpm test` + `pnpm test:integration` |

**Regression rule:** Error count must be monotonically decreasing pass-by-pass. If a pass introduces new errors in a file that previously had zero errors, the pass must be re-scoped and the regression fixed before committing.

**Logic bug discovery protocol (CL-04):**

1. Stop the current pass
2. Open a separate issue ticket with the bug description
3. Stub the type using `unknown` narrowed at the call site as interim type
4. Document the interim stub in the code comment: `// LOGIC-BUG: <description> — see <issue-ref> — interim type until fix is merged`
5. Proceed with the type pass
6. If the bug is in critical path (attempt engine, license enforcement, tenant resolver): stop the entire stabilization stage and escalate before proceeding

---

### Design Decision 9: Domain Contract Alignment Approach (CL-02)

**Parallelism model:** Sequential within a package, parallel across packages.

**Allowed parallel streams:**

- Stream A: `packages/domain-core` + `apps/api` (sequential within stream)
- Stream B: `packages/domain-core` + `apps/worker` (sequential within stream)
- Stream C: `packages/types` + `packages/validation` + `packages/logger` + `packages/redis-utils` (independent packages, fully parallel)

Note: Both Stream A and Stream B depend on domain-core. Fix domain-core first, then api and worker can proceed in parallel.

**Contract alignment definition:**

For each domain function that returns a typed value and is called by either API or worker:

1. The domain function's return type must be explicitly declared
2. The API response type must be structurally assignable from the domain return type without casting
3. The worker job payload type must be structurally assignable from the domain input type without casting

**Duplicate type elimination rule:** If the same shape is declared in both the app layer and a package, the package declaration is canonical. The app layer must import and use the package type.

**Type-only import rule:** Any import that is only used as a type at runtime must use `import type { ... }`. This eliminates circular dependency risks from value imports and reduces bundle size.

---

### Design Decision 10: Logic Bug Isolation Rule (CL-04)

**Full protocol (non-critical path):**

1. **Discover:** During a type fix pass, a type annotation reveals an apparent logic inconsistency (e.g., a function that returns `null` in a case where the caller expects a non-null value).
2. **Stop:** Do not fix the logic in the current PR. Do not bundle behavioral changes with type changes.
3. **Document:** Add a comment at the discovery site: `// LOGIC-BUG: <description> — see <issue-ref>`
4. **Ticket:** Open a separate issue with: discovery context, affected files, risk assessment, proposed fix.
5. **Stub:** Apply an interim type stub that is safe (e.g., the existing runtime behavior expressed as a type): `unknown`, `T | null`, `string | undefined`.
6. **Continue:** Proceed with the type pass. The interim stub is acceptable as a temporary holding pattern.
7. **Resolve:** After the stabilization stage is merged, the separate issue is worked in the next sprint.

**Critical path escalation:**

If the logic bug discovery is in any of:

- Tenant resolver / DB connection management
- License middleware
- Attempt engine (snapshot, submission, grading)
- Authentication / token validation

→ **STOP the entire stabilization pass. Escalate immediately. Do not apply an interim stub in critical path code without review.**

**Definition of "critical path" for this stage:** Any code that would be entered in the ADR trust chain (Isolation → License → Authentication → Attempt → Runtime).

---

## Artifacts Summary

| Artifact                                                         | Status         | Notes                                   |
| ---------------------------------------------------------------- | -------------- | --------------------------------------- |
| `specs/runtime/infra-001-typescript-stabilization/research.md`   | ✅ Written     | Full findings documented                |
| `specs/runtime/infra-001-typescript-stabilization/plan.md`       | ✅ This file   | Phase 0 + Phase 1 complete              |
| `specs/runtime/infra-001-typescript-stabilization/contracts/`    | ⛔ Not created | Infrastructure stage — no API contracts |
| `specs/runtime/infra-001-typescript-stabilization/quickstart.md` | ⛔ Not created | Infrastructure stage — not applicable   |
| `specs/runtime/infra-001-typescript-stabilization/data-model.md` | ⛔ Not created | No new DB tables — not applicable       |

---

## Pre-Implementation Checklist (Day 0 Tasks)

Before starting Pass 1, the following must be completed in order:

- [ ] Rename `"type-check"` → `"typecheck:src"`; add `"typecheck:tests": "tsc --noEmit -p tsconfig.test.json"` and `"typecheck": "pnpm typecheck:src && pnpm typecheck:tests"` aggregator scripts to root `package.json`
- [ ] Add `noImplicitAny: true`, `strictNullChecks: true`, `noUncheckedIndexedAccess: true` to `tsconfig.base.json`
- [ ] Run `npx tsc --noEmit | grep "error TS" | wc -l` — record new baseline (expected: ≥ 866)
- [ ] Remove `strict: false`, `noUnusedLocals: false`, `noUnusedParameters: false` from `apps/api/tsconfig.json`
- [ ] Remove `noUnusedLocals: false`, `noUnusedParameters: false` from `apps/api/tsconfig.app.json`
- [ ] Remove `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false` from `packages/domain-core/tsconfig.json`
- [ ] Remove `noUnusedLocals: false`, `noUnusedParameters: false` from `packages/ui-system/tsconfig.json`
- [ ] Run `npx tsc --noEmit | grep "error TS" | wc -l` — record fully-visible baseline (this is the true starting point)
- [ ] Create `tsconfig.test.json` at repo root
- [ ] Create `packages/redis-utils/tsconfig.json` (extends `../../tsconfig.base.json`)
- [ ] Create `packages/types/tsconfig.json` (extends `../../tsconfig.base.json`)
- [ ] Commit all Day 0 changes independently with message: `chore(ts): Day 0 — enable full strict mode across monorepo [INFRA-001]`

---

## Post-Implementation Exit Gate

Stage is complete when:

| Gate                                 | Verification Command                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck` exits 0             | `pnpm typecheck; echo $?`                                                                                  |
| All packages compile cleanly         | Per-package `tsc -p tsconfig.json --noEmit`                                                                |
| CI typecheck job active and blocking | CI pipeline configuration present and green                                                                |
| No undocumented `@ts-ignore`         | `grep -r "@ts-ignore" . --include="*.ts" --exclude-dir=node_modules` — all must have justification comment |
| Test suite passes                    | `pnpm test` exits 0                                                                                        |
| Integration tests pass               | `pnpm test:integration` exits 0                                                                            |
| Stage promoted to BACKEND CLOSED     | `STAGE_INFRA_01_TYPESCRIPT_STABILIZATION.md` updated                                                       |

---

## Constraints Summary

1. **No runtime behavior changes** — every type fix must be transparent to execution
2. **No cross-tenant changes** — tenant isolation model is not modified
3. **No middleware contract changes** — if required, stop and raise ADR
4. **No circular dependencies introduced** — use `import type` to break any new cycles
5. **No logic fixes bundled** — CL-04 protocol applies; logic bugs get separate tickets
6. **No weakening of any strict option** — once overrides are removed, they stay removed
7. **Error count monotonically decreasing** — no pass can leave more errors than it found
8. **Each pass committed independently** — no bulk commits spanning multiple passes

---

_Compliant with Zidney Constitution v1.2.0 — Infrastructure hardening plan. Phase 0 and Phase 1 complete. Ready for implementation._

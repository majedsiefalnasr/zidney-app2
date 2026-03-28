# Tasks: TypeScript Infrastructure Stabilization

**Feature ID:** `infra-001-typescript-stabilization` **Phase:** `01_PLATFORM_FOUNDATION` **Stage:**
`STAGE_INFRA_01_TYPESCRIPT_STABILIZATION` **Stage Status:** IN PROGRESS **Type:** Infrastructure
Hardening (non-feature) **Inputs:** spec.md (CL-01–05), plan.md (Day 0 checklist + 5-pass strategy),
research.md (codebase state audit) **Generated:** 2026-02-27 **Total Tasks:** 90 **Baseline Error
Count:** 866 (confirmed — `apps/api` strict: false was suppressing errors; true post-Day-0 baseline
will be higher)

---

## Format

```
- [X] T001 [P] Description with exact file path
```

- `- [x]` = incomplete checkbox
- `T001` = sequential ID in execution order
- `[P]` = optional parallel marker (different files, no blocking dependency on an incomplete task)
- No user story label — this is a Setup/Foundational infrastructure stage

---

## Execution Order Summary

| Phase   | Description                          | Tasks                       | Parallelism                                                           |
| ------- | ------------------------------------ | --------------------------- | --------------------------------------------------------------------- |
| Phase 0 | Day 0: tsconfig Hardening            | T001–T011, T088, T090       | T002–T005 can run in parallel after T001; T090 must run before T011   |
| Phase 1 | Pass 1: Remove Implicit Any          | T012–T033, T089             | T012–T015 + T089 parallel; T021–T028 parallel after T020              |
| Phase 2 | Pass 2: Domain Contract Alignment    | T034–T040                   | T035–T036 parallel after T034                                         |
| Phase 3 | Pass 3: Strict Null Handling         | T041–T051                   | T041–T043 parallel; T046 parallel                                     |
| Phase 4 | Pass 4: Cross-Package Import Cleanup | T052–T063                   | T052–T058 fully parallel                                              |
| Phase 5 | Pass 5: Test File Strict Compliance  | T064–T081                   | T064–T067 parallel; T069–T070 parallel; T074–T076 parallel            |
| Phase 6 | CI Gate + Final Validation           | T082, T083, T087, T084–T086 | T082–T083 parallel; T087 inserted post-QA audit; T084–T086 sequential |

---

## Phase 0 — Day 0: tsconfig Hardening

**Purpose:** Enable full strict mode uniformly across the monorepo. Must be completed before any
pass begins.  
**Commit strategy:** One commit per tsconfig fix. Do not bundle. Message:
`chore(ts): Day 0 — enable full strict mode across monorepo [INFRA-001]`  
**Escalation rule:** If `noUncheckedIndexedAccess` addition triggers errors in tenant resolver or
middleware, stop and escalate before continuing.

> ⚠️ CRITICAL: All Phase 0 tasks must complete before Phase 1 begins. Removing strict overrides
> makes currently-suppressed errors visible — post-Day-0 baseline will exceed 866.

- [x] T001 Add `noImplicitAny: true`, `strictNullChecks: true`, and `noUncheckedIndexedAccess: true`
      to `tsconfig.base.json` compilerOptions (additions only — no existing options removed or
      reordered)
- [x] T002 Remove `strict: false` from `apps/api/tsconfig.json` compilerOptions
- [x] T003 Remove `noUnusedLocals: false` and `noUnusedParameters: false` from
      `apps/api/tsconfig.json` compilerOptions
- [x] T004 Remove `noUnusedLocals: false` and `noUnusedParameters: false` from
      `apps/api/tsconfig.app.json` compilerOptions
- [x] T005 Remove `noImplicitAny: false`, `noUnusedLocals: false`, and `noUnusedParameters: false`
      from `packages/domain-core/tsconfig.json` compilerOptions
- [x] T006 Remove `noUnusedLocals: false` and `noUnusedParameters: false` from
      `packages/ui-system/tsconfig.json` compilerOptions
- [x] T007 Create `tsconfig.test.json` at repo root extending `./tsconfig.base.json` with
      `noUnusedLocals: false`, `noUnusedParameters: false`, `types: ["node", "vitest/globals"]`, and
      `include` covering `tests/**/*`, `apps/*/tests/**/*`, `**/*.test.ts`, `**/*.spec.ts`
- [x] T008 Update root `tsconfig.json` to add `tests/**`, `**/*.test.ts`, `**/*.spec.ts`,
      `apps/*/tests/**/*` to `exclude` so production typecheck ignores test paths
- [x] T009 Create `packages/redis-utils/tsconfig.json` extending `../../tsconfig.base.json` with
      explicit `include: ["src/**/*"]` and `exclude: ["node_modules", "dist"]`
- [x] T010 Create `packages/types/tsconfig.json` extending `../../tsconfig.base.json` with explicit
      `include: ["src/**/*"]` and `exclude: ["node_modules", "dist"]`
- [x] T090 Audit all external references to the old `"type-check"` script name before renaming: run
      `grep -r '"type-check"\|type-check' . --include="*.yml" --include="*.sh" --include="*.md" --exclude-dir=node_modules`
      — for each match found in shell scripts, CI workflow files, or documentation, update the
      reference to the new name (`typecheck:src`, `typecheck:tests`, or `typecheck` as appropriate);
      complete all updates before executing T011
- [x] T011 Rename `"type-check"` script to `"typecheck:src"` in root `package.json`; add
      `"typecheck:tests": "tsc --noEmit -p tsconfig.test.json"` and
      `"typecheck": "pnpm typecheck:src && pnpm typecheck:tests"` scripts to root `package.json`
- [x] T088 Run `pnpm test` after all Day 0 tsconfig changes (T001–T011) are committed: confirm no
      test suite regressions before beginning any pass; if any tests fail, investigate and resolve
      before proceeding to Phase 1

**Day 0 Checkpoint:** Run `npx tsc --noEmit 2>&1 | grep "error TS" | wc -l` — record post-Day-0
baseline. This number (expected ≥ 866) is the true starting point for Pass 1.

---

## Phase 1 — Pass 1: Remove Implicit Any

**Purpose:** Eliminate all implicit `any` usage in production source files.  
**Priority order (dependency graph):** `packages/types` → `packages/validation` → `packages/logger`
→ `packages/redis-utils` → `packages/domain-core` → `apps/api` → `apps/worker` → `apps/mmc`  
**Exit gate per group:** Run `tsc --noEmit -p <package-tsconfig>` — must exit 0 for that package
before proceeding to the next.  
**Commit format:** `fix(ts): Pass 1 — remove implicit any from <package-name> [INFRA-001]`  
**Logic bug rule (CL-04):** If a type fix reveals a suspected logic defect, stop, open a separate
issue, stub with `unknown` narrowed at the call site, and document with
`// LOGIC-BUG: <desc> — see <issue-ref>`. Do NOT fix logic in this pass.

### Group A — Foundational Packages (independent, fully parallel)

- [x] T012 [P] Fix implicit any: add explicit parameter types, return types, and type aliases across
      `packages/types/src/` (2 errors baseline)
- [x] T013 [P] Fix implicit any: add explicit parameter types, return types, and type aliases across
      `packages/validation/src/` (3 errors baseline)
- [x] T014 [P] Fix implicit any: add explicit parameter types and return types across
      `packages/logger/src/`; ensure logger interface exports typed argument signatures
- [x] T015 [P] Fix implicit any: add explicit parameter types and return types across
      `packages/redis-utils/src/cache-client.ts` and all files in `packages/redis-utils/src/`
- [x] T089 [P] Fix implicit any in `packages/ui-system/src/`: add explicit parameter types and
      return types to all exported components and utilities (est. 3 errors; was masked by
      `noUnusedLocals: false` override removed in T006)

**Group A Checkpoint:** Run `tsc --noEmit -p packages/types/tsconfig.json`,
`tsc --noEmit -p packages/validation/tsconfig.json`,
`tsc --noEmit -p packages/logger/tsconfig.json`,
`tsc --noEmit -p packages/redis-utils/tsconfig.json` — all must exit 0 before T016.

### Group B — domain-core (depends on Group A, sequential)

- [x] T016 Fix implicit any in `packages/domain-core/src/services/invitation.service.ts`: add
      explicit parameter types, return types, and typed service interfaces (primary hotspot —
      noImplicitAny was suppressed)
- [x] T017 Fix implicit any in `packages/domain-core/src/licenses/index.ts`: define typed license
      data structure interfaces; replace untyped license data with explicit type aliases
- [x] T018 Fix implicit any in remaining `packages/domain-core/src/` files: add explicit parameter
      types and return types to all exported functions
- [x] T019 Exit gate: run `tsc --noEmit -p packages/domain-core/tsconfig.json` — must exit 0 before
      proceeding to Group C

### Group C — apps/api, apps/worker, apps/mmc (depend on domain-core; api hotspot files can run in parallel)

- [x] T020 [P] Fix implicit any in `apps/api/src/middleware/dashboard-logging.middleware.ts`: add
      explicit parameter types, typed request/response shapes, and return types (25 errors — was
      suppressed by `strict: false`)
- [x] T021 [P] Fix implicit any in `apps/api/src/middleware/dashboard-cache.middleware.ts`: add
      explicit parameter types and typed middleware context (was suppressed by `strict: false`)
- [x] T022 [P] Fix implicit any in `apps/api/src/routes/members.routes.ts`: add explicit request
      body types, response types, and route handler parameter types
- [x] T023 [P] Fix implicit any in `apps/api/src/routes/invitations.routes.ts`: add explicit request
      body types, response types, and route handler parameter types
- [x] T024 Fix implicit any in remaining `apps/api/src/` files: audit all route handlers and
      middleware for missing type annotations and add explicit types
- [x] T025 Fix implicit any in `apps/worker/src/handlers/provision-workspace-handler.ts`: define
      typed job payload interface; add explicit parameter types and return types
- [x] T026 Fix implicit any in remaining `apps/worker/src/` files: add explicit parameter types and
      return types to all job handlers and service calls
- [x] T027 Fix implicit any in `apps/mmc/src/` Vue components: add typed component props, emits, and
      composable return types (12 errors baseline)
- [x] T028 Fix `tests/test-helpers.ts` vitest `expect` scope issue: add
      `/// <reference types="vitest/globals" />` or add vitest types to `tsconfig.test.json` —
      `expect` not in scope currently
- [x] T029 Exit gate: run `tsc --noEmit -p apps/api/tsconfig.json` — must exit 0
- [x] T030 Exit gate: run `tsc --noEmit -p apps/worker/tsconfig.json` — must exit 0
- [x] T031 Exit gate: run `tsc --noEmit -p apps/mmc/tsconfig.json` — must exit 0
- [x] T032 Verify implicit any error count reaches zero: run
      `npx tsc --noEmit 2>&1 | grep "implicit" | wc -l` — must return 0
- [x] T033 Run full test suite: `pnpm test` — must pass with zero failures before starting Pass 2

---

## Phase 2 — Pass 2: Domain Contract Alignment

**Purpose:** Ensure type contracts are structurally aligned across the API ↔ domain ↔ worker
boundary. No cross-layer casts permitted.  
**Escalation rule:** If aligning an interface requires changing a middleware contract — STOP. Open
an ADR before continuing. Stub the type as `unknown` narrowed at the call site.  
**Commit format:** `fix(ts): Pass 2 — domain contract alignment in <area> [INFRA-001]`

- [x] T034 Audit `packages/domain-core` entity and service return types against `apps/api` DTO
      types: map each domain function call site in the API layer and verify structural assignability
      without casting
- [x] T035 [P] Align `apps/api` route handler return types to `packages/domain-core` function return
      types: remove all `as SomeDomainType` casts from API response construction in
      `apps/api/src/routes/`
- [x] T036 [P] Align `apps/worker` job payload types to `packages/domain-core` input contracts:
      ensure all worker job message interfaces are structurally assignable from domain input types
      without casting in `apps/worker/src/handlers/`
- [x] T037 Consolidate duplicate type declarations: move shared shapes declared inline in
      `apps/api/src/` or `apps/worker/src/` into `packages/types/src/` and replace with imports
- [x] T038 Verify error response types conform to the canonical API error schema
      `{ success: boolean; data: T | null; error: { code: string; message: string } | null }` across
      all `apps/api/src/` middleware and route error handlers — ensure no handler returns a
      non-standard shape (e.g., no `correlationId` embedded inside the `error` object;
      `correlationId` belongs in response headers or a separate envelope field per AGENTS.md).
      **CL-04 protocol applies:** if audit reveals a handler currently emitting `correlationId`
      inside the `error` object — not just in the type declaration but in the actual runtime
      response construction — this is a behavioral deviation; stop, open a separate ticket, stub the
      non-conforming field as `unknown` in the type shape, and do NOT change the runtime response
      structure in this stage
- [x] T039 Exit gate: run
      `npx tsc --noEmit 2>&1 | grep "packages/domain-core\|apps/api\|apps/worker" | wc -l` — must
      return 0
- [x] T040 Run full test suite: `pnpm test` — must pass with zero failures before starting Pass 3

---

## Phase 3 — Pass 3: Strict Null Handling

**Purpose:** Eliminate unsafe null/undefined access patterns enabled by `strictNullChecks` and
`noUncheckedIndexedAccess`.  
**Focus areas:** `apps/api/src/middleware/` (hotspot — 25+ errors),
`apps/worker/src/handlers/provision-workspace-handler.ts` (15 errors).  
**Commit format:** `fix(ts): Pass 3 — strict null handling in <package-name> [INFRA-001]`

- [x] T041 [P] Remove unsafe `!` non-null assertions in `apps/api/src/middleware/` files: replace
      each `x!` with an explicit null guard (`if (!x) { throw/return/handle }`) or proper narrowing
      — no behavioral change
- [x] T042 [P] Remove unsafe `!` non-null assertions in
      `apps/worker/src/handlers/provision-workspace-handler.ts`: replace with explicit guards; if an
      assertion hides a real null case, apply CL-04 protocol
- [x] T043 [P] Remove unsafe `!` non-null assertions across `packages/domain-core/src/` files:
      replace with explicit null checks or proper type narrowing
- [x] T044 Fix `noUncheckedIndexedAccess` violations in `apps/api/src/`: add explicit `undefined`
      guards before all array index access patterns (e.g., `arr[0]` →
      `const item = arr[0]; if (!item) { ... }`)
- [x] T045 Fix `noUncheckedIndexedAccess` violations in `apps/worker/src/`: add explicit `undefined`
      guards before all array index access patterns
- [x] T046 [P] Fix `noUncheckedIndexedAccess` violations in `packages/domain-core/src/`: add
      explicit `undefined` guards before all array index access patterns
- [x] T047 Fix unsafe optional chaining patterns in `apps/api/src/`: replace optional chains on
      non-optional paths with explicit property access; add guards where values may truly be
      undefined
- [x] T048 Fix unsafe optional chaining patterns in `apps/worker/src/`: replace optional chains on
      non-optional paths with explicit guards
- [x] T049 Ensure all DB query results handle the `null` case explicitly in `apps/api/src/`: DB
      queries that can return `null` must have explicit null handling before the result is used
- [x] T050 Exit gate: run `pnpm typecheck:src` — `strictNullChecks`-related and
      `noUncheckedIndexedAccess`-related errors must reach 0
- [x] T051 Run full test suite: `pnpm test` — must pass with zero failures before starting Pass 4

---

## Phase 4 — Pass 4: Cross-Package Import Cleanup

**Purpose:** Replace value imports with `import type` where only types are used; confirm import
boundary rules; resolve circular type dependencies.  
**Commit format:** `fix(ts): Pass 4 — cross-package import types in <package-name> [INFRA-001]`

- [x] T052 [P] Replace value imports with `import type` in `packages/types/src/` wherever imported
      symbols are only used as types at runtime
- [x] T053 [P] Replace value imports with `import type` in `packages/validation/src/` wherever
      imported symbols are only used as types at runtime
- [x] T054 [P] Replace value imports with `import type` in `packages/logger/src/` wherever imported
      symbols are only used as types at runtime
- [x] T055 [P] Replace value imports with `import type` in `packages/redis-utils/src/` wherever
      imported symbols are only used as types at runtime
- [x] T056 [P] Replace value imports with `import type` in `packages/domain-core/src/` wherever
      imported symbols are only used as types at runtime
- [x] T057 [P] Replace value imports with `import type` in `apps/api/src/` wherever imported symbols
      are only used as types at runtime
- [x] T058 [P] Replace value imports with `import type` in `apps/worker/src/` wherever imported
      symbols are only used as types at runtime
- [x] T059 Audit all inter-package import declarations for circular type dependencies and resolve
      any cycles found (prefer `import type` to break cycles without changing runtime behavior)
- [x] T060 Confirm import boundary compliance per `AGENTS.md`: verify no `apps/*` imports reference
      another `apps/*`; verify no `packages/*` imports reference `apps/*`; audit `apps/api/src/`,
      `apps/worker/src/`, `apps/mmc/src/` for any violations
- [x] T061 Verify all `packages/*/src/index.ts` export declarations are fully typed: every
      re-exported symbol must have an explicit type; no implicit `any` in barrel exports
- [x] T062 Exit gate: run `pnpm typecheck:src` — all inter-package imports must resolve without type
      errors; exit code must be 0
- [x] T063 Run full test suite: `pnpm test` — must pass with zero failures before starting Pass 5

---

## Phase 5 — Pass 5: Test File Strict Compliance

**Purpose:** Bring all test files, mock factories, helpers, and fixture builders into strict
compliance using `tsconfig.test.json`.  
**Note:** `noUnusedLocals` and `noUnusedParameters` are relaxed in test scope per CL-01. All other
strict settings (including `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) are
enforced.  
**Order:** Highest error count first — `tests/unit/mmc/` (229 errors) →
`tests/integration/products/` (114 errors) → `tests/integration/mmc/` (85 errors) →
`tests/unit/types/` (35 errors) → `tests/load/` (27 errors) → remaining.  
**Commit format:** `fix(ts): Pass 5 — test strict compliance in <test-area> [INFRA-001]`

- [x] T064 [P] Fix type errors in `tests/unit/mmc/invitation.service.test.ts` (93 errors): add
      explicit types to all mock factories, `vi.fn()` return values, and typed stubs for invitation
      service dependencies
- [x] T065 [P] Fix type errors in `tests/unit/mmc/auth.service.test.ts` (63 errors): add explicit
      types to all mock factories, typed stubs for auth service dependencies, and typed fixture
      constructors
- [x] T066 [P] Fix type errors in `tests/unit/mmc/member.service.test.ts` (37 errors): add explicit
      types to all mock factories and typed stubs
- [x] T067 [P] Fix type errors in `tests/unit/mmc/role.service.test.ts` (36 errors): add explicit
      types to all mock factories and typed stubs
- [x] T068 Fix type errors in `tests/unit/types/test_product_types.ts` (35 errors): align product
      type assertions and type guards with the canonical types in `packages/types/src/`
- [x] T069 [P] Fix type errors in `tests/integration/mmc/members.test.ts` (35 errors): add explicit
      types to request/response fixtures, typed mock helpers, and assertion shapes
- [x] T070 [P] Fix type errors in `tests/integration/mmc/invitations.test.ts` (31 errors): add
      explicit types to request/response fixtures and typed mock helpers
- [x] T071 Fix type errors in `tests/integration/products/test_delete.ts` (25 errors): add explicit
      typed request/response shapes and typed assertion helpers
- [x] T072 Fix type errors in remaining `tests/integration/products/` test files: add explicit typed
      fixtures and assertion helpers to align with `packages/domain-core` and `packages/types`
      domain types
- [x] T073 Fix type errors in `tests/load/` (27 errors): add explicit types to load test fixture
      builders and performance measurement helpers in `tests/load/products/test_performance.ts` and
      related files
- [x] T074 [P] Fix type errors in `tests/performance/` (12 errors): add explicit types to license
      benchmark test helpers and measurement types in `tests/performance/`
- [x] T075 [P] Fix type errors in `tests/contract/` (5 errors): add explicit typed request/response
      contract shapes to all contract test files in `tests/contract/`
- [x] T076 [P] Fix type errors in `tests/smoke/` (4 errors): add explicit types to smoke test
      request helpers and assertion utilities in `tests/smoke/`
- [x] T077 Audit and fix all `vi.fn()` mock function declarations across `tests/unit/`,
      `tests/integration/`, `apps/mmc/tests/`, and `apps/worker/tests/` to have explicit typed
      return values (e.g., `vi.fn<ReturnType, ArgsType[]>()` or
      `vi.fn().mockReturnValue(typedValue)`)
- [x] T078 Ensure typed fixture builders in `tests/fixtures/` conform to domain types in
      `packages/domain-core` and `packages/types`: replace any `as any` fixture casts with proper
      typed construction
- [x] T079 Fix any remaining type errors in `apps/mmc/tests/` and `apps/worker/tests/` not covered
      by earlier passes
- [x] T080 Exit gate: run `tsc --noEmit -p tsconfig.test.json` — must exit code 0 (all test files
      must pass under `tsconfig.test.json`)
- [x] T081 Run full test suite and integration tests: `pnpm test && pnpm test:integration` — both
      must pass with zero failures

---

## Phase 6 — CI Gate + Final Validation

**Purpose:** Lock in type correctness as a mandatory CI gate; confirm the full monorepo is
zero-error.  
**Exit condition:** All gates listed below must pass before the stage can be promoted to BACKEND
CLOSED.

- [x] T082 [P] Create `.github/workflows/typecheck.yml`: workflow must include a top-level `on:`
      trigger block (`pull_request: branches: ['**']` and `push: branches: ['main', 'develop']`);
      use SHA-pinned Actions — `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2),
      `pnpm/action-setup@fe02b74ab94a2950ada7f64132bfb13ba15ae9f1` (v3.0.0),
      `actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af` (v4.1.0) — mutable tag aliases
      (`@v4`, `@v3`) are forbidden (supply chain risk); use `pnpm/action-setup@v3` config
      `version: '9'`; include three steps — `pnpm typecheck:src`, `pnpm typecheck:tests`, and
      `pnpm lint` — all three must exit 0 for the job to pass (see plan.md Design Decision 7 for the
      full YAML template including SHA-pinned references)
- [x] T083 [P] Add `@typescript-eslint/ban-ts-comment` ESLint rule to the root ESLint config with
      options `{ "ts-ignore": { "descriptionFormat": "^: .+ \\[.+\\]$" } }` to enforce the
      **inline** format `// @ts-ignore: <reason> [<issue-ref>]` — the description must appear on the
      same line as the directive (not on a preceding line); this is the canonical CL-05 format after
      amendment (see spec.md CL-05 and plan.md Design Decision 6)
- [x] T087 Create a CI-executable tsconfig inheritance audit script at
      `scripts/validate/check-tsconfig-strict.sh`: the script must `grep` all `tsconfig.json` and
      `tsconfig.app.json` files in `apps/` and `packages/` for any occurrence of `"strict": false`,
      `"noImplicitAny": false`, `"strictNullChecks": false`, or `"noUncheckedIndexedAccess": false`;
      the script exits non-zero (and prints the violating file + line) if any such weakening
      override is found; add a `pnpm check:tsconfig` script entry in root `package.json` that runs
      this script; this implements SC-07 automated tsconfig conformance audit
- [x] T084 Final validation: run `pnpm typecheck` (aggregator — runs `typecheck:src` then
      `typecheck:tests`) — must exit 0 with zero error lines across the full monorepo
- [x] T085 Final validation: run `pnpm test` — full test suite must pass; run
      `pnpm test:integration` — integration tests must pass; confirm exit code 0 on both
- [x] T086 Promote stage: update
      `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_01_TYPESCRIPT_STABILIZATION.md` status from
      `IN PROGRESS` → `BACKEND CLOSED`; update `STAGE_TEST_01_PLATFORM_FOUNDATION` to reflect this
      stage's closure

---

## Task Count Summary

| Phase     | Description                          | Tasks  | Parallel Tasks |
| --------- | ------------------------------------ | ------ | -------------- |
| Phase 0   | Day 0: tsconfig Hardening            | 13     | 0              |
| Phase 1   | Pass 1: Remove Implicit Any          | 23     | 9              |
| Phase 2   | Pass 2: Domain Contract Alignment    | 7      | 2              |
| Phase 3   | Pass 3: Strict Null Handling         | 11     | 4              |
| Phase 4   | Pass 4: Cross-Package Import Cleanup | 12     | 7              |
| Phase 5   | Pass 5: Test File Strict Compliance  | 18     | 7              |
| Phase 6   | CI Gate + Final Validation           | 6      | 2              |
| **Total** | —                                    | **90** | **31**         |

---

## Dependency Graph

```
Phase 0 (Day 0)
  └── Phase 1, Group A [T012–T015 parallel]
        └── Phase 1, Group B [T016–T019 sequential]
              └── Phase 1, Group C [T020–T028, api/worker/mmc parallel within group]
                    └── Phase 2 [T035–T036 parallel after T034]
                          └── Phase 3 [T041–T043 parallel; T046 parallel]
                                └── Phase 4 [T052–T058 fully parallel]
                                      └── Phase 5 [T064–T067 parallel; T069–T070 parallel; T074–T076 parallel]
                                            └── Phase 6 [T082–T083 parallel; T084–T086 sequential]
```

---

## Parallel Execution Examples

### Phase 0 → Phase 1 Group A (fastest start path)

After T001 (tsconfig.base.json), T002–T006 (override removals) can execute in any order — each is a
single-file edit. Schedule T007–T011 (test config + script changes) in parallel with T002–T006 since
they touch different files.

### Phase 1 Group A — Four packages in parallel

```
Stream A: T012 — packages/types/src/
Stream B: T013 — packages/validation/src/
Stream C: T014 — packages/logger/src/
Stream D: T015 — packages/redis-utils/src/
```

All four streams converge before T016 (domain-core begins).

### Phase 1 Group C — API hotspot files in parallel

After T019 (domain-core exit gate), four API hotspot files can be fixed in parallel (T020–T023).
Worker (T025–T026) and MMC (T027) can proceed in parallel with API fixes since they touch different
apps.

### Phase 4 — All `import type` replacements in parallel

T052–T058 touch different packages. All seven can be executed concurrently. Converge at T059
(circular dependency audit).

### Phase 5 — Highest-error test files in parallel

T064–T067 (four mmc unit test files) can run in parallel — they are in the same directory but
independent files. T069–T070 (two mmc integration test files) can run in parallel. T074–T076
(performance, contract, smoke) can run in parallel.

---

## Implementation Strategy

### MVP Scope

Phase 0 + Phase 1 together constitute the minimum viable deliverable: `strict: false` is removed
from all packages, implicit any is eliminated from production source, and the error count in
production code reaches zero. This is the prerequisite for all downstream work.

### Incremental Delivery Order

1. **Phase 0** alone is a valid, reviewable commit set — tsconfig changes with zero code changes.
2. **Phase 1** per package is independently reviewable (`packages/types`, `packages/validation`,
   etc. each as a separate commit).
3. **Phase 2** can be reviewed as a single aligned-contracts commit after Phase 1 is merged.
4. **Phases 3–4** can each be reviewed as a single commit per package.
5. **Phase 5** test fixes are the highest-volume work; review in batches by test directory.
6. **Phase 6** CI gate is the final lock-in — merge only after all prior phases are green.

### Regression Rule

Error count must be monotonically decreasing pass-by-pass. If a commit introduces new errors in a
file that previously had zero errors, the commit must be re-scoped before merging. Each pass exit
gate must be verified locally before pushing.

---

## Post-Implementation Exit Gate

| Gate                                 | Verification                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `pnpm typecheck` exits 0             | `pnpm typecheck; echo $?` → must print `0`                                   |
| All packages compile cleanly         | Per-package `tsc -p tsconfig.json --noEmit` passes for each included package |
| CI typecheck job active and blocking | `.github/workflows/typecheck.yml` exists; both steps pass                    |
| No undocumented `@ts-ignore`         | ESLint `ban-ts-comment` rule passes (`pnpm lint`)                            |
| Test suite passes                    | `pnpm test` exits 0                                                          |
| Integration tests pass               | `pnpm test:integration` exits 0                                              |
| Stage promoted to BACKEND CLOSED     | `STAGE_INFRA_01_TYPESCRIPT_STABILIZATION.md` updated                         |

---

_Compliant with Zidney Constitution v1.2.0 — Infrastructure hardening tasks. No behavioral changes.
No ADR modifications._

# Research: TypeScript Infrastructure Stabilization

**Feature ID:** `infra-001-typescript-stabilization` **Generated:** 2026-02-27 **Status:** COMPLETE
— all NEEDS CLARIFICATION resolved

---

## Research Objective

Audit the current TypeScript configuration state across the monorepo, enumerate actual error counts
per package/area, and resolve all clarifications required before planning can proceed.

---

## Finding 1: Actual TypeScript Error Count

**Question resolved:** What is the actual baseline error count (estimated 800+ in spec)?

**Findings:**

Running `npx tsc --noEmit` from the repo root against `tsconfig.json` (which includes
`apps/*/src/**/*`, `packages/*/src/**/*`, `tests/**/*`):

**Total confirmed errors: 866**

Per-area breakdown:

| Area                   | Error Count | Notes                                         |
| ---------------------- | ----------- | --------------------------------------------- |
| `tests/unit`           | 304         | Heaviest — mmc test files dominate            |
| `tests/integration`    | 271         | mmc and products integration tests            |
| `apps/api`             | 120         | Middleware files are hotspots                 |
| `packages/domain-core` | 66          | Invitation service + licenses index           |
| `tests/load`           | 27          | Performance/load test fixtures                |
| `apps/worker`          | 25          | provision-workspace-handler.ts dominates      |
| `tests/performance`    | 12          | License benchmark test                        |
| `apps/mmc`             | 12          | Vue component type errors                     |
| `tests/contract`       | 5           | Contract test type mismatches                 |
| `tests/smoke`          | 4           | Smoke test type issues                        |
| `packages/validation`  | 3           | Minor issues                                  |
| `packages/ui-system`   | 3           | Minor issues                                  |
| `packages/types`       | 2           | Minor issues                                  |
| `tests/` (root)        | ~9          | test-helpers.ts — `expect` not found in scope |

**Top 10 files by error count:**

| File                                                      | Errors |
| --------------------------------------------------------- | ------ |
| `tests/unit/mmc/invitation.service.test.ts`               | 93     |
| `tests/unit/mmc/auth.service.test.ts`                     | 63     |
| `tests/unit/mmc/member.service.test.ts`                   | 37     |
| `tests/unit/mmc/role.service.test.ts`                     | 36     |
| `tests/unit/types/test_product_types.ts`                  | 35     |
| `tests/integration/mmc/members.test.ts`                   | 35     |
| `tests/integration/mmc/invitations.test.ts`               | 31     |
| `tests/load/products/test_performance.ts`                 | 27     |
| `tests/integration/products/test_delete.ts`               | 25     |
| `apps/api/src/middleware/dashboard-logging.middleware.ts` | 25     |

**Decision:** Error baseline is confirmed at 866. Test files account for ~635 errors (~73% of
total). Production source files account for ~231 errors (~27%). This confirms the priority ordering:
fix production source first (Passes 1–4), test files last (Pass 5).

**Rationale:** Test file errors are heavily concentrated in mmc unit/integration tests and are
driven by mock type mismatches — these are easier to fix systematically once production types are
stabilized. Fixing production code first prevents cascading re-fixes in tests.

---

## Finding 2: tsconfig Inheritance — Current State

**Question resolved:** Which packages have `strict: false`, `noImplicitAny: false`, or are missing
`extends` to `tsconfig.base.json`?

### Packages with `extends` correctly pointing to tsconfig.base.json

| Package / App                        | extends field              | Status           |
| ------------------------------------ | -------------------------- | ---------------- |
| `apps/api/tsconfig.json`             | `../../tsconfig.base.json` | ✅ (but weakens) |
| `apps/worker/tsconfig.json`          | `../../tsconfig.base.json` | ✅ clean         |
| `apps/mmc/tsconfig.json`             | `../../tsconfig.base.json` | ✅ clean         |
| `packages/domain-core/tsconfig.json` | `../../tsconfig.base.json` | ✅ (but weakens) |
| `packages/validation/tsconfig.json`  | `../../tsconfig.base.json` | ✅ clean         |
| `packages/logger/tsconfig.json`      | `../../tsconfig.base.json` | ✅ clean         |
| `packages/ui-system/tsconfig.json`   | `../../tsconfig.base.json` | ✅ (weakens)     |

### Packages MISSING tsconfig.json entirely

| Package                | Has src?   | Notes                                          |
| ---------------------- | ---------- | ---------------------------------------------- |
| `packages/config`      | No (empty) | Only has package.json — may be JS config       |
| `packages/redis-utils` | Yes        | Has `src/` and `cache-client.ts` — no tsconfig |
| `packages/types`       | Yes        | Has `src/` — no tsconfig                       |

These three packages are included transitively in the root `tsconfig.json` via `packages/*/src/**/*`
glob. They currently rely on root tsconfig settings with no local override. This is partially
acceptable but means they have no explicit `include`/`exclude` scope and no local typecheck support.

**Decision:** For `packages/redis-utils` and `packages/types`, create a minimal `tsconfig.json` that
extends `tsconfig.base.json` and explicitly declares `include`/`exclude`. For `packages/config` (no
source), skip tsconfig creation.

**Rationale:** Explicit tsconfigs allow package-local typecheck runs
(`tsc -p packages/foo/tsconfig.json`), are required for IDE tooling, and make the inheritance chain
auditable. Relying on glob pickup from root is fragile.

### Packages with strict-weakening overrides

| File                                 | Weakened Options                                                             | Severity |
| ------------------------------------ | ---------------------------------------------------------------------------- | -------- |
| `apps/api/tsconfig.json`             | `strict: false`, `noUnusedLocals: false`, `noUnusedParameters: false`        | CRITICAL |
| `apps/api/tsconfig.app.json`         | `noUnusedLocals: false`, `noUnusedParameters: false`                         | HIGH     |
| `packages/domain-core/tsconfig.json` | `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false` | CRITICAL |
| `packages/ui-system/tsconfig.json`   | `noUnusedLocals: false`, `noUnusedParameters: false`                         | MEDIUM   |

**Decision:** Remove all weakening overrides. After removal, the 866 errors will become visible
(many are currently suppressed by `strict: false` in `apps/api` and `noImplicitAny: false` in
`packages/domain-core`). Fix errors in Pass 1–5 order; do not re-weaken.

**Rationale:** Some of the 866 errors may currently be invisible because `apps/api` has
`strict: false` — meaning the actual post-override error count may be higher. The plan must account
for this: enable strict first, count errors, then fix.

---

## Finding 3: tsconfig.base.json — Current State vs Spec Requirements

**Question resolved:** Does the current root `tsconfig.base.json` meet the FR-01 requirements?

Current `tsconfig.base.json` compilerOptions audit:

| Option                             | Required by FR-01 | Currently Set                         | Gap            |
| ---------------------------------- | ----------------- | ------------------------------------- | -------------- |
| `strict: true`                     | ✅ Required       | ✅ Present                            | None           |
| `noImplicitAny: true`              | ✅ Required       | ⚠️ Not explicit (implied by `strict`) | Add explicitly |
| `strictNullChecks: true`           | ✅ Required       | ⚠️ Not explicit (implied by `strict`) | Add explicitly |
| `noUnusedLocals: true`             | ✅ Required       | ✅ Present                            | None           |
| `noUnusedParameters: true`         | ✅ Required       | ✅ Present                            | None           |
| `noFallthroughCasesInSwitch: true` | ✅ Required       | ✅ Present                            | None           |
| `noUncheckedIndexedAccess: true`   | ✅ Required       | ❌ Missing                            | **Must add**   |

**Decision:** Add `noImplicitAny: true`, `strictNullChecks: true`, and
`noUncheckedIndexedAccess: true` explicitly to `tsconfig.base.json`.

- `noImplicitAny` and `strictNullChecks` are technically redundant with `strict: true` but are
  required explicitly per FR-01 for auditability.
- `noUncheckedIndexedAccess` is **not** a sub-flag of `strict` and must be added separately. This
  will add array-index safety errors that do not currently appear.

**Risk note:** Adding `noUncheckedIndexedAccess: true` may introduce additional errors beyond the
current 866. The plan must account for this — run typecheck after adding this flag specifically and
record the delta before starting passes.

---

## Finding 4: pnpm typecheck Script — Discrepancy

**Question resolved:** Is the `pnpm typecheck` script available at the monorepo root?

**Finding:** The root `package.json` defines `"type-check"` (hyphenated), not `"typecheck"`. There
is no `typecheck` alias.

The spec (FR-08, SC-01, scenarios) and stage file all reference `pnpm typecheck` as the canonical
command.

**Decision:** Rename the root script from `"type-check"` to `"typecheck"` in `package.json`. This is
a non-behavioral change (shell command alias only) that aligns the codebase with the spec contract.

**Alternatives considered:**

- Add `"typecheck"` as an alias alongside `"type-check"` — rejected because having two names for the
  same command creates confusion.
- Keep `"type-check"` and update spec — rejected because the spec is the authority.

**Rationale:** The canonical command must match what CI, ADRs, and spec documents reference. Script
rename is zero-risk and is a prerequisite for any CI configuration.

---

## Finding 5: @ts-ignore Usage in Project Source

**Question resolved:** Are there existing undocumented @ts-ignore suppressions in project source
code?

**Finding:** The only file containing `@ts-ignore` or `@ts-expect-error` in project source
(excluding `node_modules`) is:

- `tests/performance/mmc-dashboard/quality-gates.test.ts`

Upon inspection, this file contains the string `// No bare @ts-ignore directives allowed` as a
**test description** — not an actual suppression directive.

**Decision:** Zero actual @ts-ignore suppressions currently exist in project source. The CL-05
format enforcement mechanism is a preventive gate, not a remediation task for existing violations.

**Rationale:** This is a favorable baseline. The `@ts-ignore` policy (CL-05) needs to be implemented
as a CI grep check and code review rule, but no backlog of existing undocumented suppressions
exists.

---

## Finding 6: Implicit any Hotspots

**Question resolved:** Where are the primary implicit any hotspots?

Based on error distribution and the `strict: false` override in `apps/api`:

| Hotspot                                                   | Estimated Category       | Root Cause                                |
| --------------------------------------------------------- | ------------------------ | ----------------------------------------- |
| `apps/api/src/middleware/dashboard-logging.middleware.ts` | Implicit any + null      | `strict: false` was suppressing errors    |
| `apps/api/src/middleware/dashboard-cache.middleware.ts`   | Implicit any + null      | `strict: false` was suppressing errors    |
| `apps/api/src/routes/members.routes.ts`                   | Implicit any             | Missing request/response type annotations |
| `apps/api/src/routes/invitations.routes.ts`               | Implicit any             | Missing request/response type annotations |
| `apps/worker/src/handlers/provision-workspace-handler.ts` | Implicit any             | Missing typed job payload                 |
| `packages/domain-core/src/services/invitation.service.ts` | noImplicitAny suppressed | `noImplicitAny: false` was hiding errors  |
| `packages/domain-core/src/licenses/index.ts`              | Implicit any             | Untyped license data structures           |
| `tests/test-helpers.ts`                                   | Missing type import      | `expect` not in scope (vitest globals)    |

**Decision:** Implicit any is the single largest error category, driven primarily by the
`strict: false` override in `apps/api` and `noImplicitAny: false` in `packages/domain-core`.
Removing these overrides and fixing the resulting errors is Pass 1's primary objective. The domain
core must be fixed before API/worker because API and worker depend on domain types.

---

## Finding 7: tsconfig.base.json "9 options" Discrepancy

**Question resolved:** The stage file says "9 strict compiler options" but FR-01 and the tsconfig
block list 7. What are the 9?

**Finding:** The "9" referenced in the stage scope description appears to include all
strict-relevant compiler options in context (including the pre-existing
`noFallthroughCasesInSwitch`, `skipLibCheck`, etc.). FR-01 and STAGE_INFRA_01 tsconfig block are the
authoritative source — they list 7 options:

1. `strict: true`
2. `noImplicitAny: true`
3. `strictNullChecks: true`
4. `noUnusedLocals: true`
5. `noUnusedParameters: true`
6. `noFallthroughCasesInSwitch: true`
7. `noUncheckedIndexedAccess: true`

**Decision:** Implement exactly the 7 options specified in FR-01. The "9" in the stage scope
description is a minor inconsistency; FR-01 is the authoritative specification.

---

## Dependency Considerations

### TypeScript Version

The root `package.json` pins `"typescript": "latest"`. For a stability-critical infrastructure
stage, this is a risk.

**Decision:** Note as a follow-up hardening item. During this stage, do not change the TypeScript
version. Document the pin as a future hardening task. If a TypeScript upgrade causes additional
errors during the passes, escalate before continuing.

### @types/pg

Already present in root `devDependencies` as `"@types/pg": "^8.16.0"`.

### Other @types packages

No missing `@types` packages have been identified as root causes of the current 866 errors. The
errors are in project code, not third-party type declarations.

---

## Summary of Decisions

| Decision ID | Decision                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| RD-01       | Confirm baseline at 866 errors; fix production code first, tests last                                       |
| RD-02       | Remove all strict-weakening overrides from apps/api and packages/domain-core first                          |
| RD-03       | Add tsconfig.json to packages/redis-utils and packages/types                                                |
| RD-04       | Add `noUncheckedIndexedAccess: true` and explicit `noImplicitAny`, `strictNullChecks` to tsconfig.base.json |
| RD-05       | Rename root script from `type-check` to `typecheck`                                                         |
| RD-06       | No existing @ts-ignore violations to remediate; implement CL-05 as forward gate                             |
| RD-07       | domain-core must be fixed before api/worker (dependency ordering)                                           |
| RD-08       | Test file errors are 73% of total; defer to Pass 5                                                          |
| RD-09       | Implement 7 options from FR-01 (not 9 — stage scope text is an inconsistency)                               |
| RD-10       | After adding noUncheckedIndexedAccess, recount errors before starting Passes                                |

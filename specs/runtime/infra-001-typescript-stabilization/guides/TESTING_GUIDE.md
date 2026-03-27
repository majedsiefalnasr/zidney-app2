# Testing Guide — STAGE_INFRA_01_TYPESCRIPT_STABILIZATION

**Stage:** STAGE_INFRA_01_TYPESCRIPT_STABILIZATION **Phase:** 01_PLATFORM_FOUNDATION **Stage
Directory:** infra-001-typescript-stabilization **Generated On:** 2026-02-28

---

## Purpose

This guide explains how to validate that the TypeScript stabilization implementation is correct and
that no regressions have been introduced. The stage made **no runtime changes** — it is type-system
enforcement only. Validation is therefore primarily static (typecheck, lint, tsconfig audit) plus
unit test confirmation.

---

## Summary of Delivered Behavior

This stage enforced TypeScript strict mode across the entire Zidney monorepo. Before this stage, the
codebase had 866 source-level TypeScript errors and ~700 test-file errors. After this stage, both
counts are zero. A CI gate prevents any future regression.

Key outcomes:

- `bun run typecheck:src` passes with 0 errors on every PR
- `bun run typecheck:tests` passes with 0 errors on every PR
- `bun run lint` passes with 0 errors (ban-ts-comment format enforced)
- `bash scripts/validate/check-tsconfig-strict.sh` confirms all 7 strict flags are present and no package is
  weakening them
- All 152 `@ts-ignore` comments carry a `[INFRA-001-LOGIC-XX]` reference traceable to a follow-up
  ticket

---

## Prerequisites

| Requirement                  | Validation Command                                      |
| ---------------------------- | ------------------------------------------------------- |
| Bun installed                | `bun --version` (v1+)                                   |
| Node.js installed            | `node --version` (v20+)                                 |
| Correct branch checked out   | `git branch` shows `infra-001-typescript-stabilization` |
| Dependencies installed       | `bun install`                                           |
| No local uncommitted changes | `git status` clean                                      |

---

## Files in Scope

```text
apps/api/src/           — type fixes in routes, middleware, utils, db, modules
apps/worker/src/        — type fixes in handlers, workers, services
packages/domain-core/   — type fixes in services, queries (6 query files reformatted)
packages/validation/    — regex escape fixes in password.validator.ts
packages/types/         — no changes (type source)
tests/                  — all test files brought to 0 TS errors
tests/shims/            — added bullmq.d.ts, uuid.d.ts, vue.d.ts
.eslintrc.json          — ban-ts-comment upgraded to error level
package.json            — check:tsconfig script added
.github/workflows/      — typecheck.yml CI gate added
scripts/validate/check-tsconfig-strict.sh — tsconfig audit script
```

---

## Local Run Commands

```bash
# From repo root
cd /path/to/zidney-app2

# Install dependencies
bun install

# Run all static checks (the primary validation for this stage)
bun run typecheck:src
bun run typecheck:tests
bun run lint
bash scripts/validate/check-tsconfig-strict.sh
```

---

## Automated Validation Commands

Run these in order. All must exit with code 0.

```bash
# 1. TypeScript source check
bun run typecheck:src
# Expected: 0 errors

# 2. TypeScript test file check
bun run typecheck:tests
# Expected: 0 errors

# 3. Full aggregated typecheck
bun run typecheck
# Expected: exits 0 (runs both above)

# 4. Lint (no errors allowed, warnings OK)
bun run lint
# Expected: 0 errors, some warnings

# 5. tsconfig strict audit
bash scripts/validate/check-tsconfig-strict.sh
# Expected: PASS — all 7 flags present, no weakening overrides found

# 6. Unit tests (should still pass)
bun run test:unit
# Expected: 416 passed, 21 skipped (or better)

# 7. Static tests
bun run test:static
# Expected: 3 passed
```

---

## Manual Test Scenarios

### Scenario 1 — Introduce a deliberate TypeScript error

**Purpose:** Confirm that the CI gate blocks regressions.

1. Open any file in `apps/api/src/` — e.g. `apps/api/src/routes/health.ts`
2. Add a deliberately wrong type: change a typed parameter to accept `any` without annotation (e.g.
   `function foo(x) { return x; }`)
3. Run `bun run typecheck:src`

Expected: TypeScript reports a new error with the exact file and line number. Exit code is non-zero.

Troubleshooting: If no error is reported, check that `tsconfig.base.json` still contains
`"noImplicitAny": true` and that the app's `tsconfig.json` extends `tsconfig.base.json`.

---

### Scenario 2 — Introduce a non-compliant `@ts-ignore`

**Purpose:** Confirm that the ESLint rule blocks bare suppress comments.

1. Open any source file and add:
   ```ts
   // @ts-ignore
   const x = badCall();
   ```
2. Run `bun run lint`

Expected: ESLint reports: `Do not use "@ts-ignore" because it alters compilation errors.` with an
indication that a description matching `^: .+ \[.+\]$` is required. Exit code is non-zero.

Troubleshooting: If the error is not raised, check `.eslintrc.json` — the
`@typescript-eslint/ban-ts-comment` rule must be at `"error"` level with
`"ts-ignore": { "descriptionFormat": "^: .+ \\[.+\\]$" }`.

---

### Scenario 3 — Weaken a tsconfig strict flag (Edge Case)

**Purpose:** Confirm the tsconfig audit script catches any regression.

1. Open `packages/domain-core/tsconfig.json` (or any package tsconfig).
2. Add `"strict": false` inside `compilerOptions`.
3. Run `bash scripts/validate/check-tsconfig-strict.sh`

Expected: Script prints a warning/error about a weakening override found in that file and exits with
code 1.

Troubleshooting: If exit code is 0, check `scripts/validate/check-tsconfig-strict.sh` — Phase 2 of the script
must scan for `"strict": false`, `"noImplicitAny": false`, etc. across all package tsconfigs.

Undo:

```bash
git checkout packages/domain-core/tsconfig.json
```

---

## Negative Cases

| Scenario                    | Trigger                                            | Expected Response                                       |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| Implicit any in source      | Add untyped parameter                              | `bun run typecheck:src` exits non-zero                  |
| Bare `@ts-ignore`           | Add without description                            | `bun run lint` exits non-zero with ban-ts-comment error |
| tsconfig weakening override | Add `"strict": false` to a package                 | `check-tsconfig-strict.sh` exits 1                      |
| Missing strict flag in base | Remove `"noImplicitAny"` from `tsconfig.base.json` | `check-tsconfig-strict.sh` exits 1                      |

---

## Multi-Tenant Isolation Verification

This stage introduces no runtime code changes. No multi-tenant test is required. If verifying in
staging, confirm that existing workspace-scoped endpoints still return isolated data:

1. Authenticate as a user in `workspace-a`.
2. Call any tenant-scoped endpoint (e.g. `/api/members`).
3. Authenticate as a user in `workspace-b`.
4. Call the same endpoint.
5. Expected: responses contain only data for the respective workspace.

---

## Structured Log Verification

No changes were made to logging configuration. The standard log format remains unchanged.

```bash
# Start API in development mode and pipe to jq
bun run dev:api 2>&1 | jq .
```

Confirm logs include:

- `"level"`
- `"workspace_slug"` on tenant-bound requests
- `"correlation_id"`

---

## Database Verification

No schema changes were introduced. No database verification is required for this stage.

---

## CI Gate Verification

After merging or pushing to a tracked branch, confirm that the GitHub Actions workflow runs:

1. Navigate to the repository → **Actions** tab.
2. Find the run triggered by the push/PR.
3. Confirm all three steps pass:
   - `Type-check source files` → ✅
   - `Type-check test files` → ✅
   - `Lint` → ✅

---

## Sign-Off Checklist

- [ ] `bun run typecheck:src` → 0 errors
- [ ] `bun run typecheck:tests` → 0 errors
- [ ] `bun run lint` → 0 errors
- [ ] `bash scripts/validate/check-tsconfig-strict.sh` → PASS
- [ ] `bun run test:unit` → all pass
- [ ] Deliberate-error scenario confirms CI gate blocks regression
- [ ] Bare `@ts-ignore` scenario confirms ESLint blocks non-compliant suppression
- [ ] tsconfig weakening scenario confirms audit script catches override
- [ ] No `console.log` or stack traces exposed at runtime

---

## References

- `specs/runtime/infra-001-typescript-stabilization/reports/IMPLEMENT_REPORT.md`
- `specs/runtime/infra-001-typescript-stabilization/reports/PLAN_REPORT.md`
- `specs/runtime/infra-001-typescript-stabilization/audits/VALIDATION_REPORT.md`
- `specs/runtime/infra-001-typescript-stabilization/audits/ANALYZE_REPORT.md`
- `.github/workflows/typecheck.yml`
- `scripts/validate/check-tsconfig-strict.sh`

---

Generated by Zidney Orchestrator Hard Mode v1.2.0.

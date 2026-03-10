# Research: Lint Governance — Current State Analysis

**Stage:** STAGE_INFRA_05_LINT_GOVERNANCE  
**Phase:** 01_PLATFORM_FOUNDATION  
**Feature:** `infra-005-lint-governance`  
**Researched:** 2026-03-07  
**Status:** COMPLETE — all NEEDS CLARIFICATION resolved

---

## 1. Executive Summary

The platform is approximately 80% of the way to full lint governance. The major infrastructure
(`biome.json`, `lint-staged.config.mjs`, `scripts/ai-guard.ts`, Husky hooks) is already in place and
operational. The remaining gaps are:

1. One Biome rule severity correction (`noUnreachable` must be promoted from `warn` to `error`).
2. The CI pipeline (`ci.yml`) does not gate non-main-branch pushes through AI-Guard — only the
   separate `architecture-governance.yml` workflow does, and it only triggers on `main`/`develop`.
3. The pre-commit hook has a stale comment referencing ESLint/Prettier rather than Biome.
4. The CI `ci.yml` lint job runs both `bun biome check .` and `bun biome format .` redundantly
   (format checking is already included in `check`).
5. The canonical CI command referenced in the spec as `bun run type-check` does not match the actual
   script name `bun run typecheck`.

No new packages or scripts are required. All installation prerequisites (`@biomejs/biome`, `husky`,
`lint-staged`) are present and correctly versioned.

---

## 2. `biome.json` — Current State

**File:** `biome.json` (repository root)  
**Schema:** `https://biomejs.dev/schemas/2.4.6/schema.json`

### 2.1 Formatter

| Setting          | Value    |
| ---------------- | -------- |
| `indentStyle`    | `space`  |
| `indentWidth`    | `2`      |
| `lineWidth`      | `100`    |
| `quoteStyle`     | single   |
| `semicolons`     | asNeeded |
| `trailingCommas` | es5      |

✅ These match standard Zidney conventions. No changes required.

### 2.2 Linter Rules — Current Severity Mapping

| Rule                        | Category    | Current Level | Spec FR-01 Requirement | Status |
| --------------------------- | ----------- | ------------- | ---------------------- | ------ |
| `noUnusedImports`           | correctness | `error`       | `error`                | ✅ OK  |
| `noUnreachable`             | correctness | **`warn`**    | **`error`**            | ❌ GAP |
| `noPrecisionLoss`           | correctness | `warn`        | `warn` (keep)          | ✅ OK  |
| `noDebugger`                | suspicious  | `error`       | `error`                | ✅ OK  |
| `noConsole`                 | suspicious  | `error`       | `error`                | ✅ OK  |
| `noImplicitAnyLet`          | suspicious  | `warn`        | `warn` (keep)          | ✅ OK  |
| `useIterableCallbackReturn` | suspicious  | `warn`        | `warn` (keep)          | ✅ OK  |
| `noAssignInExpressions`     | suspicious  | `warn`        | not specified          | ✅ OK  |
| `noExportsInTest`           | suspicious  | `warn`        | not specified          | ✅ OK  |
| `useConst`                  | style       | `error`       | `error`                | ✅ OK  |
| `noVueDuplicateKeys`        | correctness | `warn`        | not specified          | ✅ OK  |

**Single required change:** `noUnreachable` must be promoted from `warn` to `error`.

### 2.3 Import Organizer

The `assist.actions.source.organizeImports` is set to `"on"`. This activates Biome's import
organizer globally.

Biome's organizer automatically applies its canonical group order:

1. Node.js built-ins (`node:*`)
2. External packages
3. Internal monorepo packages (including `@zidney/*`)
4. App-local and relative imports

This satisfies FR-02. The grouping is applied automatically by `bun biome check --write` and
`bun run lint:fix`. No additional configuration is needed.

**Decision:** Biome's default import organizer grouping is sufficient. No custom import group
configuration exists in the schema version in use. The canonical 5-group order defined in FR-02 is
enforced by Biome's built-in heuristic.

### 2.4 Overrides — Preserved Exemptions

| Override Scope                                         | Exemption                                       |
| ------------------------------------------------------ | ----------------------------------------------- |
| `packages/logger/**/*.ts`                              | `noConsole: off`                                |
| `apps/worker/src/observability/structured-logger.ts`   | `noConsole: off`                                |
| `packages/domain-core/src/logging/master-db-logger.ts` | `noConsole: off`                                |
| `packages/domain-core/src/migration/**`                | `noConsole: off`                                |
| `apps/api/src/db/master/migrations/**`                 | `noConsole: off`                                |
| `apps/api/src/db/tenant/migrations/**`                 | `noConsole: off`                                |
| `scripts/**`                                           | `noConsole: off`                                |
| `tests/**`, `**/*.test.ts`, `**/*.spec.ts`             | `noConsole: off`                                |
| `**/*.vue`                                             | `noUnusedImports: warn` (downgraded from error) |

All overrides are intentional and preserved as-is per Assumption 6 from the spec.

---

## 3. `lint-staged.config.mjs` — Current State

**File:** `lint-staged.config.mjs` (repository root)

```js
export default {
  "*.{ts,tsx,js,jsx,mjs,vue,json}": ["bun biome check --write"],
};
```

**Assessment:** This EXACTLY matches the FR-04 requirement. The pattern covers all
JavaScript/TypeScript/Vue/JSON staged files. The `--write` flag enables auto-fix for formatting and
safe lint fixes. The `bun` invocation is correct.

**Decision:** No change required. lint-staged configuration is already compliant with FR-04.

**Note:** The planning task description also mentioned `cjs` extension coverage. This extension is
absent from both the current config and spec FR-04. Since `cjs` files are not present in this
monorepo (which uses ESM exclusively via Bun), this is a non-issue.

---

## 4. Husky Pre-Commit Hook — Current State

**File:** `.husky/pre-commit`

```sh
#!/bin/sh

# ── Staged-file quality gates (lint-staged) ────────────────────────────────
# Runs ESLint --fix + Prettier --write on staged .ts/.tsx/.vue/.md/.json files.
# Commit is blocked if any lint error remains after auto-fix.
bunx lint-staged

# ── AI Architecture Guard (hard gate) ──────────────────────────────────────
# Checks ARCHITECTURE_CONTRACT.json for layer violations, dependency rule
# violations, circular dependencies, and architecture drift.
# Non-zero exit = commit blocked.
bun scripts/ai-guard.ts

# ── Infrastructure Audit — Quick Mode (hard gate) ──────────────────────────
# Runs structural governance checks (excludes slow file writes).
# Non-zero exit = commit blocked.
bun scripts/infra-audit.ts --quick
```

**Assessment:**

| Hook Step                            | Status                                                |
| ------------------------------------ | ----------------------------------------------------- |
| `bunx lint-staged`                   | ✅ Correct and active                                 |
| `bun scripts/ai-guard.ts`            | ✅ Correct and active                                 |
| `bun scripts/infra-audit.ts --quick` | ✅ Additional gate (beyond spec minimum — acceptable) |
| Comment line 3 (ESLint/Prettier)     | ❌ **STALE** — references removed tools               |

**AI-Guard is already active as a pre-commit gate.** No script activation is required.

**Single required change:** Update the stale comment on line 4 from "Runs ESLint --fix + Prettier
--write" to reference Biome.

---

## 5. Husky Pre-Push Hook — Current State

**File:** `.husky/pre-push`

```sh
#!/bin/sh
# ...advisory-only unit tests...
# NOTE: bun run lint and bun run typecheck are deferred until the pre-existing
# baseline errors (12 lint errors + 2 TS2306 errors on develop, pre-infra-governance)
# are resolved in a subsequent stage.
```

**Assessment:** The pre-push hook is currently advisory-only (runs unit tests informationally; does
not block push). This matches spec FR-08 requirements exactly. The hook's comment indicates
lint/typecheck were intentionally deferred — this is the condition being resolved by this INFRA-05
stage.

**Decision:** After INFRA-05 baseline lint errors are resolved, the pre-push hook SHOULD be updated
to include `bun run lint && bun run typecheck` as informational gates. However, FR-08 states the
hook must remain non-blocking. This is a follow-up documentation note, not a hard requirement of
this stage.

---

## 6. `scripts/ai-guard.ts` — Current State

**File:** `scripts/ai-guard.ts` (full implementation reviewed)

### 6.1 Implemented Checks

| Check                         | Function                                               | Status         |
| ----------------------------- | ------------------------------------------------------ | -------------- |
| Cross-app imports             | `validateCrossAppImports()`                            | ✅ Implemented |
| Package-to-app imports        | `validateRules()` via ARCHITECTURE_CONTRACT            | ✅ Implemented |
| Architecture map compliance   | `validateArchitectureMap()`                            | ✅ Implemented |
| Forbidden dependency contract | `validateRules()`                                      | ✅ Implemented |
| Relative path leaks           | `validateRelativeLeaks()`                              | ✅ Implemented |
| Branch naming (spec work)     | `validateBranchNaming()`                               | ✅ Implemented |
| Brain-enriched analysis       | `loadArchitectureBrain()` + `getModuleDepsFromBrain()` | ✅ Implemented |

### 6.2 File Targeting

AI-Guard reads staged files via `git diff --cached --name-only` and filters for `.ts`, `.tsx`,
`.vue` extensions. This is the correct scope for pre-commit validation.

### 6.3 Fallback Mode

If `docs/ai/context/ai-architecture-brain.json` is absent, AI-Guard falls back to reading
`ARCHITECTURE_CONTRACT.json` directly. Brain-enriched analysis uses the module dependency graph from
`infra-audit.ts`. This satisfies FR-06.

### 6.4 Exit Codes

- Exit 0: All checks pass (or no staged files detected).
- Exit 1: Architecture violations found. Prints each violation with file and rule.

### 6.5 Conclusion

**AI-Guard requires no code changes.** It is fully implemented and already active in the pre-commit
hook. The only requirement in this stage is documentation and CI integration verification.

---

## 7. CI Workflows — Current State

### 7.1 `ci.yml` — Jobs Analysis

**Trigger:** Push to `main`, `infra-*`, `feature/*`, `fix/*` | PR to `main`, `develop`

| Job                 | Commands                                               | Passes AI-Guard? |
| ------------------- | ------------------------------------------------------ | ---------------- |
| `lint`              | `bun biome check .` + `bun biome format .` (redundant) | ❌ No            |
| `typecheck`         | `bun run typecheck:src` + `bun run typecheck:tests`    | ❌ No            |
| `unit-tests`        | `bun run test:unit` (needs lint + typecheck)           | ❌ No            |
| `integration-tests` | Full integration suite (needs unit-tests)              | ❌ No            |

**Gaps in `ci.yml`:**

1. `bun scripts/ai-guard.ts` is **not present** as a CI step in `ci.yml`.
2. `bun biome check .` already includes format checking; running `bun biome format .` separately is
   redundant.
3. The lint job should call `bun run lint` (the script alias) rather than direct Biome invocation
   for consistency.

### 7.2 `architecture-governance.yml` — Jobs Analysis

**Trigger:** PR to `main`, `develop` | Push to `main`, `develop`

| Step                         | Command                            |
| ---------------------------- | ---------------------------------- |
| Verify AI Bootstrap Exists   | `[ -f docs/ai/AI_BOOTSTRAP.md ]`   |
| Run Zidney AI Guard          | `bun scripts/ai-guard.ts`          |
| Run Infrastructure Audit     | `bun scripts/infra-audit.ts --ci`  |
| Run Architecture Diff        | `bun scripts/architecture-diff.ts` |
| Publish Architecture Summary | Publishes to GITHUB_STEP_SUMMARY   |

**Assessment:** AI-Guard IS run as a CI step in `architecture-governance.yml`, but only for
PRs/pushes targeting `main` and `develop`. It is NOT run for pushes to `infra-*` or `feature/*`
branches.

**Critical Gap:** A developer pushing to a `feature/` or `infra-*` branch gets lint + typecheck
gates via `ci.yml` but NOT the AI-Guard gate. The governance pipeline is not uniform across all
branch types.

**Decision:** Add AI-Guard to `ci.yml` as a dedicated job that runs after the `lint` and `typecheck`
jobs. This ensures all branch types — including feature and infra branches — receive the AI-Guard
gate in CI.

### 7.3 `hard-mode-guard.yml`

Validates Hard Mode workflow state for `spec/*` branches. This is infra tooling for the SpecKit
pipeline itself. No changes required or relevant to this stage.

---

## 8. `package.json` Scripts — Current State

| Script Name       | Command                                                         | Status    |
| ----------------- | --------------------------------------------------------------- | --------- |
| `lint`            | `bun biome check .`                                             | ✅ Exists |
| `lint:fix`        | `bun biome check --write .`                                     | ✅ Exists |
| `format`          | `bun biome format --write .`                                    | ✅ Exists |
| `format:check`    | `bun biome format .`                                            | ✅ Exists |
| `typecheck`       | `bun typecheck:src && bun typecheck:tests`                      | ✅ Exists |
| `typecheck:src`   | `tsc --noEmit`                                                  | ✅ Exists |
| `typecheck:tests` | `tsc --noEmit -p tsconfig.test.json`                            | ✅ Exists |
| `arch:audit`      | `bun scripts/infra-audit.ts`                                    | ✅ Exists |
| `arch:generate`   | `bun scripts/architecture/generate-architecture-map.ts`         | ✅ Exists |
| `arch:add-module` | `bun scripts/architecture/add-module.ts`                        | ✅ Exists |
| `arch:context`    | `bun scripts/gitnexus-context.ts`                               | ✅ Exists |
| `arch:refresh`    | `bun scripts/infra-audit.ts && bun scripts/gitnexus-context.ts` | ✅ Exists |
| `arch:fix`        | `bun scripts/infra-audit.ts --fix-map`                          | ✅ Exists |

**Important naming discrepancy:** The spec and planning brief reference `bun run type-check`
(hyphenated). The actual script name is `bun run typecheck` (no hyphen). All spec documentation must
reference `bun run typecheck` as the canonical command.

**No new scripts are required** for this stage. All scripts are present and correctly implemented.

---

## 9. Architecture Intelligence Files — Current State

| File                                                        | Status    |
| ----------------------------------------------------------- | --------- |
| `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` | ✅ Exists |
| `docs/architecture/intelligence/ARCHITECTURE_MAP.json`      | ✅ Exists |
| `docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json`  | ✅ Exists |

**ARCHITECTURE_MAP.json** contains:

- All top-level modules (`packages/*`, `apps/*`) mapped with `layer`, `criticality`, and
  `forbidden_dependencies`.
- `criticality: "core"` on `packages/domain-core`, `packages/types`, `packages/validation`.
- `criticality: "infrastructure"` on `packages/logger`, `packages/config`, `packages/redis-utils`,
  `packages/api-client`.

The `criticality` field in `ARCHITECTURE_MAP.json` already provides the machine-readable marker
required by FR-07.

---

## 10. Gap Analysis Summary

| Area                     | Gap Description                                                            | Severity | Required Change       |
| ------------------------ | -------------------------------------------------------------------------- | -------- | --------------------- |
| `biome.json`             | `noUnreachable` is `warn` but should be `error`                            | High     | Change 1 rule         |
| `.husky/pre-commit`      | Stale comment references ESLint/Prettier instead of Biome                  | Low      | Update comment        |
| `ci.yml`                 | AI-Guard gate missing — not present as a CI job                            | High     | Add arch-guard job    |
| `ci.yml`                 | Lint job runs `bun biome format .` redundantly after `bun biome check .`   | Low      | Remove redundant step |
| Spec documentation       | References `bun run type-check` (hyphen) but script is `bun run typecheck` | Low      | Spec accuracy note    |
| `lint-staged.config.mjs` | None — matches FR-04 exactly                                               | —        | No change             |
| `scripts/ai-guard.ts`    | None — fully implemented and active                                        | —        | No change             |
| `package.json` scripts   | None — all required scripts exist                                          | —        | No change             |
| `ARCHITECTURE_MAP.json`  | None — criticality field already present                                   | —        | No change             |

---

## 11. Decisions and Rationale

| Decision                                                                 | Rationale                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `noUnreachable` → `error`                                                | Spec FR-01 explicitly requires this. Unreachable code always signals logic errors (dead branches, incorrect return paths). The `warn` level was appropriate during initial Biome adoption but is now incorrect for a hardened governance layer. |
| No changes to `lint-staged.config.mjs`                                   | The config already matches FR-04 exactly. Adding `cjs` is unnecessary since the monorepo uses ESM only.                                                                                                                                         |
| AI-Guard added to `ci.yml` (not solely in `architecture-governance.yml`) | Feature and infra branches do not trigger `architecture-governance.yml`. Placing AI-Guard in `ci.yml` creates a uniform gate for all branches, closing the governance gap.                                                                      |
| Remove redundant `bun biome format .` step from `ci.yml` lint job        | `bun biome check .` already enforces formatting. The separate `format` step adds confusion and doubles the scan time without value.                                                                                                             |
| No new `ai:guard` script added to package.json                           | `bun scripts/ai-guard.ts` is the direct invocation documented in the spec and used in CI. Adding a script alias would be redundant.                                                                                                             |
| Pre-push hook remains advisory-only                                      | Spec FR-08 explicitly requires the pre-push hook to be non-blocking. The CI gates provide the enforcement path.                                                                                                                                 |

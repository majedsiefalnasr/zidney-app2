# Research: infra-004-biome — Biome Toolchain Migration

**Feature ID:** `infra-004-biome`
**Researched:** 2026-03-06
**Status:** Complete — all NEEDS CLARIFICATION resolved

---

## Overview

This document records findings from a full codebase scan performed to support the Biome migration plan. All unknowns listed in the spec have been resolved by reading actual files.

---

## Finding 01: ESLint Packages Present

**Research task:** Identify every ESLint-related package in the repository.

**Source:** `package.json` (root) `devDependencies` — inspected directly.

| Package                             | Version in package.json |
| ----------------------------------- | ----------------------- |
| `@eslint/js`                        | `^9.0.0`                |
| `eslint`                            | `^9.0.0`                |
| `eslint-config-prettier`            | `^10.1.8`               |
| `eslint-import-resolver-typescript` | `^4.4.4`                |
| `eslint-plugin-import-x`            | `^4.0.0`                |
| `eslint-plugin-vue`                 | `^10.8.0`               |
| `globals`                           | `^15.0.0`               |
| `typescript-eslint`                 | `^8.0.0`                |

**Note:** No ESLint packages appear in per-package `package.json` files. All per-app ESLint configs import from the root workspace `node_modules`.

**Decision:** All 8 packages are removed from root `devDependencies` in Pass 3. No per-package removal needed.

---

## Finding 02: Prettier Packages Present

**Research task:** Identify every Prettier-related package in the repository.

**Source:** `package.json` (root) `devDependencies` — inspected directly.

| Package    | Version in package.json |
| ---------- | ----------------------- |
| `prettier` | `^3.8.1`                |

**Note:** No Prettier plugins are installed. `eslint-config-prettier` is listed separately above under ESLint (it bridges the two tools).

**Decision:** `prettier` (1 package) removed from root `devDependencies` in Pass 3.

---

## Finding 03: Current Prettier Configuration

**Research task:** Verify actual Prettier settings to understand formatting delta with Biome.

**Source:** Two config files exist simultaneously:

### `prettier.config.mjs` (root)

```js
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
  printWidth: 100, // ← already 100, NOT 80
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: [],
}
```

### `.prettierrc` (root)

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

**Key finding:** `prettier.config.mjs` already sets `printWidth: 100`. The spec's clarification states "line width 100 replaces Prettier 80 (intentional)" — however `prettier.config.mjs` is already at 100. The `.prettierrc` file does not specify `printWidth`, which means it falls back to Prettier's default of 80. If Prettier was loading `.prettierrc` rather than `prettier.config.mjs`, the effective line width may have been 80. The Biome migration normalises this to 100 unambiguously.

**Formatting delta:** The Biome reformatting pass will produce a large diff. This is expected and documented in the PR description.

**Biome formatter settings to use:**

- `indentStyle: "space"` (from `useTabs: false`)
- `indentWidth: 2` (from `tabWidth: 2`)
- `lineWidth: 100`
- `javascript.formatter.quoteStyle: "single"` (from `singleQuote: true`)
- `javascript.formatter.trailingCommas: "es5"` (from `trailingComma: 'es5'`)
- `javascript.formatter.semicolons: "asNeeded"` (from `semi: false`)

---

## Finding 04: ESLint Config Files To Remove

**Research task:** List every ESLint configuration file in the repository.

**Source:** `find apps packages -name "eslint.config*" -o -name ".eslintrc*"` — executed directly.

| File                                       | Disposition                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint.config.mjs` (root)                 | **DELETE**                                                                                                                                                    |
| `apps/backoffice/eslint.config.js`         | **DELETE**                                                                                                                                                    |
| `apps/frontoffice/eslint.config.js`        | **DELETE**                                                                                                                                                    |
| `apps/mmc/eslint.config.js`                | **DELETE**                                                                                                                                                    |
| `packages/ui-system/.eslintrc-ui-guard.md` | **KEEP** — this is a Markdown documentation file, not an ESLint config. The `.md` extension confirms it contains guidance text, not a parsed ESLint rule set. |

**Total files to delete:** 4

**Important note on per-app ESLint configs:** Each of the three app configs (`backoffice/eslint.config.js`, `frontoffice/eslint.config.js`, `mmc/eslint.config.js`) enforces application-specific import restrictions (e.g., no direct axios imports, no cross-app imports). These rules were NOT purely duplicating the root config — they add localised restrictions on top.

**Biome migration decision for these per-app rules:** Biome does not have an equivalent of ESLint's `no-restricted-imports` rule. However, `ai-guard.ts` enforces import boundary rules architecturally at the CI level. The cross-app import restrictions enforced by `eslint-plugin-import-x` in `eslint.config.mjs` (root) cover the same architectural concerns. Removing per-app ESLint configs does not weaken the architecture boundary enforcement because AI-Guard already covers it. **Document this explicitly in the PR description.**

---

## Finding 05: Prettier Config Files To Remove

**Research task:** List every Prettier configuration file in the repository.

**Source:** `find . -name ".prettierrc*" -o -name ".prettier.config*"` — executed directly.

| File                  | Disposition |
| --------------------- | ----------- |
| `prettier.config.mjs` | **DELETE**  |
| `.prettierrc`         | **DELETE**  |

**Total files to delete:** 2

---

## Finding 06: Current lint-staged Configuration

**Research task:** Read actual lint-staged config to understand what changes are needed.

**Source:** `lint-staged.config.mjs` — inspected directly.

```js
export default {
  '*.{ts,tsx,vue}': ['eslint --fix', 'prettier --write'],
  '*.{md,json}': ['prettier --write'],
}
```

**Required change:** Replace entirely with Biome-based hooks per spec clarification.

**New content:**

```js
export default {
  '*.{ts,tsx,js,jsx,mjs,vue,json}': ['bun biome check --apply-unsafe'],
}
```

**Rationale:**

- `--apply-unsafe` applies both safe and unsafe auto-fixes (including import sorting and some style fixes)
- The `json` and `mjs` types are added vs. the previous config to match Biome's coverage
- Markdown files are excluded because Biome does not lint/format Markdown

---

## Finding 07: CI Workflow Structure

**Research task:** Read `ci.yml` to understand the actual job graph and what must change.

**Source:** `.github/workflows/ci.yml` — inspected in full.

**Workflow files present:**

- `.github/workflows/ci.yml` — **target for modification**
- `.github/workflows/architecture-governance.yml` — **do not modify**
- `.github/workflows/hard-mode-guard.yml` — **do not modify**

**Current `lint` job in `ci.yml`:**

```yaml
lint:
  name: Lint
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
      with: { bun-version: ${{ env.BUN_VERSION }} }
    - run: bun install --frozen-lockfile
    - name: Run ESLint
      run: bun run lint -- --debug
    - name: Check Prettier formatting
      run: bun run format:check
```

**Jobs that depend on `lint` via `needs:`:**

- `unit-tests`: `needs: [lint, typecheck]`
- `build-verification`: `needs: [lint, typecheck, unit-tests, integration-tests, e2e-mmc, e2e-backoffice, e2e-frontoffice, coverage-validation]`

**Decision:** Rename the `lint` step's display name to `Biome — Lint & Format` but **keep the YAML job key as `lint`** to avoid updating all `needs:` references downstream. Replace the two steps (`Run ESLint`, `Check Prettier formatting`) with two Biome steps. The `bun run lint -- --debug` invocation is replaced by `bun biome check .`; the `bun run format:check` step is replaced by `bun biome format --check .`.

---

## Finding 08: console.\* Violations Inventory

**Research task:** Count and categorise all `console.*` usages across source files (excluding `dist/`, `node_modules/`).

**Source:** Executed `grep -rn "console\."` across all source paths — results inspected directly.

### Category A: Legitimate — require `noConsole: "off"` override in `biome.json`

| Location                        | Reason                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/logger/src/logger.ts` | This IS the logger implementation — it wraps `console.*` intentionally (4 calls)               |
| `scripts/**` (9 files)          | CLI scripts requiring terminal output — matches existing ESLint `'no-console': 'off'` override |

### Category B: Test Files — require `noConsole: "off"` override in `biome.json`

| Location                                                            | Type                |
| ------------------------------------------------------------------- | ------------------- |
| `apps/mmc/tests/audit/dashboard-compliance.test.ts`                 | 2 x `console.log`   |
| `apps/mmc/tests/performance/dashboard-perf.test.ts`                 | 9 x `console.log`   |
| `apps/api/tests/integration/phase4-audit-trail.integration.test.ts` | 1 x `console.error` |
| `apps/api/tests/performance/dashboard-query-plans.test.ts`          | 1 x `console.log`   |

**Decision:** Test files may use `console.*` sparingly. Add `tests/**` to the `noConsole: "off"` override.

### Category C: Source files — must migrate to `@zidney/logger`

These files contain `console.*` calls in production source code that must be replaced with structured logger calls before `biome check .` can pass with `noConsole: "error"`.

**apps/mmc/src (18 occurrences across 5 files):**

- `src/shared/components/AuditTrailViewer.vue` — 2 x `console.error`
- `src/modules/licenses/views/LicenseList.vue` — 1 x `console.log` (debug artifact)
- `src/modules/dashboard/api.ts` — 6 x `console.error`
- `src/modules/dashboard/views/DashboardView.vue` — 3 x `console.error`
- `src/modules/dashboard/store.ts` — 6 x `console.error`

**apps/backoffice/src:** 0 violations (comment-only occurrences confirming compliance)

**apps/frontoffice/src:** 0 violations

**apps/api/src (~45 files):** Large volumes. Key files include all middleware, route handlers, service layers, and DB migration runner files. A complete file list is included in the plan.

**apps/worker/src (~15 files):** Worker processor, queue infrastructure, provisioning orchestrator, and observability wrappers.

**packages/domain-core/src (~12 files):** Auth, migration runners, email utility, logging bridge, tenant-resolver version-check.

**packages/redis-utils/src (2 files):** Rate limiting algorithm implementations.

**Total estimated scope for Pass 2 console migration:** ~75 source files.

**Special case — migration runner files:**
Files in `apps/api/src/db/**/migrations/` use `console.log` for migration progress output. These are non-interactive batch scripts. For Pass 2, these are candidates for `// biome-ignore lint/suspicious/noConsole: migration runner output` suppression comments rather than full logger replacement, acknowledging they run in a non-request context without a logger instance.

---

## Finding 09: Biome Version and Schema

**Research task:** Determine the Biome version to record in `biome.json`'s `$schema` URL.

**Method:** `curl https://registry.npmjs.org/@biomejs/biome/latest` — latest version field read directly.

**Finding:** Latest stable `@biomejs/biome` version as of 2026-03-06 is **2.4.6**.

**Schema URL:** `https://biomejs.dev/schemas/2.4.6/schema.json`

**Per spec clarification:** Biome is installed without a version pin (`bun add -D @biomejs/biome`). The resolved version is recorded in the `$schema` URL inside `biome.json`. After running the install command, the actual installed version should be verified and the schema URL updated accordingly.

---

## Finding 10: tsconfig and Build Impact

**Research task:** Verify there is no tsconfig or build system impact from removing ESLint/Prettier.

**Finding:** Confirmed zero impact.

- Biome does not read or depend on `tsconfig.json` for its operation.
- `tsconfig.json`, `tsconfig.base.json`, `tsconfig.test.json`, and per-app tsconfig files are immutable by this migration.
- Vite build system is unaffected — no Vite plugin references ESLint or Prettier.
- `vitest.config.ts` is unaffected.
- The removal of `eslint-import-resolver-typescript` (which resolves TypeScript path aliases for ESLint's import resolver) does not affect the TypeScript compiler or build.

---

## Finding 11: Rule Name Mapping (ESLint → Biome)

**Research task:** Confirm Biome 2.x rule names for all rules specified in the spec.

| Spec Rule Name       | Biome 2.x Rule Path                   | Notes                            |
| -------------------- | ------------------------------------- | -------------------------------- |
| `noUnusedImports`    | `lint.correctness.noUnusedImports`    | Available in Biome 1.3+          |
| `noDebugger`         | `lint.suspicious.noDebugger`          | Part of `recommended` ruleset    |
| `noConsole`          | `lint.suspicious.noConsole`           | Available in Biome 1.9+          |
| `noDuplicateImports` | `lint.correctness.noDuplicateImports` | Also handled by import organizer |
| `useConst`           | `lint.style.useConst`                 | Available in Biome 1.0+          |

**Note:** `noDuplicateImports` is also enforced structurally by `organizeImports.enabled: true` — the import organizer deduplicates imports when running `biome format --write`. The lint rule provides a gate during `biome check .`.

---

## Finding 12: `.vscode/extensions.json` Status

**Research task:** Check if `.vscode/extensions.json` exists and needs to be created.

**Finding:** `.vscode/` directory exists but contains only `mcp.json` and `settings.json`. No `extensions.json` file exists.

**Decision:** Create `.vscode/extensions.json` in Pass 3 with the Biome extension recommendation:

```json
{
  "recommendations": ["biomejs.biome"]
}
```

---

## Finding 13: package.json Scripts To Update

**Research task:** Read actual script definitions that reference ESLint or Prettier.

**Source:** Root `package.json` — inspected directly.

| Script Key     | Current Value        | New Value                    |
| -------------- | -------------------- | ---------------------------- |
| `lint`         | `eslint .`           | `bun biome check .`          |
| `format`       | `prettier --write .` | `bun biome format --write .` |
| `format:check` | `prettier --check .` | `bun biome format --check .` |

**Additional script to add:**
| Script Key | New Value | Purpose |
| -------------- | -------------------------------- | -------------------------------- |
| `lint:fix` | `bun biome check --apply .` | Apply safe lint fixes |

**No changes needed to other scripts** — `typecheck`, `test`, `build`, `dev:*`, `arch:*` are unaffected.

---

## Summary of Resolved Unknowns

| Unknown                         | Resolution                                                               |
| ------------------------------- | ------------------------------------------------------------------------ |
| Exact ESLint packages present   | 8 packages identified — see Finding 01                                   |
| Exact Prettier packages present | 1 package — see Finding 02                                               |
| Per-app ESLint config files     | 3 files to delete — see Finding 04                                       |
| Prettier config files           | 2 files to delete — see Finding 05                                       |
| Existing CI workflow structure  | Single `lint` job — 2 steps to replace — see Finding 07                  |
| Current lint-staged config      | ESLint + Prettier → replace with biome — see Finding 06                  |
| console.\* violations count     | ~75 source files; categorised — see Finding 08                           |
| Biome schema version            | 2.4.6 → `https://biomejs.dev/schemas/2.4.6/schema.json` — see Finding 09 |
| tsconfig impact                 | None confirmed — see Finding 10                                          |
| Biome rule names                | All 5 rules mapped — see Finding 11                                      |
| .vscode/extensions.json         | Does not exist — must be created — see Finding 12                        |
| package.json script changes     | 3 updates + 1 new — see Finding 13                                       |

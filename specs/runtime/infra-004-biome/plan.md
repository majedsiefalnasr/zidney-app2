# Implementation Plan: infra-004-biome — Biome Toolchain Migration

**Feature ID:** `infra-004-biome` **Phase:** `01_PLATFORM_FOUNDATION` **Branch:**
`spec/infra-004-biome` **Planned:** 2026-03-06 **Status:** Planning complete — ready for
implementation

---

## Technical Context

| Item                      | Value                                              |
| ------------------------- | -------------------------------------------------- |
| Biome version             | 2.4.6 (latest stable, no pin)                      |
| Schema URL (post-install) | `https://biomejs.dev/schemas/2.4.6/schema.json`    |
| Install command           | `bun add -D @biomejs/biome` (from repo root)       |
| Scope                     | All apps, packages, scripts, tests — monorepo root |
| Architecture impact       | None — developer toolchain only                    |
| Runtime impact            | None                                               |
| Database impact           | None                                               |
| CI file to modify         | `.github/workflows/ci.yml` only                    |

---

## Constitution Check

_Resolved against `docs/PROJECT_CONTEXT_PRIMER.md` and AGENTS.md._

| Rule                              | Status                                                   |
| --------------------------------- | -------------------------------------------------------- |
| No cross-tenant access introduced | ✅ Not applicable — tooling only                         |
| License middleware not bypassed   | ✅ Not applicable — tooling only                         |
| Attempt engine not modified       | ✅ Not applicable — tooling only                         |
| Structured logging enforced       | ✅ Reinforced — `noConsole` rule enforces this           |
| Import boundaries not weakened    | ✅ Maintained — AI-Guard continues to enforce boundaries |
| Stage lifecycle status            | ✅ `IN PROGRESS` authorises implementation               |

---

## Gates

All pre-implementation gates pass:

- ✅ Stage status: `IN PROGRESS` — implementation authorised
- ✅ No ADR conflict — no architectural boundary change
- ✅ No migration system touched
- ✅ No tenant isolation touched
- ✅ Constitution alignment confirmed

---

## Migration Pass Sequence

The migration is structured as three independent, committable passes.

```
Pass 1: Install + Configure
  └── bun add -D @biomejs/biome
  └── create biome.json
  └── verify bun biome check . runs (violations OK at this stage)

Pass 2: Violation Resolution
  └── bun biome format --write .           (format + import sort, large diff)
  └── bun biome check --apply-unsafe .     (auto-fix safe violations)
  └── manual: replace console.* in source files with @zidney/logger
  └── verify: bun biome check . → exit 0
  └── verify: bun biome format --check . → exit 0

Pass 3: Legacy Removal + CI Update
  └── remove ESLint packages from package.json
  └── remove Prettier package from package.json
  └── delete eslint.config.mjs (root)
  └── delete apps/{backoffice,frontoffice,mmc}/eslint.config.js
  └── delete prettier.config.mjs and .prettierrc
  └── update lint-staged.config.mjs
  └── update CI: .github/workflows/ci.yml
  └── update package.json scripts
  └── create .vscode/extensions.json
  └── run bun install to regenerate lockfile
  └── verify all CI checks pass
```

---

## Pass 1: Install and Configure

### Step 1.1 — Install Biome

Run from repository root:

```bash
bun add -D @biomejs/biome
```

This adds `@biomejs/biome` to root `devDependencies`. No version pin. Verify the installed version
and update the `$schema` URL in `biome.json` if the resolved version differs from `2.4.6`.

### Step 1.2 — Create `biome.json`

Create `biome.json` at the repository root with the following exact content:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": [
      "node_modules",
      "dist",
      "**/node_modules/**",
      "**/dist/**",
      "**/*.d.ts",
      ".specify/**",
      "coverage/**"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "asNeeded"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noDuplicateImports": "error"
      },
      "suspicious": {
        "noDebugger": "error",
        "noConsole": "error"
      },
      "style": {
        "useConst": "error"
      }
    }
  },
  "organizeImports": {
    "enabled": true
  },
  "overrides": [
    {
      "include": ["packages/logger/**/*.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsole": "off"
          }
        }
      }
    },
    {
      "include": ["scripts/**"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsole": "off"
          }
        }
      }
    },
    {
      "include": ["tests/**", "**/*.test.ts", "**/*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsole": "off"
          }
        }
      }
    }
  ]
}
```

**Key decisions embodied in this config:**

| Setting                                    | Value               | Rationale                                                         |
| ------------------------------------------ | ------------------- | ----------------------------------------------------------------- |
| `$schema`                                  | `2.4.6/schema.json` | Update to resolved installed version post-install                 |
| `vcs.useIgnoreFile`                        | `true`              | Biome respects `.gitignore` patterns automatically                |
| `lineWidth`                                | `100`               | Spec requirement — replaces Prettier's effective 80/100 ambiguity |
| `javascript.formatter.quoteStyle`          | `"single"`          | Matches existing Prettier + ESLint style                          |
| `javascript.formatter.semicolons`          | `"asNeeded"`        | Matches `semi: false` in Prettier config                          |
| `javascript.formatter.trailingCommas`      | `"es5"`             | Matches existing Prettier config                                  |
| `noConsole` override for `packages/logger` | `"off"`             | Logger wraps `console.*` intentionally                            |
| `noConsole` override for `scripts/**`      | `"off"`             | CLI scripts require terminal output                               |
| `noConsole` override for test files        | `"off"`             | Test output is acceptable                                         |
| `.specify/**` in ignore                    | yes                 | SpecKit tooling governed by its own convention                    |

### Step 1.3 — Verify Biome Scans Successfully

```bash
bun biome check . 2>&1 | tail -20
```

Exit gate: Command runs and produces output (violations are expected and acceptable at this stage).
The command must not fail with a configuration error or unrecognised option.

---

## Pass 2: Violation Resolution

### Step 2.1 — Apply Formatting Pass

```bash
bun biome format --write .
```

This applies:

- Indent normalisation (spaces, width 2)
- Line width enforcement (100)
- Import sorting (alphabetical, separated by type)
- Quote style (`'single'`)
- Trailing comma insertion (`es5`)
- Semicolon removal

**Expected result:** Large diff touching most source files. This is the largest single commit in the
migration — document in PR description as "formatting: apply Biome formatter (replaces Prettier,
line-width 100)".

### Step 2.2 — Apply Auto-Fixable Lint Violations

```bash
bun biome check --apply-unsafe .
```

This auto-fixes:

- `noUnusedImports` (removes unused import statements)
- `noDuplicateImports` (deduplicates import entries)
- `useConst` (promotes `let` to `const` where the variable is never reassigned)

**Output:** Inspect the diff before committing. `noConsole` violations will remain (cannot be
auto-fixed — requires manual replacement).

### Step 2.3 — Manual console.\* Remediation

This is the most labour-intensive step. All production source files listed below must have
`console.*` calls replaced with structured `@zidney/logger` calls.

**Priority order (highest to lowest risk):**

#### Group A — apps/api/src (critical path middleware and handlers)

Each of the following files contains `console.*` calls in production middleware, route handlers, or
service code. Replace with `import { logger } from '@zidney/logger'` calls using structured fields.

```
apps/api/src/index.ts
apps/api/src/boot/migration-registry.ts
apps/api/src/infrastructure/redis.ts
apps/api/src/middleware/auth/resolve-rbac.ts
apps/api/src/middleware/auth/validate-jwt.ts
apps/api/src/middleware/auth/validate-license-middleware.ts
apps/api/src/middleware/auth/validate-license.ts
apps/api/src/middleware/auth/validate-token-version.ts
apps/api/src/middleware/backoffice-module-guard.ts
apps/api/src/middleware/backoffice-permission-guard-v2.ts
apps/api/src/middleware/backoffice-rbac-guard.ts
apps/api/src/middleware/correlation-id.ts
apps/api/src/middleware/error-handler.ts
apps/api/src/middleware/middleware-chain.ts
apps/api/src/middleware/rate-limit-provisioning.ts
apps/api/src/middleware/rate-limiting.ts
apps/api/src/middleware/request-logger.middleware.ts
apps/api/src/middleware/tenant-resolver.ts
apps/api/src/handlers/licenses/create-license.ts
apps/api/src/modules/attempt/submit.ts
apps/api/src/modules/errors/error-formatter.ts
apps/api/src/modules/schema/migration-enqueue.ts
apps/api/src/modules/workspace-settings/workspace-settings.service.ts
apps/api/src/routes/auth/backoffice-login.ts
apps/api/src/routes/auth/logout-all.ts
apps/api/src/routes/backoffice/context.ts
apps/api/src/routes/backoffice/roles.ts
apps/api/src/routes/backoffice/workflow/post-transition.ts
apps/api/src/routes/backoffice/ws.ts
apps/api/src/routes/health.ts
apps/api/src/routes/mmc/affiliates/create.ts
apps/api/src/routes/mmc/affiliates/disable.ts
apps/api/src/routes/mmc/affiliates/edit.ts
apps/api/src/routes/mmc/affiliates/list.ts
apps/api/src/routes/mmc/affiliates/usages.ts
apps/api/src/services/audit.service.ts
apps/api/src/utils/idempotency.ts
```

#### Group B — Migration runner files (API DB migrations)

These files use `console.log` for migration progress output. They run in a non-HTTP context without
access to the request-scoped logger. Apply
`// biome-ignore lint/suspicious/noConsole: migration runner output` suppressions rather than
replacing with `@zidney/logger`.

```
apps/api/src/db/master/migrations/0005_schema_version_increment.ts
apps/api/src/db/master/migrations/0006_create_dead_letter_queue.ts
apps/api/src/db/master/migrations/0007_create_dlq_resolutions.ts
apps/api/src/db/master/migrations/20260225_006_seed_roles_and_permissions.ts
apps/api/src/db/master/migrations/20260226_001_dashboard_indexes.ts
apps/api/src/db/master/migrations/runner.ts
apps/api/src/db/tenant/migrations/0008_add_idempotent_submission.ts
apps/api/src/db/tenant/migrations/0009_add_idempotent_indexes.ts
apps/api/src/db/tenant/migrations/0010_add_audit_indexes.ts
```

#### Group C — apps/worker/src

```
apps/worker/src/config/queues.ts
apps/worker/src/config/worker-config.ts
apps/worker/src/jobs/drain-language-translations.ts
apps/worker/src/jobs/grade-attempt.ts
apps/worker/src/jobs/lock-manager.ts
apps/worker/src/jobs/migration-phase.ts
apps/worker/src/jobs/retry-strategy.ts
apps/worker/src/jobs/snapshot-phase.ts
apps/worker/src/modules/queue/job-queue.ts
apps/worker/src/observability/structured-logger.ts
apps/worker/src/processor.ts
apps/worker/src/queue.ts
apps/worker/src/services/provisioning/BaselineSeeder.ts
apps/worker/src/services/provisioning/CheckpointManager.ts
apps/worker/src/services/provisioning/DistributedLock.ts
apps/worker/src/services/provisioning/ErrorHandling.ts
apps/worker/src/services/provisioning/JobQueue.ts
apps/worker/src/services/provisioning/MigrationExecutor.ts
apps/worker/src/services/provisioning/ProvisioningOrchestrator.ts
```

**Note on `apps/worker/src/observability/structured-logger.ts`:** This file may be a logger bridge
that wraps `console.*`. Evaluate whether it should receive the same `noConsole: "off"` override in
`biome.json` (add to `overrides[0]["include"]` for logger-bridge files) or be migrated to use
`@zidney/logger`.

#### Group D — apps/mmc/src (18 occurrences)

| File                                            | Calls               | Action                    |
| ----------------------------------------------- | ------------------- | ------------------------- |
| `src/shared/components/AuditTrailViewer.vue`    | 2 x `console.error` | Replace with logger error |
| `src/modules/licenses/views/LicenseList.vue`    | 1 x `console.log`   | Remove debug artifact     |
| `src/modules/dashboard/api.ts`                  | 6 x `console.error` | Replace with logger error |
| `src/modules/dashboard/views/DashboardView.vue` | 3 x `console.error` | Replace with logger error |
| `src/modules/dashboard/store.ts`                | 6 x `console.error` | Replace with logger error |

**Note on Vue app logging:** Vue frontend apps typically don't have direct access to a structured
backend logger. For Vue components, the appropriate response is to remove debug `console.log` calls
entirely and to replace `console.error` calls with a frontend error capture mechanism (e.g.,
re-throw or set reactive error state). These are not replaceable with `@zidney/logger` — that
package is backend-only.

**Pragmatic option for Vue apps:** Add a
`// biome-ignore lint/suspicious/noConsole: frontend error boundary` suppression on specific
`console.error` calls that are critical error boundaries until a frontend error tracking integration
is added.

#### Group E — packages/domain-core/src

| File                                       | Calls               | Action                                             |
| ------------------------------------------ | ------------------- | -------------------------------------------------- |
| `src/auth/password.ts`                     | 1 x `console.error` | Replace with `@zidney/logger`                      |
| `src/auth/audit.ts`                        | 3 x `console.*`     | Review — may be a logger bridge                    |
| `src/utils/email.ts`                       | 1 x `console.log`   | Replace or suppress (dev-mode only conditionals)   |
| `src/migration/master-migration-runner.ts` | 2 x `console.log`   | Apply biome-ignore suppression (migration context) |
| `src/migration/snapshot-manager.ts`        | 2 x `console.log`   | Apply biome-ignore suppression                     |
| `src/migration/tenant-migration-runner.ts` | 4 x `console.log`   | Apply biome-ignore suppression                     |
| `src/logging/master-db-logger.ts`          | 1 x `console.log`   | Evaluate — DB logger bridge may need override      |
| `src/services/audit.service.ts`            | 1 x `console.error` | Replace with `@zidney/logger`                      |
| `src/tenant-resolver/version-check.ts`     | 3 x `console.log`   | Replace with `@zidney/logger`                      |

#### Group F — packages/redis-utils/src

| File                               | Calls               | Action                        |
| ---------------------------------- | ------------------- | ----------------------------- |
| `src/algorithms/token-bucket.ts`   | 3 x `console.error` | Replace with `@zidney/logger` |
| `src/algorithms/sliding-window.ts` | 3 x `console.error` | Replace with `@zidney/logger` |

### Step 2.4 — Verify Gates

```bash
# Must exit with code 0:
bun biome check .
bun biome format --check .
```

Both commands must exit with code `0` before proceeding to Pass 3.

---

## Pass 3: Legacy Removal, CI Update, and Documentation

### Step 3.1 — Remove ESLint Packages from root `package.json`

Remove the following entries from `devDependencies` in root `package.json`:

```json
"@eslint/js": "^9.0.0",
"eslint": "^9.0.0",
"eslint-config-prettier": "^10.1.8",
"eslint-import-resolver-typescript": "^4.4.4",
"eslint-plugin-import-x": "^4.0.0",
"eslint-plugin-vue": "^10.8.0",
"globals": "^15.0.0",
"typescript-eslint": "^8.0.0"
```

**Note:** `globals` is included because it is only used by `eslint.config.mjs`. If `globals` is used
elsewhere, verify before removing.

Remove the following entry from `devDependencies`:

```json
"prettier": "^3.8.1"
```

### Step 3.2 — Delete ESLint Configuration Files

Delete these files:

- `eslint.config.mjs`
- `apps/backoffice/eslint.config.js`
- `apps/frontoffice/eslint.config.js`
- `apps/mmc/eslint.config.js`

**Do NOT delete:** `packages/ui-system/.eslintrc-ui-guard.md` — this is Markdown documentation, not
a config file.

### Step 3.3 — Delete Prettier Configuration Files

Delete these files:

- `prettier.config.mjs`
- `.prettierrc`

### Step 3.4 — Update `lint-staged.config.mjs`

Replace the entire file content with:

```js
/** @type {import('lint-staged').Config} */
export default {
  "*.{ts,tsx,js,jsx,mjs,vue,json}": ["bun biome check --apply"],
};
```

**Changes from current:**

- `eslint --fix` removed
- `prettier --write` removed
- Added `json`, `js`, `jsx`, `mjs` to the pattern (Biome covers these; previous config did not)
- Markdown files dropped — Biome does not lint or format `.md` files
- Single unified hook replaces two separate hooks

### Step 3.5 — Update `package.json` Scripts

Update the `scripts` section in root `package.json`:

**Replace:**

```json
"lint": "eslint .",
"format": "prettier --write .",
"format:check": "prettier --check .",
```

**With:**

```json
"lint": "bun biome check .",
"lint:fix": "bun biome check --apply .",
"format": "bun biome format --write .",
"format:check": "bun biome format --check .",
```

**Note:** `lint:fix` is a new script for applying safe auto-fixes locally. `--apply` (safe fixes
only) is used in both `lint:fix` and the lint-staged pre-commit hook to prevent silent staged-code
mutation. `--apply-unsafe` is reserved for explicit developer invocation: run
`bun biome check --apply-unsafe .` directly when you want to apply all suggested fixes including
potentially semantics-altering transformations.

### Step 3.6 — Update `.github/workflows/ci.yml`

Replace the `lint` job's steps. Keep the YAML job key as `lint` to preserve all downstream `needs:`
references.

**Current `lint` job steps (replace these):**

```yaml
- name: Run ESLint
  run: bun run lint -- --debug

- name: Check Prettier formatting
  run: bun run format:check
```

**Replace with:**

```yaml
- name: Run Biome lint check
  run: bun biome check .

- name: Run Biome format check
  run: bun biome format --check .
```

**Also update the job display name:**

```yaml
lint:
  name: "Biome — Lint & Format" # ← was: Lint
```

**Full updated `lint` job:**

```yaml
# ── Job 1. Biome Lint & Format ──────────────────────────────────────────
lint:
  name: "Biome — Lint & Format"
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Run Biome lint check
      run: bun biome check .

    - name: Run Biome format check
      run: bun biome format --check .
```

**CI gate order after this change:**

```
biome check .           (Job: lint — step 1)
biome format --check .  (Job: lint — step 2)
                          ↓  (downstream jobs need: lint)
typecheck               (Job: typecheck — parallel with lint)
                          ↓  (unit-tests needs: lint, typecheck)
unit-tests              (Job: unit-tests)
                          ↓
integration-tests       (Job: integration-tests)
                          ↓
e2e + coverage          (parallel)
                          ↓
build-verification      (final gate)
```

**Note:** AI-Guard scripts (`scripts/ai-guard.ts`) are not currently a dedicated CI job in `ci.yml`.
The spec's pipeline ordering (Biome → AI-Guard → Vitest) is fully satisfied: `lint` job runs Biome,
then downstream jobs execute Vitest tests. AI-Guard enforcement occurs via pre-commit hook or the
`architecture-governance.yml` workflow.

### Step 3.7 — Create `.vscode/extensions.json`

Create `.vscode/extensions.json`:

```json
{
  "recommendations": ["biomejs.biome"]
}
```

This enables automatic format-on-save for all developers using VS Code with the Biome extension.

**Recommended `.vscode/settings.json` addition (append to existing file):**

```json
{
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[vue]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "editor.formatOnSave": true
}
```

**Note:** Only add the Biome-specific keys. Do not overwrite existing `.vscode/settings.json`
content.

### Step 3.8 — Regenerate Lockfile

```bash
bun install
```

This removes ESLint/Prettier package metadata from `bun.lock` and adds `@biomejs/biome`.

### Step 3.9 — Final Verification

```bash
# Biome gates
bun biome check .
bun biome format --check .

# Type checking unchanged
bun run typecheck

# Tests unchanged
bun run test:unit

# Lint script works
bun run lint

# Format script works
bun run format:check
```

All five commands must exit with code `0`.

---

## tsconfig and Build Impact Analysis

**Result: None.**

| System                              | Impact      | Rationale                                                        |
| ----------------------------------- | ----------- | ---------------------------------------------------------------- |
| `tsconfig.json` (root)              | None        | Biome is a standalone Rust binary with its own parser            |
| `tsconfig.app.json` per app         | None        | No reference to ESLint or Prettier                               |
| `tsconfig.test.json`                | None        | Unaffected                                                       |
| Vite build                          | None        | No Vite ESLint or Prettier plugin is configured                  |
| `vitest.config.ts`                  | None        | No linting dependency in test configuration                      |
| `eslint-import-resolver-typescript` | Removing it | Only used as ESLint resolver — TypeScript itself is not affected |

Existing type-checking, unit tests, and build pipeline are unaffected by this migration.

---

## File Change Summary

| File                                     | Action                    | Pass |
| ---------------------------------------- | ------------------------- | ---- |
| `biome.json`                             | Create                    | 1    |
| `package.json` (root devDependencies)    | Remove 9 packages         | 3    |
| `package.json` (root scripts)            | 3 updates + 1 new         | 3    |
| `eslint.config.mjs`                      | Delete                    | 3    |
| `apps/backoffice/eslint.config.js`       | Delete                    | 3    |
| `apps/frontoffice/eslint.config.js`      | Delete                    | 3    |
| `apps/mmc/eslint.config.js`              | Delete                    | 3    |
| `prettier.config.mjs`                    | Delete                    | 3    |
| `.prettierrc`                            | Delete                    | 3    |
| `lint-staged.config.mjs`                 | Replace content           | 3    |
| `.github/workflows/ci.yml`               | Update `lint` job         | 3    |
| `.vscode/extensions.json`                | Create                    | 3    |
| `.vscode/settings.json`                  | Append formatter settings | 3    |
| ~75 source files (console.\* violations) | Manual remediation        | 2    |

---

## PR Description Template

For the Pass 2 commit:

```
chore: apply Biome formatter across monorepo (line-width 100)

This commit runs `bun biome format --write .` as part of the infra-004-biome
migration. The large diff is expected and acceptable. No logic changes — only
whitespace, quote style, trailing comma, and import sort order. Line width
changes from Prettier's ambiguous 80/100 (two configs existed) to a uniform 100.
```

For the Pass 3 commit:

```
feat(infra): replace ESLint + Prettier with Biome (infra-004-biome)

- Removes 8 ESLint packages and 1 Prettier package from devDependencies
- Deletes eslint.config.mjs, 3 per-app eslint configs, prettier.config.mjs, .prettierrc
- Updates lint-staged to use bun biome check --apply
- Updates CI lint job to use biome check + biome format --check
- Adds .vscode/extensions.json with Biome extension recommendation
- Adds biome.json at repository root as single source of truth
- Updates package.json lint/format scripts

Import boundary enforcement: AI-Guard (scripts/ai-guard.ts) continues to
enforce cross-package import rules. Per-app ESLint configs that enforced
import restrictions are removed; AI-Guard covers the same architectural
boundaries at the CI level.
```

---

## Risk Register

| Risk                                               | Likelihood | Mitigation                                                                                        |
| -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| Biome rule name differs in 2.4.6 vs plan           | Low        | Run `bun biome check .` after Pass 1 and inspect any "unknown rule" errors                        |
| Vue `.vue` file parsing failures                   | Low        | Biome 1.9+ supports Vue embedded scripts; test with `bun biome check apps/mmc/src` directly       |
| `noDuplicateImports` rule unavailable              | Low        | Remove from `biome.json` if the rule name throws an error; import organizer handles deduplication |
| Large console.\* remediation introduces bugs       | Medium     | Each remediation commit must run `bun run test:unit` to confirm no regressions                    |
| `bun.lock` conflict after ESLint removal           | Low        | Run `bun install` to regenerate; commit updated lockfile                                          |
| `.vscode/settings.json` clobbers existing settings | Low        | Append only — do not overwrite; merge manually                                                    |

---

## Acceptance Criteria Checklist

Mapped from the spec exit conditions:

- [ ] `bun biome check .` exits with code `0` on full repository
- [ ] `bun biome format --check .` exits with code `0` on full repository
- [ ] No ESLint dependency in any `package.json` across the monorepo
- [ ] No Prettier dependency in any `package.json` across the monorepo
- [ ] No ESLint configuration file exists in the repository
- [ ] No Prettier configuration file exists in the repository
- [ ] CI `lint` job runs `bun biome check .` and `bun biome format --check .`
- [ ] CI `lint` job runs before `unit-tests` job (preserved via existing `needs:` graph)
- [ ] `.vscode/extensions.json` contains `biomejs.biome` recommendation
- [ ] `lint-staged.config.mjs` uses `bun biome check --apply`
- [ ] `bun run test:unit` passes with no regressions
- [ ] `bun run typecheck` passes with no regressions
- [ ] Single `biome.json` exists at repository root with no sub-directory overrides

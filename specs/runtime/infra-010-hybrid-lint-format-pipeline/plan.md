# Implementation Plan: Hybrid Lint Format Pipeline

**Phase:** 01_PLATFORM_FOUNDATION **Stage:** STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE **Spec:**
[spec.md](./spec.md) **Branch:** `spec/infra-010-hybrid-lint-format-pipeline` **Date:** 2026-03-10
**Status:** READY FOR IMPLEMENTATION

---

## Technical Context

### Current State Summary

| File                           | Current State                                             | Gap                                                                        |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `lint-staged.config.mjs`       | Biome entry only (`*.{ts,tsx,js,jsx,mjs,vue,json}`)       | Missing: `*.md`, `*.{yml,yaml}`, `.github/workflows/*.yml` entries         |
| `.husky/pre-commit`            | Runs lint-staged + TypeScript check + architecture guards | No explicit markdown/YAML gap — lint-staged will cover once config updated |
| `.husky/pre-push`              | Runs ai-guard + infra-audit + unit tests + tsc            | Missing: `actionlint .github/workflows/` full scan                         |
| `package.json`                 | Has `lint`, `lint:fix`, `format`, `format:check` scripts  | Missing: `format:check:md`, `validate:yaml`, `validate:workflows`          |
| `package.json` devDependencies | Has Biome, husky, lint-staged — **no prettier**           | Must add `prettier` as devDependency                                       |
| `.prettierrc`                  | Does not exist                                            | Must create with markdown-only config                                      |
| `.prettierignore`              | Does not exist                                            | Must create to exclude TS/JS/Vue from prettier scope                       |
| `.yamllint`                    | Does not exist                                            | Must create yamllint config at repo root                                   |
| `.actionlint.yaml`             | Does not exist                                            | Optional — only needed to override defaults                                |

### Dependency Status

| Tool             | Type        | Installation State               | Action Required                           |
| ---------------- | ----------- | -------------------------------- | ----------------------------------------- |
| `@biomejs/biome` | npm devDep  | ✅ Already installed (`^2.4.6`)  | None                                      |
| `prettier`       | npm devDep  | ❌ Not in `package.json`         | Add to devDependencies                    |
| `lint-staged`    | npm devDep  | ✅ Already installed (`^15.0.0`) | None                                      |
| `husky`          | npm devDep  | ✅ Already installed (`^9.0.0`)  | None                                      |
| `yamllint`       | System tool | Not tracked in package.json      | Document in setup guide; add to AGENTS.md |
| `actionlint`     | System tool | Not tracked in package.json      | Document in setup guide; add to AGENTS.md |

### Constitution Check

**Result:** PASS — No violations.

This stage is infrastructure tooling only. It does not interact with tenant databases,
authentication middleware, license enforcement, attempt engine, or worker queues.

| Gate                    | Result  | Notes                                                  |
| ----------------------- | ------- | ------------------------------------------------------ |
| Tenant isolation        | ✅ PASS | No database interaction                                |
| License middleware      | ✅ PASS | N/A — no workspace-bound routes                        |
| Import boundary rules   | ✅ PASS | No new imports; config files only                      |
| Architecture map impact | ✅ PASS | No new modules; no packages/apps modified structurally |
| ADR conflict check      | ✅ PASS | No ADR governs lint tooling selection                  |
| Stage lifecycle         | ✅ PASS | spec.md is DRAFT; implementation is authorized         |

---

## Phase 0: Research Summary

All clarifications were resolved in `spec.md` (Session 2026-03-10). No outstanding unknowns.

### Resolved Decisions

| Decision                           | Resolution                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| lint-staged config location        | Use existing `lint-staged.config.mjs` at repo root (not inline in `package.json`) |
| Biome invocation in lint-staged    | Single `bun biome check --write` (not two commands)                               |
| `*.mjs` and `*.json` in Biome glob | Yes — include both, consistent with existing config                               |
| Pre-push Biome invocation          | `bun run lint` (uses the defined npm script alias, guarantees `.` path arg)       |
| actionlint scope                   | Both lint-staged (staged files) AND full scan in pre-push hook                    |
| Vue handling                       | `<script>` blocks only (Biome limitation; documented assumption)                  |
| yamllint type                      | System tool — NOT an npm package                                                  |
| Biome installation scope           | Root only — no per-package configurations                                         |
| prettier absent from devDeps       | Must be added; prettier was referenced in spec but not yet installed              |

---

## Phase 1: Design & Contracts

### Data Model

No database changes. No migrations. No schema changes.

---

### File Change List

**Files Modified (6):**

| File                     | Change Type | Description                                                                                                   |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `lint-staged.config.mjs` | Modify      | Add 3 new entries: prettier for `*.md`, yamllint for `*.{yml,yaml}`, actionlint for `.github/workflows/*.yml` |
| `.husky/pre-push`        | Modify      | Add actionlint full-scan step after infra-audit                                                               |
| `package.json`           | Modify      | Add prettier to devDependencies; add 3 new scripts                                                            |
| `.prettierrc`            | Create      | New prettier config, markdown-only scope declaration                                                          |
| `.prettierignore`        | Create      | Exclude TS/JS/Vue/JSON from prettier scope                                                                    |
| `.yamllint`              | Create      | yamllint config for repo-wide YAML validation                                                                 |

**Files Created (4):**

| File                                                | Description                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `.prettierrc`                                       | Prettier configuration (prose-wrap: always, print-width: 100)            |
| `.prettierignore`                                   | Blocks prettier from running on TS/JS/Vue/JSON files                     |
| `.yamllint`                                         | YAML lint rules: 2-space indent, 120-char line length, no duplicate keys |
| `tests/unit/lint-staged/lint-staged-config.test.ts` | Unit tests verifying lint-staged config structure                        |

**Files NOT Modified:**

| File                                       | Reason                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `biome.json`                               | Already correctly configured per spec; no changes needed                                                                 |
| `.husky/pre-commit`                        | lint-staged hook already invokes `bunx lint-staged`; new entries in `lint-staged.config.mjs` are picked up automatically |
| All `apps/*` and `packages/*` source files | No source code changes in this stage                                                                                     |

---

### Detailed Change Specifications

#### 1. `lint-staged.config.mjs` — Add 3 new entries

**Current content:**

```js
/** @type {import('lint-staged').Config} */
export default {
  "*.{ts,tsx,js,jsx,mjs,vue,json}": ["bun biome check --write"],
};
```

**New content:**

```js
/** @type {import('lint-staged').Config} */
export default {
  "*.{ts,tsx,js,jsx,mjs,vue,json}": ["bun biome check --write"],
  "*.md": ["prettier --write"],
  "*.{yml,yaml}": ["yamllint"],
  ".github/workflows/*.yml": ["actionlint"],
};
```

**Design decisions:**

- `prettier --write` (not `bunx prettier --write`) — prettier will be in `node_modules/.bin/` once
  installed; lint-staged resolves local binaries automatically.
- `yamllint` invoked without flags — relies on `.yamllint` config file at repo root.
- `actionlint` invoked without flags — processes files passed by lint-staged as positional
  arguments.
- No entry added for `*.mdx` — out of scope; not a file type in this repo.

**Glob ordering:** lint-staged processes patterns from top to bottom. A GitHub workflow `.yml` file
stages both the `*.{yml,yaml}` entry (yamllint) AND the `.github/workflows/*.yml` entry (actionlint)
— this additive behavior is intended per spec Formatting Responsibility Matrix.

---

#### 2. `package.json` — Add devDependency + 3 new scripts

**devDependencies change:**

```diff
-   "@biomejs/biome": "^2.4.6",
+   "@biomejs/biome": "^2.4.6",
+   "prettier": "^3.0.0",
```

**Exact version:** Use `"prettier": "^3.0.0"` (Prettier v3 is the stable LTS with ESM support and
async API — compatible with Bun). Pin to major version `^3` to stay current within the Prettier 3.x
line.

**New scripts:**

```json
"format:check:md": "prettier --check \"**/*.md\"",
"validate:yaml": "yamllint .",
"validate:workflows": "actionlint .github/workflows/"
```

**Placement:** Insert after the existing `format:check` script in alphabetical-adjacent grouping.

**Why these script names:**

- `format:check:md` — follows the existing `format:check` naming pattern; scoped suffix `:md`
  signals markdown-only.
- `validate:yaml` — `validate:` prefix distinguishes validation-only tools from format tools;
  yamllint does not auto-fix.
- `validate:workflows` — mirrors yamllint convention; actionlint is also validation-only.

---

#### 3. `.husky/pre-push` — Add actionlint full scan

**Current last step before Final Summary:**

```sh
# ── Optional TypeScript project validation ──────────────────────────────────
TS_FILES=$(echo "$CHANGED_FILES" | grep -E '\.(ts|tsx)$' || true)
...
```

**Addition — insert after `infra-audit.ts --quick` block and before Unit Tests block:**

```sh
# ── Full GitHub Workflow Validation (blocking) ────────────────────────────────
# Validates all GitHub Actions workflow files using actionlint.
# This is a full-repository scan, not limited to changed files.
echo "Running actionlint on GitHub workflow files..."
if ls .github/workflows/*.yml 2>/dev/null | head -1 > /dev/null; then
  actionlint .github/workflows/ || {
    echo "❌ actionlint validation failed — push blocked."
    echo "   Fix the GitHub Actions errors listed above before pushing."
    exit 1
  }
else
  echo "No workflow files found — skipping actionlint"
fi
```

**Design decisions:**

- Full-repository scan (not filtered to changed files) — satisfies FR-04 acceptance criterion:
  "reports no errors on all existing workflow files."
- Graceful skip if `.github/workflows/` has no `.yml` files — prevents failure on branches without
  workflows.
- Blocking (`exit 1`) — consistent with pre-push philosophy (architecture guard, brain validation
  also block).
- Placed after `infra-audit.ts --quick` and before unit tests — maintains the ordering: governance →
  tooling validation → test suite.

---

#### 4. `.prettierrc` — Create

```json
{
  "printWidth": 100,
  "proseWrap": "always",
  "singleQuote": false,
  "trailingComma": "es5",
  "overrides": [
    {
      "files": "*.md",
      "options": {
        "proseWrap": "always",
        "printWidth": 100
      }
    }
  ]
}
```

**Design decisions:**

- `printWidth: 100` — matches Biome's `lineWidth: 100` for visual consistency across file types.
- `proseWrap: "always"` — re-wraps Markdown paragraphs at 100 characters for consistent ADR/spec
  formatting.
- Only `*.md` override specified in `overrides` — functional scope restriction declared in
  `.prettierignore`.
- No TypeScript/JavaScript options in `.prettierrc` — irrelevant because `.prettierignore` blocks
  those files.

---

#### 5. `.prettierignore` — Create

```
# Biome handles these — prettier must not process them
**/*.ts
**/*.tsx
**/*.js
**/*.jsx
**/*.mjs
**/*.cjs
**/*.vue
**/*.json
**/*.jsonc

# Build outputs and generated files
node_modules/
dist/
.next/
coverage/
docs/ai/context/
```

**Design decisions:**

- Explicit glob exclusion of every Biome-managed file type — enforces FR-02 (Prettier scoped to
  Markdown only) and AI-02 rule.
- `docs/ai/context/` excluded — machine-generated JSON files; not human-authored markdown.

---

#### 6. `.yamllint` — Create

```yaml
---
extends: default

rules:
  line-length:
    max: 120
    level: warning
  indentation:
    spaces: 2
    indent-sequences: true
    check-multi-line-strings: false
  comments:
    min-spaces-from-content: 1
  document-start:
    level: warning
  truthy:
    allowed-values: ["true", "false", "on", "off", "yes", "no"]
    check-keys: false
```

**Design decisions:**

- `extends: default` — uses yamllint recommended ruleset as baseline (consistent with NFR-03 single
  config location).
- `line-length: 120 warning` — slightly longer than Biome/Prettier's 100 to accommodate YAML's
  inherently verbose syntax (GitHub Actions steps, Docker Compose mappings).
- `document-start: warning` — many YAML files in the repo omit `---`; treat as warning until
  codebase is migrated.
- `truthy.check-keys: false` — GitHub Actions `on:` key would otherwise trigger a truthy
  false-positive.

---

### Testing Strategy

#### Unit Tests — `tests/unit/lint-staged/lint-staged-config.test.ts`

Tests verify the structural correctness of lint-staged configuration without executing the toolchain
binaries.

**Test cases:**

1. **Config shape: Biome entry exists**
   - Import `lint-staged.config.mjs`; assert key `'*.{ts,tsx,js,jsx,mjs,vue,json}'` is present.
   - Assert value is `['bun biome check --write']`.

2. **Config shape: Prettier entry exists for Markdown**
   - Assert key `'*.md'` is present.
   - Assert value is `['prettier --write']`.

3. **Config shape: yamllint entry exists for YAML**
   - Assert key `'*.{yml,yaml}'` is present.
   - Assert value is `['yamllint']`.

4. **Config shape: actionlint entry exists for workflows**
   - Assert key `'.github/workflows/*.yml'` is present.
   - Assert value is `['actionlint']`.

5. **No-overlap: Prettier not mapped to TypeScript patterns**
   - Assert no key in the config includes `.ts` or `.js` mapped to a command containing `prettier`.

6. **No-overlap: Biome not mapped to Markdown**
   - Assert key `'*.md'` does not include a command containing `biome`.

7. **No-overlap: Prettier not mapped to JSON**
   - Assert key `'*.{yml,yaml}'` does not include a command containing `prettier`.

8. **Config is a plain object (not array)**
   - Assert `typeof config === 'object' && !Array.isArray(config)`.

**Test file location:** `tests/unit/lint-staged/lint-staged-config.test.ts`

**Vitest project:** Root vitest config (not scoped to a specific app package).

---

#### Integration Tests — `tests/integration/lint-staged/pre-commit-pipeline.test.ts`

> ⚠️ Integration tests for hook execution require a controlled Git environment. These tests use a
> temp Git repo to isolate from the actual repository state. They are informational and do not run
> in CI as part of the standard lint-check suite.

**Test cases:**

1. **Biome blocks a TypeScript file with a lint violation**
   - Stage a `.ts` file containing `console.log("test")` (blocked by `noConsole` rule).
   - Assert pre-commit exits non-zero.

2. **Prettier auto-formats a Markdown file**
   - Stage a `.md` file with lines exceeding 100 characters.
   - Assert prettier reformats and re-stages the file.

3. **yamllint blocks a malformed YAML file**
   - Stage a `.yml` file with inconsistent indentation.
   - Assert yamllint exits non-zero with a human-readable error.

4. **actionlint blocks an invalid GitHub workflow**
   - Stage a `.github/workflows/` YAML with a nonexistent `uses:` action reference.
   - Assert actionlint exits non-zero.

5. **No-overlap: Biome not invoked on `.md` files**
   - Stage only a `.md` file.
   - Assert lint-staged invokes prettier, not biome on that file.

---

#### Performance Tests

> Note: Performance targets are defined in NFR-01. These are measured manually during implementation
> validation, not as automated vitest tests.

| Scenario                               | Target  | Measurement Method                          |
| -------------------------------------- | ------- | ------------------------------------------- |
| 1–3 TypeScript files staged            | < 100ms | `time git commit` with only TS files staged |
| Full incremental pass (10 mixed files) | < 500ms | `time git commit` with mixed staged files   |

---

### System Tool Documentation

**Approach:** Add installation instructions to `apps/api/AGENTS.md` (developer env section) and
document in `docs/03_ENGINEERING_WORKFLOW/` or equivalent setup guide. This plan proposes a
dedicated section in the AGENTS files rather than a new standalone document (minimizes file
proliferation).

**Content to add:**

```markdown
## Developer Environment: Required System Tools

The following system tools are required for pre-commit and pre-push hooks to function.

### yamllint

Validates YAML syntax in all .yml/.yaml files.

macOS: brew install yamllint

Ubuntu/Debian: sudo apt-get install yamllint

Docker CI (already in base image for most linux runners): pip install yamllint

### actionlint

Validates GitHub Actions workflow files.

macOS: brew install actionlint

Ubuntu/Debian: bash <(curl
https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)

Verify: actionlint --version
```

---

## Migration Concern Analysis

**Risk level: Low**

All changes in this stage are **additive**:

| Change                                              | Migration Impact                                    | Backward Compatibility                                |
| --------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| Adding prettier to devDependencies                  | `bun install` required after merge                  | Non-breaking; npm lifecycle                           |
| Add prettier + yamllint + actionlint to lint-staged | Hooks only fire on staged files matching new globs  | Additive; previously unchecked file types now checked |
| Add actionlint to pre-push                          | Only fires if `.github/workflows/*.yml` exists      | Graceful skip if no files                             |
| Add scripts to package.json                         | New script names only; existing scripts unchanged   | Non-breaking                                          |
| Create `.prettierrc`                                | Prettier config read on first `prettier` invocation | Non-breaking for Biome-managed files                  |
| Create `.prettierignore`                            | Blocks prettier from non-markdown files             | Only relevant if someone runs `prettier .` manually   |
| Create `.yamllint`                                  | yamllint reads this automatically on invocation     | Existing YAML files may surface new warnings          |

**Potential disruption:** Existing `.yml` and `.md` files may fail the new hooks if they contain
violations. Per spec Out of Scope: "Migrating or rewriting existing code to comply with new lint
rules is excluded." Developers encountering failures on existing files must fix or suppress per-file
with inline comments.

**Breaking change classification:** None — no existing scripts, hooks, or configurations are removed
or modified in a breaking way.

---

## Implementation Sequence

Tasks must be executed in this order to avoid intermediate states where hooks reference missing
config:

```
Step 1: Install prettier devDependency
  → bun add -D prettier@^3
  → Verify: grep prettier package.json

Step 2: Create .prettierrc (must exist before lint-staged invokes prettier)

Step 3: Create .prettierignore (scope restriction)

Step 4: Create .yamllint (yamllint reads this on first invocation)

Step 5: Update lint-staged.config.mjs (add 3 new entries)

Step 6: Add scripts to package.json

Step 7: Update .husky/pre-push (add actionlint scan)

Step 8: Write unit tests (tests/unit/lint-staged/lint-staged-config.test.ts)

Step 9: Validate pipeline manually
  → bun run format:check:md
  → bun run validate:yaml (requires yamllint installed)
  → bun run validate:workflows (requires actionlint installed)
  → bun run test:unit (must include new unit tests)
  → bun run lint

Step 10: Verify no regressions
  → bun run typecheck
  → bun run lint
```

---

## Architecture Governance

### Architecture Map Impact

No new modules introduced under `packages/` or `apps/`. No `ARCHITECTURE_MAP.json` update required.
No `bun run arch:add-module` invocation needed.

### infra-audit.ts Compliance

Changes are limited to root-level config files (`.prettierrc`, `.yamllint`, `.prettierignore`,
`lint-staged.config.mjs`) and shell scripts (`.husky/pre-push`). None of these are tracked as
architecture modules.

### ai-guard.ts Compliance

No new imports added. No cross-layer boundaries introduced. `ai-guard.ts` will not flag these
changes.

---

## Acceptance Criteria Traceability

| FR    | Acceptance Criterion                                           | Implementation Step                                          |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| FR-01 | `biome check` runs cleanly without ESLint/Prettier involvement | biome.json already configured; no change needed              |
| FR-02 | `prettier --check "**/*.md"` passes; `.ts` not invoked         | `.prettierignore` + `format:check:md` script                 |
| FR-03 | `yamllint .` runs on all YAML files                            | `.yamllint` config + `validate:yaml` script                  |
| FR-04 | `actionlint .github/workflows/*.yml` reports no errors         | pre-push hook update + `validate:workflows` script           |
| FR-05 | `git commit` triggers `bunx lint-staged`                       | Already implemented; no pre-commit change needed             |
| FR-06 | `lint-staged.config.mjs` has all 4 patterns                    | `lint-staged.config.mjs` update                              |
| FR-07 | pre-push runs: lint → ai-guard → infra-audit → actionlint      | `.husky/pre-push` update                                     |
| FR-08 | Monorepo-wide coverage (`apps/*`, `packages/*`, `scripts/*`)   | Biome covers root; yamllint covers `.`                       |
| FR-09 | No ESLint in TS/JS scope                                       | Verified — no ESLint in devDependencies                      |
| FR-10 | Tools executable via Bun                                       | lint-staged resolves local binaries; system tools documented |

---

## Generated Artifacts

| Artifact                      | Path                                                          | Status                                           |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Plan document (this file)     | `specs/runtime/infra-010-hybrid-lint-format-pipeline/plan.md` | ✅ Created                                       |
| Research doc (embedded above) | Phase 0 section of this plan                                  | ✅ Resolved inline — no clarifications remain    |
| Data model                    | N/A — no database changes                                     | ✅ Confirmed N/A                                 |
| API contracts                 | N/A — no external interfaces                                  | ✅ Confirmed N/A                                 |
| Quickstart guide              | System tool installation documented in plan                   | ✅ Included in System Tool Documentation section |

---

## Notes

- `biome.json` requires **zero changes** — it is correctly configured for this stage's requirements.
- The `.husky/pre-commit` hook requires **zero changes** — `bunx lint-staged` already invokes
  whatever `lint-staged.config.mjs` defines.
- The `prettier` devDependency is the only new npm package introduced. All other new tooling
  (yamllint, actionlint) is system-level.
- If `yamllint` or `actionlint` are not installed when a developer attempts to commit a YAML or
  workflow file, the hook will fail with `command not found`. This is intentional (FR-06) — failure
  transparency is required by NFR-06.
- The stage is purely additive. No existing workflow is disrupted by this implementation.

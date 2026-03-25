# Testing Guide — Hybrid Lint Format Pipeline

**Stage:** INFRA-010 Hybrid Lint Format Pipeline  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage Directory:** `specs/runtime/infra-010-hybrid-lint-format-pipeline/`  
**Generated On:** 2026-03-10

---

## Purpose

This guide explains how to validate the hybrid lint/format pipeline implemented in INFRA-010. It
covers automated test execution, manual verification of each pipeline layer, and troubleshooting for
common developer tooling issues.

---

## Summary of Delivered Behavior

This stage establishes a deterministic, fast, non-overlapping code quality enforcement system for
the Zidney monorepo.

Key outcomes:

- **Biome** handles all TS/JS/Vue/JSON linting and formatting on every pre-commit via lint-staged
- **Prettier** enforces Markdown formatting (`printWidth: 100`, `proseWrap: always`) on every
  pre-commit and via `format:check:md` script
- **yamllint** validates all YAML files on pre-commit (graceful skip if not installed)
- **actionlint** validates GitHub Actions workflows on pre-push (graceful skip if not installed)
- All tool responsibilities are non-overlapping — zero formatting conflicts
- Unit tests guard against configuration drift (11 spec cases, 21 assertions)

---

## Prerequisites

| Requirement                | Validation Command                                              |
| -------------------------- | --------------------------------------------------------------- |
| Bun installed              | `bun --version` (v1+, confirmed on 1.3.9)                       |
| Git hooks active (Husky)   | `cat .husky/pre-commit` — should show lint-staged invocation    |
| Correct branch checked out | `git branch` shows `spec/infra-010-hybrid-lint-format-pipeline` |
| Dependencies installed     | `bun install` if fresh clone                                    |
| yamllint (optional)        | `yamllint --version` or `brew install yamllint`                 |
| actionlint (optional)      | `actionlint --version` or `brew install actionlint`             |

---

## Files in Scope

```text
.prettierrc
.prettierignore
.yamllint
lint-staged.config.mjs
package.json (scripts: format:check:md, validate:yaml, validate:workflows)
.husky/pre-push
tests/unit/lint-staged/lint-staged-config.test.ts
```

---

## Local Run Commands

```bash
# Install dependencies (if necessary)
bun install

# Check if all .md files are correctly formatted
bun run format:check:md

# Fix .md formatting issues (if any)
bun prettier --write '**/*.md'

# Validate all YAML files (requires yamllint)
bun run validate:yaml

# Validate GitHub Actions workflows (requires actionlint)
bun run validate:workflows

# Run lint-staged unit tests only
bun run test tests/unit/lint-staged/lint-staged-config.test.ts

# Run full unit test suite
bun run test
```

---

## Automated Validation Commands

```bash
# Unit tests for lint-staged config wiring and config drift
bun run test tests/unit/lint-staged/lint-staged-config.test.ts
```

Expected outcome: **21 tests pass, 0 fail**.

Test coverage:

| Test Case | Assertion Count | What It Checks                                                  |
| --------- | --------------- | --------------------------------------------------------------- |
| T1        | 1               | Config object is defined and non-null                           |
| T2        | 1               | `*.md` key maps to an array                                     |
| T3        | 1               | `*.md` rule includes `prettier --write`                         |
| T4        | 1               | `*.{ts,...}` code key maps to an array                          |
| T5        | 8               | No code glob maps to prettier (per-glob sub-tests)              |
| T6        | 1               | `*.{yml,yaml}` key maps to an array                             |
| T7        | 1               | YAML rule includes `yamllint` command                           |
| T8        | 1               | `.github/workflows/*.yml` key maps to an array                  |
| T9        | 2               | `.prettierrc` has `printWidth: 100` + `proseWrap: always`       |
| T10       | 1               | `.prettierignore` does NOT explicitly include `*.md`            |
| T11       | 3               | `.yamllint` has `extends: default`, max: 120, check-keys: false |

---

## Manual Test Scenarios

### Scenario 1 — Pre-Commit Hook: Markdown Formatting

**Purpose:** Verify that Prettier auto-formats `.md` files on commit.

1. Create a test Markdown file with non-standard line width:
   ```bash
   echo "This is a very long line that exceeds one hundred characters in total and should be wrapped by prettier when committed to the repository" > /tmp/test-manual.md
   cp /tmp/test-manual.md docs/test-manual.md
   ```
2. Stage and attempt to commit:
   ```bash
   git add docs/test-manual.md
   git commit -m "test: manual prettier verification"
   ```
3. Observe the pre-commit hook output — it should show `prettier --write` being applied.
4. Check that the committed file has word-wrapped lines ≤ 100 chars.

Expected: Commit succeeds; file is auto-formatted.

Cleanup:

```bash
git reset HEAD~ && rm docs/test-manual.md
```

Troubleshooting: If hook does not run, verify `cat .husky/pre-commit` includes `npx lint-staged`.

---

### Scenario 2 — Pre-Commit Hook: TypeScript/JS via Biome

**Purpose:** Verify Biome runs on TS/JS files on commit (not Prettier).

1. Create a test TS file with a formatting issue (extra semicolons, spacing):
   ```bash
   echo "const x = 1 ;  const y = 2 ;" > /tmp/test-code.ts
   cp /tmp/test-code.ts apps/api/src/test-manual.ts
   ```
2. Stage and commit:
   ```bash
   git add apps/api/src/test-manual.ts
   git commit -m "test: manual biome verification"
   ```
3. Observe pre-commit output — should show `bun biome check --write` being applied.
4. Verify that Prettier was NOT invoked for `.ts` files (only Biome).

Expected: Commit succeeds; Biome formatted the file; Prettier did not run on `.ts`.

Cleanup:

```bash
git reset HEAD~ && rm apps/api/src/test-manual.ts
```

Troubleshooting: If Biome errors on the file, check `.prettierignore` excludes `*.ts` — it should.

---

### Scenario 3 — format:check:md Baseline (Edge Case)

**Purpose:** Verify that `format:check:md` exits 0 on the current repository state.

1. Run the check command:
   ```bash
   bun run format:check:md
   ```
2. Expected output:
   ```
   All matched files use Prettier code style!
   ```
3. Expected exit code: `0`

Expected: No formatting violations in `.md` files across the monorepo.

Troubleshooting: If exit code is non-zero, format violations exist. Fix with:

```bash
bun prettier --write '**/*.md'
bun run format:check:md  # should now be 0
```

Note: `.agents/` and `.specify/` directories are excluded from formatting via `.prettierignore`.

---

### Scenario 4 — yamllint Validation (Optional Tool)

**Purpose:** Verify yamllint integration if the tool is installed.

1. Check if yamllint is available:
   ```bash
   yamllint --version
   ```
2. If installed, run validation:
   ```bash
   bun run validate:yaml
   ```
3. Expected: All YAML files pass with at most warnings (no errors).

Troubleshooting: If not installed, the `bun run validate:yaml` command will still exit 0 (graceful
skip via bash conditional).

---

### Scenario 5 — actionlint Workflow Validation (Optional Tool)

**Purpose:** Verify actionlint integration if the tool is installed.

1. Check if actionlint is available:
   ```bash
   actionlint --version
   ```
2. If installed, run validation:
   ```bash
   bun run validate:workflows
   ```
3. Expected: All `.github/workflows/*.yml` files pass.

Also verify the pre-push hook:

```bash
cat .husky/pre-push
# Should contain: actionlint .github/workflows/ || { ... exit 1 ... }
```

Troubleshooting: If not installed, the pre-push hook will emit a warning and skip gracefully.

---

## Sign-Off Checklist

- [ ] `bun run format:check:md` exits 0 — all `.md` files pass Prettier check
- [ ] `bun run test tests/unit/lint-staged/lint-staged-config.test.ts` — 21 pass, 0 fail
- [ ] Pre-commit hook triggers on `.md` changes (Prettier applied)
- [ ] Pre-commit hook triggers on `.ts`/`.js` changes (Biome applied, not Prettier)
- [ ] `.prettierignore` excludes `*.ts`, `*.tsx`, `*.js`, `*.vue`, and AI tooling dirs
- [ ] `.yamllint` exists and contains `extends: default` with `line-length max: 120`
- [ ] No `console.log` in production code paths (N/A — tooling-only stage)
- [ ] Architecture score 100/100 confirmed from implementation commit hooks

---

## Notes for Reviewers

- The `.agents/` and `.specify/` directories are intentionally excluded from Prettier formatting —
  these are AI tooling directories not under project formatting governance.
- The 955 `.md` files formatted in commit `d9b9d2e` serve as the formatting baseline. All future
  `.md` commits will be auto-formatted on pre-commit.
- Pre-existing Biome errors in `apps/api/src/` (13 errors) are **not** introduced by this stage —
  they are pre-existing and documented in `audits/VALIDATION_REPORT.md`.
- yamllint and actionlint are optional — CI will pass without them installed locally, and the hooks
  emit a clear warning when skipped.

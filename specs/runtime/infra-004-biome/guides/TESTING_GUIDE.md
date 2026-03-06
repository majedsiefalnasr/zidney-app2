# Testing Guide: STAGE_INFRA_04_BIOME

**Feature:** Biome Unified Linting & Formatting Toolchain  
**Stage:** STAGE_INFRA_04_BIOME  
**Date:** 2026-03-06

---

## Quick Start

### Prerequisites

```bash
# Ensure Node/Bun is installed
bun --version  # Should be v1.2+ (Biome compatible)

# Clone/pull the current spec/infra-004-biome branch
git checkout spec/infra-004-biome
bun install    # Downloads @biomejs/biome + restored dependencies
```

### Verify Biome Installation

```bash
bun biome --version
# Expected: Output version 2.x+ (e.g., "biome 2.4.6")

bun run lint
# Expected: Exit code 0 (no violations)

bun run format:check
# Expected: Exit code 0 (all files properly formatted)
```

---

## Test Scenarios

### SC1: Formatibility — All Source Files Match Biome Line Width (100 chars)

**Goal:** Verify that the formatter enforces consistent line width across all source files.

**Test Steps:**

```bash
# Run the formatter check
bun run format:check

# Expected: Exit code 0
# If violations exist: Run auto-fix and commit
bun biome format --write .
git add -A && git commit -m "chore: apply Biome formatting"
```

**Acceptance:** `bun run format:check` exits with code 0 across all files.

---

### SC2: Lintability — No unresolved Linter Violations

**Goal:** Confirm that all `noConsole`, `noUnusedImports`, `noDuplicateImports`, and structural violations are resolved.

**Test Steps:**

```bash
# Run the linter
bun run lint

# Expected: Exit code 0, zero violations reported
```

**Acceptance:** `bun run lint` exits with code 0.

---

### SC3: Library Imports — @zidney/logger Correctly Replaces console.\*

**Goal:** Verify that structured logging is correctly wired in backend services.

**Test Steps:**

```bash
# Check that @zidney/logger is imported where console was removed
grep -r "import.*@zidney/logger" apps/api/src/ apps/worker/src/ packages/domain-core/src/ | head -10

# Expected: Multiple imports visible across API, Worker, and domain-core

# Verify no stray console.* calls remain (excluding overridden files)
grep -r "console\." apps/api/src/ apps/worker/src/ packages/domain-core/src/ \
  --exclude-dir=db --exclude="structured-logger.ts" --exclude="master-db-logger.ts" 2>/dev/null

# Expected: No output (no unhandled console calls)
```

**Acceptance:** @zidney/logger is the primary logging mechanism; migration runners and logger bridges use biome-ignore suppressions.

---

### SC4: Test Suite Integrity — Unit Tests Still Pass

**Goal:** Confirm that the console.\* migrations and formatter changes don't break the test suite.

**Test Steps:**

```bash
# Run the full unit test suite
bun run test:unit

# Expected: Exit code 0
# Expected output: "X Test Files passed, Y tests passed | Z skipped"
```

**Acceptance:** All unit tests pass (962 tests passing, 1 skipped).

---

### SC5: Type Safety — TypeScript Compilation Clean

**Goal:** Verify that the formatter and logger migrations don't introduce type errors.

**Test Steps:**

```bash
# Run TypeScript type check
bun run typecheck

# Expected: Exit code 0, no type errors
```

**Acceptance:** `bun typecheck` exits with code 0.

---

### SC6: Pre-commit Linting — lint-staged Hook Works

**Goal:** Verify that the pre-commit hook enforces linting on staged files.

**Test Steps:**

```bash
# Make a test change (any TypeScript file)
echo "// test comment" >> apps/api/src/index.ts

# Stage the file
git add apps/api/src/index.ts

# Attempt commit (lint-staged should run)
git commit -m "test: verify pre-commit linting"

# Expected behavior:
#  - If violation exists: commit is blocked, lint-staged shows message
#  - If no violation: commit succeeds
#  - File is auto-formatted via "bun biome check --apply"

# Clean up
git reset HEAD~1 apps/api/src/index.ts
git checkout apps/api/src/index.ts
```

**Acceptance:** Pre-commit hook executes Biome linting and blocks commits with violations.

---

### SC7: CI/CD Pipeline — GitHub Actions Lint Job

**Goal:** Verify that CI enforces Biome linting on all pull requests.

**Test Steps:**

```bash
# Simulate CI lint steps locally
bun biome check .      # Should exit 0
bun biome format --check .  # Should exit 0

# Expected: Both commands exit with code 0
```

**Acceptance:** CI workflow runs successfully; lint job in `.github/workflows/ci.yml` uses Biome commands.

---

### SC8: IDE Integration — VSCode Biome Extension

**Goal:** Verify that the Biome extension is recommended and integrated.

**Test Steps:**

```bash
# Check that the extension is recommended
cat .vscode/extensions.json | grep biomejs.biome

# Expected: "biomejs.biome" appears in recommendations array

# In VS Code:
# 1. Open a TypeScript file (e.g., apps/api/src/index.ts)
# 2. Right-click → Format Document
# 3. Expected: Biome formatter is available in the dropdown
# 4. Verify that editor.defaultFormatter is set to biomejs.biome:
#    File → Preferences → Settings → Search "defaultFormatter"
#    Should show biomejs.biome for [typescript], [javascript], [vue], [json]
```

**Acceptance:** VSCode extension is recommended; Biome is the default formatter.

---

### SC9: Logger Bridge Evaluation — Structured Logger is Preserved

**Goal:** Verify that apps/worker/src/observability/structured-logger.ts and packages/domain-core/src/logging/master-db-logger.ts are correctly overridden or migrated.

**Test Steps:**

```bash
# Check biome.json for the noConsole override
grep -A5 "noConsole" biome.json | head -20

# Expected: Override includes patterns like:
#   - "apps/worker/src/observability/structured-logger.ts"
#   - "packages/domain-core/src/logging/master-db-logger.ts"
# OR these files have been migrated to @zidney/logger

# Verify the files exist and have no console.* violations after override
bun biome check apps/worker/src/observability/structured-logger.ts 2>&1 | grep -i console

# Expected: No output (no console violations)
```

**Acceptance:** Logger bridges are either:

- Overridden in biome.json with `noConsole: "off"` AND exist, OR
- Fully migrated to @zidney/logger

---

### SC10: Migration Runner Suppressions — Database Output Preserved

**Goal:** Verify that migration runners retain their console.\* output via biome-ignore comments.

**Test Steps:**

```bash
# Check that migration runners have biome-ignore comments
grep -n "biome-ignore" apps/api/src/db/master/migrations/runner.ts

# Expected: Biome-ignore comments appear above console.* calls
# Example:
#   // biome-ignore lint/suspicious/noConsole: migration runner output
#   console.log(...)

# Verify linter doesn't complain about migration files
bun biome check apps/api/src/db/master/migrations/runner.ts

# Expected: Exit code 0 (biome-ignore suppressions are recognized)
```

**Acceptance:** Migration runners have biome-ignore suppressions; linter accepts them.

---

### SC11: Performance — No Lint/Format Slowdowns

**Goal:** Verify that Biome performance is acceptable for daily development workflows.

**Test Steps:**

```bash
# Time a full lint pass
time bun run lint

# Expected: < 30 seconds for a typical monorepo

# Time a full format check
time bun run format:check

# Expected: < 30 seconds for a typical monorepo
```

**Acceptance:** Lint and format operations complete in reasonable time (< 30 seconds).

---

### SC12: Developer Experience — Linting Error Messages Are Clear

**Goal:** Verify that Biome error messages are informative and actionable.

**Test Steps:**

```bash
# Intentionally introduce a violation
echo "const x = 5; console.log('debug'); const y = x;" >> apps/api/src/test-violation.ts

# Run linter
bun run lint 2>&1 | grep -A3 "test-violation.ts"

# Expected: Clear error message identifying:
#   - File path
#   - Line number
#   - Violation type (e.g., "console.* is not allowed")
#   - Suggestion (e.g., "consider using logger instead")

# Clean up
rm apps/api/src/test-violation.ts
```

**Acceptance:** Linter produces clear, actionable error messages.

---

### SC13: Dependency Cleanup — ESLint & Prettier Removed

**Goal:** Verify that legacy ESLint and Prettier packages are completely removed.

**Test Steps:**

```bash
# Check package.json for legacy dependencies
grep -E "eslint|prettier|typescript-eslint|globals" package.json

# Expected: No output (no legacy packages)

# Verify bun.lock doesn't reference them
grep -E "eslint|prettier" bun.lock

# Expected: No output (locked dependencies are clean)
```

**Acceptance:** No ESLint, Prettier, or related packages remain in dependencies.

---

### SC14: Configuration Files Deleted — Legacy Configs Gone

**Goal:** Verify that old ESLint and Prettier config files have been removed.

**Test Steps:**

```bash
# Search for legacy config files
find . \( -name "eslint.config*" -o -name ".prettierrc*" -o -name "prettier.config*" \) \
  -not -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*"

# Expected: No output (no legacy config files found)
```

**Acceptance:** All legacy ESLint and Prettier configuration files are deleted.

---

## Automated Test Commands

Run all verification gates in sequence:

```bash
#!/bin/bash
set -e

echo "1. Format check..."
bun run format:check

echo "2. Lint check..."
bun run lint

echo "3. Type check..."
bun run typecheck

echo "4. Unit tests..."
bun run test:unit

echo "✅ All gates passed!"
```

---

## Troubleshooting

### Problem: `biome` command not found

**Solution:**

```bash
bun install
npx biome --version  # or: bunx biome --version
```

### Problem: Pre-commit hook fails

**Solution:**

```bash
# Ensure lint-staged is installed
bun install

# Manually run Biome on the file
bun biome check --apply <file>

# Stage & commit again
git add <file>
git commit -m "message"
```

### Problem: VSCode doesn't use Biome formatter

**Solution:**

```bash
# Install the extension
# Command: "Extensions: Install Extensions" → search "Biome" → install biomejs.biome

# Verify settings.json is correct
# .vscode/settings.json should contain:
#   "[typescript]": { "editor.defaultFormatter": "biomejs.biome" }
#   "[javascript]": { "editor.defaultFormatter": "biomejs.biome" }
```

### Problem: Tests fail after merge

**Solution:**

```bash
# Clear node_modules and reinstall (in case lockfile is stale)
rm -rf node_modules bun.lock
bun install

# Re-run tests
bun run test:unit
```

---

## Acceptance Checklist

Before considering this stage complete, verify:

- [ ] `bun run lint` exits 0
- [ ] `bun run format:check` exits 0
- [ ] `bun run typecheck` exits 0
- [ ] `bun run test:unit` exits 0 (962 tests, 1 skipped)
- [ ] No ESLint or Prettier packages remain in package.json
- [ ] No legacy `.eslintrc`, `prettier.config`, or related files exist
- [ ] biome.json exists at repo root with proper configuration
- [ ] `.vscode/extensions.json` recommends biomejs.biome
- [ ] CI/CD lint job uses `bun biome check .` and `bun biome format --check .`
- [ ] Pre-commit hook invokes `bun biome check --apply`
- [ ] Root README.md documents the new Biome workflow
- [ ] All test files have `noConsole: "off"` override in biome.json
- [ ] All migration runners have biome-ignore suppressions on console.\* calls
- [ ] All backend services use @zidney/logger instead of console.\*

---

**Created:** 2026-03-06  
**Stage:** STAGE_INFRA_04_BIOME  
**For Developers & QA:** Perform these tests before staging/production deployment

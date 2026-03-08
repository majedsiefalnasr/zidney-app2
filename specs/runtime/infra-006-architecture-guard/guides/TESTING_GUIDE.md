# Testing Guide — STAGE_INFRA_06_ARCHITECTURE_GUARD

**Stage:** STAGE_INFRA_06_ARCHITECTURE_GUARD
**Phase:** 01_PLATFORM_FOUNDATION
**Stage Directory:** infra-006-architecture-guard
**Generated On:** 2026-03-08

---

## Purpose

This guide explains how to validate the implementation for STAGE_INFRA_06_ARCHITECTURE_GUARD.
Use it to run tests, verify the architecture guard CLI, and confirm that the pre-commit hook
continues to enforce all boundary rules.

---

## Summary of Delivered Behavior

This stage formalizes the Zidney architecture protection system by adding tests and developer
tooling around `scripts/ai-guard.ts` — the pre-commit hook that blocks forbidden cross-layer
imports, cross-app imports, and relative path leaks.

Key outcomes:

- Developers can now run `bun run arch:guard` to validate architecture manually at any time
- The 7 core validation functions inside `ai-guard.ts` are now covered by 37 automated unit tests
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` is now validated by 7 static tests
  that assert the contract correctly encodes all required boundary rules
- The `import.meta.main` guard ensures `ai-guard.ts` can be imported in tests without triggering
  the full pre-commit scan side effect

---

## Prerequisites

| Requirement                  | Validation Command / Check                                        |
| ---------------------------- | ----------------------------------------------------------------- |
| Bun installed                | `bun --version` (v1.0+)                                           |
| Correct branch checked out   | `git branch --show-current` → `spec/infra-006-architecture-guard` |
| Dependencies installed       | `bun install` from repo root                                      |
| Architecture brain exists    | `ls docs/ai/context/ai-architecture-brain.json`                   |
| Architecture contract exists | `ls docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json`    |

---

## Files in Scope

```text
scripts/ai-guard.ts                                           (modified — 7 exports added)
package.json                                                  (modified — arch:guard script)
tests/unit/ai-guard/fixtures/valid-package-imports.ts         (new)
tests/unit/ai-guard/fixtures/cross-app-violation.ts           (new)
tests/unit/ai-guard/fixtures/packages-import-apps-violation.ts (new)
tests/unit/ai-guard/fixtures/relative-leak-violation.ts       (new)
tests/unit/ai-guard/fixtures/clean-api-file.ts                (new)
tests/unit/ai-guard/ai-guard-validation.test.ts               (new — 37 tests)
tests/static/05-architecture-guard.test.ts                    (new — 7 tests)
```

---

## Automated Validation Commands

### Run all tests for this stage

```bash
# From repo root
bun run vitest run tests/unit/ai-guard/ai-guard-validation.test.ts tests/static/05-architecture-guard.test.ts
```

Expected: `37 passed | 7 passed | 0 failed`

### Run unit tests only

```bash
bun run vitest run tests/unit/ai-guard/ai-guard-validation.test.ts
```

Expected: `37 passed | 0 failed`
7 describe blocks should all show green:

- `extractImports`
- `detectModule`
- `detectFileModule`
- `validateRules — cross-app`
- `validateRules — packages-import-apps`
- `validateRelativeLeaks`
- `validateArchitectureMap`

### Run static tests only

```bash
bun run vitest run tests/static/05-architecture-guard.test.ts
```

Expected: `7 passed | 0 failed`
ARCHITECTURE_CONTRACT.json must encode all 4 required boundary rules.

### Run architecture guard manually

```bash
bun run arch:guard
```

Expected: `AI Guard: architecture validation passed.`
If there are violations, the guard will list them and exit with code 1.

### Run full infrastructure audit

```bash
bun scripts/infra-audit.ts
```

Expected: architecture score `100 / 100`, `Governance checks passed.`

---

## Manual Test Scenarios

### Scenario 1 — New file with forbidden cross-app import is blocked at commit

**Purpose:** Confirm the Husky pre-commit hook rejects a cross-app import.

1. Create a temporary file in `apps/api/src/`:
   ```typescript
   // temp-violation.ts
   import {something} from 'apps/mmc/src/services/test'
   ```
2. Stage it: `git add apps/api/src/temp-violation.ts`
3. Attempt a commit: `git commit -m "test violation"`

Expected:
The commit is rejected. Terminal output includes:

```
AI Guard: Architecture violations detected.
[AI-Guard] VIOLATION: Cross-app boundary violation in apps/api/src/temp-violation.ts
Commit rejected by Zidney AI Guard.
```

Troubleshooting: If the commit succeeds, verify `.husky/pre-commit` contains the ai-guard step.
Run `cat .husky/pre-commit` and confirm `bun scripts/ai-guard.ts` is present.

---

### Scenario 2 — `bun run arch:guard` reports clean on current branch

**Purpose:** Confirm the `arch:guard` npm script works as a standalone CLI command.

1. From repo root: `bun run arch:guard`
2. Observe terminal output.

Expected:

```
AI Guard: using ai-architecture-brain.json for rule validation.
AI Guard: architecture validation passed.
```

Exit code: 0

Troubleshooting: If the command fails with "Cannot find module", ensure `bun install` has been run
from the repo root. If the guard finds violations, identify the file from the output and fix the
import.

---

### Scenario 3 — Unit test isolation (Edge Case)

**Purpose:** Confirm that importing `ai-guard.ts` in a test does NOT trigger the real `runGuard()`
file-system scan.

1. Run: `bun run vitest run tests/unit/ai-guard/ai-guard-validation.test.ts --reporter=verbose`
2. Observe: the test suite should complete without any file-system errors or "changed files"
   output.

Expected:
All 37 tests pass. No `[AI-Guard]` or `[INFRA AUDIT]` output is printed during the test run.

---

## Negative Cases

| Scenario                              | Trigger                                        | Expected Response                                 |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Cross-app boundary import             | `import {} from 'apps/mmc/...'` in `apps/api`  | `AI Guard: Architecture violations detected`      |
| packages/ importing apps/             | `import {} from 'apps/api/...'` in `packages/` | `AI Guard: Architecture violations detected`      |
| Relative path leak across boundary    | `import {} from '../../apps/api/...'`          | `AI Guard: Architecture violations detected`      |
| ARCHITECTURE_CONTRACT.json malformed  | Remove `forbidPackagesImportingApps` key       | Static test `05-architecture-guard.test.ts` fails |
| ai-guard.ts called without brain file | Delete `ai-architecture-brain.json`            | Guard falls back to `ARCHITECTURE_CONTRACT.json`  |

---

## Multi-Tenant Isolation Verification

Not applicable. This stage contains no API routes, no database access, and no tenant-scoped
logic. All changes are confined to development tooling (tests + CLI script).

---

## Structured Log Verification

Not applicable for this stage. The architecture guard outputs structured console messages
(not application logs) when violations are detected. No `console.log` was introduced.

---

## Sign-Off Checklist

- [ ] `bun run vitest run tests/unit/ai-guard/ai-guard-validation.test.ts` → 37/37 PASS
- [ ] `bun run vitest run tests/static/05-architecture-guard.test.ts` → 7/7 PASS
- [ ] `bun run arch:guard` exits 0 with "architecture validation passed"
- [ ] `bun scripts/infra-audit.ts` reports score 100/100
- [ ] Husky hook rejects a test commit containing a cross-app import (Scenario 1)
- [ ] No new `console.log` statements in `scripts/ai-guard.ts`

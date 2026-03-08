# Testing Guide — STAGE_INFRA_07_MODULE_BOUNDARIES

**Stage:** STAGE_INFRA_07_MODULE_BOUNDARIES  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage Directory:** `specs/runtime/infra-007-module-boundaries`  
**Generated On:** 2025-07-18

---

## Purpose

This guide explains how to validate the module-boundaries governance implementation end-to-end. All tests are automated and integrate into CI/CD.

---

## Summary of Delivered Behavior

This stage introduces a machine-readable module-boundary contract (`docs/architecture/module-boundaries.json`) that enforces architectural layer separation and cross-cutting constraints at pre-commit time. The governance engine (ai-guard.ts + extended infra-audit.ts) validates every commit against the contract, catching architectural violations before they reach CI.

Key outcomes:

- Module boundaries are machine-enforced (not just documented)
- Layer violations detected in real-time (pre-commit)
- Cross-cutting rules prevent specific architectural patterns (e.g., packages cannot import apps)
- Undeclared modules discovered automatically
- Full test coverage of validation logic (43 tests, all scenarios)

---

## Prerequisites

| Requirement            | Validation Command / Check                                           |
| ---------------------- | -------------------------------------------------------------------- |
| Node.js installed      | `node --version` (v20+)                                              |
| Bun installed          | `bun --version` (v1+)                                                |
| Git configured         | `git config --global user.name` && `git config --global user.email`  |
| Branch checked out     | `git branch` shows `spec/infra-007-module-boundaries` or `develop`   |
| Dependencies installed | `bun install` (or already done)                                      |
| module-boundaries.json | `ls -la docs/architecture/module-boundaries.json` (file exists)      |
| ai-guard script        | `ls -la scripts/ai-guard.ts` (file exists, contains export keywords) |
| Test files present     | `ls tests/static/module-boundaries.test.ts` (and unit/ paths)        |

---

## Files in Scope

```text
New files:
 docs/architecture/module-boundaries.json
 tests/static/module-boundaries.test.ts
 tests/unit/ai-guard/ai-guard-boundaries.test.ts
 tests/unit/infra-audit/infra-audit-boundaries.test.ts

Modified files:
 scripts/ai-guard.ts (+5 exported functions)
 scripts/infra-audit.ts (+findUndeclaredModulesFromBoundaries)
 package.json (ai-guard and test:unit:boundaries scripts)
 .github/workflows/ci.yml (module-boundary-validation + test:unit:boundaries steps)
```

---

## Quick Validation Commands

Run these commands in any order to validate the implementation:

```bash
# Option 1: Run all 43 new tests
bun run test:unit:boundaries

# Option 2: Run static structure tests only
npx vitest run tests/static/module-boundaries.test.ts

# Option 3: Run ai-guard unit tests only
npx vitest run tests/unit/ai-guard/ai-guard-boundaries.test.ts

# Option 4: Run infra-audit integration tests only
npx vitest run tests/unit/infra-audit/infra-audit-boundaries.test.ts

# Option 5: Runtime execution of ai-guard (≤0.4s)
bun run ai-guard

# Option 6: Full typecheck
bun run tsc --noEmit

# Option 7: Lint (should see 0 errors)
bun run biome check scripts/ai-guard.ts scripts/infra-audit.ts tests/
```

**Expected outcome:** All commands exit with code 0. All tests pass. No errors.

---

## Automated Validation Commands (CI)

These commands mirror the CI pipeline and validate the entire module boundary system:

```bash
# Unit tests (all 43 new tests in the test:unit:boundaries bundle)
bun run test:unit:boundaries

# AI guard runtime execution (pre-commit hook gate)
bun run ai-guard

# Type check (catches TypeScript errors)
bun run tsc --noEmit

# Lint (catches code style violations)
bun run biome check .

# Full suite (recommended for pre-deployment verification)
bun run test:unit:boundaries && bun run ai-guard && bun run tsc --noEmit && bun run biome check .
```

---

## Manual Test Scenarios

### Scenario 1 — Static Schema Validation

**Purpose:** Verify that `docs/architecture/module-boundaries.json` is well-formed and contains all required fields.

**Run:**

```bash
npx vitest run tests/static/module-boundaries.test.ts
```

**Expected output:**

```
✓ tests/static/module-boundaries.test.ts (7 tests) 44ms
```

**Concrete checks:**

- File exists and is valid JSON
- Top-level keys: `version`, `layers`, `allowed_dependencies`, `forbidden_dependencies`, `cross_cutting_rules`
- Layer names: `infrastructure`, `domain`, `runtime`, `ui`
- All 13 expected modules declared
- Dependency matrix complete (4 rows × 4 columns)
- Cross-cutting rules array non-empty
- Forbidden dependencies object non-empty

**Troubleshooting:**

- If "JSON parse error" → check JSON syntax: `bun run json.stringify docs/architecture/module-boundaries.json`
- If "missing field" → verify all required fields are present
- If "unknown layer" → add missing layer to `layers` object

---

### Scenario 2 — Layer Boundary Enforcement

**Purpose:** Verify that layer violations (e.g., ui → domain imports) are detected by `ai-guard.ts`.

**Run:**

```bash
npx vitest run tests/unit/ai-guard/ai-guard-boundaries.test.ts
```

**Expected output:**

```
✓ tests/unit/ai-guard/ai-guard-boundaries.test.ts (28 tests) 312ms
```

**What's tested:**

- loadModuleBoundaries() parses and validates the JSON structure
- loadTsAliases() reads TypeScript path aliases from tsconfig
- resolveImportToModule() correctly maps import statements to declared modules
- matchesGlobPattern() utility works correctly (wildcard, extension matching)
- validateLayerBoundaries() detects forbidden layer transitions (e.g., ui importing domain packages)
- Error cases: missing file, malformed JSON, unknown modules, cross-cutting rule violations
- All error paths are covered (13 scenarios: a–m, plus scenario n for happy-path valid file load)

**Concrete test cases:**

- Scenario c: `import { logger } from '@zidney/logger'` → resolves to `packages/logger` → infrastructure layer ✅
- Scenario f: `import { User } from '@zidney/domain-core'` in ui layer → violates layer rules → BLOCKED ✅
- Scenario h: `import { Button } from 'apps/backoffice'` (cross-app) → violates cross-cutting rule → BLOCKED ✅
- Scenario j: malformed JSON → process.exit(1) with error message ✅
- Scenario l: missing file → console.error + process.exit(1) ✅

**Troubleshooting:**

- If test "resolveImportToModule scenario X" fails → check TypeScript alias definitions in tsconfig.json
- If "validateLayerBoundaries" fails → review allowed_dependencies matrix in module-boundaries.json
- If "cross-cutting rule" test fails → check cross_cutting_rules array for correct pattern (glob vs. string)

---

### Scenario 3 — Infra-Audit Integration (Undeclared Modules)

**Purpose:** Verify that `infra-audit.ts` detects modules under `packages/` and `apps/` that are not declared in module-boundaries.json.

**Run:**

```bash
npx vitest run tests/unit/infra-audit/infra-audit-boundaries.test.ts
```

**Expected output:**

```
✓ tests/unit/infra-audit/infra-audit-boundaries.test.ts (8 tests) 89ms
```

**What's tested:**

- `findUndeclaredModulesFromBoundaries()` scans packages/ and apps/ directories
- Detected modules compared against module-boundaries.json layers
- Undeclared modules reported (informational in normal runs; blocking under --ci-strict)
- `import.meta.main` guard prevents side effects when infra-audit.ts is imported as a module (not standalone)

**Concrete test cases:**

- Infrastructure layer: packages/logger, packages/config, packages/types, packages/redis-utils → all declared ✅
- Domain layer: packages/domain-core, packages/validation → all declared ✅
- Runtime layer: apps/api, apps/worker → all declared ✅
- UI layer: apps/mmc, apps/backoffice, apps/frontoffice, packages/ui-system, packages/api-client → all declared ✅
- Undeclared: if a module exists in file system but not in module-boundaries.json → detected and reported ✅

**Troubleshooting:**

- If "undeclared module: packages/X" → add to appropriate layer in module-boundaries.json
- If "import.meta.main guard" fails → verify import.meta idiom is supported in your Node/Bun version (v20+)
- If "fs.readdirSync fails" → verify packages/ and apps/ directories exist

---

### Scenario 4 — AI Guard Runtime Execution (Performance)

**Purpose:** Verify that `bun run ai-guard` loads module-boundaries.json and validates the current repository state successfully.

**Run:**

```bash
time bun run ai-guard
```

**Expected output:**

```
AI Guard: module-boundaries.json loaded — layer boundary validation enabled.
AI Guard: architecture validation passed.
Exit code: 0
Wall-clock: ~0.4 seconds
```

**What's validated:**

- module-boundaries.json is successfully loaded and parsed
- All modules in the repo are declared
- No layer violations detected in current state
- No cross-cutting rule violations
- No circular dependencies
- Architecture score: 100/100

**Performance threshold (NFR-004):**

- ✅ Pass: ≤ 30 seconds
- ❌ Fail: > 30 seconds

**Troubleshooting:**

- If "module-boundaries.json not found" → verify file path: `ls docs/architecture/module-boundaries.json`
- If "layer violation detected!" → run `git diff` to check recent changes; review module-boundaries.json rules
- If "takes > 30s" → profile the script; likely cause is large number of files to scan or slow JSON parsing

---

### Scenario 5 — Pre-Commit Hook Integration

**Purpose:** Verify that the pre-commit hook (Husky) runs ai-guard and blocks commits on violations.

**Run manually:**

```bash
# Make a test change
echo "import { x } from 'apps/api'" > /tmp/test.ts
cp /tmp/test.ts test-violation.ts
git add test-violation.ts
git commit -m "test: trigger boundary violation"
```

**Expected outcome:**

- Husky runs ai-guard
- Detects cross-app dependency
- Commit is rejected
- Error message displayed
- test-violation.ts remains staged (user can fix and retry)

**Cleanup (if you ran the manual test):**

```bash
git reset HEAD test-violation.ts
rm test-violation.ts
```

**Troubleshooting:**

- If Husky doesn't run → verify `.husky/pre-commit` exists and is executable
- If ai-guard doesn't block → verify module-boundaries.json cross_cutting_rules array contains the pattern
- If you can't revert the commit → use `git reset --soft HEAD~1` to undo the commit but keep changes staged

---

### Scenario 6 — CI Pipeline Integration

**Purpose:** Verify that the CI pipeline runs the module-boundary validation.

**Check in CI logs:**

```bash
# Look for these steps in .github/workflows/ci.yml
- name: module-boundary-validation
  run: bun run ai-guard

- name: Run module boundary unit tests
  run: bun run test:unit:boundaries
```

**Expected:**

- Both steps pass (exit 0)
- Tests: all 43 pass
- Runtime: ai-guard < 30 seconds

**Troubleshooting:**

- If CI step fails but local `bun run ai-guard` passes → check for OS-specific path issues (Windows vs. Unix paths)
- If 43 tests don't run in CI → verify `test:unit:boundaries` script is defined in package.json
- If timeout occurs → increase timeout threshold in workflows; investigate slow tests

---

## Edge Cases & Advanced Scenarios

### Edge Case 1 — Adding a New Module

If you create a new module (e.g., `packages/new-module`):

1. **Pre-commit will warn:**

   ```
   [INFRA AUDIT] ⚠️ Undeclared modules detected:
   undeclared module: packages/new-module
   ```

2. **To register:**

   ```bash
   # Option A: Edit docs/architecture/module-boundaries.json manually
   # Add to the appropriate layer, then commit

   # Option B: Use the helper script (if available)
   bun run arch:add-module packages/new-module
   ```

3. **Verify:**
   ```bash
   bun run ai-guard  # Should show zero undeclared modules
   ```

### Edge Case 2 — Cross-Layer Import

If code accidentally imports across layers:

```typescript
// In apps/mmc (ui layer)
import {Domain} from '@zidney/domain-core' // domain layer
// Result: BLOCKED by ai-guard at pre-commit
```

**To fix:**

1. Remove the cross-layer import
2. Refactor through allowed boundary (API client or service interface)
3. Re-commit

### Edge Case 3 — Updating module-boundaries.json

If you need to modify the governance rules:

1. Edit `docs/architecture/module-boundaries.json`
2. Run tests to verify structure:
   ```bash
   npx vitest run tests/static/module-boundaries.test.ts
   ```
3. Run ai-guard to validate against repo:
   ```bash
   bun run ai-guard
   ```
4. Commit (pre-commit will re-validate)

---

## Validation Checklist (QA / Reviewers)

Before approving this PR:

- [ ] All 43 tests pass: `bun run test:unit:boundaries` → 43/43
- [ ] Type check passes: `bun run tsc --noEmit` → exit 0
- [ ] Lint passes: `bun run biome check` → exit 0, 0 errors
- [ ] AI guard executes: `bun run ai-guard` → exit 0, < 0.4s
- [ ] CI passes on this branch
- [ ] module-boundaries.json is well-formed (static tests confirm)
- [ ] All 13 modules declared in layers
- [ ] Dependency matrix is complete
- [ ] Cross-cutting rules make sense
- [ ] Documentation (spec.md, plan.md) aligns with implementation

---

## Support & Troubleshooting

**Common Issues:**

| Issue                              | Cause                                | Solution                                              |
| ---------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| `module-boundaries.json not found` | File path error                      | Verify: `ls docs/architecture/module-boundaries.json` |
| `layer violation detected!`        | Wrong rule in module-boundaries.json | Review allowed_dependencies matrix                    |
| `43 tests don't run in CI`         | test:unit:boundaries script missing  | Check package.json `scripts` section                  |
| `ai-guard takes > 30s`             | Large codebase or slow machine       | Profile with `time bun run ai-guard`                  |
| `Cross-app import not blocked`     | Cross-cutting rule not in list       | Add glob pattern to cross_cutting_rules               |
| Pre-commit doesn't run             | Husky not installed                  | Run `bun install` and re-configure hooks              |

**Contact / Questions:**

Refer to:

- [IMPLEMENT_REPORT.md](reports/IMPLEMENT_REPORT.md) — implementation details
- [VALIDATION_REPORT.md](audits/VALIDATION_REPORT.md) — test results & evidence
- [CLOSURE_REPORT.md](reports/CLOSURE_REPORT.md) — final summary

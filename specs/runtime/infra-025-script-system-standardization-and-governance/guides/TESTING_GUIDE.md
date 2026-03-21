# Testing Guide — Script System Standardization And Governance

**Version:** 1.0  
**Last Updated:** 2026-03-21  
**Stage:** INFRA-025  
**Status:** PRODUCTION READY

---

## Overview

This guide provides step-by-step instructions for testing the INFRA-025 Script System Standardization And Governance stage. The stage introduces 4 new validators, a migration engine, and unified script governance across the Zidney monorepo.

**Who should read this guide:**

- QA engineers and code reviewers
- CI/CD maintainers verifying automation
- Platform engineers validating deployment safety

---

## Component Overview

### 1. Script Naming Validator (`validate:script:naming`)

**Purpose:** Enforces `domain:action[:scope]` naming convention  
**Languages:** TypeScript/Bun  
**Files:** `scripts/validate/script-naming.ts` + test suite

### 2. Script Usage Validator (`validate:script:usage`)

**Purpose:** Scans repo for `bun run` references and validates against known scripts  
**Languages:** TypeScript/Bun  
**Files:** `scripts/validate/script-usage.ts` + test suite

### 3. Script Infrastructure Validator (`validate:script:infrastructure`)

**Purpose:** Validates metadata headers and registry freshness  
**Languages:** TypeScript/Bun  
**Files:** `scripts/validate/script-infrastructure.ts` + test suite

### 4. Refactor Engine (`dev:refactor:scripts`)

**Purpose:** Automates script migrations (Types A–E) from SCRIPT_MIGRATION_MAP.md  
**Languages:** TypeScript/Bun  
**Files:** `scripts/dev/refactor-scripts.ts` + test suite

---

## Manual Test Scenarios

### Scenario 1: Validator Accuracy — validate:script:naming

**Objective:** Verify that the naming validator correctly identifies compliant and non-compliant script names.

**Setup:**

```bash
cd /path/to/zidney-app2
git checkout spec/infra-025-script-system-standardization-and-governance
```

**Test Steps:**

1. **Verify validator passes on compliant scripts:**

   ```bash
   bun run validate:script:naming
   ```

   **Expected:** Exits with code 0 (no violations)

2. **Test false positive avoidance (lifecycle-exempt scripts):**

   ```bash
   # Check package.json for LIFECYCLE_EXEMPT entries (migrate, start, stop, etc.)
   grep -A 20 "lifecycle" scripts/validate/script-naming.ts
   ```

   **Expected:** LIFECYCLE_EXEMPT excludes `migrate`, `start`, `stop`, `test`, `build`, `dev`, `lint`, `format`, `dev:refactor:scripts`

3. **Review allowed domains:**

   ```bash
   grep "ALLOWED_DOMAINS" scripts/validate/script-naming.ts | head -1
   ```

   **Expected:** 9 canonical domains: `db`, `arch`, `validate`, `ai`, `ci`, `repo`, `dev`, `infra`, `test`

4. **Expected zero violations:**
   ```bash
   bun run validate:script:naming 2>&1 | grep -E "violation|error|FAIL" || echo "PASS: No violations"
   ```

---

### Scenario 2: Validator Accuracy — validate:script:usage

**Objective:** Verify that the usage validator correctly identifies missing and present `bun run` references.

**Setup:**

```bash
bun run validate:script:usage
```

**Test Steps:**

1. **Verify known scripts are recognized:**

   ```bash
   # The validator should know about all package.json scripts
   grep -c '"' package.json | head -1
   # Should be > 50 scripts
   ```

2. **Verify false positives are filtered:**

   ```bash
   # Check that flags like `--silent` are excluded
   grep -A 10 "Skip flag-like" scripts/validate/script-usage.ts
   ```

   **Expected:** `bun run --silent db:migrate` is recognized as `db:migrate`, not `--silent`

3. **Verify path-like false positives are filtered:**

   ```bash
   # Check that `bun run src/index.ts` doesn't match `src`
   grep -A 10 "Skip path-like" scripts/validate/script-usage.ts
   ```

   **Expected:** `bun run src/file.ts` is not flagged as a script usage

4. **Run against test files:**
   ```bash
   cd scripts/validate/__tests__
   bun run ../../script-usage.ts ../ 2>&1 | head -20
   ```

---

### Scenario 3: Validator Accuracy — validate:script:infrastructure

**Objective:** Verify that metadata validation catches missing or malformed headers.

**Setup:**

```bash
bun run validate:script:infrastructure
```

**Test Steps:**

1. **Verify all tracked scripts have required metadata:**

   ```bash
   # All 27 scripts should have @script, @domain, @category, @description, @usage
   grep -r "@script" scripts/ | grep -v node_modules | wc -l
   # Expected: >= 27
   ```

2. **Verify registry freshness check:**

   ```bash
   # Check SCRIPT_REGISTRY.md exists and is fresh
   stat docs/scripts/SCRIPT_REGISTRY.md | grep Modify
   # Should be < 24 hours old (for a fresh stage)
   ```

3. **Check against test violations:**
   ```bash
   # Create a temporary test script without metadata
   echo "export function test() {}" > /tmp/bad-script.ts
   # Validator should report it missing metadata (when scanned)
   ```

---

### Scenario 4: Migration Engine — dev:refactor:scripts

**Objective:** Verify that the refactor engine safely applies Type A–E migrations.

**Setup:**

```bash
# Review the migration map
cat docs/scripts/SCRIPT_MIGRATION_MAP.md | head -50
```

**Test Steps:**

1. **Run in dry-run mode (non-destructive):**

   ```bash
   bun run dev:refactor:scripts --dry-run
   ```

   **Expected:** Displays proposed changes without modifying any files

2. **Verify migration counts:**

   ```bash
   # Count Type A (domain prefix fix) entries
   grep "^| .*| A |" docs/scripts/SCRIPT_MIGRATION_MAP.md | wc -l
   # Expected: Multiple entries
   ```

3. **Verify no file modifications occur in dry-run:**
   ```bash
   git status --porcelain > /tmp/before.txt
   bun run dev:refactor:scripts --dry-run
   git status --porcelain > /tmp/after.txt
   diff /tmp/before.txt /tmp/after.txt
   ```
   **Expected:** No changes to working tree

---

### Scenario 5: Integration — All Validators Pass in CI

**Objective:** Verify that all validators pass and are integrated into the CI pipeline.

**Setup:**

```bash
# Check the CI workflow configuration
cat .github/workflows/architecture-governance.yml | grep -A 20 "validate:script"
```

**Test Steps:**

1. **Run all 4 validators locally:**

   ```bash
   bun run validate:script:naming && echo "✅ naming"
   bun run validate:script:usage && echo "✅ usage"
   bun run validate:script:infrastructure && echo "✅ infrastructure"
   bun run dev:generate:script-docs && echo "✅ docs"
   ```

   **Expected:** All 4 exit with code 0

2. **Verify CI will enforce these validators:**

   ```bash
   grep -B 2 -A 5 "validate:script:infrastructure" .github/workflows/architecture-governance.yml
   ```

   **Expected:** Validator is listed as a required check step

3. **Make a test commit and verify CI runs:**
   ```bash
   # Push a branch with a test change
   git checkout -b test/script-governance
   echo "// test" >> scripts/validate/script-naming.ts
   git add . && git commit -m "test: verify script validators run"
   git push origin test/script-governance
   # Open a PR and check GitHub Actions output
   ```

---

### Scenario 6: Backward Compatibility — Existing Scripts Still Work

**Objective:** Verify that the validator system doesn't break existing script invocations.

**Setup:**

```bash
# List a sampling of existing scripts
bun run db:migrate --help 2>&1 | head -5
bun run validate:ai-context-fresh --help 2>&1 | head -5
```

**Test Steps:**

1. **Execute a representative sample of scripts:**

   ```bash
   # Test db scripts
   bun run db:console --version 2>&1 | grep -i version

   # Test dev scripts
   bun run dev:lint 2>&1 | head -3

   # Test validate scripts
   bun run validate:script:naming 2>&1 | tail -1
   ```

   **Expected:** All scripts execute without errors

2. **Verify no silent failures:**
   ```bash
   # Ensure help/version switches work
   for script in db:console arch:guard validate:ai-context-fresh; do
     bun run $script --help >/dev/null 2>&1 && echo "✅ $script" || echo "❌ $script"
   done
   ```
   **Expected:** All ✅

---

### Scenario 7: Governance Enforcement — Invalid Scripts Rejected

**Objective:** Verify that non-compliant script names are caught and reported.

**Setup:**

```bash
# Add a temporary invalid script to package.json
```

**Test Steps:**

1. **Create a non-compliant script entry:**

   ```bash
   # Temporarily add a bare name without domain prefix
   # e.g., "migrate-db": "bun scripts/db/migrate.ts"
   # Then run the validator
   bun run validate:script:naming
   ```

   **Expected:** Validator reports the violation and exits with non-zero code

2. **Verify violation message is clear:**
   ```bash
   # Violation output should identify:
   # - Script name
   # - Violation type (e.g., "bare name, no domain prefix")
   # - Suggested fix (e.g., "db:migrate")
   ```

---

## Automated Test Execution

All tests are integrated into the project's test suite:

```bash
# Run all script-related tests
bun run test -- scripts/validate/__tests__/script-naming.test.ts
bun run test -- scripts/validate/__tests__/script-usage.test.ts
bun run test -- scripts/validate/__tests__/script-infrastructure.test.ts
bun run test -- scripts/dev/__tests__/refactor-scripts.test.ts
```

**Expected:** All tests pass (100% pass rate)

---

## Performance Validation

### Script Validator Performance

```bash
# Time the validators on the full repository
time bun run validate:script:naming
time bun run validate:script:usage
time bun run validate:script:infrastructure
```

**Expected SLO:**

- `validate:script:naming` — < 500ms
- `validate:script:usage` — < 2s (repo scan)
- `validate:script:infrastructure` — < 500ms

### Migration Engine Performance

```bash
# Time the refactor engine on the full dataset
time bun run dev:refactor:scripts --dry-run
```

**Expected SLO:** < 5s (dry-run, all 33 migrations)

---

## Rollback Testing

### Scenario: Revert Invalid Migration

**Objective:** Verify that rollback is safe if a migration goes wrong.

**Test Steps:**

1. **Commit current state:**

   ```bash
   git stash
   ```

2. **Run a test migration in a feature branch:**

   ```bash
   git checkout -b test/rollback-safety
   # Edit SCRIPT_MIGRATION_MAP with test entries
   # Run: bun run dev:refactor:scripts
   # Verify changes are applied
   git diff package.json
   ```

3. **Rollback to clean state:**

   ```bash
   git checkout HEAD -- package.json
   git checkout develop
   git stash pop
   ```

   **Expected:** All scripts are restored to pre-migration state

---

## Sign-Off Checklist

- [ ] All 4 validators pass locally
- [ ] All 4 test suites pass (100% pass rate)
- [ ] CI pipeline includes all validators as required checks
- [ ] Sample of existing scripts still execute without errors
- [ ] Invalid script names are correctly identified and rejected
- [ ] Validators meet performance SLOs
- [ ] Dry-run mode for migration engine works correctly
- [ ] Rollback procedures are documented and tested
- [ ] Backward compatibility is verified

---

## Support & Troubleshooting

### Question: What if a validator fails locally but CI passes?

**Answer:** Ensure you're on the correct branch:

```bash
git checkout spec/infra-025-script-system-standardization-and-governance
bun run validate:script:naming
```

### Question: Can I skip a validator if I know it's safe?

**Answer:** No — all 4 validators are required before merge. If there's a false positive, file an issue with the exact script name and context.

### Question: How do I add a new script safely?

**Answer:**

1. Follow the naming convention: `domain:action[:scope]`
2. Include all 5 metadata fields in the header:
   ```typescript
   /**
    * @script domain:action:scope
    * @domain domain
    * @category runtime|validation|governance|maintenance
    * @description One-line description
    * @usage bun run domain:action:scope
    */
   ```
3. Run validators to verify:
   ```bash
   bun run validate:script:naming
   bun run validate:script:usage
   bun run dev:generate:script-docs
   ```

---

## Contact

For questions about this stage or its validators, refer to:

- INFRA-025 stage spec: `specs/runtime/infra-025-script-system-standardization-and-governance/spec.md`
- Governance rules: `.agents/skills/script-system-governance/SKILL.md`
- Implementation details: `specs/runtime/infra-025-script-system-standardization-and-governance/plan.md`

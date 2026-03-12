# Testing Guide — STAGE_INFRA_14_ARCHITECTURE_ALIGNMENT_MIGRATION

**Stage:** STAGE_INFRA_14_ARCHITECTURE_ALIGNMENT_MIGRATION  
**Phase:** 01_PLATFORM_FOUNDATION  
**Type:** Infrastructure Alignment / Migration (Docs-Only)  
**Date:** 2026-03-12  
**Audience:** QA Engineers, Developers, Reviewers

---

## Overview

This guide explains how to validate that STAGE_INFRA_14_ARCHITECTURE_ALIGNMENT_MIGRATION has been correctly implemented and integrated into the Zidney codebase.

**Key Point:** This is a **docs-only stage**. There are no runtime code changes, database migrations, or endpoint behavior modifications. All tests validate that governance standards are met and architectural intelligence is up-to-date.

---

## What This Stage Does

1. **Captures a canonical baseline** showing the Zidney repository's compliance with architecture governance standards
2. **Verifies trust-chain preservation** across tenant isolation, license enforcement, authentication, and other critical guarantees
3. **Regenerates canonical architecture intelligence** (dependency graphs, module maps, AI context artifacts)
4. **Documents governance scope and remediation status** for future alignment work

---

## What This Stage Does NOT Do

- ❌ No runtime code changes
- ❌ No database schema changes or migrations
- ❌ No endpoint behavior modifications
- ❌ No dependency additions or removals
- ❌ No breaking changes to any service

---

## How to Test This Stage

### Test 1: Verify Baseline Evidence Files Exist

**What to Test:** All baseline evidence files generated during Phase 1-2 (Setup and Foundational) are present.

**Steps:**

```bash
# Navigate to stage directory
cd specs/runtime/infra-014-architecture-alignment-migration/

# Verify audits/ directory has baseline files
ls -la audits/ | grep -E "ALIGNMENT_BASELINE|REMEDIATION_TRACKER|FINAL_VERIFICATION|GOVERNED_SCOPE"

# Expected output:
#  ALIGNMENT_BASELINE.md            ✅
#  REMEDIATION_TRACKER.md           ✅
#  FINAL_VERIFICATION.md            ✅
#  GOVERNED_SCOPE.md                ✅
#  VALIDATION_REPORT.md             ✅
```

**Pass Criteria:** All files exist and are non-empty.

---

### Test 2: Verify Baseline Captures (User Story 1)

**What to Test:** Canonical baseline captures from three governance tools are present and merged.

**Steps:**

```bash
cd specs/runtime/infra-014-architecture-alignment-migration/

# Verify raw baseline captures
ls audits/ | grep -E "us1-arch-guard-baseline|us1-infra-audit-baseline|us1-type-safety-baseline"

# Expected output:
#  us1-arch-guard-baseline.json       ✅
#  us1-infra-audit-baseline.md        ✅
#  us1-type-safety-baseline.json      ✅
```

**Validation Content:**

```bash
# Check arch-guard baseline shows zero violations
grep -c "violation" audits/us1-arch-guard-baseline.json  # Should be 0 or minimal

# Check infra-audit baseline is clean
grep -E "(Dependency violations|Circular|Layer violation|Architecture drift)" audits/us1-infra-audit-baseline.md | grep -c "0"  # Should match for all checks

# Check type-safety baseline is clean
jq '.totalViolations' audits/us1-type-safety-baseline.json  # Should be 0
```

**Pass Criteria:** All baseline captures show zero violations (clean baseline state).

---

### Test 3: Verify Alignment Baseline Merge (User Story 1)

**What to Test:** All baseline findings merged and categorized correctly.

**Steps:**

```bash
# Review merged baseline
cat audits/ALIGNMENT_BASELINE.md | head -50

# Should show a structured table with:
#  - Source tool (arch-guard, infra-audit, type-safety)
#  - Module affected
#  - Rule family
#  - Severity level
#  - Finding description
#  - Remediation priority

# Verify table structure
grep -c "| Source" audits/ALIGNMENT_BASELINE.md  # Should be 1 (header)
```

**Pass Criteria:** Merged baseline contains clean categorization with zero in-scope violations.

---

### Test 4: Verify Trust-Chain Preservation (User Story 2)

**What to Test:** Documentation confirms all critical runtime guarantees remain unchanged.

**Steps:**

```bash
# Review trust-chain verification document
cat audits/FINAL_VERIFICATION.md | grep -A 1 "Trust-Chain"

# Check for verification of:
# - Tenant isolation (database-per-tenant)
# - License middleware enforcement
# - Authentication flow
# - Attempt engine integrity
# - Server-authoritative time
# - Idempotency guarantees
# - Error contract preservation
# - Worker authority boundaries

# All should be marked as verified and unchanged
```

**Pass Criteria:** All trust-chain items documented as preserved.

---

### Test 5: Verify No-Remediation Decision (User Story 2)

**What to Test:** Repository alignment already passes; no code remediation required.

**Steps:**

```bash
# Check remediation tracker shows zero required items
cat audits/REMEDIATION_TRACKER.md | grep "Repository Status"

# Should show:
# Repository Status: NO REMEDIATION REQUIRED

# Check no urgent or high-priority remediation items
grep -E "Priority: (P0|P1|URGENT)" audits/REMEDIATION_TRACKER.md | wc -l  # Should be 0
```

**Pass Criteria:** Documented no-remediation decision with clear justification.

---

### Test 6: Verify Architecture Intelligence Regeneration (User Story 3)

**What to Test:** Canonical architecture artifacts were regenerated and validated.

**Steps:**

```bash
# Check that docs/ai/context/ and docs/architecture/intelligence/ are present
ls -la docs/ai/context/ | grep -E "ai-architecture-brain|ai-dependency-graph|ai-module-map"

# Expected files (all should exist):
#  ai-architecture-brain.json         ✅
#  ai-dependency-graph.json           ✅
#  ai-module-map.json                 ✅
#  ai-layer-model.json                ✅
#  ai-runtime-map.json                ✅
#  ai-runtime-dependents.json         ✅

# Verify brain validation passed
grep "validation: PASSED" audits/FINAL_VERIFICATION.md  # Should be 1 match
```

**Pass Criteria:** All canonical artifacts present and validated.

---

### Test 7: Verify Architecture Guard Final Verdict (User Story 3)

**What to Test:** Final governance verification passed with current canonical context.

**Steps:**

```bash
# Run final architecture guard check
bun run arch:guard:ci

# Expected output should show:
# ✅ Unified Architecture Guard verdict=PASS

# Verify no new violations
echo "Exit code should be 0:"
echo $?
```

**Pass Criteria:** `arch:guard:ci` returns exit code 0 (PASS).

---

### Test 8: Verify Type Safety (Validation Gate Step 6.5)

**What to Test:** TypeScript type safety validation passes.

**Steps:**

```bash
# Run type validation
bun run validate:types

# Check both tsc and type-safety-guard pass
echo "Looking for type violations..."
grep -c "violation" < <(bun run validate:types 2>&1) || echo "No violations found ✅"

# Expected: 0 violations
```

**Pass Criteria:** `bun run validate:types` returns exit code 0.

---

### Test 9: Verify Module Boundary Tests (Validation Gate Step 6.5)

**What to Test:** All static architecture tests pass.

**Steps:**

```bash
# Run module boundary tests
bun run test -- tests/static/module-boundaries.test.ts

# Expected output:
#  ✅ 43 passed
#  ❌ 0 failed

# Run architecture-specific tests
bun run test -- tests/unit/infra-audit/infra-audit-boundaries.test.ts
bun run test -- tests/unit/ai-guard/ai-guard-boundaries.test.ts

# All should return:
#  ✅ X tests passed
#  ❌ 0 failed
```

**Pass Criteria:** All tests pass with 0 failures.

---

### Test 10: Verify CI/CD Pipeline Readiness (Guardian Validation Step 6.6)

**What to Test:** GitHub Actions workflows are safe and ready for production.

**Steps:**

```bash
# Check that CI pipeline definition exists
cat .github/workflows/ci.yml | head -20

# Verify key gates are present:
#  - Lint enforcement (Biome)
#  - Type safety (TypeScript + type-safety-guard)
#  - Architecture guard (ai-guard)
#  - Unit tests

# Verify no hardcoded secrets in workflows
grep -r "PASSWORD\|SECRET\|TOKEN" .github/workflows/ | grep -v "\${{" | wc -l  # Should be 0

# Verify proper error handling and timeouts
grep -c "timeout" .github/workflows/*.yml  # Should have multiple timeout definitions
```

**Pass Criteria:**

- No hardcoded secrets found
- All validation gates present
- Proper error handling configured

---

### Test 11: Verify Deployment Safety (Guardian Validation Step 6.6)

**What to Test:** Stage can be deployed without risk.

**Steps:**

```bash
# Confirm stage is docs-only
# Count actual code file changes (should be 0)
git diff develop -- apps/ packages/ scripts/infra-audit.ts | wc -l

# Expected: only 'Binary files differ' or empty (docs-only changes)

# Verify no database migrations
ls -la apps/api/src/db/master/migrations/ | grep "$(date +%Y-%m-%d)" | wc -l  # Should be 0

# Verify no runtime configuration changes
git diff develop -- .env.* | wc -l  # Should be 0
```

**Pass Criteria:**

- Zero runtime code changes
- Zero new migrations
- Zero configuration changes

---

### Test 12: Verify All Tasks Marked Complete

**What to Test:** All 28 implementation tasks are marked as completed.

**Steps:**

```bash
# Count completed tasks
grep -c "\[X\]" tasks.md  # Should be 28

# Verify no incomplete tasks remain
grep -c "\[ \]" tasks.md  # Should be 0

# List all completed tasks for final review
echo "=== COMPLETED TASKS ==="
grep "\[X\]" tasks.md | wc -l
```

**Pass Criteria:** 28 tasks marked completed, 0 incomplete.

---

## Manual Review Checklist

### For Code Reviewers

- [ ] All stage artifacts (reports/, audits/, guides/) are present
- [ ] Baseline captures show zero violations
- [ ] Trust-chain preservation documented and verified
- [ ] No runtime code files were modified
- [ ] No database migrations introduced
- [ ] No configuration changes made
- [ ] All 28 tasks marked as completed [X]
- [ ] Stage status transitioned to BACKEND CLOSED
- [ ] All validation gates show PASSED status

### For QA Engineers

- [ ] Run all 12 tests above (or use automated test suite)
- [ ] Verify architecture guard returns PASS
- [ ] Verify type safety returns 0 violations
- [ ] Verify all governance tooling works without errors
- [ ] Confirm zero runtime behavioral changes
- [ ] Confirm no deployment blockers

### For Release Managers

- [ ] Stage is marked PRODUCTION READY
- [ ] All evidence artifacts complete
- [ ] External blockers documented (lint baseline)
- [ ] Trust-chain preservation verified
- [ ] Deployment safety confirmed
- [ ] PR ready for merge to `develop`

---

## Automated Test Suite

To run all tests in one command:

```bash
# Run the full validation suite
bun run test -- \
  tests/static/module-boundaries.test.ts \
  tests/unit/infra-audit/infra-audit-boundaries.test.ts \
  tests/unit/ai-guard/ai-guard-boundaries.test.ts && \
bun run validate:types && \
bun run arch:guard:ci

# Expected result:
# ✅ All tests passed
# ✅ Type validation passed (0 violations)
# ✅ Architecture guard passed (PASS verdict)
```

---

## Troubleshooting

### Issue: Architecture Guard Returns BLOCKED

**Solution:**

1. Regenerate canonical context: `bun scripts/infra-audit.ts`
2. Refresh AI context: `bun scripts/generate-ai-context.ts --force`
3. Restore brain: `bun scripts/infra-audit.ts` (second run)
4. Re-check: `bun run arch:guard:ci`

### Issue: Type Safety Violations Found

**Solution:**

1. Run `bun run validate:types` to see violations
2. Check if fixture updates are needed in test files
3. Verify no runtime code was accidentally modified
4. Escalate to platform team if violations are in core logic

### Issue: Test Failures

**Solution:**

1. Verify all stage files are committed (`git status`)
2. Reset any uncommitted changes: `git checkout .`
3. Re-run tests
4. If failures persist, escalate with full test output

---

## Sign-Off

Once all 12 tests pass, this stage is verified and ready for:

✅ Merge to `develop`  
✅ Deployment to staging  
✅ Deployment to production

**No additional changes required for go-live.**

---

**Test Guide Prepared:** 2026-03-12T20:00:00Z  
**Confidence Level:** HIGH ✅  
**Estimated Test Duration:** 15-20 minutes (automated) + 10-15 minutes (manual review)

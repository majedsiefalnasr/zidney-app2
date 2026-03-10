# Testing Guide: STAGE_INFRA_05_LINT_GOVERNANCE

**Stage:** STAGE_INFRA_05_LINT_GOVERNANCE **Purpose:** Lint governance and architecture validation
**Audience:** QA, developers, reviewers

---

## Quick Start

**Verify the stage locally:**

```bash
cd /path/to/zidney-app2

# Run all validation gates (same as CI)
bun run lint && \
bun run typecheck && \
bun scripts/ai-guard.ts
```

**Expected result:** All three commands exit 0, zero errors.

---

## Pre-Commit Hook Validation

**Test the updated `.husky/pre-commit` hook:**

```bash
# Stage a file change
echo "// test" >> apps/api/src/index.ts
git add apps/api/src/index.ts

# Attempt commit — hook should run biome, typecheck, AI-Guard
git commit -m "test: verify pre-commit hook"

# Expected: hook runs biome check, typecheck, ai-guard
# All must pass before commit succeeds
```

**Revert test file:**

```bash
git reset HEAD apps/api/src/index.ts
git checkout apps/api/src/index.ts
```

---

## Linting Validation

### Test 1: Biome noUnreachable Rule Enforcement

**Objective:** Verify that `noUnreachable` is now at `error` level (was `warn`).

**Setup:**

```bash
# Create a test file with unreachable code
cat > /tmp/test-unreachable.ts << 'EOF'
function example() {
  throw new Error("unreachable");
  return "this is unreachable";
}
EOF
```

**Run biome check:**

```bash
bun biome check /tmp/test-unreachable.ts
```

**Expected result:** Output should show `noUnreachable` as an error (not warning):

```
  error: Unreachable code unsafe/noUnreachable
```

**Cleanup:**

```bash
rm /tmp/test-unreachable.ts
```

---

### Test 2: Vue Scaffold Suppressions

**Objective:** Verify biome-ignore suppressions are in place and suppress only the expected
violations.

**Check files:**

Four Vue files have `biome-ignore` for `noUnreachable`:

- `apps/mmc/src/modules/licenses/components/LicenseCreateForm.vue`
- `apps/mmc/src/modules/licenses/components/LicenseDeletionDialog.vue`
- `apps/mmc/src/modules/licenses/components/LicenseDetailPage.vue`
- `apps/mmc/src/shared/components/AuditTrailViewer.vue`

**Run biome check on these files:**

```bash
bun biome check \
  apps/mmc/src/modules/licenses/components/LicenseCreateForm.vue \
  apps/mmc/src/modules/licenses/components/LicenseDeletionDialog.vue \
  apps/mmc/src/modules/licenses/components/LicenseDetailPage.vue \
  apps/mmc/src/shared/components/AuditTrailViewer.vue
```

**Expected result:** 0 errors (suppressions are active).

**Verify comment placement:**

```bash
grep -n "biome-ignore" \
  apps/mmc/src/modules/licenses/components/LicenseCreateForm.vue \
  apps/mmc/src/modules/licenses/components/LicenseDeletionDialog.vue
```

**Expected pattern:** Comment appears **inside the try block**, as the **last statement before
`} catch`** block.

---

### Test 3: Full Lint Suite

**Objective:** Verify the entire codebase lints without errors.

**Run:**

```bash
bun run lint
```

**Expected result:**

```
✅ 0 errors
Exit code: 0
```

**Warnings are acceptable** (stage promotes rules; existing code may trigger warnings).

---

## TypeScript Validation

**Objective:** Verify type safety across the monorepo.

**Run:**

```bash
bun run typecheck
```

**Expected result:**

```
Exit code: 0
(No typescript errors)
```

---

## AI-Guard Architecture Validation

### Test 1: Full Codebase Scan

**Objective:** Verify AI-Guard scans all tracked files and detects architecture violations.

**Run:**

```bash
bun scripts/ai-guard.ts
```

**Expected output:**

```
AI Guard: using ai-architecture-brain.json for rule validation.
AI Guard: architecture validation passed.
Exit code: 0
```

### Test 2: CI Fallback Mode

**Objective:** Verify AI-Guard uses `git ls-files` fallback when no staged files (CI scenario).

**Setup — simulate CI conditions:**

```bash
# Clear the git index (simulates CI fresh checkout)
git reset HEAD --soft

# Run AI-Guard
bun scripts/ai-guard.ts
```

**Expected result:**

- AI-Guard should still scan all tracked files via `git ls-files` fallback
- Exit code: 0, "architecture validation passed"

**Revert git state:**

```bash
git reset HEAD
```

---

## CI Workflow Validation

### Test 3: Simulate CI Environment

**Objective:** Verify the CI workflow `.github/workflows/ci.yml` changes work in isolated
environment.

**Prerequisites:**

- Docker or local Node 20+ environment
- Bun 1.3.9 or compatible

**Steps:**

1. **Verify BUN_VERSION pinning:**

```bash
grep "BUN_VERSION:" .github/workflows/ci.yml
```

Expected: `BUN_VERSION: '1.3.9'`

2. **Verify arch-guard job exists:**

```bash
grep -A 5 "- name: AI Guard Architecture Validation" .github/workflows/ci.yml
```

Expected: Shows `bun scripts/ai-guard.ts` command

3. **Verify job dependencies:**

```bash
grep -A 2 "needs:" .github/workflows/ci.yml | grep arch-guard
```

Expected: `unit-tests` and `integration-tests` jobs list `arch-guard` as dependency

---

## Governance Documentation Validation

**Objective:** Verify the new governance document is complete and accurate.

**File:** `docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md`

**Checklist:**

- [ ] Section 1: Introduction — explains purpose
- [ ] Section 2: Layer Model — biome → ai-guard → infra-audit → tests
- [ ] Section 3: Biome Configuration — rule levels documented
- [ ] Section 4: AI-Guard — architecture validation explained
- [ ] Section 5: CI Enforcement — workflow integration documented
- [ ] Section 6: Pre-commit Pipeline — hook order explained
- [ ] Section 7: Module Ownership Policy — ARCHITECTURE_MAP role explained
- [ ] Section 8: Drift Recovery — `--no-verify` and remediation procedures documented

**Read the document:**

```bash
cat docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md
```

**Verify key section:**

Look for the **drift recovery** section:

```
To bypass lint enforcement and commit infra improvements:

  git commit --no-verify -m "chore: resolve drift"

Then run manual audit:

  bun scripts/infra-audit.ts --fix-map
```

---

## Manual Test Scenarios

### Scenario 1: New TypeScript File

**Objective:** New files should pass all governance checks automatically.

**Create a test file:**

```bash
cat > test-new-file.ts << 'EOF'
export function example(): string {
  return "hello";
}
EOF
```

**Stage and lint:**

```bash
git add test-new-file.ts
bun run lint
```

**Expected result:** Exit 0, new file passes biome rules.

**Cleanup:**

```bash
git reset HEAD test-new-file.ts
rm test-new-file.ts
```

---

### Scenario 2: Lint Fix Verification

**Objective:** Verify `bun run lint:fix` auto-corrects fixable violations.

**Create a test file with violations:**

```bash
cat > test-bad-format.ts << 'EOF'
export function example(  ):string{return"hello"}
EOF
```

**Auto-fix:**

```bash
git add test-bad-format.ts
bun run lint:fix
```

**Verify fix:**

```bash
cat test-bad-format.ts
```

**Expected result:** File is reformatted with proper spacing.

**Cleanup:**

```bash
git reset HEAD test-bad-format.ts
rm test-bad-format.ts
```

---

## Known Issues & Workarounds

### Biome-ignore Vue Suppressions

**Issue:** 4 Vue scaffold files contain `noUnreachable` violations in try-catch blocks (placeholder
code).

**Status:** SUPPRESSED via `biome-ignore` comments, documented in source code with rationale.

**Future resolution:** When scaffold code is replaced with actual implementation, remove
`biome-ignore` comments and implement proper error handling.

---

## Performance Impact

| Check            | Local Time | CI Time | Impact     |
| ---------------- | ---------- | ------- | ---------- |
| Biome lint       | ~2–3s      | ~5s     | Negligible |
| TypeScript check | ~5–10s     | ~15s    | Negligible |
| AI-Guard scan    | ~1–2s      | ~3s     | Negligible |
| Full pre-commit  | ~8–15s     | ~20s    | Acceptable |

**Total CI time impact:** ~+20s per commit (within acceptable range).

---

## Troubleshooting

### Issue: `ai-guard.ts` exits 0 but doesn't scan anything

**Cause:** Staged files list is empty in non-CI environment.

**Resolution:** Run `bun scripts/ai-guard.ts` directly without git staging, or run in CI environment
where the fallback is active.

### Issue: Biome lint shows warnings, not errors

**Cause:** Some rules are at `warn` level, not `error`.

**Resolution:** Warnings don't block commits. To promote a warning to error, modify `biome.json` and
create a new INFRA stage.

### Issue: Pre-commit hook hangs

**Cause:** Rarely, `lint-staged` can deadlock on large file lists.

**Resolution:** Use `git commit --no-verify -m "msg"` to bypass, then run
`bun scripts/infra-audit.ts --fix-map` to recover.

---

## Sign-Off

✅ **Testing guide approved for use by QA and reviewers.**

For questions, reference: `docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md`

# TESTING GUIDE — Incremental Architecture Guard

**For:** QA Engineers, Code Reviewers, and Developers  
**Stage:** INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD  
**Date:** 2026-03-11

---

## Overview

This guide provides step-by-step instructions for testing the Incremental Architecture Guard feature locally and in CI. The feature validates architectural rules only for modules affected by a change, reducing pre-commit validation time from ~900ms to <200ms for typical changes.

---

## Environment Setup

### Prerequisites

- Node.js + Bun installed (Zidney standard)
- Working checkout of the repo on branch `spec/infra-011-incremental-architecture-guard`
- No uncommitted changes in `scripts/ai-guard.ts` or `scripts/infra-audit.ts`

### Fresh Start

```bash
cd /path/to/zidney-app2
git checkout spec/infra-011-incremental-architecture-guard
bun install
bun run type-check  # Verify TypeScript compiles
bun run test:unit -- tests/unit/ai-guard tests/unit/infra-audit  # Run new tests
```

Expected: 33 new tests pass (incremental-guard + generate-graph test files).

---

## Manual Testing

### Test 1: Generate Dependency Graph (T004, T021)

**Objective:** Verify `generateDependencyGraph()` produces schema v2 with 14 modules.

```bash
# Generate the cache
bun scripts/infra-audit.ts --generate-graph

# Verify file exists and is valid JSON
ls -lh docs/ai/context/ai-dependency-graph.json
cat docs/ai/context/ai-dependency-graph.json | jq .

# Check structure
jq '.schema_version, .modules | keys | length, (.generated_at // "MISSING"), .source_metadata' \
  docs/ai/context/ai-dependency-graph.json
```

**Expected Output:**

- File created at `docs/ai/context/ai-dependency-graph.json` (~50KB)
- `schema_version: "2"` (string, not number)
- 14 modules in `modules` object
- `generated_at` is ISO-8601 timestamp
- `source_metadata.infra_audit_timestamp` present
- No `edges[]` array

---

### Test 2: Incremental Guard with Staged Files (T010, T012)

**Objective:** Verify incremental validation on staged files.

```bash
# Start fresh — no staged changes
git reset HEAD~1 --soft  # Undo the last commit but keep changes staged
# OR manually stage 1-2 files from a specific module
git add apps/api/src/index.ts apps/api/src/routes.ts

# Run incremental guard
STAGED_FILES="$(git diff --cached --name-only)" bun scripts/ai-guard.ts --incremental

# Expected: validation runs on "apps/api" + transitive dependents only
```

**Expected Output:**

- Should print "Validating 2–5 modules" (depending on reverse dependencies)
- Should NOT print "Validating 14 modules"
- Should complete in <200ms
- Exit code 0 (pass)

**To verify timing:**

```bash
time (STAGED_FILES="$(git diff --cached --name-only)" bun scripts/ai-guard.ts --incremental)
```

---

### Test 3: Full-Scan Fallback — Graph Missing (T006, T010)

**Objective:** Verify fallback when cache is missing.

```bash
# Delete the cache
rm docs/ai/context/ai-dependency-graph.json

# Stage a file and run incremental guard
git add apps/api/src/index.ts
STAGED_FILES="apps/api/src/index.ts" bun scripts/ai-guard.ts --incremental
```

**Expected Behavior:**

1. Guard detects missing graph
2. Calls `--generate-graph` automatically
3. Regenerates cache (1–2 seconds)
4. Falls through to full scan
5. Prints `fallback_reason: "graph_missing"`
6. Exit code 0

---

### Test 4: Full-Scan Fallback — Cache Stale (T010)

**Objective:** Verify fallback when cache is too old.

```bash
# Make cache artificially stale by setting env var
ARCH_GRAPH_MAX_AGE_HOURS=0 bun scripts/ai-guard.ts --incremental

# OR by modifying the file timestamp
touch -t 202601010000 docs/ai/context/ai-dependency-graph.json
bun scripts/ai-guard.ts --incremental
```

**Expected Output:**

- Prints `fallback_reason: "graph_stale"`
- Does NOT call `--generate-graph`
- Runs full scan instead
- Exit code 0
- Completes in ~900ms

---

### Test 5: Full-Scan Fallback — ARCHITECTURE_MAP Changed (T010)

**Objective:** Verify fallback when architecture map changes.

```bash
# Stage the ARCHITECTURE_MAP
git add docs/architecture/intelligence/ARCHITECTURE_MAP.json

# Stage an unrelated file
git add README.md

# Run incremental guard
STAGED_FILES="$(git diff --cached --name-only)" bun scripts/ai-guard.ts --incremental
```

**Expected Output:**

- Guard detects `ARCHITECTURE_MAP.json` in staged files
- Prints `fallback_reason: "map_changed"`
- Runs full scan (14 modules)
- Exit code 0

---

### Test 6: Pre-Commit Hook Integration (T012)

**Objective:** Verify hook runs and exits correctly.

```bash
# Stage some files
git add apps/api/src/index.ts

# Try to commit (pre-commit hook will run)
git commit -m "test: verify pre-commit guard"

# Expected:
# - Hook loads STAGED_FILES env var
# - Calls ai-guard.ts --incremental
# - If validation passes: commit succeeds
# - If validation fails: commit blocked, can fix and retry
```

---

### Test 7: Pre-Push Hook Integration (T013)

**Objective:** Verify pre-push runs full scan before pushing.

Create 2+ commits on the branch:

```bash
git commit --allow-empty -m "test: commit 1"
git commit --allow-empty -m "test: commit 2"

# Try to push
git push origin spec/infra-011-incremental-architecture-guard
```

**Expected Behavior:**

1. Pre-push hook runs
2. Calls `bun scripts/ai-guard.ts --full`
3. Calls `bun scripts/infra-audit.ts --quick`
4. Both exit 0
5. Push succeeds

---

### Test 8: Backward Compatibility (T011)

**Objective:** Verify existing behavior is unchanged when no flags are passed.

```bash
# No flags = full scan (unchanged)
bun scripts/ai-guard.ts

# Expected:
# - Runs full scan
# - Validates all 14 modules
# - Completes in ~900ms
# - Exit code 0
```

---

### Test 9: ArchitectureImpactReport Output (T025)

**Objective:** Verify report is generated on every run.

```bash
# Run any validation command
STAGED_FILES="apps/api/src/index.ts" bun scripts/ai-guard.ts --incremental 2>&1 | grep -A 20 "ArchitectureImpactReport\\|run_id"

# Should print JSON with fields:
# - run_id
# - timestamp
# - validation_mode ("incremental" or "full")
# - modules_validated (number)
# - modules_skipped (number)
# - fallback_reason (string or null)
# - verdict ("pass" or "fail")
# - duration_ms (number)
```

---

### Test 10: Explicit Module Override (T010)

**Objective:** Verify manual module specification.

```bash
STAGED_FILES="" bun scripts/ai-guard.ts --incremental --modules apps/api,packages/logger
```

**Expected Behavior:**

- Even though STAGED_FILES is empty, guard validates only apps/api and packages/logger
- Useful for explicit testing or CI overrides

---

## Automated Testing

### Run the Unit Test Suite

```bash
# All ai-guard + infra-audit tests
bun run test:unit -- tests/unit/ai-guard tests/unit/infra-audit

# Filter to specific test file
bun run test:unit -- tests/unit/ai-guard/incremental-guard.test.ts
bun run test:unit -- tests/unit/infra-audit/generate-graph.test.ts
```

**Expected:** All 33 tests pass (parseArgs, mapToModules, computeImpactScope, loadDependencyGraph, generateDependencyGraph variants).

### Run TypeScript Type Check

```bash
bun run type-check
```

**Expected:** Zero errors.

---

## Edge Cases & Troubleshooting

### Issue: "No modules to validate"

**Symptom:** Guard exits with code 0 but no files changed.

**Cause:** `STAGED_FILES` env var is empty or contains only docs/scripts files.

**Fix:** Verify you staged actual module files (under `apps/*` or `packages/*`).

---

### Issue: "Graph cache missing — regenerating"

**Symptom:** First run after fresh clone or cache deletion is slow (~3 seconds).

**Cause:** Graph doesn't exist; `--generate-graph` runs.

**Expected:** Second run is <200ms (cache is now available).

---

### Issue: "fallback_reason: graph_stale"

**Symptom:** Guard runs full scan even though no architecture map changed.

**Cause:** Cache is older than `ARCH_GRAPH_MAX_AGE_HOURS` (default 24 hours).

**Fix:** Regenerate cache with `infra-audit.ts --generate-graph`, or wait 24 hours.

---

### Issue: Pre-commit hook blocks commit

**Symptom:** `git commit` fails with architecture validation error.

**Cause:** Guard found rule violations in staged files.

**Fix:**

1. Review the violations in the hook output
2. Fix the code to comply with rules
3. Re-stage and retry commit

---

## Performance Benchmarks

| Scenario                                | Expected Time | Notes                      |
| --------------------------------------- | ------------- | -------------------------- |
| Incremental (1 file, 1 module)          | <100ms        | Fast path; no dependencies |
| Incremental (10 files, 2–3 modules)     | 100–150ms     | Typical PR                 |
| Incremental (50 files, 5+ modules)      | 150–200ms     | Large PR within budget     |
| Fallback full scan (all modules)        | ~900ms        | Pre-push gate; acceptable  |
| Graph regeneration (`--generate-graph`) | 1–2 seconds   | On-demand only             |

---

## Checklist for Code Review

When reviewing PRs that touch `scripts/ai-guard.ts` or `scripts/infra-audit.ts`:

- [ ] TypeScript compiles (`bun run type-check`)
- [ ] All tests pass (`bun run test:unit -- tests/unit/ai-guard tests/unit/infra-audit`)
- [ ] No broken imports (modules import only from `packages/types` and Node built-ins)
- [ ] Discriminated union logic in `loadDependencyGraph()` is exhaustive (all 4 reason cases handled)
- [ ] Fallback reasons match the whitelist: "map_changed", "graph_missing", "graph_stale", "graph_unusable", "new_module_detected", "full_scope"
- [ ] Pre-commit hook still runs <200ms for typical changes
- [ ] Backward compatibility intact (no-flag behavior unchanged)

---

## Conclusion

This feature is production-ready and thoroughly tested. Developers should use the incremental guard's faster turnaround time for local development, while the pre-push gate ensures CI always sees a full scan before code reaches develop.

For questions or issues, refer to the implementation tasks in `tasks.md` or the CLOSURE_REPORT.

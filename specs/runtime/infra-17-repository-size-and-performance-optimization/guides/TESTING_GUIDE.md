# STAGE_INFRA_17 Testing & Verification Guide

**Stage:** Repository Size and Performance Optimization  
**Purpose:** QA and developer verification procedures for all 6 optimization phases  
**Date:** 2026-03-15  
**Status:** Ready for Testing

---

## Overview

This guide provides step-by-step verification procedures for all phases of the Repository Size and Performance Optimization stage. Use this document to validate that all optimizations are working correctly and that no regressions have been introduced.

---

## Test Environment Setup

### Prerequisites

```bash
# Ensure on spec/ branch
git checkout spec/infra-17-repository-size-and-performance-optimization

# Install dependencies (if not already done)
bun install

# Verify no pending changes
git status --porcelain  # Should show clean working tree
```

### System Requirements

- **Disk Space:** 2GB free (for build artifacts, test outputs)
- **RAM:** 4GB minimum (for test suite)
- **Node.js/Bun:** Version specified in .node-version or package.json
- **OS:** macOS or Linux (Windows requires WSL2)

---

## Phase 1: Repository Diagnostics & Baseline

### Test 1.1: Verify Diagnostic Infrastructure

**Objective:** Confirm that audit-helpers.ts is properly extended with all 4 analyzer classes

**Steps:**

1. Open `tests/audit-helpers.ts`
2. Verify presence of 4 classes:
   - `FileSizeAnalyzer` — with methods: `analyze()`, `identifyOversized()`
   - `DirectorySizeAnalyzer` — with methods: `measure()`, `getTopDirectories()`
   - `AIContextAnalyzer` — with methods: `analyzeArtifacts()`, `computeCompression()`
   - `ScriptPerformanceProfiler` — with methods: `profile()`, `getBenchmark()`

**Validation:**

```bash
bun run type-check tests/audit-helpers.ts
# Should pass with no type errors
```

**Expected Outcome:** ✅ No TypeScript errors, all classes properly typed

### Test 1.2: Run Baseline Diagnostic Report

**Objective:** Generate baseline measurements for all optimization areas

**Steps:**

1. Execute baseline generation:

   ```bash
   bun scripts/dev/generate-baseline-report.ts
   ```

2. Verify output file created:

   ```bash
   ls -lh docs/audit-reports/BASELINE_REPORT.md
   ```

3. Review report for 5 sections:
   - **File Size Analysis** — Should show ~75MB (excl. node_modules), 99 oversized files
   - **Directory Size Analysis** — Should list top 10 directories with sizes
   - **AI Context Artifacts** — Should show 50KB total, 7.1:1 compression
   - **Script Performance** — Should show baseline times for ai-guard, infra-audit, etc.
   - **Summary & Recommendations** — Should identify Phase 2 optimization targets

**Expected Outcome:** ✅ BASELINE_REPORT.md created with complete metrics

### Test 1.3: Verify Audit Templates

**Objective:** Confirm all 4 reporting templates exist and are properly structured

**Steps:**

1. Check that all 4 templates exist:

   ```bash
   ls -lh docs/audit-reports/
   # Should show: FILE_SIZE_ANALYSIS.md, DIRECTORY_SIZE_ANALYSIS.md,
   #              AI_CONTEXT_ARTIFACT_ANALYSIS.md, SCRIPT_PERFORMANCE_PROFILE.md
   ```

2. Validate each template has standard sections:
   - Metrics table with columns: Metric | Current | Target | Status
   - Analysis section with findings
   - Recommendations section with actionable steps

**Expected Outcome:** ✅ All 4 templates present and properly structured

---

## Phase 2: Script Modularization & Architecture Tools

### Test 2.1: Verify Core Utilities Extracted

**Objective:** Confirm that key utilities are properly extracted into `scripts/core/`

**Steps:**

1. Verify 7 core utility files exist:

   ```bash
   ls scripts/core/
   # Should show: file-analyzer.ts, artifact-validator.ts, cache-manager.ts,
   #              module-roster.ts, graph-analyzer.ts, performance-profiler.ts,
   #              governance-validator.ts (if in governance/core/)
   ```

2. Check that core utilities are imported by governance scripts:
   ```bash
   grep -r "from.*scripts/core" scripts/architecture/
   # Should show multiple imports from core utilities
   ```

**Expected Outcome:** ✅ All 7 utilities present, imported by governance scripts

### Test 2.2: Measure Code Duplication

**Objective:** Verify that code duplication is <5% across architecture scripts

**Steps:**

1. Run duplication analysis:

   ```bash
   bun scripts/dev/validate-script-duplication.ts
   ```

2. Review output for:
   - Total lines of code across governance scripts
   - Identified duplicate code blocks
   - Duplication percentage (should be <5%)

**Expected Outcome:** ✅ Duplication <5%, Phase 2 refactoring successful

### Test 2.3: Validate Architecture Map Updates

**Objective:** Confirm that new modules are properly registered in ARCHITECTURE_MAP.json

**Steps:**

1. Check ARCHITECTURE_MAP.json for new modules:

   ```bash
   grep -A 5 '"scripts/core"' docs/architecture/intelligence/ARCHITECTURE_MAP.json
   ```

2. Verify all 7 utilities are declared:
   - `scripts/core/file-analyzer`
   - `scripts/core/artifact-validator`
   - `scripts/core/cache-manager`
   - `scripts/core/module-roster`
   - `scripts/core/graph-analyzer`
   - `scripts/core/performance-profiler`
   - `scripts/governance/core/governance-validator`

**Expected Outcome:** ✅ All modules declared, no circular dependencies

---

## Phase 3: AI Context Optimization

### Test 3.1: Verify GitHub Actions Cache Integration

**Objective:** Confirm that GitHub Actions cache is properly configured

**Steps:**

1. Check `.github/workflows/` for cache configuration:

   ```bash
   grep -A 10 "uses: actions/cache" .github/workflows/ci.yml
   ```

2. Verify cache key includes `bun.lock`:

   ```bash
   grep "bun.lock" .github/workflows/ci.yml
   # Should show cache key with bun.lock hash
   ```

3. Confirm cache paths include AI context artifacts:
   ```bash
   grep "docs/ai/context" .github/workflows/ci.yml
   # Should show cache paths for AI context directory
   ```

**Expected Outcome:** ✅ GitHub Actions cache configured, bun.lock-based invalidation

### Test 3.2: Test Cache Invalidation

**Objective:** Verify that cache invalidates correctly when dependencies change

**Steps:**

1. Modify `bun.lock` (add comment or minor change)
2. Push to branch and trigger GitHub Actions
3. Check workflow run to see cache invalidation:
   - Cache hit should be MISS (due to bun.lock change)
   - New artifacts should be generated and cached

**Expected Outcome:** ✅ Cache invalidates on bun.lock change, new artifacts generated

### Test 3.3: Measure AI Context Performance

**Objective:** Verify that AI context generation performance has improved

**Steps:**

1. Profile AI context generation locally:

   ```bash
   time bun scripts/generate-ai-context.ts
   # Should complete in <5 seconds (baseline was 5-8s)
   ```

2. Check cache effectiveness in CI logs:
   ```bash
   # Review GitHub Actions workflow run
   # Look for "Cache hit" or "Cache miss" indicators
   # Cache hit rate should be 70%+ on dependency artifacts
   ```

**Expected Outcome:** ✅ AI context <5s (40% improvement), cache hit rate 70%+

---

## Phase 4: CI Pipeline Optimization

### Test 4.1: Benchmark CI Pipeline Duration

**Objective:** Verify that CI pipeline completes in <8 minutes

**Steps:**

1. Run full CI pipeline:

   ```bash
   bun run ci:test
   ```

2. Record execution time and compare to baseline:
   - **Baseline:** 12-18 minutes
   - **Target:** <8 minutes
   - **Success:** Actual duration should be <8 min (55% reduction)

3. Review workflow logs for parallelization:
   ```bash
   # Check GitHub Actions workflow job timeline
   # Should show 2 parallel job groups (not serial)
   ```

**Expected Outcome:** ✅ CI duration <8 minutes, 55% improvement

### Test 4.2: Validate Job Parallelization

**Objective:** Confirm that CI jobs are properly parallelized

**Steps:**

1. Inspect `.github/workflows/` for job dependencies:

   ```bash
   grep -A 2 "jobs:" .github/workflows/ci.yml
   ```

2. Verify job structure shows parallelization:
   - Job group 1: Setup, install, lint
   - Job group 2: Type-check (parallel with group 1)
   - Job group 3: Tests (depends on groups 1-2)
   - Job group 4: Build (final step)

**Expected Outcome:** ✅ Jobs properly parallelized, clear dependency graph

### Test 4.3: Verify Job Timeouts & Failure Fast

**Objective:** Confirm that jobs have appropriate timeouts and failure strategies

**Steps:**

1. Check job configurations for timeout settings:

   ```bash
   grep "timeout-minutes" .github/workflows/ci.yml
   # Should show appropriate timeouts per job (e.g., 10 min for tests)
   ```

2. Verify failure-fast is configured:
   ```bash
   grep "fail-fast" .github/workflows/ci.yml
   # Should show fail-fast: true for quick feedback
   ```

**Expected Outcome:** ✅ Timeouts configured, fail-fast enabled

---

## Phase 5: Dependency & Skill Cleanup

### Test 5.1: Verify All SKILL.md Files <500 Lines

**Objective:** Confirm that all skill files are within the 500-line limit

**Steps:**

1. Run skill size validation:

   ```bash
   bun scripts/dev/audit-skill-sizes.ts
   ```

2. Review output for:
   - Total skills analyzed
   - Skills >500 lines (should be 0)
   - Largest skills (should all be <500)
   - Compliance percentage (should be 100%)

**Expected Outcome:** ✅ 100% of skills <500 lines, validation passes

### Test 5.2: Verify Dependencies Safely Removed

**Objective:** Confirm that removed dependencies don't break anything

**Steps:**

1. Run all tests to verify no import errors:

   ```bash
   bun run test
   ```

2. Check for any unresolved imports:

   ```bash
   bun run type-check
   # Should pass with no type errors
   ```

3. Verify that cleanup scripts work:
   ```bash
   bun scripts/dev/analyze-dependencies.ts
   # Should complete successfully and show clean dependency tree
   ```

**Expected Outcome:** ✅ No broken imports, all tests passing

### Test 5.3: Verify SKILLS_INDEX.md Completeness

**Objective:** Confirm that SKILLS_INDEX.md properly catalogs all skills

**Steps:**

1. Check that SKILLS_INDEX.md exists:

   ```bash
   ls specs/runtime/infra-17-*/SKILLS_INDEX.md
   ```

2. Verify it includes:
   - All 30+ skill files catalogued
   - Descriptions for each skill
   - Line counts for each file
   - Skill domain grouping

3. Cross-check against actual skills:
   ```bash
   find .agents/skills -name "SKILL.md" | wc -l
   # Count should match SKILLS_INDEX.md
   ```

**Expected Outcome:** ✅ SKILLS_INDEX.md complete, all skills documented

---

## Phase 6: Architecture Tools Finalization

### Test 6.1: Verify Incremental Analysis Performance

**Objective:** Confirm that incremental dependency analysis is faster than full analysis

**Steps:**

1. Profile ai-guard with incremental analysis:

   ```bash
   bun scripts/dev/profile-ai-guard.ts
   ```

2. Profile infra-audit with incremental analysis:

   ```bash
   bun scripts/dev/profile-infra-audit.ts
   ```

3. Compare to baseline:
   - **ai-guard:** Should be <1s (baseline: 1-2s)
   - **infra-audit:** Should be <3s (baseline: 3-5s)

**Expected Outcome:** ✅ ai-guard <1s, infra-audit <3s

### Test 6.2: Verify Architecture Brain Caching

**Objective:** Confirm that architecture brain is cached and TTL-based invalidation works

**Steps:**

1. Check cache directory:

   ```bash
   ls -lh docs/ai/context/ai-architecture-brain.json
   ```

2. Verify cache is used on subsequent runs:

   ```bash
   time bun scripts/infra-audit.ts
   # First run: generates cache (~3s)
   # Second run: uses cache (<1s)
   ```

3. Test cache invalidation:
   - Modify a file in `scripts/` or `packages/`
   - Run infra-audit again
   - Cache should invalidate and regenerate

**Expected Outcome:** ✅ Cache working, TTL invalidation functional

### Test 6.3: Verify No Architecture Violations

**Objective:** Confirm that all refactored code passes architecture validation

**Steps:**

1. Run full architecture audit:

   ```bash
   bun scripts/infra-audit.ts
   ```

2. Check for violations:
   - Should report 0 violations
   - Should report 0 forbidden imports
   - Should show clean architecture score (85+)

3. Run ai-guard:

   ```bash
   bun scripts/architecture/ai-guard.ts
   ```

4. Verify guardian verdict:
   - Should pass with 0 violations
   - Should show all rule checks PASS

**Expected Outcome:** ✅ 0 violations, architecture score 85+, ai-guard passes

---

## Cross-Phase Integration Tests

### Test Integration 1: Full Optimization Flow

**Objective:** Verify that all phases work together without conflicts

**Steps:**

1. Run the full optimization flow sequentially:

   ```bash
   # Phase 1: Generate baselines
   bun scripts/dev/generate-baseline-report.ts

   # Phase 2: Validate architecture after modularization
   bun scripts/infra-audit.ts

   # Phase 3: Verify AI context caching
   time bun scripts/generate-ai-context.ts

   # Phase 4: Run full CI pipeline
   bun run ci:test

   # Phase 5: Validate dependencies
   bun scripts/dev/analyze-dependencies.ts

   # Phase 6: Profile optimizations
   bun scripts/dev/profile-ai-guard.ts
   ```

2. Verify no errors occur across the full flow
3. Compare final metrics to baseline

**Expected Outcome:** ✅ All phases work together, no conflicts

### Test Integration 2: Performance Regression Detection

**Objective:** Verify that regression detection catches performance degradation

**Steps:**

1. Artificially introduce a performance regression:
   - Add 1000 lines of unnecessary code to a core utility
   - Commit the change

2. Run profiling:

   ```bash
   bun scripts/dev/profile-ai-guard.ts
   ```

3. Verify that regression is detected:
   - Profile should show performance change >5%
   - Regression report should be generated

4. Revert the change and verify recovery:

   ```bash
   git reset --hard HEAD~1
   bun scripts/dev/profile-ai-guard.ts
   ```

5. Confirm performance returns to baseline

**Expected Outcome:** ✅ Regression detection working, recovery confirmed

---

## Validation Checklist

Before considering testing complete, verify all items:

### Phase 1: Diagnostics

- [ ] Audit infrastructure (4 analyzer classes) verified
- [ ] Baseline report generated successfully
- [ ] All 4 reporting templates present and structured
- [ ] Baseline metrics match expected ranges

### Phase 2: Script Modularization

- [ ] All 7 core utilities extracted and present
- [ ] Code duplication <5% confirmed
- [ ] ARCHITECTURE_MAP.json updated with new modules
- [ ] No circular dependencies detected

### Phase 3: AI Context Optimization

- [ ] GitHub Actions cache configured correctly
- [ ] Cache key includes bun.lock
- [ ] Cache invalidation working on dependency changes
- [ ] AI context generation <5s (40% improvement)

### Phase 4: CI Pipeline Optimization

- [ ] CI pipeline completes in <8 minutes
- [ ] Job parallelization confirmed
- [ ] Job timeouts configured appropriately
- [ ] Fail-fast strategy enabled

### Phase 5: Dependency & Skill Cleanup

- [ ] All SKILL.md files <500 lines (100% compliance)
- [ ] No broken imports from dependency removal
- [ ] All tests passing after dependency cleanup
- [ ] SKILLS_INDEX.md complete and accurate

### Phase 6: Architecture Tools Finalization

- [ ] Incremental analysis performance targets met
- [ ] Architecture brain caching functional
- [ ] TTL-based cache invalidation working
- [ ] 0 architecture violations detected

### Integration Tests

- [ ] Full optimization flow completes without errors
- [ ] Regression detection functional
- [ ] Performance recovery after revert confirmed

---

## Troubleshooting Guide

### Issue: AI Context Generation Still Slow (>5s)

**Diagnosis:**

```bash
# Check if cache is being used
grep "cache" docs/ai/context/*.json
```

**Solution:**

1. Verify GitHub Actions cache is configured (Phase 3 test 3.1)
2. Check that bun.lock hasn't changed (cache key should match)
3. Run manual cache invalidation:
   ```bash
   rm docs/ai/context/*
   bun scripts/generate-ai-context.ts
   ```

### Issue: CI Pipeline Still Takes 12+ Minutes

**Diagnosis:**

```bash
# Check GitHub Actions workflow run timing
# Look at job timeline in Actions tab
```

**Solution:**

1. Verify job parallelization is configured (Phase 4 test 4.2)
2. Check for serial job dependencies that should be parallel
3. Review job timeout settings and reduce if appropriate

### Issue: Architecture Validation Fails

**Diagnosis:**

```bash
bun scripts/infra-audit.ts 2>&1 | head -50
```

**Solution:**

1. Check that all refactored imports are correct
2. Verify ARCHITECTURE_MAP.json is updated (Phase 2 test 2.3)
3. Run ai-guard to identify specific violations:
   ```bash
   bun scripts/architecture/ai-guard.ts
   ```

### Issue: SKILL.md Files Still >500 Lines

**Diagnosis:**

```bash
bun scripts/dev/audit-skill-sizes.ts
```

**Solution:**

1. Identify which skills exceed 500 lines
2. Check if domains are properly split (Phase 5 test 5.1)
3. Further split large skill domains if needed

---

## Performance Baseline Reference

**Target Metrics (from Phase 1 baseline):**

| Metric                | Baseline | Target     | Phase   |
| --------------------- | -------- | ---------- | ------- |
| Repository Size       | 180MB    | <150MB     | Phase 1 |
| AI Context Speed      | 5-8s     | <2s        | Phase 3 |
| ai-guard Execution    | 1-2s     | <1s        | Phase 6 |
| infra-audit Execution | 3-5s     | <3s        | Phase 6 |
| type-safety-guard     | 1-2s     | <1s        | Phase 6 |
| architecture-diff     | 2-3s     | <2s        | Phase 6 |
| CI Pipeline           | 12-18min | <8min      | Phase 4 |
| Lock File Size        | 6-7.5MB  | <6MB       | Phase 5 |
| SKILL.md Compliance   | Variable | <500 lines | Phase 5 |
| Script Duplication    | ~12%     | <5%        | Phase 2 |

---

## Sign-Off

**QA Team:** When all tests pass, sign off below.

| Role        | Name | Date | Sign-Off     |
| ----------- | ---- | ---- | ------------ |
| QA Lead     | —    | —    | [ ] Approved |
| Dev Lead    | —    | —    | [ ] Approved |
| DevOps Lead | —    | —    | [ ] Approved |

---

**Questions?** Refer to:

- **CLOSURE_REPORT.md** — Detailed implementation summary
- **reports/IMPLEMENT_REPORT.md** — Technical implementation details
- **audits/ANALYZE_REPORT.md** — Drift analysis and quality metrics

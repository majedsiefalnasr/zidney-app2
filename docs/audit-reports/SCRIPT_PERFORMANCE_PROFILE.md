# Script Performance Profile Report

**Generated:** [timestamp]  
**Repository State:** [branch/commit]  
**Purpose:** Profile governance script execution times to establish baseline for Phase 2 optimization

---

## Executive Summary

| Script                         | Target (ms) | Current (ms) | P95 (ms) | Status | Gap   |
| ------------------------------ | ----------- | ------------ | -------- | ------ | ----- |
| ai-guard.ts                    | <1000       | X            | X        | ⚠️/✓   | ±X ms |
| infra-audit.ts                 | <3000       | X            | X        | ⚠️/✓   | ±X ms |
| type-safety-guard.ts           | <1000       | X            | X        | ⚠️/✓   | ±X ms |
| architecture-diff.ts           | <2000       | X            | X        | ⚠️/✓   | ±X ms |
| generate-ai-context.ts         | <2000       | X            | X        | ⚠️/✓   | ±X ms |
| validate-architecture-brain.ts | <1000       | X            | X        | ⚠️/✓   | ±X ms |

---

## Critical Path Scripts (used in CI)

### 🔴 ai-guard.ts

**Target:** <1000 ms (95th percentile)

**Profile (10 runs):**

```
Run 1:  X ms
Run 2:  X ms
Run 3:  X ms
Run 4:  X ms
Run 5:  X ms
Run 6:  X ms
Run 7:  X ms
Run 8:  X ms
Run 9:  X ms
Run 10: X ms
```

**Statistics:**

- **Min:** X ms
- **Max:** X ms
- **Average:** X ms
- **P95 (95th percentile):** X ms
- **Status:** ✓ Below target / ⚠️ Above target / 🔴 Significantly over
- **Variability:** ±X ms (coefficient of variation: X%)

**Bottleneck Analysis:**

- Schema validation: X ms (expected)
- Dependency graph creation: X ms (HOTSPOT)
- Rule evaluation: X ms (expected)
- Report generation: X ms (expected)

**Optimization Opportunities:**

- [ ] Extract schema-validator utility (shared by 3 scripts)
- [ ] Cache graph structure between runs
- [ ] Parallelize rule evaluation if independent
- [ ] Reduce JSON parsing overhead

---

### 🔴 infra-audit.ts

**Target:** <3000 ms (95th percentile)

**Profile (10 runs):**

```
Run 1:  X ms
Run 2:  X ms
Run 3:  X ms
Run 4:  X ms
Run 5:  X ms
Run 6:  X ms
Run 7:  X ms
Run 8:  X ms
Run 9:  X ms
Run 10: X ms
```

**Statistics:**

- **Min:** X ms
- **Max:** X ms
- **Average:** X ms
- **P95:** X ms
- **Status:** ✓ Below target / ⚠️ Above target / 🔴 Significantly over
- **Variability:** ±X ms

**Bottleneck Analysis:**

- File discovery & analysis: X ms (HOTSPOT)
- Graph traversal: X ms (expected)
- Rule validation: X ms (expected)
- Artifact generation: X ms (expected)
- Report writing: X ms

**Optimization Opportunities:**

- [ ] Cache module roster (doesn't change frequently)
- [ ] Parallelize independent file analysis
- [ ] Implement selective audit (skip unchanged directories)
- [ ] Pre-compute graph instead of building on-demand
- [ ] Extract file-analyzer and graph-analyzer utilities

---

### 🔴 type-safety-guard.ts

**Target:** <1000 ms (95th percentile)

**Profile (10 runs):**

```
Run 1:  X ms
Run 2:  X ms
Run 3:  X ms
... (similar format)
```

**Statistics:**

- **Min:** X ms
- **Max:** X ms
- **Average:** X ms
- **P95:** X ms
- **Status:** ✓/⚠️/🔴

**Bottleneck Analysis:**

- TSConfig parsing: X ms
- Type check orchestration: X ms
- Validation logic: X ms

**Optimization Opportunities:**

- [ ] Cache TSConfig parsing
- [ ] Parallelize per-package type checks
- [ ] Extract schema-validator utility

---

### 🔴 architecture-diff.ts

**Target:** <2000 ms (95th percentile)

**Profile (10 runs):**

```
Run 1:  X ms
Run 2:  X ms
... (10 entries)
```

**Statistics:**

- **Min:** X ms
- **Max:** X ms
- **Average:** X ms
- **P95:** X ms
- **Status:** ✓/⚠️/🔴

**Bottleneck Analysis:**

- Previous state loading: X ms
- Current state generation: X ms
- Diff computation: X ms
- Reporting: X ms

**Optimization Opportunities:**

- [ ] Cache previous snapshot instead of regenerating
- [ ] Implement incremental diff (only changed modules)
- [ ] Extract schema-validator and performance-profiler utilities

---

## Supporting Scripts

### generate-ai-context.ts

**Current Time:** X ms (target <2000 ms)

**Profile:**

- Mini generator: X ms
- Module-map generator: X ms
- Dependency-graph generator: X ms
- Architecture-brain generator: X ms
- Report generation: X ms

**Status:** Later optimized in Phase 3 (caching)

### validate-architecture-brain.ts

**Current Time:** X ms (target <1000 ms)

**Profile:**

- Schema validation: X ms
- Integrity checks: X ms
- Report generation: X ms

**Status:** Expected to improve with schema-validator utility extraction

---

## Utility Opportunity Analysis (Phase 2)

### Code Duplication Detected

| Utility           | Used By                                     | Opportunities                      | Savings           |
| ----------------- | ------------------------------------------- | ---------------------------------- | ----------------- |
| Schema validation | ai-guard, architecture-diff, validate-brain | Extract to schema-validator.ts     | ~50-100 ms total  |
| File analysis     | infra-audit, generate-ai-context            | Extract to file-analyzer.ts        | ~100-200 ms total |
| Graph operations  | infra-audit, architecture-diff              | Extract to graph-analyzer.ts       | ~50-150 ms total  |
| Timing/stats      | (all scripts)                               | Extract to performance-profiler.ts | ~30-50 ms total   |

**Estimated Phase 2 Improvement: 200-400 ms total (15-30% reduction)**

---

## Parallelization Opportunities

### Independent Operations

- [ ] File discovery and tsconfig parsing (can parallelize)
- [ ] Per-package analyses (can parallelize with limits)
- [ ] Rule validation groups (can parallelize)

### Current Sequential Bottlenecks

- Graph creation (depends on file analysis, cannot parallelize)
- Artifact generation (depends on graph, cannot parallelize)

---

## Environment Factors

### System Info

```
CPU: [detected]
Memory: [available]
Disk Type: [SSD/HDD]
Node: [version]
Bun: [version]
```

### Variance Analysis

- **Expected run-to-run variance:** ±X%
- **Environmental impact:** Disk I/O variance contributes ~X%
- **Tip:** Run on SSD for consistent performance

---

## Phase Progression Targets

| Phase        | Script      | Target  | Current | Improvement        |
| ------------ | ----------- | ------- | ------- | ------------------ |
| 1 (Baseline) | ai-guard    | <1000ms | X ms    | 📊 Baseline        |
| 2 (Refactor) | ai-guard    | <1000ms | (TBD)   | Target ↓30%        |
| 2 (Refactor) | infra-audit | <3000ms | (TBD)   | Target ↓25%        |
| 3 (CI Opt)   | all         | —       | (TBD)   | Parallelized in CI |

---

## Recommendations for Phase 2

**Priority 1 (High Impact):**

1. Extract schema-validator utility (~50-100ms savings)
2. Cache infra-audit module roster (~100-150ms improvement)
3. Extract file-analyzer utility (~100-200ms savings)

**Priority 2 (Medium Impact):** 4. Implement selective caching for dependency-graph 5. Parallelize file analysis where possible 6. Extract graph-analyzer utility

**Priority 3 (Monitoring):** 7. Add performance regression detection to CI 8. Track script times over time 9. Alert if any script exceeds target by >10%

---

## Tracking & Regression Prevention

### Baseline Metrics (Phase 1)

- [Script name] P95: X ms
- [Script name] P95: X ms
- [Script name] P95: X ms

### CI Integration

- [ ] Add script performance tracking to CI job
- [ ] Alert if script exceeds target by >10%
- [ ] Store performance metrics in artifacts
- [ ] Generate performance report per CI run

### Success Criteria Summary

✓ = Meeting target  
⚠️ = Within 10% of target  
🔴 = >10% over target

**Phase 1 Baseline Status:** [Summary]  
**Next Review:** After Phase 2 completion

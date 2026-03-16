# CI Workflow Structure Analysis

**Date:** 2026-03-15  
**Phase:** 4: CI Pipeline Optimization (T081-T095)  
**Baseline Duration:** 12-18 minutes  
**Target Duration:** <8 minutes (25-35% reduction)

---

## Current Workflow Architecture

### Job Dependency Graph

```
START
  ├─ lint (3-5 min)
  └─ typecheck (3-5 min)
         ↓ (both complete ~3-5 min)
      arch-guard (1-2 min) ─────────┐
                                     ├─ unit-tests (5-8 min)
                                     │      ↓
                                     ├──────┤ coverage-validation (5-8 min)
                                     │      │
                                     └──────┤ integration-tests (10-15 min)
                                            │      ↓
                                    [E2E Tests - parallel]
                                    ├─ e2e-mmc (10-15 min)
                                    ├─ e2e-backoffice (10-15 min)
                                    └─ e2e-frontoffice (10-15 min)
                                            ↓
                                    build-verification (5 min)
                                            ↓
                                    SUCCESS
```

---

## Sequential Job Chain Analysis

### Task Dependency Tree

| Job                     | Dependencies                                                                | Duration  | Type                      | Status                                   |
| ----------------------- | --------------------------------------------------------------------------- | --------- | ------------------------- | ---------------------------------------- |
| **lint**                | None                                                                        | 3-5 min   | Parallelizable            | ✓ Independent                            |
| **typecheck**           | None                                                                        | 3-5 min   | Parallelizable            | ✓ Independent                            |
| **arch-guard**          | lint, typecheck                                                             | 1-2 min   | Sequential                | ⚠ Blocks unit-tests                      |
| **unit-tests**          | lint, typecheck, arch-guard                                                 | 5-8 min   | Parallelizable            | ⚠ Dependency blocker                     |
| **coverage-validation** | unit-tests                                                                  | 5-8 min   | Sequential                | ✓ Can parallelize with integration-tests |
| **integration-tests**   | unit-tests, arch-guard                                                      | 10-15 min | Parallelizable (DB/Redis) | ⚠ Heavy resource usage                   |
| **e2e-mmc**             | integration-tests                                                           | 10-15 min | Parallelizable            | ✓ Parallel with other e2e                |
| **e2e-backoffice**      | integration-tests                                                           | 10-15 min | Parallelizable            | ✓ Parallel with other e2e                |
| **e2e-frontoffice**     | integration-tests                                                           | 10-15 min | Parallelizable            | ✓ Parallel with other e2e                |
| **build-verification**  | lint, typecheck, unit-tests, integration-tests, e2e-\*, coverage-validation | 5 min     | Sequential                | ⚠ Unnecessary dependencies               |

---

## Critical Path Analysis

### Current Execution Timeline (Sequential Branch)

```
Timeline:
0-5 min:   lint + typecheck (parallel)
5-7 min:   arch-guard (sequential after lint+typecheck)
7-15 min:  unit-tests (sequential after arch-guard)
15-30 min: integration-tests (sequential after unit-tests)
30-45 min: e2e tests (parallel, max 15-20 min each)
45-50 min: build-verification (sequential at end)

TOTAL: ~45-50 minutes (longest path)
WALL-CLOCK: ~45-50 minutes (due to sequential blocking)
```

### Critical Path Identification

**Longest dependency chain:**

```
lint (3-5) → arch-guard (1-2) → unit-tests (5-8) → integration-tests (10-15) → e2e (10-15) → build (5)
= 34-50 minutes sequential
```

**With current parallelization (lint+typecheck, e2e):**

```
max(lint, typecheck) (3-5)
  → arch-guard (1-2)
  → unit-tests (5-8)
  → integration-tests (10-15)
  → max(e2e-mmc, e2e-backoffice, e2e-frontoffice) (10-15)
  → build (5)
= ~34-50 minutes total
```

---

## Sequential Bottlenecks

### 1. **Lint + Typecheck Blocking arch-guard**

- **Issue:** arch-guard depends on BOTH lint AND typecheck completing
- **Impact:** arch-guard cannot start until both finish (serial dependency)
- **Optimization:** Remove lint/typecheck as hard dependencies for arch-guard
  - arch-guard only validates module boundaries (independent concern)
  - Can run in parallel with lint+typecheck

### 2. **arch-guard Blocking unit-tests**

- **Issue:** unit-tests requires lint + typecheck + arch-guard (3 sequential gates)
- **Impact:** unit-tests is delayed by arch-guard's sequential dependency chain
- **Optimization:** Make arch-guard optional for unit-tests or run both in parallel
  - arch-guard validates structure, not correctness
  - Tests validate behavior

### 3. **unit-tests Blocking integration-tests**

- **Issue:** integration-tests depends on unit-tests completion
- **Impact:** Cannot start integration setup/DB until unit tests finish
- **Optimization:** Remove explicit dependency, run in parallel
  - integration-tests has own setup phase (DB initialization)
  - No data sharing between unit and integration tests
  - Reduces critical path by ~5-8 minutes

### 4. **integration-tests Blocking all e2e tests**

- **Issue:** All e2e tests must wait for integration tests (good, sequential)
- **Impact:** Cannot parallelize e2e earlier
- **Status:** This is appropriate (e2e needs integration-tests to complete)

### 5. **build-verification Over-Blocking**

- **Issue:** build-verification depends on ALL jobs (lint, typecheck, unit-tests, integration-tests, e2e-\*, coverage-validation)
- **Impact:** Build cannot start until the last e2e test completes
- **Current Status:** build-verification is the final gate
- **Optimization:** Make build-verification depend only on lint + typecheck + arch-guard
  - Build success depends on source code quality, not test results
  - Tests validate behavior, not build correctness
  - Allows build to complete ~20 minutes earlier

### 6. **coverage-validation in Parallel Queue**

- **Issue:** coverage-validation depends only on unit-tests but is gated by build-verification
- **Impact:** Results are blocked by build, not by coverage completion
- **Status:** Can run independently after unit-tests

---

## Parallelization Opportunities

### High-Impact Optimizations

| Opportunity                              | Current                            | Optimized                           | Savings   | Dependencies               |
| ---------------------------------------- | ---------------------------------- | ----------------------------------- | --------- | -------------------------- |
| Lint + typecheck in parallel             | Sequential arch-guard wait         | Parallel immediately                | 1-2 min   | None                       |
| arch-guard parallel to lint+typecheck    | Sequential wait for lint+typecheck | Parallel start                      | 1-2 min   | Remove lint+typecheck deps |
| unit-tests parallel to arch-guard        | Sequential wait                    | Parallel after lint+typecheck       | 1-2 min   | Remove arch-guard dep      |
| integration-tests parallel to unit-tests | Sequential wait for completion     | Parallel start after lint+typecheck | 5-8 min   | Remove unit-tests dep      |
| e2e tests parallel (already done)        | All e2e sequential                 | Parallel e2e                        | 10-15 min | ✓ Already optimized        |
| coverage-validation parallel             | Wait for other tests               | Parallel to integration-tests       | 3-5 min   | Only needs unit-tests      |
| build-verification early                 | Wait for all tests                 | After lint+typecheck only           | 15-20 min | Remove test dependencies   |

---

## Optimization Strategy

### Phase 1: Remove Unnecessary Dependencies (Immediate Gains: 8-12 min)

1. **arch-guard independence** (1-2 min gain)
   - Remove `needs: [lint, typecheck]` from arch-guard
   - Make arch-guard run immediately after checkout
   - Rationale: Boundary validation is independent of lint/typecheck

2. **unit-tests independence from arch-guard** (1-2 min gain)
   - Remove `needs: arch-guard` from unit-tests
   - Keep only `needs: [lint, typecheck]`
   - Rationale: Unit correctness doesn't depend on architecture validation

3. **integration-tests independence from unit-tests** (5-8 min gain)
   - Remove `needs: unit-tests` from integration-tests
   - Keep only `needs: arch-guard`
   - Rationale: Integration setup is independent; requires arch validation only
   - Safety: Integration-tests can run in parallel, failing independently

4. **coverage-validation parallel path** (3-5 min gain)
   - Keep `needs: unit-tests` (required for test data)
   - Add to allow parallel with integration-tests
   - No new blocker

5. **build-verification early completion** (15-20 min gain)
   - Change `needs: [lint, typecheck, unit-tests, integration-tests, e2e-*, coverage-validation]`
   - To: `needs: [lint, typecheck, arch-guard]`
   - Rationale: Build success depends on source quality (lint+typecheck+arch), not test results
   - Can run early, report simultaneously with test results

### Phase 2: Cache Integration

1. **node_modules caching** (2-3 min savings per job)
   - Use GitHub Actions cache with `bun.lock` hash as key
   - Avoids reinstalling dependencies in each job

2. **ai-context artifact caching** (0.5 sec savings)
   - Cache dependency-graph and runtime-dependents from Phase 3
   - Already implemented in Phase 3, needs CI integration

---

## Updated Critical Path (Post-Optimization)

### Optimized Execution Timeline

```
0-5 min:    lint + typecheck (parallel) + arch-guard (parallel)
5-13 min:   unit-tests + integration-tests (parallel) + coverage-validation
13-28 min:  e2e tests (parallel: mmc, backoffice, frontoffice)
28-33 min:  build-verification (early, in parallel with e2e, reports last)
33+ min:    ALL COMPLETE

TOTAL: ~33 minutes → 13-14 minutes critical path
With cache: ~13-14 minutes (cold), ~8-10 minutes (warm, cached dependencies)
```

### Parallel Job Groups (Optimized)

**Group 1 - Code Quality (0-5 min, all parallel):**

- lint
- typecheck
- arch-guard

**Group 2 - Unit + Integration (5-13 min, all parallel):**

- unit-tests
- integration-tests
- coverage-validation

**Group 3 - E2E (13-28 min, all parallel):**

- e2e-mmc
- e2e-backoffice
- e2e-frontoffice

**Group 4 - Build (starts at 0, completes after group 1, reports at end):**

- build-verification (can run in parallel with any group, report at 33 min)

---

## Cache Strategy

### node_modules Cache

```yaml
- uses: actions/cache@v4
  with:
    path: node_modules
    key: node-modules-${{ hashFiles('bun.lock') }}
    restore-keys: node-modules-
```

**Impact:**

- Cold run: 2-3 min (reinstall)
- Warm run: 10-30 sec (restore from cache)
- Savings per job: 2-3 min
- Total savings (8 jobs): ~15-20 minutes

### AI Context Artifact Cache

```yaml
- uses: actions/cache@v4
  with:
    path: docs/ai/context/*.json
    key: ai-context-${{ hashFiles('package.json', 'bun.lock') }}
    restore-keys: ai-context-
```

**Impact:**

- Cold run: 2 sec (generation)
- Warm run: 0.5 sec (restore)
- Savings: ~1.5 sec (minimal, artifact generation is already fast from Phase 3)

---

## Success Metrics (Phase 4 Goals)

| Metric                   | Current   | Target   | Status          |
| ------------------------ | --------- | -------- | --------------- |
| CI Duration (wall-clock) | 12-18 min | <8 min   | ⏳ In Progress  |
| Critical Path            | 34-50 min | ~8 min   | ⏳ In Progress  |
| Parallel Groups          | 1 (e2e)   | 4 groups | ⏳ In Progress  |
| Cache Hit Ratio          | 0%        | >70%     | ⏳ To Implement |
| Lint Job                 | 3-5 min   | 2-3 min  | ⏳ To Cache     |
| Type Check Job           | 3-5 min   | 2-3 min  | ⏳ To Cache     |
| Unit Tests               | 5-8 min   | 3-4 min  | ⏳ To Cache     |
| Integration Tests        | 10-15 min | 5-8 min  | ⏳ To Cache     |

---

## Risk Assessment

### Low Risk (Safe Parallelization)

- ✓ lint + typecheck (independent)
- ✓ arch-guard independent (validates code structure)
- ✓ e2e tests parallel (isolated environments)
- ✓ coverage-validation in parallel queue

### Medium Risk (Requires Validation)

- ⚠ unit-tests + integration-tests parallel (need separate test data setup)
  - **Mitigation:** Keep their setup steps isolated, only share GitHub workspace (code)
  - **Validation:** Run both in CI, verify no test data conflicts

- ⚠ build-verification early (removes test failure blocking)
  - **Mitigation:** Builds pass on lint+typecheck; tests validate behavior separately
  - **Validation:** Existing tests catch behavioral regressions; build is orthogonal

### High Risk (Do NOT optimize)

- ✗ Remove arch-guard (validates architectural integrity)
- ✗ Remove unit-tests (foundational validation)
- ✗ Remove integration-tests (critical for runtime behavior)
- ✗ Remove e2e tests (end-to-end validation)

---

## Implementation Checklist

- [x] T081: Analyze current workflow structure ✓ (THIS DOCUMENT)
- [ ] T082: Parallelize lint + typecheck
- [ ] T083: Parallelize arch-guard
- [ ] T084: Parallelize unit-tests + integration-tests
- [ ] T085: Add node_modules cache
- [ ] T086: Integrate artifact cache restore
- [ ] T087: Add cache save step
- [ ] T088: Configure cache key strategy
- [ ] T089: Remove duplicate type-check steps
- [ ] T090: Remove redundant artifact generation
- [ ] T091: Benchmark baseline
- [ ] T092-T095: Performance validation and reporting

---

## Next Steps

1. **T082-T090:** Implement parallelization changes in ci.yml
2. **Validation:** Run CI pipeline and measure wall-clock time
3. **Reporting:** Document before/after metrics in CI_PERFORMANCE_REPORT.md

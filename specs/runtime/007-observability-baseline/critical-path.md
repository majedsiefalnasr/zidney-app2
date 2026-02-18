# Critical Path Analysis: STAGE_07_OBSERVABILITY_BASELINE

**Generated**: 2026-02-18  
**Stage**: STAGE_07_OBSERVABILITY_BASELINE  
**Total Tasks**: 22  
**Phases**: 5  
**Dependency Edges**: 38

---

## Executive Summary

**Critical Path Length**: ~16 hours (sequential execution of dependency chains)

**Optimized Timeline** (with parallelization): ~11.25 hours

**Conservative Timeline** (single-threaded): ~20 hours

**Key Bottlenecks**:

1. Phase 1 Foundation (4 hours) — Logger singleton is critical
2. Phase 3 Job Chain (5.5 hours) — Worker integration cannot be parallelized
3. Phase 4-5 Integration (3.75 hours) — Error handling + full test suite

---

## Critical Path Chains

### Chain 1: Phase 1 Logger Foundation (4 hours)

**Sequence**:

```
T001: Create Logger Abstraction (1.5h)
  ↓
T002: Create Request ID Middleware (1h)
  ↓
T003: Create Correlation Context Middleware (1.5h)
  ↓
T005: Register Middlewares in API Router (1h)
  ─────────────────────────────────────────
  Total: 5 hours (sequential)
```

**Parallelizable within chain**:

- T002 can run in parallel with T001 (no dependency)
- T004 can run in parallel with T001 (no dependency)
- Both create at T003 (depends on T001, T002)
- Then T005 (depends on T003, T004)

**Optimized Phase 1: 4 hours** (T001 + [T002,T004 parallel] + T003 + T005)

**Reason for sequencing**:

- Logger must be created first (singleton pattern)
- Request ID generation and correlation both consume logger
- Both middlewares must be implemented before registration
- Registration finalizes Phase 1

---

### Chain 2: Phase 2 Audit Services (3.5 hours)

**Sequence**:

```
T006: Create Audit Service (1.5h) ┐
T007: Create Audit Log Migration (1h) ┤ Parallel
                                   ┘
  ↓
T008: License Service Integration (1h) ┐
T009: Provisioning Service Integration (1h) ┤ Sequential (T008 then T009)
  ───────────────────────────────────────
  Total: 3.5 hours
```

**Parallelizable within chain**:

- T006 and T007 can run in parallel (service + migration independent)
- T008 and T009 must run sequentially (both depend on T006+T007)

**Optimized Phase 2: 3.5 hours** ([T006,T007 parallel] + [T008,T009 sequential])

**Reason for sequencing**:

- Audit table (T007) and service (T006) independent implementations
- Two integration points (license, provisioning) depend on both
- Sequential integration points ensure clear dependencies

---

### Chain 3: Phase 3 Worker Job Lifecycle (5.5 hours)

**Sequence**:

```
T010: Create Job Envelope Interface (1h) ┐
T011: Create Job Hash Function (0.5h) ────┤ Parallel
                                          ┘
  ↓
T012: Update Job Enqueue (1.5h)
  ↓
T013: Update Job Dequeue (1.5h)
  ↓
T014: Create Worker Logger Context (1h)
  ─────────────────────────────────────────
  Total: 5.5 hours (sequential chain with parallel start)
```

**Parallelizable within chain**:

- T010 and T011 can run in parallel (types + hash function independent)
- T012-T013-T014 forms unbreakable sequential chain

**Optimized Phase 3: 5.5 hours** ([T010,T011 parallel] → T012 → T013 → T014)

**Reason for sequencing**:

- Job envelope interface and hash function must both exist before enqueue
- Enqueue must complete before dequeue (dependency flow)
- Worker logger depends on job structure from dequeue
- Cannot parallelize T012-T014 (hard blocking chain)

---

### Chain 4: Phase 4 Error Standardization (2.25 hours)

**Sequence**:

```
T016: Create Error Code Registry (0.75h) ┐
                                         ├─ Sequential
T017: Update Error Handler Middleware (1.5h) ┘
  ──────────────────────────────────────────
  Total: 2.25 hours

T015: Update Grading Worker (1h)
  ──────────────────────────────────────────
  Can run in parallel with T016-T017
```

**Parallelizable within chain**:

- T015 is independent (no blocking dependencies)
- T015 can run in parallel with T016-T017
- Actual timeline: max(T015, T016→T017) = max(1h, 2.25h) = 2.25 hours

**Optimized Phase 4: 2.25 hours** (T015 ∥ [T016 → T017])

**Reason for sequencing**:

- Error codes must be defined before handler references them
- Error handler must come after codes (hard dependency)
- Grading worker independent (can run anytime after Phase 3)

---

### Chain 5: Phase 5 Testing & Validation (1.5 hours)

**Sequence**:

```
T018: Logger Unit Tests (1h) ┐
T019: Correlation Integration Tests (1.5h) ┤
T020: Job Lifecycle Tests (1.5h) ├─ All Parallel
T021: Audit Event Tests (1.5h) ├─ (no dependencies)
T022: Snapshot Tests (1h) ────┘
  ──────────────────────────────────────────
  Total: 1.5 hours (all parallel, max time)
{% if not hide_detailed %}

**Parallelizable within chain**:
- All 5 test suites are completely independent
- No test depends on another test
- All test subjects (T001-T017) must be complete before testing starts
- Timeline determined by longest test (T019, T020, T021 at 1.5h each)

**Optimized Phase 5: 1.5 hours** ([T018-T022 all parallel])

**Reason for parallelization**:
- Tests are read-only of implementation (no cross-test blocking)
- Each test suite covers different components (logger, correlation, job, audit, snapshots)
- Can distribute across 5 developers/machines (1 test suite per developer)
{% endif %}
```

**Optimized Phase 5: 1.5 hours** ([T018-T022 all parallel])

**Reason for parallelization**:

- Tests are read-only of implementation (no cross-test blocking)
- Each test suite covers different components
- Can distribute across team (1 test suite per developer)

---

## Full Stage Critical Path

**Assembled from all chains**:

```
Phase 1 (4h):
  T001 (1.5h) → T002 (1h) → T003 (1.5h) → T005 (1h)
  [+ T004 parallel in T002-T003 window]

Phase 2 (3.5h):
  [T006, T007 parallel: 1.5h] → T008 (1h) → T009 (1h)
  [Can run AFTER Phase 1 completes]

Phase 3 (5.5h):
  [T010, T011 parallel: 1.5h] → T012 (1.5h) → T013 (1.5h) → T014 (1h)
  [Can run AFTER Phase 1 T005 completes]
  [OVERLAPS with Phase 2]

Phase 4 (2.25h):
  T015 (1h) ∥ [T016 (0.75h) → T017 (1.5h)]
  [Can run AFTER Phase 3 T014 completes]

Phase 5 (1.5h):
  [T018, T019, T020, T021, T022 all parallel: 1.5h]
  [Can run AFTER Phase 4 completes]

Total Critical Path: 4 + max(3.5, 5.5 overlap window) + 2.25 + 1.5
                  = 4 + 5.5 + 2.25 + 1.5
                  = 13.25 hours (minimal overlap)
```

**With Maximum Overlap**:

```
Timeline:
├─ [0-4h]:      Phase 1 (4h)
├─ [4-9.5h]:    Phase 2 (3.5h) + Phase 3 (5.5h) overlapped
├─ [9.5-11.75h]: Phase 4 (2.25h)
└─ [11.75-13.25h]: Phase 5 (1.5h)

Total: 13.25 hours (with temporal overlap)
```

**More realistic with dependencies**:

```
├─ [0-4h]:       Phase 1 (T001-T005)
├─ [4-9.5h]:     Phase 2 (3.5h) | Phase 3 (5.5h) | starts at T005
├─ [9.5-11.75h]: Phase 4 (2.25h) after Phase 3 T014
├─ [11.75-13.25h]: Phase 5 (1.5h) after Phase 4 T017

Critical Path Timeline: ~13 hours
```

---

## Bottleneck Analysis

### Bottleneck 1: Phase 1 Logger Foundation (4 hours)

**Why it's a bottleneck**:

- Logger required by all middleware (T003, T004)
- Logger required by all tests (T018)
- Logger singleton pattern cannot be parallelized
- Blocks: Phase 2, Phase 3, Phase 5

**Impact of delay**:

- 1-hour delay in T001 → 1-hour delay to project completion
- Critical: Do not block on edge cases (keep scope minimal)

**Mitigation**:

- Assign senior engineer to T001 (minimize rework)
- Commit logger design before implementation starts
- Use standard Pino pattern (not custom)
- Skip advanced features (batching, custom transports)

---

### Bottleneck 2: Phase 3 Job Chain (5.5 hours)

**Why it's a bottleneck**:

- Job envelope (T010) → Hash function (T011) → Enqueue (T012) → Dequeue (T013) → Logger (T014)
- Cannot parallelize T012-T013-T014 (hard dependency chain)
- Longest non-parallel chain in entire stage
- Blocks: Phase 4, Phase 5

**Impact of delay**:

- Phase 3 is longest single chain (5.5 hours)
- Any slip here delays end-to-end staging by same amount
- Worker jobs are foundation for all background operations

**Mitigation**:

- Start Phase 3 as soon as Phase 1 T005 complete (don't wait for Phase 2)
- Parallelize T010+T011 aggressively (pre-design both)
- Use test-driven approach: write T020 tests first, implement T012-T014 to pass
- Consider stub implementations for T012-T013 to unblock T014 faster

---

### Bottleneck 3: Test Coverage (1.5 hours, but determines project quality)

**Why it's a bottleneck** (quality not speed):

- All 5 test suites depend on full Phase 1-4 completion
- Test discovery happens late (day 10, not day 1)
- Cannot start tests until implementation done
- Test failures discovered near end can cause rework

**Impact of delay**:

- Test delays don't delay deployment (Tests are last phase)
- But test failures force rework in Phases 1-4
- Risk: Schedule compression (no time for rework)

**Mitigation**:

- Write test stubs in Phase 1 (T018 framework, failing tests)
- Implement tests in parallel with implementation (TDD approach)
- Don't wait until Phase 5 to discover test issues
- Reserve 2-3 hours buffer in Phase 5 for rework + coverage fixes

---

## Timeline Comparison

| Scenario                            | Timeline     | Notes                                                |
| ----------------------------------- | ------------ | ---------------------------------------------------- |
| **Sequential (no parallelization)** | ~20 hours    | Every task starts after previous finishes            |
| **Conservative parallelization**    | ~15 hours    | Within-phase parallelization only                    |
| **Recommended parallelization**     | ~13 hours    | Cross-phase overlap + within-phase parallel          |
| **Aggressive parallelization**      | ~11.25 hours | Maximum overlap, all parallelizable tasks concurrent |
| **With buffer (15% contingency)**   | ~15 hours    | Recommended + 15% buffer = 13h × 1.15                |

**Recommended approach**: Conservative parallelization (~15 hours) with 15% buffer = **realistic 17.25-hour timeline**

---

## Schedule (Recommended Execution Order)

### Day 1-2: Phase 1 Foundation Critical Path

**Parallel Teams**:

**Team A** (Logger):

- T001: Create logger abstraction (1.5h) → complete by Day 1 EOD

**Team B** (Middleware Implementations):

- T002: Request ID middleware (starts Day 1 after T001 stub, 1h)
- T004: Redaction middleware (starts Day 1 parallel with T002, 1.5h)

**Team A continues**:

- T003: Correlation context (starts after T001+T002 available, 1.5h) → complete Day 1 EOD

**Team C** (Router Registration):

- T005: Register middlewares (starts after T003+T004, 1h) → Day 2 EOD

**Status**: Phase 1 complete by Day 2 EOD (4 hours elapsed)

---

### Day 2-3: Phase 2 & 3 Start (Parallel Pipeline)

**Phase 2 Team** (Audit):

- T006: Audit service (starts Day 2 afternoon, 1.5h)
- T007: Audit migration (starts Day 2 afternoon parallel, 1h)
- T008: License integration (starts after T006+T007, 1h) → Day 3 EOD
- T009: Provisioning integration (follows T008, 1h) → Day 3 EOD

**Phase 3 Team** (Worker Foundations):

- T010: Job envelope (starts Day 2 afternoon, 1h)
- T011: Job hash function (starts Day 2 afternoon parallel, 0.5h)
- T012: Job enqueue (starts after T010+T011, 1.5h) → Day 3 afternoon
- T013: Job dequeue (starts after T012, 1.5h) → Day 4 EOD
- T014: Worker logger (starts after T013, 1h) → Day 4 EOD

**Status**: Phase 2 complete by Day 3 EOD; Phase 3 in progress (Days 3-4)

---

### Day 4-5: Phase 3 Completion & Phase 4 Start

**Phase 3 Continued**:

- Days 3-4: T012 → T013 → T014 complete by Day 4 EOD

**Phase 4 Team** (Error Standardization):

- T015: Grading worker (starts Day 4, 1h) → complete Day 4 EOD
- T016: Error codes (starts Day 4 parallel, 0.75h)
- T017: Error handler (starts after T016, 1.5h) → Day 5 EOD

**Status**: Phase 3 & 4 complete by Day 5 EOD

---

### Day 5-6: Phase 5 Testing (All Parallel)

**All Test Suites Parallel** (no bottlenecks):

- T018: Logger unit tests (starts Day 5, 1h)
- T019: Correlation integration tests (starts Day 5, 1.5h)
- T020: Job lifecycle tests (starts Day 5, 1.5h)
- T021: Audit event tests (starts Day 5, 1.5h)
- T022: Snapshot tests (starts Day 5, 1h)

**Timeline**: Max(1.5h) = 1.5 hours → complete Day 5 late afternoon

**Status**: All 22 tasks complete by Day 5 evening (5 full 8-hour days)

---

## Risk-Based Timeline Adjustments

### Low Risk (No adjustments):

- Phase 1 logger (straightforward Pino wrapper)
- Phase 5 tests (no dependencies, can parallelize fully)
- Timeline: No buffer required

### Medium Risk (Add 10% buffer):

- Phase 2 audit (straightforward service, clear schema)
- Phase 4 error handler (standard error response pattern)
- Adjusted timeline: +0.35 hours = ~14.5 hours

### High Risk (Add 20% buffer):

- Phase 3 worker chain (complex dual ID tracking, hash verification)
- Job envelope design must be perfect (hard to change mid-chain)
- Adjusted timeline: +1.1 hours = ~15.6 hours

**Total With Buffers**: ~15.6 hours (recommended schedule)

---

## Go/No-Go Checkpoints

### Checkpoint 1: After Phase 1 (Day 2 EOD)

**Status Block**: Logger abstraction must be production-ready

**Criteria**:

- [ ] Logger singleton verified (1000 calls return same instance)
- [ ] JSON output valid (no parse errors)
- [ ] Required fields present (timestamp, level, service)
- [ ] Unit tests >90% coverage

**If Not Met**:

- [ ] Stop Phase 2-5 (cannot proceed without logger)
- [ ] 2-hour rework window
- [ ] Decision: Proceed with partial scope or reset

---

### Checkpoint 2: After Phase 2 (Day 3 EOD)

**Status Block**: Audit service + license integration working

**Criteria**:

- [ ] Audit service methods callable (no type errors)
- [ ] Audit table created and accessible
- [ ] License integration tested (license change recorded to audit_log)
- [ ] Integration tests passing

**If Not Met**:

- [ ] Stop Phase 4 (error handler depends on error patterns from audit)
- [ ] 1-hour fix window
- [ ] Decision: Proceed with audit stubs or reset

---

### Checkpoint 3: After Phase 3 (Day 4 EOD)

**Status Block**: Worker job lifecycle tracking working

**Criteria**:

- [ ] Job envelope structure valid (all fields present)
- [ ] Dual IDs (request_id + job_id) in logs
- [ ] Payload hash computed and verified
- [ ] Worker logger injecting context automatically

**If Not Met**:

- [ ] Stop Phase 5 (cannot test worker without job tracking)
- [ ] 2-hour rework window
- [ ] Decision: Proceed with partial job scope or reset

---

### Checkpoint 4: After Phase 4 (Day 5 EOD)

**Status Block**: Error responses standardized

**Criteria**:

- [ ] All 10+ error codes defined
- [ ] Error handler mapping codes to HTTP status
- [ ] No stack traces in error responses
- [ ] Grading worker using job logger

**If Not Met**:

- [ ] Start Phase 5 anyway (tests don't block Stage 08 readiness)
- [ ] 1-hour fix window during Phase 5
- [ ] Decision: Proceed with snapshot tests or reset

---

### Checkpoint 5: After Phase 5 (Day 5 evening)

**Status Block**: All tests passing, >80% coverage

**Criteria**:

- [ ] T018: Logger unit tests passing, >90% coverage
- [ ] T019: Correlation integration tests passing, >85% coverage
- [ ] T020: Job lifecycle tests passing, >85% coverage
- [ ] T021: Audit event tests passing, >85% coverage
- [ ] T022: Snapshot tests passing, all formats validated
- [ ] Total coverage >80% (code + features)

**If Not Met**:

- [ ] Rework in Day 6 (1-2 hour buffer)
- [ ] Decision: Ship with coverage gap or block release

---

## Final Critical Path Summary

```
Minimum Timeline: 16 hours (sequential execution of critical chains)

Realistic Timeline: 17.25 hours (recommended scope + 15% buffer)

Schedule:
├─ Day 1-2: Phase 1 Foundation (4h) ──────┐
├─ Day 2-3: Phase 2 Audit (3.5h) ────────┐│
├─ Day 3-4: Phase 3 Worker (5.5h) ───────┤├─ Can overlap
├─ Day 4-5: Phase 4 Error Handler (2.25h)┘│
└─ Day 5-6: Phase 5 Testing (1.5h)────────┘

Total: 5 full days, achieve by Day 5 evening with aggressive parallelization
Recommended: 6 calendar days with 15% contingency buffer
```

---

## Readiness Confirmation

**Before execution, confirm**:

- [ ] All 22 tasks identified and prioritized
- [ ] Team size confirmed (recommended: 5 developers)
- [ ] Critical path identified: Phase 1 → Phase 3 → Phase 4 → Phase 5
- [ ] Bottlenecks documented: Logger (4h), Job chain (5.5h), Tests (1.5h)
- [ ] Checkpoints scheduled: After each phase completion
- [ ] Buffer time allocated: 15% = ~2.5 hours
- [ ] Schedule approved: 17.25 hours total timeline
- [ ] Dependencies locked: No scope changes mid-execution
- [ ] Go/no-go criteria defined: 5 checkpoints

**Status**: READY FOR PHASE 1 IMPLEMENTATION ✅

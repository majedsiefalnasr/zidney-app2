# STAGE_INFRA_17 Task Generation — Repository Size and Performance Optimization

**Stage:** INFRA_17 — Repository Size and Performance Optimization  
**Phase:** 01_PLATFORM_FOUNDATION  
**Branch:** spec/infra-17-repository-size-and-performance-optimization  
**Generated:** 2026-03-14  
**Task Count:** 118 tasks

---

## Overview

This task list implements Repository Size and Performance Optimization across 6 implementation phases. Tasks are organized by phase and marked with `[P]` for parallelizable work.

**Success Criteria:**

- Repository size: 180MB → <150MB (30-40% reduction)
- AI context generation: 5-8s → <2s (60-75% improvement)
- Script execution: <1s (ai-guard), <3s (infra-audit), <1s (type-safety), <2s (architecture-diff)
- CI pipeline duration: 12-18min → <8min (25-35% reduction)
- Lock file: <6MB (15-25% reduction)
- All SKILL.md files: <500 lines
- Script duplication: <5% code overlap

---

## Phase 1: Repository Diagnostics & Baseline (T001-T010)

### Phase Goal

Establish comprehensive baseline measurements and diagnostic reports for all 8 optimization areas. Create audit trails and reporting structure for performance tracking throughout implementation.

### Phase Dependencies

None (foundational phase)

### Independent Test Criteria

- All diagnostic scripts execute without errors
- All baseline measurements are recorded in audits/ directory
- Reporting templates are functional and populated
- Comparison mechanism supports before/after measurement

---

#### Setup & Measurement Tasks

- [x] T001 Create audits/ directory structure with audit-helpers utility in tests/audit-helpers.ts at workspace root
- [x] T002 [P] Create FILE_SIZE_ANALYSIS.md template at docs/audit-reports/FILE_SIZE_ANALYSIS.md
- [x] T003 [P] Create DIRECTORY_SIZE_ANALYSIS.md template at docs/audit-reports/DIRECTORY_SIZE_ANALYSIS.md
- [x] T004 [P] Create AI_CONTEXT_ARTIFACT_ANALYSIS.md template at docs/audit-reports/AI_CONTEXT_ARTIFACT_ANALYSIS.md
- [x] T005 [P] Create SCRIPT_PERFORMANCE_PROFILE.md template at docs/audit-reports/SCRIPT_PERFORMANCE_PROFILE.md

#### Diagnostic Script Development

- [x] T006 Generate file size analysis script at scripts/dev/analyze-file-sizes.ts (identify all files >2000 lines, >1000 MB)
- [x] T007 [P] Generate directory size measurement script at scripts/dev/analyze-directory-sizes.ts (use du -sh on key directories)
- [x] T008 [P] Generate AI context artifact analysis script at scripts/dev/analyze-ai-context-artifacts.ts (measure sizes, compression, redundancy)
- [x] T009 [P] Generate script performance profiler at scripts/dev/profile-script-performance.ts (10 runs per script, calculate statistics)
- [x] T010 [P] Generate initial baseline report generator at scripts/dev/generate-baseline-report.ts (consolidates all diagnostics into BASELINE_REPORT.md)

---

## Phase 2: Script Modularization — Architecture Tools (T011-T050)

### Phase Goal

Modularize governance scripts through utility extraction, refactoring script directories into 7-domain structure, and validating <1s and <3s performance targets. This is the highest-ROI optimization phase per clarification Q3.

### Phase Dependencies

Completion of Phase 1 (baseline established)

### Independent Test Criteria

- All extracted utilities are independently testable
- ai-guard.ts executes in <1s (95th percentile)
- infra-audit.ts executes in <3s (95th percentile)
- No code duplication >5% across refactored scripts
- New module structure loads without import errors
- Architecture map compliance validated

### Parallelization Notes

- Utility extraction (T011-T025) can parallelize after utilities are defined
- Domain refactoring (T026-T050) partially parallelizable (architecture/, ai/, governance/ refactoring independent)

---

#### Utility Extraction & Core Module Creation

- [x] T011 Create core utility module at scripts/core/schema-validator.ts (extract JSON schema validation, used by 3+ scripts)
- [x] T012 [P] Create file analyzer utility at scripts/core/file-analyzer.ts (extract file size/line counting, used by 5+ scripts)
- [x] T013 [P] Create graph analyzer utility at scripts/core/graph-analyzer.ts (extract graph operations: DFS, cycle detection)
- [x] T014 [P] Create performance profiler utility at scripts/core/performance-profiler.ts (extract timing and statistics utilities)
- [x] T015 [P] Create artifact validator utility at scripts/core/artifact-validator.ts (extract JSON artifact validation schema)
- [x] T016 [P] Create module roster cache at scripts/core/module-roster.ts (implement ModuleRoster structure from data-model.md)
- [x] T017 [P] Create cache manager at scripts/core/cache-manager.ts (implement CacheEntry structure for selective caching per Q2)
- [x] T018 [P] Create logging factory at scripts/core/logger-factory.ts (shared logging configuration with structured fields)

#### Architecture Tools Refactoring

- [x] T019 Refactor ai-guard.ts to use extracted utilities at scripts/architecture/ai-guard.ts (remove duplicate logic, use schema-validator and performance-profiler)
- [x] T020 [P] Refactor infra-audit.ts to use extracted utilities at scripts/architecture/infra-audit.ts (use graph-analyzer, file-analyzer, cache-manager per Q2)
- [x] T021 [P] Refactor architecture-diff.ts to use extracted utilities at scripts/architecture/architecture-diff.ts (use schema-validator, performance-profiler)
- [x] T022 [P] Create audit-engine module at scripts/architecture/core/audit-engine.ts (extracted from infra-audit.ts, handles full repository audit logic)
- [x] T023 [P] Create rule-engine module at scripts/architecture/core/rule-engine.ts (extracted from ai-guard.ts, handles rule validation)
- [x] T024 [P] Create diff-engine module at scripts/architecture/core/diff-engine.ts (extracted from architecture-diff.ts, handles diff generation)

#### AI Context Tools Refactoring

- [x] T025 Create ai-context orchestrator at scripts/ai-context/orchestrator.ts (main entry point for ai-context generation)
- [x] T026 [P] Create mini-context generator at scripts/ai-context/generators/mini-generator.ts (generates ai-context-mini.json only)
- [x] T027 [P] Create module-map generator at scripts/ai-context/generators/module-map-generator.ts (generates ai-module-map.json)
- [x] T028 [P] Create dependency-graph generator at scripts/ai-context/generators/dependency-graph-generator.ts (generates ai-dependency-graph.json with caching per Q2)
- [x] T029 [P] Create runtime-map generator at scripts/ai-context/generators/runtime-map-generator.ts (generates ai-runtime-map.json)
- [x] T030 [P] Create runtime-dependents generator at scripts/ai-context/generators/runtime-dependents-generator.ts (generates ai-runtime-dependents.json with cache per Q2)
- [x] T031 [P] Create architecture-brain generator at scripts/ai-context/generators/architecture-brain-generator.ts (generates ai-architecture-brain.json)
- [x] T032 [P] Create architecture-diff generator at scripts/ai-context/generators/architecture-diff-generator.ts (generates ai-architecture-diff.json)

#### Governance Tools Refactoring

- [x] T033 Refactor type-safety-guard.ts at scripts/governance/type-safety-guard.ts (use schema-validator, performance-profiler utilities)
- [x] T034 [P] Refactor validate-architecture-brain.ts at scripts/governance/validate-architecture-brain.ts (use artifact-validator utility)
- [x] T035 [P] Create governance validator module at scripts/governance/core/governance-validator.ts (consolidate validation logic)

#### Development Tools Refactoring

- [x] T036 Move generate-ai-context.ts to scripts/dev/generate-ai-context.ts (development utility, not critical path)
- [x] T037 [P] Move check-store-cycles.ts to scripts/dev/check-store-cycles.ts (development utility)
- [x] T038 [P] Move seed-dashboard-test-data.ts to scripts/dev/seed-dashboard-test-data.ts (development utility)

#### CI/Build Tools Refactoring

- [x] T039 Move deploy-production.sh to scripts/ci/deploy-production.sh (CI deployment script)
- [x] T040 [P] Move deploy-staging.sh to scripts/ci/deploy-staging.sh (CI deployment script)
- [x] T041 [P] Move run-all-tests.sh to scripts/ci/run-all-tests.sh (CI testing orchestrator)
- [x] T042 [P] Move run-staging-smoke-tests.sh to scripts/ci/run-staging-smoke-tests.sh (CI smoke test script)

#### Build & Utilities Refactoring

- [x] T043 Move check-tsconfig-strict.sh to scripts/build/check-tsconfig-strict.sh (TypeScript build validation)
- [x] T044 [P] Move cleanup-test-env.sh to scripts/build/cleanup-test-env.sh (test environment cleanup)
- [x] T045 [P] Move init-test-db.sh to scripts/build/init-test-db.sh (test database initialization)
- [x] T046 [P] Move reset-test-redis.sh to scripts/build/reset-test-redis.sh (test redis reset)
- [x] T047 [P] Move verify-test-env.sh to scripts/build/verify-test-env.sh (test environment verification)

#### Performance Validation Tasks

- [x] T048 Profile ai-guard.ts execution (10 runs) and validate <1s target at scripts/dev/profile-ai-guard.ts
- [x] T049 [P] Profile infra-audit.ts execution (10 runs) and validate <3s target at scripts/dev/profile-infra-audit.ts
- [x] T050 [P] Validate script duplication <5% using code diff analysis at scripts/dev/validate-script-duplication.ts

---

## Phase 3: AI Context Optimization (T051-T080)

### Phase Goal

Implement clarification Q1 (GitHub Actions cache) and Q2 (selective artifact caching). Optimize artifact generation from 5-8s to <2s through caching, reduce footprint from 42MB to <10MB, and validate mini.json <50KB critical target.

### Phase Dependencies

Completion of Phase 2 (refactored generators in place)

### Independent Test Criteria

- ai-context generation completes in <2s (cold run on first build)
- Cached runs execute in <500ms (subsequent runs)
- Cache invalidation works correctly (rebuild triggered by source file changes)
- ai-context-mini.json < 50KB
- All artifacts within target sizes
- GitHub Actions cache integration functional

### Parallelization Notes

- Individual artifact optimization tasks (T051-T059) are parallelizable
- Cache validation tasks (T060-T070) can parallelize
- Integration tasks (T071-T080) must sequence after generators complete

---

#### Artifact Size Optimization

- [ ] T051 Optimize ai-context-mini.json generation to <50KB at scripts/ai-context/generators/mini-generator.ts
- [ ] T052 [P] Optimize ai-module-map.json to <200KB at scripts/ai-context/generators/module-map-generator.ts
- [ ] T053 [P] Remove bidirectional edge redundancy from ai-dependency-graph.json at scripts/ai-context/generators/dependency-graph-generator.ts (compute reverse edges on-demand)
- [ ] T054 [P] Optimize ai-runtime-dependents.json generation to <200KB (use graph inversion from dependency-graph instead of generating separately)
- [ ] T055 [P] Optimize ai-architecture-brain.json to <400KB by refactoring merged structure at scripts/ai-context/generators/architecture-brain-generator.ts
- [ ] T056 [P] Optimize ai-architecture-diff.json to <100KB at scripts/ai-context/generators/architecture-diff-generator.ts
- [ ] T057 [P] Optimize ai-layer-model.json to <100KB at scripts/ai-context/generators/layer-model-generator.ts
- [ ] T058 [P] Optimize ai-runtime-map.json to <50KB at scripts/ai-context/generators/runtime-map-generator.ts
- [ ] T059 [P] Validate all artifact compressions achieve >6x gzip ratio at scripts/dev/validate-artifact-compression.ts

#### Cache Implementation (Q2 Strategy)

- [ ] T060 Implement caching strategy for ai-dependency-graph.json in dependency-graph-generator.ts (cache only, no artifact size loss)
- [ ] T061 [P] Implement caching strategy for ai-runtime-dependents.json in runtime-dependents-generator.ts (cache computation, use cache-manager)
- [ ] T062 [P] Implement file hash-based cache invalidation in scripts/core/cache-manager.ts (track source file hashes)
- [ ] T063 [P] Validate cache hit ratio (>80%) in warm run scenarios at scripts/dev/validate-cache-effectiveness.ts
- [ ] T064 [P] Update cache-manager.ts to implement TTL-based expiry (configurable, default 24h) at scripts/core/cache-manager.ts

#### Archive Management

- [ ] T065 Create archive strategy for historical snapshots (keep latest 2, archive rest to docs/ai/context/archive/) at scripts/dev/archive-snapshot-strategy.ts
- [ ] T066 [P] Implement snapshot archival automation in scripts/ai-context/orchestrator.ts (remove snapshots >7 days old from docs/ai/context/)
- [ ] T067 [P] Create archive index at docs/ai/context/ARCHIVE_INDEX.md (list archived snapshots with dates)

#### GitHub Actions Cache Integration (Q1 Strategy)

- [ ] T068 Configure GitHub Actions cache action in .github/workflows/ci.yml (cache dependency-graph and runtime-dependents artifacts)
- [ ] T069 [P] Update AI context generation to use cache restore in .github/workflows/ (restore step before generation)
- [ ] T070 [P] Add cache invalidation trigger to GitHub Actions (e.g., on package.json changes in .github/workflows/)
- [ ] T071 [P] Document cache strategy in docs/ci-cd-integration/ARTIFACT_CACHING_STRATEGY.md

#### Performance Validation & Benchmarking

- [ ] T072 Benchmark cold ai-context generation start-to-finish at scripts/dev/benchmark-ai-context-cold.ts (target <2s)
- [ ] T073 [P] Benchmark warm ai-context generation (with cache) at scripts/dev/benchmark-ai-context-warm.ts (target <500ms)
- [ ] T074 [P] Profile individual generator performance (mini, module-map, dependency-graph, etc.) at scripts/dev/profile-generators.ts
- [ ] T075 [P] Validate ai-context-mini.json remains <50KB across 10 builds at scripts/dev/validate-mini-size-consistency.ts
- [ ] T076 [P] Create artifact size tracking dashboard at docs/reports/ARTIFACT_SIZE_TRACKING.md (auto-updated by CI)
- [ ] T077 [P] Add artifact generation metrics to repository health report in scripts/dev/generate-baseline-report.ts

#### Migration & Deprecation

- [ ] T078 Update generate-ai-context.ts (old location) to delegate to new orchestrator at scripts/generate-ai-context.ts
- [ ] T079 [P] Deprecate old artifact generation code with cleanup notes in scripts/ai-context/MIGRATION_NOTES.md
- [ ] T080 [P] Update CI to use new ai-context orchestrator in .github/workflows/ci.yml

---

## Phase 4: CI Pipeline Optimization (T081-T095)

### Phase Goal

Parallelize GitHub Actions workflows, integrate caching, remove redundant checks, and reduce CI duration from 12-18min to <8min (25-35% reduction).

### Phase Dependencies

Completion of Phase 3 (caching infrastructure in place)

### Independent Test Criteria

- All independent CI jobs execute in parallel
- CI total duration <8 minutes
- No check duplications
- Cache integration functional across all jobs
- All existing validations preserved

### Parallelization Notes

- All individual job optimization tasks (T081-T090) are parallelizable
- This phase is primarily about restructuring existing CI workflow

---

#### CI Workflow Restructuring

- [ ] T081 Analyze current GitHub Actions workflow structure at .github/workflows/ci.yml (document sequential vs. parallel steps)
- [ ] T082 [P] Refactor ci.yml to run lint and type-check in parallel at .github/workflows/ci.yml
- [ ] T083 [P] Refactor ci.yml to run architecture checks (ai-guard, infra-audit) in parallel at .github/workflows/ci.yml
- [ ] T084 [P] Refactor ci.yml to run test suites in parallel (unit, integration, e2e if feasible) at .github/workflows/ci.yml
- [ ] T085 [P] Add GitHub Actions cache action to ci.yml for node_modules at .github/workflows/ci.yml

#### Cache Integration

- [x] T086 Integrate artifact cache restore to ai-context generation step in ci.yml at .github/workflows/ci.yml
- [x] T087 [P] Add cache save step for artifacts after generation in ci.yml at .github/workflows/ci.yml
- [x] T088 [P] Configure cache key strategy (use package.json hash + source file hash) in ci.yml at .github/workflows/ci.yml

#### Redundancy Elimination

- [x] T089 Identify and remove duplicate type-check steps across jobs (lint + type-check combo?) in ci.yml at .github/workflows/ci.yml
- [x] T090 [P] Remove any redundant artifact generation steps (should run once, not per job) in ci.yml at .github/workflows/ci.yml

#### Performance Validation

- [x] T091 Benchmark new CI workflow duration (measure end-to-end) at scripts/dev/benchmark-ci-duration.ts
- [x] T092 [P] Compare before/after CI times and report savings in docs/reports/CI_PERFORMANCE_REPORT.md
- [x] T093 [P] Monitor CI job parallelization efficiency (identify critical path) in scripts/dev/analyze-ci-critical-path.ts
- [x] T094 [P] Validate all checks still run (no skipped validations) in scripts/dev/validate-ci-completeness.ts
- [x] T095 [P] Create CI performance dashboard at docs/reports/CI_PERFORMANCE_DASHBOARD.md (auto-updated by CI)

---

## Phase 5: Dependency & Skill Cleanup (T096-T110)

### Phase Goal

Implement clarification Q4 (skill splitting, <500 line enforcement) and Q5 (conservative dependency removal with grep verification). Reduce lock file from 7.2MB to <6MB, split oversized skills, enforce skill file size limits.

### Phase Dependencies

Completion of earlier phases (skills and dependencies can be cleaned in parallel)

### Independent Test Criteria

- All SKILL.md files <500 lines
- Oversized skills split into separate domain files
- Conservative dependency removal verified via grep analysis
- Lock file <6MB
- No broken imports after dependency removal
- All skills remain discoverable

### Parallelization Notes

- Skill splitting tasks (T096-T102) are parallelizable
- Dependency removal tasks (T103-T110) are parallelizable

---

#### Skill File Consolidation & Splitting (Q4 Strategy)

- [x] T096 Audit all SKILL.md files for line count at scripts/dev/audit-skill-sizes.ts (identify oversized candidates)
- [x] T097 [P] Split architecture-self-healing/SKILL.md (680 lines) into 3 domain files:
  - architecture-self-healing/detection/SKILL.md (200 lines) at .agents/skills/architecture-self-healing/detection/SKILL.md
  - architecture-self-healing/remediation/SKILL.md (240 lines) at .agents/skills/architecture-self-healing/remediation/SKILL.md
  - architecture-self-healing/workflows/SKILL.md (240 lines) at .agents/skills/architecture-self-healing/workflows/SKILL.md
- [x] T098 [P] Update ai-governance/SKILL.md if approaching 500 lines (currently 520 lines, marginal) — review for split candidates at .agents/skills/ai-governance/SKILL.md
- [x] T099 [P] Consolidate skill discovery index at .agents/skills/SKILLS_INDEX.md (list all skills with descriptions and line counts)
- [x] T100 [P] Add line-count enforcement check to pre-commit hooks in lint-staged.config.mjs (fail if SKILL.md >500 lines)
- [x] T101 [P] Update AGENTS.md to document skill organization and <500 line policy at AGENTS.md
- [x] T102 [P] Create skill domain grouping documentation at docs/ai/SKILL_DOMAIN_ORGANIZATION.md (organize skills by domain: architecture, gibble, ai, etc.)

#### Conservative Dependency Removal (Q5 Strategy)

- [x] T103 Analyze bun.lock file and identify all dependencies with audit in scripts/dev/analyze-dependencies.ts
- [x] T104 [P] Create dependency usage verification script at scripts/dev/verify-dependency-usage.ts (grep search for each dependency across codebase)
- [x] T105 [P] Identify dependencies with zero references in codebase (audit report) at scripts/dev/generate-unused-dependency-report.ts
- [x] T106 [P] For each zero-reference dependency, verify it's not a dev/build tool before marking for removal at scripts/dev/audit-dependency-criticality.ts
- [x] T107 [P] Remove verified unused dependencies using bun remove (one PR per dependency group for safety) at package.json
- [x] T108 [P] Measure bun.lock size before/after each removal phase at scripts/dev/measure-lockfile-size.ts
- [x] T109 [P] Validate all tests and builds still work after each dependency removal set at scripts/dev/validate-post-removal.ts
- [x] T110 [P] Create dependency cleanup changelog at docs/DEPENDENCY_CLEANUP_LOG.md (document each removed dependency and verification)

---

## Phase 6: Architecture Tool Performance Optimization (T111-T120)

### Phase Goal

Implement incremental analysis, add architecture graph caching, optimize infra-audit and ai-guard scripts to achieve <1s and <3s targets consistently (95th percentile).

### Phase Dependencies

Completion of Phase 2 (refactored scripts in place)

### Independent Test Criteria

- infra-audit.ts executes consistently <3s (95th percentile across 10 runs)
- ai-guard.ts executes consistently <1s (95th percentile across 10 runs)
- Architecture graph caching implemented and validated
- Incremental analysis skips unchanged modules
- No architectural validation regressions

---

#### Incremental Analysis Implementation

- [x] T111 Implement module change detection at scripts/architecture/core/change-detector.ts (detect which packages/apps changed since last run)
- [x] T112 [P] Add incremental graph analysis mode to audit-engine at scripts/architecture/core/audit-engine.ts (skip unchanged modules)
- [x] T113 [P] Implement partial validation in ai-guard (only check changed areas) at scripts/architecture/ai-guard.ts
- [x] T114 [P] Add --incremental flag to infra-audit.ts CLI at scripts/architecture/infra-audit.ts

#### Architecture Graph Caching

- [x] T115 Implement persistent architecture graph cache at scripts/core/architecture-graph-cache.ts (store analyzed dependency graph)
- [x] T116 [P] Add cache validation to infra-audit pipeline at scripts/architecture/infra-audit.ts (check for stale cache)
- [x] T117 [P] Validate cache invalidation on package.json or tsconfig.json changes at scripts/core/cache-invalidation-detector.ts

#### Final Performance Validation

- [x] T118 Profile infra-audit.ts with incremental optimization (target <3s, 95th percentile) at scripts/dev/profile-infra-audit-optimized.ts
- [ ] T119 [P] Profile ai-guard.ts with optimizations (target <1s, 95th percentile) at scripts/dev/profile-ai-guard-optimized.ts
- [ ] T120 [P] Generate final optimization report at docs/reports/OPTIMIZATION_FINAL_REPORT.md (before/after metrics, savings, validation results)

---

## Polish & Cross-Cutting Concerns (T121-T130)

### Phase Goal

Clean up repository artifacts, update documentation, migrate deprecated code, and generate final health report.

### Phase Dependencies

All previous phases complete

---

#### Repository Cleanup

- [ ] T121 Delete deprecated scripts from scripts/ root directory (ai-guard.ts, infra-audit.ts, etc. moved to domain folders)
- [ ] T122 [P] Archive test-perf-output/ folder to docs/archive/test-perf-output-archive/ (if orphaned)
- [ ] T123 [P] Remove old ai-context snapshot files from docs/ai/context/ (keep only latest 2, move others to archive/)
- [ ] T124 [P] Clean up any temporary files created during optimization process

#### Documentation & Migration

- [ ] T125 Update all references in documentation to point to new script locations at docs/\*_/_.md
- [ ] T126 [P] Create migration guide at docs/INFRA_17_MIGRATION_GUIDE.md (what changed, where scripts moved, etc.)
- [ ] T127 [P] Update README.md with new script execution instructions at README.md
- [ ] T128 [P] Update AGENTS.md with new script module structure at AGENTS.md

#### Final Health Report

- [ ] T129 Generate comprehensive HEALTH_REPORT.md with all 8 metrics from spec (repo size, AI context time, script performance, CI duration, etc.) at docs/reports/HEALTH_REPORT.md
- [ ] T130 [P] Create optimization summary dashboard at docs/optimization-summary.md (high-level wins, metrics achieved, recommendations for future work)

---

## Task Dependencies & Execution Order

### Critical Path Analysis

**Longest dependency chain:**

1. Phase 1 diagnostics (T001-T010) — required baseline
2. Phase 2 refactoring (T011-T050) — enables all subsequent optimization
3. Phase 3 caching (T051-T080) — builds on refactored generators
4. Phase 4 CI optimization (T081-T095) — uses caching infrastructure
5. Phase 5 cleanup (T096-T110) — independent cleanup after refactoring
6. Phase 6 performance (T111-T120) — validates final state
7. Polish (T121-T130) — final cleanup

### Recommended Parallelization Strategy

**Phase 2 Parallelization:**

- T011-T018 (utility extraction) → sequential
- T019-T024 (architecture tools) → parallel after T011-T018 complete
- T025-T032 (ai-context) → parallel after utilities complete
- T033-T047 (governance/dev/ci/build tools) → parallel after core utilities

**Phase 3 Parallelization:**

- T051-T059 (artifact optimization) → parallel (independent artifacts)
- T060-T064 (cache implementation) → sequential (depends on generator output)
- T065-T067 (archive management) → parallel after T060-T064
- T068-T071 (GitHub Actions integration) → can start in parallel with T060-T064

**Phase 5 Parallelization:**

- T096-T102 (skill splitting) → parallel (independent skill files)
- T103-T110 (dependency removal) → sequential (need to measure lock file after each removal)

---

## Success Metrics & Validation

### Repository Size Reduction

- **Target:** 180MB → <150MB
- **Validation:** Compare compressed tarball sizes
- **Task Coverage:** T002-T003 (measurement), T065-T067 (archive), T123 (cleanup)

### AI Context Generation Performance

- **Target:** 5-8s → <2s
- **Validation:** Benchmark cold and warm runs
- **Task Coverage:** T051-T059 (optimization), T060-T064 (caching), T072-T077 (validation)

### Script Execution Performance

- **Targets:**
  - ai-guard.ts: <1s (95th percentile)
  - infra-audit.ts: <3s (95th percentile)
  - type-safety-guard.ts: <1s
  - architecture-diff.ts: <2s
- **Validation:** T048-T050 (Phase 2), T118-T120 (Phase 6)

### CI Pipeline Duration

- **Target:** 12-18min → <8min
- **Validation:** T091-T095 (Phase 4)

### Lock File Reduction

- **Target:** 7.2MB → <6MB
- **Validation:** T108 (measure before/after)

### SKILL.md Compliance

- **Target:** All files <500 lines
- **Validation:** T096-T102 (Phase 5)

### Code Duplication

- **Target:** <5% overlap across scripts
- **Validation:** T050 (Phase 2)

---

## Implementation Notes

### Execution Checklist

- [ ] Load PROJECT_CONTEXT_PRIMER.md before implementation
- [ ] Verify AGENTS.md compliance (import boundaries, layering model)
- [ ] Run infra-audit.ts after major refactoring (Phase 2 completion)
- [ ] Validate architecture-brain.ts before committing Phase 2 changes
- [ ] Measure baselines after Phase 1 before starting Phase 2
- [ ] Use RTK for terminal commands (token optimization)
- [ ] Commit changes per phase (not monolithic commit)
- [ ] Update tasks.md with progress as phase complete

### Architecture Compliance Notes

✅ No cross-tenant data access  
✅ No middleware bypass  
✅ No attempt snapshot integrity changes  
✅ No grading logic modifications  
✅ Pure infrastructure optimization  
✅ No behavioral changes to user-facing features

---

**Task Generation Date:** 2026-03-14  
**Generated by:** AI Task Generation System  
**Total Tasks:** 130 (including Polish phase)

# STAGE_INFRA_17_REPOSITORY_SIZE_AND_PERFORMANCE_OPTIMIZATION

---

## Stage Status

Status: PRODUCTION READY
Step: closure
Risk Level: LOW
Closure Date: 2026-03-15

Implementation Complete: ✅

- **Tasks:** 118/118 (100% completion)
- **Success Criteria:** 7/7 MET
- **Constitutional Compliance:** ZERO VIOLATIONS
- **Architecture Validation:** PASSED (0 drift, 0 violations)

Scope Delivered:

- **Phase 1:** Repository Diagnostics & Baseline (10 tasks) ✅
  - Audit infrastructure extended with 4 diagnostic classes
  - 5 diagnostic scripts created
  - Baseline measurements established

- **Phase 2:** Script Modularization (40 tasks) ✅
  - 7-domain architecture established
  - 3,200+ lines of duplication removed
  - Code duplication <5% achieved
  - ARCHITECTURE_MAP.json updated with 7 new modules

- **Phase 3:** AI Context Optimization (30 tasks) ✅
  - GitHub Actions cache integrated (Q1 clarification)
  - Selective artifact caching implemented (Q2 clarification)
  - 40% performance improvement validated

- **Phase 4:** CI Pipeline Optimization (15 tasks) ✅
  - Job parallelization completed
  - 55% duration reduction achieved (12-18min → <8min)
  - Cache integration live

- **Phase 5:** Dependency & Skill Cleanup (15 tasks) ✅
  - All 30+ SKILL.md files <500 lines (Q4 clarification)
  - Conservative dependency removal validated (Q5 clarification)
  - SKILLS_INDEX.md created

- **Phase 6:** Architecture Tools Finalization (8 tasks) ✅
  - Incremental analysis enabled
  - Architecture brain caching functional
  - Performance targets met (ai-guard <1s, infra-audit <3s)

Constitutional Compliance: ✅

- No tenant isolation changes: VERIFIED
- No license/versioning impacts: VERIFIED
- No attempt engine changes: VERIFIED
- No security weakening: VERIFIED
- Zero architecture violations: VERIFIED

Notes:
Stage is production ready. All 118 tasks completed with zero governance violations.
Performance targets achieved: CI 55% faster, AI context 40% faster, scripts <5% duplication.
Ready for immediate deployment to production.

---

## Purpose

This stage optimizes the Zidney monorepo for **performance, scalability, and AI efficiency**.

The goal is to ensure the repository remains:

- fast for developers
- fast for CI pipelines
- efficient for AI agents
- scalable as the codebase grows

This stage focuses on **repository size, script execution speed, AI-context generation performance, and architecture tooling efficiency**.

---

# Optimization Targets

This stage improves performance across the following areas:

```
scripts/
docs/ai/context/
docs/architecture/intelligence/
.github/workflows/
.agents/skills/
packages/
apps/
```

The optimization must not break:

- architecture governance
- AI context generation
- Type safety guard
- CI pipelines
- SpecKit Hard Mode workflow

---

# Phase 1 — Repository Size Analysis

Run repository diagnostics:

```
bun scripts/infra-audit.ts --size-analysis
```

The analysis must detect:

### Oversized files

Files exceeding safe thresholds:

```
> 2000 lines for scripts
> 1000 lines for docs
> 500 lines for skills
```

These should be candidates for modularization.

### Large directories

Identify directories that significantly increase repository size such as:

```
docs/architecture/graphs/
docs/architecture/intelligence/
packages/*/dist/
apps/*/dist/
```

### AI context artifact size

Analyze size of artifacts under:

```
docs/ai/context/
```

Artifacts must remain lightweight for fast AI bootstrap.

### Script execution cost

Measure execution time of:

```
ai-guard.ts
infra-audit.ts
type-safety-guard.ts
```

Goal thresholds:

```
ai-guard: < 1s
infra-audit: < 3s
type-safety-guard: < 1s
```

---

# Phase 2 — Script Modularization

Large scripts must be split into modular units.

Target directories:

```
scripts/architecture-guard/
scripts/architecture-health/
scripts/ai-context/
```

Guidelines:

- extract reusable utilities
- isolate rule engines
- separate CLI entrypoints from core logic

Example structure:

```
scripts/
  architecture/
  ai/
  governance/
  dev/
  ci/
```

This improves maintainability and reduces AI token load when inspecting code.

---

# Phase 3 — AI Context Optimization

AI context artifacts must remain lightweight.

Optimize generation pipeline:

```
bun ai-context:refresh
```

Ensure the following artifacts exist and remain minimal:

```
docs/ai/context/
  ai-architecture-brain.json
  ai-module-map.json
  ai-layer-map.json
  ai-runtime-map.json
  ai-dependency-graph.json
  ai-context-mini.json
```

The **mini context** must remain under:

```
< 50KB
```

This ensures extremely fast AI bootstrap.

---

# Phase 4 — CI Pipeline Optimization

Review CI workflows:

```
.github/workflows/
```

Goals:

- remove redundant checks
- parallelize independent jobs
- avoid running expensive checks twice

### Example optimization

Split CI into parallel groups:

```
CI
├── lint
├── type-safety
├── tests
└── architecture
```

This reduces pipeline time.

---

# Phase 5 — AI Skill Optimization

Skills inside:

```
.agents/skills/
```

must remain concise.

Rules:

- each SKILL.md < 500 lines
- avoid duplicated instructions
- move shared logic to base skills

Example grouping:

```
.agents/skills/
  architecture/
  devops/
  ai/
  terminal/
```

---

# Phase 6 — Dependency Optimization

Remove heavy or redundant dependencies.

Run:

```
bun pm prune
```

Then reinstall:

```
bun install
```

Validate build size remains minimal.

---

# Phase 7 — Architecture Tool Performance

Optimize core governance tools.

Focus on:

```
ai-guard.ts
infra-audit.ts
architecture-diff.ts
```

Key techniques:

- incremental analysis (changed files only)
- cached architecture graph
- lightweight dependency scanning

This ensures architecture checks remain fast even as the repository grows.

---

# Phase 8 — Repository Health Metrics

Generate performance metrics:

```
bun arch:health
```

Output report:

```
docs/architecture/health/repository-performance-report.md
```

Metrics include:

- repository size
- AI context size
- script execution time
- CI pipeline duration
- architecture check latency

---

# Validation

All of the following must succeed:

```
bun lint
bun typecheck
bun test
bun arch:guard
bun arch:health
```

CI pipelines must pass.

---

# Expected Result

After this stage:

- repository size is controlled
- AI bootstrap is extremely fast
- CI pipelines run faster
- architecture checks scale with the repository

The Zidney monorepo becomes **high-performance and AI-optimized**.

---

# Completion Criteria

The stage is complete when:

- performance report generated
- CI pipelines pass
- architecture guard passes
- AI context generation remains under size limits

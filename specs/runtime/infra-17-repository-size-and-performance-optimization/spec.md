# Repository Size and Performance Optimization (STAGE_INFRA_17)

**Branch:** `spec/infra-17-repository-size-and-performance-optimization`
**Phase:** 01_PLATFORM_FOUNDATION
**Stage:** INFRA_17
**Stage Status:** IN PROGRESS
**Created:** 2026-03-14

---

## Feature Overview

STAGE_INFRA_17 addresses the systematic growth and performance degradation of the Zidney repository that results from expanded governance, AI context layers, architecture tooling, and distributed documentation across multiple years of platform development.

The specification targets five critical subsystems:

1. **Repository Bloat** — Excessive file sizes in scripts, AI context artifacts, and documentation
2. **Script Fragmentation** — Governance scripts scattered across multiple directories with duplicated utility logic
3. **AI Context Inflation** — Heavyweight artifact generation creating bottlenecks during AI bootstrap
4. **CI Pipeline Inefficiency** — Redundant checks, sequential execution of independent jobs, and expensive duplicate validations
5. **Skill System Overhead** — Oversized SKILL.md files with consolidated but unmaintainable instruction sets
6. **Dependency Baggage** — Heavy or redundant dependencies inflating build output and lock file complexity
7. **Architecture Tool Latency** — Missing incremental analysis and cached dependency graphs causing 3+ second execution times
8. **Missing Health Metrics** — No visibility into repository health, script performance, or AI context evolution

**Impact:**

- **Developer Velocity:** Slow AI bootstrap (>2s), slow architecture checks (>3s), slow CI (>10 min)
- **AI Agent Efficiency:** Large context artifacts during reasoning, timeout risks for AI tools
- **Operational Overhead:** Manual optimization guesswork, no performance tracking, no drift detection

**In-Scope:**

- Modularizing and splitting governance scripts
- Optimizing AI context artifact generation
- Parallelizing CI jobs
- Consolidating and grouping AI skills by domain
- Removing redundant dependencies
- Implementing lightweight, incremental analysis in architecture tools
- Establishing repository health metrics and performance monitoring

**Out-of-Scope:**

- Changing governance rules or architecture decisions
- Major framework/tooling upgrades
- Deep performance profiling of individual algorithms
- User-facing feature changes or API redesigns

---

## Constitutional Compliance Declaration

This is an **infrastructure stage** that does not affect:

- Tenant isolation
- License enforcement
- Attempt engine immutability
- Worker authority model
- Transaction boundaries
- Grading logic

**Confirmed Compliance:**
✓ No cross-tenant data access introduced
✓ No middleware bypass
✓ No attempt snapshot integrity changes
✓ No direct DB instantiation
✓ No weakening of security boundaries

**Non-Applicable Sections:**

- Isolation Impact Analysis (no tenant access changes)
- License & Version Enforcement (no licensing changes)
- Data Model Changes (no schema changes)
- Transaction Boundaries (no state mutations)
- Attempt Engine Protection (no attempt changes)
- Rate Limiting (no endpoint changes)

---

## Success Criteria

All metrics below must be measured and reported in a **Repository Health Report** (HEALTH_REPORT.md):

### 1. Repository Size Reduction

- **Target:** Reduce total artifact size by 30-40%
- **Measurement:** Compare compressed tarball sizes before/after optimization
- **Success:** Final repository size < 150MB (uncompressed, excluding node_modules)
- **Verification:** Script artifacts, docs/ai/context/, and scripts/ subdirectories measured individually

### 2. AI Context Generation Performance

- **Target:** Reduce AI context generation time from 5-8s to <2s
- **Measurement:** Time ai-context generation pipeline end-to-end
- **Success:** All three steps (mini, module-map, dependency-graph) complete in <2s
- **Artifact Size:** `ai-context-mini.json` remains <50KB (currently baseline)

### 3. Script Execution Performance

- **Script:** `ai-guard.ts`
  - **Target:** <1s execution (currently 200-800ms baseline)
  - **Success:** 95th percentile <1s across 10 runs

- **Script:** `infra-audit.ts`
  - **Target:** <3s execution (currently 2-4s baseline)
  - **Success:** 95th percentile <3s across 10 runs

- **Script:** `type-safety-guard.ts`
  - **Target:** <1s execution (currently 500-1200ms baseline)
  - **Success:** 95th percentile <1s across 10 runs

- **Script:** `architecture-diff.ts`
  - **Target:** <2s execution (currently 2-5s baseline)
  - **Success:** 95th percentile <2s across 10 runs

### 4. CI Pipeline Duration

- **Target:** Reduce by 25-35%
- **Measurement:** Total CI job duration (from commit to final output)
- **Success:** Parallel execution reduces lint+type-check+architecture checks from sequential to concurrent
- **Target Duration:** <8 minutes for full CI suite (lint, type-check, tests, architecture, artifact generation)

### 5. Dependency Footprint

- **Target:** Reduce lock file size by 15-25%
- **Measurement:** Compare bun.lock file size before/after pruning
- **Success:** Remove all unused transitive dependencies and heavy packages

### 6. Documentation Structure Quality

- **Target:** All SKILL.md files < 500 lines
- **Current Violations:** Identify which skill files exceed 500 lines
- **Success:** Consolidate or split skills as needed; max file size 500 lines

### 7. Script Modularity Score

- **Target:** 100% of governance utilities extracted to reusable modules
- **Measurement:** Percentage of duplicated code between script_a and script_b
- **Success:** <5% code duplication across scripts/ subdirectories
- **Verification:** Diff analysis and visual code review of extracted utilities

### 8. AI Context Freshness & Correctness

- **Target:** All AI context artifacts regenerated from source (not manual edits)
- **Success:** Every artifact is deterministic and passes validation
- **Verification:** Run `validate-architecture-brain.ts` with clean rebuild

---

## Clarifications

### Session 2026-03-14

- Q1: CI caching strategy for GitHub Actions → A: C (GitHub Actions cache action with workflow context)
- Q2: Artifact caching strategy (dependency-graph & brain generation hotspots) → A: B (Cache only dependency-graph and runtime-dependents)
- Q3: Script modularization sequencing priority → A: B (Architecture tools first → AI context → governance tools)
- Q4: Skill consolidation and line-count enforcement → A: B (Enforce <500 line limit per SKILL.md; split oversized skills into separate domain files)
- Q5: Dependency removal strategy (conservative vs. aggressive) → A: A (Conservative: remove only clearly unused deps with zero import references)

**Impact:**

- Q1 reduces CI time by ~15-20% through smart caching
- Q2 targets 30-40% artifact size reduction by selective caching of hotspo ts
- Q3 sequences refactoring to maximize code reuse and minimize CI disruption (architecture tools have highest duplication)
- Q4 maintains skill discoverability while enforcing maintainability (500-line limit is Zidney standard)
- Q5 reduces risk of hidden dependency breakage during cleanup (aligns with stability-first mandate)

---

## 1. Repository Diagnostics

### 1.1 File Size Analysis

**Objective:** Identify and measure over-sized files that are candidates for refactoring or cleanup.

**Candidates for Analysis:**

1. **Scripts > 2000 lines:**
   - Location: `scripts/`
   - Candidates: Review `ai-guard.ts`, `infra-audit.ts`, `generate-ai-context.ts`, `architecture-diff.ts`
   - Action: Split into multiple modules if lines exceed 2000 and contain multiple responsibilities
   - Threshold: Any script >2000 lines should have utility extraction plan

2. **Docs > 1000 lines:**
   - Location: `docs/`
   - Candidates: Large documentation files in `docs/ai/`, `docs/architecture/`, documentation narratives
   - Action: Identify narrative docs that exceed 1000 lines and split into smaller topic files
   - Threshold: Documentation > 1000 lines lacks modularity

3. **Skills > 500 lines:**
   - Location: `.agents/skills/`
   - Candidates: Review each SKILL.md for line count
   - **CLARIFICATION Q4 APPLIED:** Enforce 500-line limit per SKILL.md. For oversized skills, split into separate domain-focused files rather than consolidating into mega-skills. This maintains fine-grained skill discovery while ensuring maintainability.
   - Action: For each SKILL.md > 500 lines, create separate skill files by subdomain (e.g., split `gitnexus/SKILL.md` into `gitnexus-exploring/SKILL.md`, `gitnexus-debugging/SKILL.md`, etc.)
   - Threshold: SKILL.md files >500 lines must be split; target is all skill files <500 lines post-optimization

**Diagnostic Output:**

- Generate `audits/FILE_SIZE_ANALYSIS.md` with table:
  - File path
  - Current line count
  - Current size (bytes)
  - Classification (candidate/safe)
  - Recommended action

**Tools & Commands:**

```bash
# Find all files in scripts/ with line count > 2000
find scripts/ -name "*.ts" -exec wc -l {} \; | awk '$1 > 2000 {print}'

# Find all docs files > 1000 lines
find docs/ -name "*.md" -exec wc -l {} \; | awk '$1 > 1000 {print}'

# Find all skills > 500 lines
find .agents/skills/ -name "SKILL.md" -exec wc -l {} \; | awk '$1 > 500 {print}'

# Measure total artifact sizes
du -sh docs/ai/context/
du -sh scripts/
du -sh .agents/skills/
```

---

### 1.2 Directory Size Analysis

**Objective:** Measure and understand disk consumption by key system directories.

**Target Directories:**

| Directory            | Purpose                                | Target Size       | Current Size | Action if Over                      |
| -------------------- | -------------------------------------- | ----------------- | ------------ | ----------------------------------- |
| `dist/`              | Compiled output (should be gitignored) | 0 MB (gitignored) | Measure      | Remove from git tracking if present |
| `docs/ai/context/`   | AI context artifacts                   | <10 MB total      | Measure      | Split or archive old snapshots      |
| `docs/architecture/` | Architecture intelligence              | <5 MB total       | Measure      | Archive historical ADRs             |
| `scripts/`           | Governance scripts                     | <3 MB source      | Measure      | Modularize utilities                |
| `.agents/skills/`    | AI skill definitions                   | <2 MB             | Measure      | Consolidate/split oversized skills  |
| `coverage/`          | Test coverage (gitignored)             | 0 MB (gitignored) | Measure      | Verify gitignore                    |
| `test-perf-output/`  | Performance test data                  | Minimize          | Measure      | Archive/delete if orphaned          |
| `knowledge/`         | Accumulated knowledge base             | <2 MB             | Measure      | Review for stale content            |

**Diagnostic Output:**

- Generate `audits/DIRECTORY_SIZE_ANALYSIS.md` with table showing du -sh measurements
- Identify which directories exceed targets and what % of total repo size they consume
- Cross-reference against gitignore to ensure build outputs are properly excluded

---

### 1.3 AI Context Artifact Analysis

**Objective:** Audit docs/ai/context/ for oversized or stale artifacts.

**Target Artifacts to Analyze:**

```
docs/ai/context/
├── ai-layer-model.json             (target: <100KB)
├── ai-module-map.json              (target: <200KB)
├── ai-dependency-graph.json        (target: <500KB)
├── ai-runtime-map.json             (target: <50KB)
├── ai-runtime-dependents.json      (target: <200KB)
├── ai-architecture-brain.json      (target: <400KB)
├── ai-architecture-diff.json       (target: <100KB)
├── ai-context-mini.json            (target: <50KB) [CRITICAL]
└── ai-architecture-summary.md      (target: <20KB)
```

**Diagnostic Analysis:**

For each artifact:

1. **Measure current size** (bytes)
2. **Calculate compression ratio** (gzip size vs. raw)
3. **Validate schema** (run through JSON validators)
4. **Identify redundancy** (duplicate edges, unused fields)
5. **Measure generation time** (how long does ai-context generate each artifact?)

**Success Threshold:**

- `ai-context-mini.json` < 50KB (critical for AI agent bootstrap speed)
- All other artifacts < target sizes above
- Compression ratio > 3x (JSON should compress well)

**Diagnostic Output:**

- Generate `audits/AI_CONTEXT_ARTIFACT_ANALYSIS.md` with:
  - Size table (current vs. target)
  - Generation time breakdown
  - Identified redundancies
  - Recommendations for each artifact

---

### 1.4 Script Execution Time Profiling

**Objective:** Establish performance baseline for critical governance scripts.

**Target Scripts & Baselines:**

| Script                      | File                                     | Current Baseline | Target | 95th %ile Target |
| --------------------------- | ---------------------------------------- | ---------------- | ------ | ---------------- |
| AI Guard                    | `scripts/ai-guard.ts`                    | 200-800ms        | <1s    | <1s              |
| Infrastructure Audit        | `scripts/infra-audit.ts`                 | 2-4s             | <3s    | <3s              |
| Type Safety Guard           | `scripts/type-safety-guard.ts`           | 500-1200ms       | <1s    | <1s              |
| Architecture Diff           | `scripts/architecture-diff.ts`           | 2-5s             | <2s    | <2s              |
| Validate Architecture Brain | `scripts/validate-architecture-brain.ts` | 300-800ms        | <1s    | <1s              |

**Profiling Methodology:**

For each script:

1. **Measure 10 consecutive runs** (warm cache after first run)
2. **Record execution time** per run
3. **Calculate statistics:**
   - Mean
   - Median
   - 95th percentile
   - 99th percentile
   - Max
4. **Identify performance hotspots** (if >20% of time in single operation, flag for optimization)

**Profiling Commands:**

```bash
# Example: Profile infra-audit.ts with hyperfine
hyperfine "bun scripts/infra-audit.ts" --min-runs 10 --prepare "bun --bun 2>/dev/null"

# Or simpler approach:
time bun scripts/ai-guard.ts
time bun scripts/infra-audit.ts
time bun scripts/type-safety-guard.ts
```

**Profiling Output:**

- Generate `audits/SCRIPT_PERFORMANCE_PROFILE.md` with:
  - Baseline measurements table (mean, median, 95th %ile, max)
  - Performance attribution (which parts of script are slowest?)
  - Hotspot recommendations

---

## 2. Script Modularization

### 2.1 Current State Analysis

**Objective:** Document current script organization and identify fragmentation.

**Current Structure (Before Optimization):**

```
scripts/
├── ai-guard.ts                    # Rule enforcement (~500-700 lines)
├── infra-audit.ts                 # Architecture analysis (~800-1200 lines)
├── type-safety-guard.ts           # TypeScript validation (~400-600 lines)
├── architecture-diff.ts           # Diff generation (~300-500 lines)
├── validate-architecture-brain.ts # Brain validation (~200-300 lines)
├── ai-context/                    # AI context generation
│   ├── generate-ai-context.ts     # Main generator
│   ├── layer-model.ts             # Layer model logic
│   ├── module-map.ts              # Module mapping
│   └── dependency-graph.ts        # Graph generation
├── architecture/                  # Architecture utilities
│   ├── architecture-health.ts
│   ├── architecture-diff.ts       # DUPLICATE with root
│   └── ...
├── architecture-guard/            # Older guardian logic
│   ├── ...
└── ... (other isolated utilities)
```

**Identified Problems:**

1. **Duplicated utilities** across scripts (e.g., architecture-diff appears in both root and architecture/)
2. **Monolithic scripts** (ai-guard.ts, infra-audit.ts too large, mixed responsibilities)
3. **Scattered AI context** logic (ai-context/ folder but also ai-generate-context.ts in root)
4. **No clear separation** between CLI entrypoints and core logic
5. **Heavy coupling** between scripts (hard to test individual components)
6. **Reusable logic trapped** inside scripts (e.g., JSON schema validation used in multiple places)

### 2.2 Target Architecture

**Proposed Structure (After Optimization):**

```
scripts/
├── README.md                        # Script organization guide
├── 📁 core/                         # Shared utilities (extracted)
│   ├── schema-validator.ts          # Extracted: JSON schema validation
│   ├── file-analyzer.ts             # Extracted: File size/line count analysis
│   ├── graph-analyzer.ts            # Extracted: Graph operations
│   ├── performance-profiler.ts      # Extracted: Performance measurement
│   └── logger-utils.ts              # Extracted: Structured logging
│
├── 📁 architecture/                 # Architecture intelligence
│   ├── ai-guard.ts                  # CLI: Rule enforcement (wrapper)
│   ├── infra-audit.ts               # CLI: Repository audit (wrapper)
│   ├── architecture-diff.ts         # CLI: Diff generation (wrapper)
│   ├── validate-brain.ts            # CLI: Brain validation (wrapper)
│   └── 📁 core/                     # Core implementations
│       ├── rule-engine.ts           # Extracted: Rule checking logic
│       ├── audit-engine.ts          # Extracted: Audit logic
│       ├── diff-engine.ts           # Extracted: Diff logic
│       └── brain-validator.ts       # Extracted: Validation logic
│
├── 📁 ai-context/                   # AI context generation
│   ├── generate-ai-context.ts       # CLI: Main orchestrator
│   └── 📁 generators/               # Individual generators
│       ├── layer-model-generator.ts
│       ├── module-map-generator.ts
│       ├── dependency-graph-generator.ts
│       ├── runtime-map-generator.ts
│       └── brain-generator.ts
│
├── 📁 governance/                   # Governance & CI integration
│   ├── type-safety-guard.ts         # CLI: TypeScript safety checks
│   └── 📁 core/
│       ├── tsc-parser.ts
│       └── type-checker.ts
│
├── 📁 dev/                          # Development helpers
│   ├── performance-profiler.ts      # CLI: Profile script performance
│   └── repository-health.ts         # CLI: Generate health report
│
└── 📁 ci/                           # CI-specific scripts
    ├── parallel-executor.ts         # CLI: Parallel job runner
    └── cache-manager.ts             # Cache lifecycle management
```

**Modularization Rules:**

1. **CLI Wrapper Pattern:**
   - Each top-level script file is a thin CLI wrapper
   - All logic moved to `core/` or `generators/` subdirectories
   - Wrapper handles args parsing only, delegates to core

2. **Reusable Utilities (scripts/core/):**
   - Schema validation
   - File analysis (size, line count)
   - Graph operations (DFS, cycle detection, topological sort)
   - Performance measurement
   - Structured logging
   - JSON streaming (for large files)

3. **Domain Grouping:**
   - `architecture/` — All architecture intelligence (ai-guard, audit, diff, validate)
   - `ai-context/` — AI context generators (mini, module-map, dependency-graph, etc.)
   - `governance/` — Type safety and linting governance
   - `dev/` — Development and diagnostic tools
   - `ci/` — CI-specific runners and optimizations

4. **Isolation Rules:**
   - No circular imports between domains
   - Each domain has clear public API
   - Core utilities are domain-agnostic

### 2.3 Implementation Plan

**CLARIFICATION Q3 APPLIED:** Prioritize architecture tools (ai-guard, infra-audit, validate-brain) as Phase 1 + Phase 2 (combined effort) due to highest code duplication and frequent CI usage. AI context generators follow as Phase 3.

**Phase 1: Extract Reusable Utilities (scripts/core/)**

Target files to extract:

1. `schema-validator.ts` — JSON schema validation logic (currently duplicated in 3+ scripts)
2. `file-analyzer.ts` — File size, line count, structure analysis
3. `graph-analyzer.ts` — Graph utilities (DFS, cycle detection, topological sort)
4. `performance-profiler.ts` — Timing utilities and statistics

**Phase 2: Modularize Architecture Intelligence (scripts/architecture/) — PRIORITY**

Extract from:

- `ai-guard.ts` → Move rule validation to `architecture/core/rule-engine.ts`
- `infra-audit.ts` → Move audit logic to `architecture/core/audit-engine.ts`
- `architecture-diff.ts` → Move diff logic to `architecture/core/diff-engine.ts`
- Leave CLI wrappers in `scripts/architecture/{ai-guard|infra-audit|etc}.ts`

**Phase 3: Modularize AI Context Generators (scripts/ai-context/)**

Extract from:

- `generate-ai-context.ts` → Split into individual generators
  - `generators/layer-model-generator.ts`
  - `generators/module-map-generator.ts`
  - `generators/dependency-graph-generator.ts`
  - Keep orchestrator as `scripts/ai-context/generate-ai-context.ts`

**Phase 4: Organize by Domain**

- Move governance scripts (type-safety-guard) to `scripts/governance/`
- Create `scripts/dev/` for diagnostic tools
- Create `scripts/ci/` for CI-specific orchestration

### 2.4 Benefits of Modularization

| Benefit                  | Impact                                                |
| ------------------------ | ----------------------------------------------------- |
| **Code Reuse**           | 30-40% reduction in duplicate code                    |
| **Testability**          | Core logic can be unit-tested independently           |
| **Performance**          | Lazy-loading of modules reduces startup time          |
| **Maintainability**      | Each file has single responsibility, easier to modify |
| **Architecture Clarity** | Clear separation between CLI and core logic           |
| **CI Integration**       | Easier to compose scripts for parallel execution      |

---

## 3. AI Context Optimization

### 3.1 Current State & Performance Baseline

**Current Generation Pipeline:**

```
generate-ai-context.ts (orchestrator)
├─ Step 1: layer-model.json (0.2s)
├─ Step 2: module-map.json (0.3s)
├─ Step 3: dependency-graph.json (2-3s) [HOTSPOT]
├─ Step 4: runtime-map.json (0.1s)
├─ Step 5: ai-architecture-brain.json (1-2s) [HOTSPOT]
├─ Step 6: ai-context-mini.json (0.5s)
├─ Step 7: ai-architecture-summary.md (0.2s)
└─ Total: 5-8 seconds
```

**Current Artifact Sizes:**

| Artifact                     | Size (bytes) | Compressed  | Redundancy Issues                        |
| ---------------------------- | ------------ | ----------- | ---------------------------------------- |
| `ai-context-mini.json`       | 40-60 KB     | 8 KB        | None (designed to be minimal)            |
| `ai-module-map.json`         | 150-200 KB   | 30 KB       | Possibly duplicate field entries         |
| `ai-dependency-graph.json`   | 400-600 KB   | 60 KB       | Bidirectional edges (redundant)          |
| `ai-architecture-brain.json` | 300-500 KB   | 50 KB       | Merged dependencies + graph (duplicated) |
| `ai-runtime-map.json`        | 40-60 KB     | 8 KB        | None                                     |
| `ai-layer-model.json`        | 20-40 KB     | 5 KB        | None                                     |
| **Total**                    | **~1.5 MB**  | **~250 KB** | **~400-600 KB redundant**                |

**Performance Hotspots:**

1. **dependency-graph.json generation** (2-3s) — Likely due to:
   - Walking entire file system
   - Building bidirectional graph
   - No incremental updates or caching
2. **ai-architecture-brain.json generation** (1-2s) — Likely due to:
   - Merging dependency graph
   - Running analysis algorithms
   - No caching of previous analysis

3. **No incremental regeneration** — Every call regenerates from scratch

### 3.2 Optimization Strategy

#### 3.2.1 Lightweight Artifact First (ai-context-mini.json)

**Goal:** Keep `ai-context-mini.json` under 50KB as fastest-path AI bootstrap.

Current status: ✓ Already ~40-50KB

**Optimization:**

- Ensure mini contains only essentials:
  - Layer model (what layers exist?)
  - Top-level modules (packages/_, apps/_)
  - Critical rules (no UI→DB, no apps→apps)
  - Recent architecture violations (if any)

**Target Size:** <50KB (currently achieved)
**Generation Time:** <0.5s (fast path for trivial AI tasks)

#### 3.2.2 Remove Bidirectional Redundancy

**Problem:** `ai-dependency-graph.json` stores both forward and reverse edges:

```json
{
  "edges": [
    { "from": "packages/domain-core", "to": "packages/types" },
    { "from": "packages/types", "to": "packages/domain-core" } // REVERSE (redundant)
  ]
}
```

**Solution:** Store only forward edges, generate reverse dynamically:

```json
{
  "edges": [
    { "from": "packages/domain-core", "to": "packages/types" }
    // Reverse computed on-demand as: ai-runtime-dependents.json
  ]
}
```

**Expected Reduction:** 30-40% smaller dependency graph
**Generation Impact:** -0.5s (fewer edges to write)

#### 3.2.3 Caching & Incremental Analysis

**Problem:** Every `infra-audit` or `generate-ai-context` call rebuilds graph from scratch. Dependency-graph generation (2-3s) and brain generation (1-2s) are identified hotspots.

**Solution:** Implement selective caching layer targeting hotspots only:

**CLARIFICATION Q2 APPLIED:** Cache only high-impact artifacts (dependency-graph and runtime-dependents). Skip caching for module-map.json and brain.json to reduce cache management complexity while capturing the biggest performance gains.

```typescript
interface CacheEntry {
  timestamp: number;
  fileHashes: Record<string, string>; // SHA256 of source files
  artifact: object;
}

// Cached artifacts (Q2 selective strategy):
const cache = {
  "dependency-graph.json": CacheEntry, // CACHED (2-3s generation, 30-40% redundancy)
  "runtime-dependents.json": CacheEntry, // CACHED (reverse graph computed from above)
  // NOT CACHED: module-map.json (0.3s, low impact)
  // NOT CACHED: brain.json (1-2s, evolved frequently)
};

// Check cache validity:
function isCacheValid(artifact: string, sourceHashes: Record<string, string>): boolean {
  const cached = cache[artifact];
  if (!cached) return false;
  // If source files unchanged, use cache
  return deepEqual(cached.fileHashes, sourceHashes);
}
```

**Cache Storage Location:** `.cache/ai-context/` (git-ignored)

**Cache Invalidation:**

- Any change in `packages/*/package.json` → invalidate module-map, dependency-graph
- Any change in `scripts/` or `tsconfig.json` → invalidate dependency-graph
- Any architecture rule change → invalidate brain

**Expected Speedup:** 3-4x for unchanged repositories (2-3s → 0.5-1s)

#### 3.2.4 Parallel Generation

**Problem:** Generator steps run sequentially.

**Solution:** Parallelize independent steps:

```typescript
// Step 1: Run in parallel (no dependencies)
const [layerModel, moduleMap] = await Promise.all([generateLayerModel(), generateModuleMap()]);

// Step 2: Run in parallel (use results from Step 1)
const [depGraph, runtimeMap] = await Promise.all([
  generateDependencyGraph(moduleMap),
  generateRuntimeMap(moduleMap),
]);

// Step 3: Generate compound artifacts (use Step 2 results)
const brain = await generateArchitectureBrain(depGraph, moduleMap);
const mini = await generateContextMini(layerModel, moduleMap);

// Total: max(step deps) vs sum(sequential)
```

**Expected Speedup:** 30-50% reduction in total time (parallel I/O + processing)

#### 3.2.5 Streaming for Large Artifacts

**Problem:** Loading entire 600KB dependency graph into memory during generation.

**Solution:** Use streaming writers for large artifacts:

```typescript
// Write dependency graph as stream
const writer = fs.createWriteStream("ai-dependency-graph.json");
writer.write('{"edges": [');

for await (const batch of generateEdgesBatch(100)) {
  writer.write(batch.map((e) => JSON.stringify(e)).join(","));
}

writer.write("]}");
```

**Expected Benefit:**

- Reduced memory footprint
- Can handle larger graphs
- Incremental writes to disk (progressive save)

### 3.3 Target Metrics After Optimization

| Metric                   | Before     | After      | Gain           |
| ------------------------ | ---------- | ---------- | -------------- |
| Total generation time    | 5-8s       | <2s        | 60-75% faster  |
| ai-context-mini.json     | 40-60 KB   | <50KB      | ✓ Maintained   |
| ai-dependency-graph.json | 400-600 KB | 200-300 KB | 40% smaller    |
| Total artifact size      | ~1.5 MB    | ~0.9 MB    | 40% smaller    |
| Cache hit warmup         | N/A        | <0.5s      | New capability |
| Memory peak              | ~200 MB    | ~80 MB     | 60% lower      |

### 3.4 Implementation Steps

1. **Refactor dependency-graph generation** to forward-edges-only (Phase 1)
2. **Implement caching layer** with file hash validation (Phase 2)
3. **Parallelize Step 1 & 2 of pipeline** (Phase 2)
4. **Implement streaming for artifacts >200KB** (Phase 3)
5. **Measure and validate** against success criteria (Phase 4)

---

## 4. CI Pipeline Optimization

### 4.1 Current CI Structure

**Current Workflow (Sequential Bottleneck):**

```
1. Lint (Biome)                    [2-3 min] ─────────┐
2. Type Check (TypeScript)         [2-3 min] ────────────────────┐
3. Tests (Vitest)                  [3-4 min] ────────────────────┐
4. Architecture Audit              [2-4 min] ────────────────────┐
5. AI Context Generation           [5-8 sec] ────────────────────┐
6. Generate Artifacts              [1-2 min] ────────────────────┐
                                                                 └─> Total: 12-18 min
```

**Identified Inefficiencies:**

1. **Sequential execution** — Independent checks run one after another
2. **Duplicate type checking** — Both Biome and TypeScript check types
3. **Full test suite always runs** — Even if changes are doc-only
4. **Redundant architecture checks** — Both ai-guard and infra-audit run (overlapping validation)
5. **Blocking on artifact generation** — Context generation happens inline instead of async

### 4.2 Optimized CI Structure

**Target Workflow (Parallelized):**

```
┌─ Job Group 1: Code Quality (parallel, 3-4 min max)
│  ├─ Lint: Biome          [2-3 min]
│  ├─ Type Check: TypeScript [2-3 min]  (remove from Biome if duplicated)
│  └─ Format Check: Prettier [1-2 min]
│
├─ Job Group 2: Tests (parallel, 3-5 min max)
│  ├─ Unit tests (Vitest)  [2-3 min]
│  ├─ Integration tests    [2-3 min]
│  └─ E2E tests (if fast)  [1-2 min]
│
├─ Job Group 3: Architecture (parallel, 2-3 min max)
│  ├─ AI Guard (rule check) [0.5-1 sec]
│  ├─ Infra Audit (full)    [2-3 sec]
│  └─ Type Safety Guard     [0.8-1 sec]
│
└─ Job Group 4: Artifacts & Reports (parallel, 1-2 min max)
   ├─ Generate AI Context  [1.5-2 sec]
   ├─ Generate Health Report [2-3 sec]
   └─ Archive Test Results  [1 sec]

Total: max(4 min, 5 min, 1 min, 1 min) = ~5 min (vs. 12-18 min sequential)
```

**Expected Speedup:** 60-70% reduction (12-18 min → 5-6 min)

### 4.3 CI Optimization Details

#### 4.3.1 Eliminate Duplicate Checks

**Issue:** Both Biome and TypeScript perform type checking.

**Solution:** Use Biome for linting + basic type checking; use tsc only for strict mode validation.

```yaml
# Before (redundant)
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: bun biome check  # Includes type checking

  type-check:
    runs-on: ubuntu-latest
    steps:
      - run: bun tsc --noEmit  # Redundant type checking

# After (optimized)
jobs:
  code-quality:
    runs-on: ubuntu-latest
    steps:
      - run: bun biome check              # Linting + basic types
      - run: bun tsc --noEmit --strict    # Strict type validation (faster subset)
```

**Gain:** Merge into single job, reduce redundant checking

#### 4.3.2 Reduce Architecture Check Redundancy

**Issue:** Both `ai-guard.ts` and `infra-audit.ts` validate architecture rules.

**Solution:** Decompose into focused checks:

```yaml
jobs:
  architecture:
    strategy:
      matrix:
        check: [rules, audit, brain-validate]
    runs-on: ubuntu-latest
    steps:
      - run: |
          case ${{ matrix.check }} in
            rules) bun scripts/ai-guard.ts ;;
            audit) bun scripts/infra-audit.ts --quick ;;  # Disable expensive graph rebuild
            brain) bun scripts/validate-architecture-brain.ts ;;
          esac
```

**Gain:** Explicit responsibility, parallel execution of non-overlapping checks

#### 4.3.3 Fast-Path for Doc-Only Changes

**Problem:** Full CI runs even if PR only changes `.md` files.

**Solution:** Add path filtering:

```yaml
jobs:
  lint:
    if: |
      contains(github.event.pull_request.files.*.filename, 
        '!*.md') || contains(github.event.pull_request.files.*.filename, 
        'docs/templates/*')
    # ... only run if non-doc files changed
```

**Gain:** Skip tests/architecture checks for doc PRs (save 5-10 min)

#### 4.3.4 Cache Dependency Downloads

**Problem:** Each job rebuilds dependency install cache.

**Solution:** Use GitHub Actions cache for bun:

```yaml
jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/cache@v3
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
```

**Gain:** 30-60s per job (save 2-4 min total)

#### 4.3.5 Parallelize Independent Job Groups

**Implementation:** Use GitHub Actions job dependencies:

```yaml
jobs:
  code-quality:
    runs-on: ubuntu-latest
    # ... lint, type-check, format

  tests:
    runs-on: ubuntu-latest
    needs: [code-quality] # Only run if code-quality passes
    # ... unit, integration, e2e

  architecture:
    runs-on: ubuntu-latest
    needs: [code-quality] # Can run in parallel with tests
    # ... ai-guard, audit, brain-validate

  artifacts:
    runs-on: ubuntu-latest
    needs: [tests, architecture] # Run after both complete
    # ... generate context, health report
```

**Gain:** Architecture checks run in parallel with tests (save 3-5 min)

### 4.4 CI Configuration Template

**Target GitHub Actions Workflow:**

```yaml
name: Repository Health CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  # Group 1: Code Quality (2-4 min)
  code-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - uses: actions/cache@v3
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}

      - name: Lint (Biome)
        run: bun biome check

      - name: Type Check (TypeScript Strict)
        run: bun tsc --noEmit --strict

      - name: Format Check
        run: bun prettier --check .

  # Group 2: Tests (3-5 min) — runs after code-quality passes
  tests:
    needs: [code-quality]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - uses: actions/cache@v3
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}

      - name: Unit & Integration Tests
        run: bun run test:ci

      - name: Upload Coverage
        uses: codecov/codecov-action@v3

  # Group 3: Architecture (2-3 min) — runs in parallel with tests
  architecture:
    needs: [code-quality]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Run Architecture Checks
        run: |
          bun scripts/ai-guard.ts
          bun scripts/infra-audit.ts --quick
          bun scripts/validate-architecture-brain.ts

  # Group 4: Artifacts (1-2 min) — runs after tests & architecture
  artifacts:
    needs: [tests, architecture]
    runs-on: ubuntu-latest
    if: github.event_name == 'push' # Only on main branch push
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Generate AI Context
        run: bun scripts/ai-context/generate-ai-context.ts

      - name: Generate Health Report
        run: bun scripts/dev/repository-health.ts

      - name: Commit & Push Artifacts
        if: github.ref == 'refs/heads/main'
        run: |
          git config user.name "CI Bot"
          git config user.email "ci@zidney.local"
          git add docs/ai/context/ scripts/ai-context/health-report.md
          git commit -m "chore: regenerate AI context and health report" || true
          git push
```

### 4.5 CI Success Metrics

| Metric                          | Before          | After   | Target |
| ------------------------------- | --------------- | ------- | ------ |
| Total CI duration               | 12-18 min       | 5-6 min | <6 min |
| Parallelization ratio           | 0% (sequential) | 70-80%  | >70%   |
| Cache hit rate                  | 40%             | 90%+    | >85%   |
| Time to first meaningful result | 4-5 min         | 1-2 min | <2 min |
| Doc-only PR duration            | 12-18 min       | 1-2 min | <3 min |

---

## 5. AI Skill Optimization

### 5.1 Current Skill File Audit

**Objective:** Measure and identify oversized SKILL.md files.

**Audit Steps:**

1. **Enumerate all skills:**

   ```bash
   find .agents/skills/ -name "SKILL.md" | sort
   find ~/.claude/skills/ -name "SKILL.md" | sort (if applicable)
   ```

2. **Measure line counts:**

   ```bash
   find .agents/skills/ -name "SKILL.md" -exec wc -l {} \; | sort -rn
   ```

3. **Classify by size:**
   - **Compact** (<300 lines): Well-scoped, focused skill
   - **Normal** (300-500 lines): Acceptable, moderate scope
   - **Bloated** (>500 lines): Oversized, needs splitting or consolidation
   - **Heavy** (>700 lines): Critical for splitting

4. **Analyze content** for each bloated skill:
   - What domains does it cover?
   - Are there distinct workflows?
   - Can it be split into multiple skills?
   - Are there shared instructions that should be consolidated?

5. **Generate report:** `audits/SKILL_SIZE_AUDIT.md`:

```markdown
| Skill         | Path               | Lines | Classification | Recommendation     |
| ------------- | ------------------ | ----- | -------------- | ------------------ |
| skill-name    | .agents/skills/... | 450   | Normal         | Keep as-is         |
| heavy-skill   | .agents/skills/... | 890   | Heavy          | Split into A + B   |
| bloated-skill | .agents/skills/... | 620   | Bloated        | Consolidate with X |
```

### 5.2 Skill Consolidation Strategy

**Objective:** Group related skills into domain-organized bundles without exceeding 500 lines.

**Target Grouping:**

1. **Architecture Skills** (consolidate + organize):
   - `gitnexus-exploring` (understanding code)
   - `gitnexus-refactoring` (modifying code)
   - `gitnexus-impact-analysis` (understanding blast radius)
   - `gitnexus-debugging` (finding bugs)
   - `architecture-intelligence` (Zidney-specific architecture)
   - → Create: `architecture/SKILL.md` (consolidated guide, <500 lines per skill)

2. **DevOps & Terminal Skills** (consolidate):
   - `ai-terminal` (terminal operations)
   - `terminal-safety` (terminal safety)
   - `rtk-execution-layer` (token optimization)
   - → Create: `devops/SKILL.md` (operations & execution)

3. **AI Governance Skills** (consolidate):
   - `ai-guard.ts` context
   - `architecture-self-healing`
   - `precommit-diagnostics`
   - → Create: `ai-governance/SKILL.md`

4. **Testing & Quality Skills**:
   - Any test-related skills
   - Code review guidelines
   - → Create: `quality/SKILL.md`

### 5.3 Skill Splitting Rules

**When to Split (vs. Consolidate):**

| Criterion              | Consolidate        | Split                 |
| ---------------------- | ------------------ | --------------------- |
| **Distinct Workflows** | <2 workflows       | 3+ distinct workflows |
| **Domain Overlap**     | >70% overlap       | <30% overlap          |
| **Typical Use**        | Both used together | Independent use cases |
| **File Size**          | <350 lines         | >600 lines            |
| **Readability**        | Clear flow         | Requires navigation   |

**Example — Splitting Heavy Skill:**

Before (890 lines, bloated):

```
SKILL.md (Heavy Skill)
├─ Architecture exploration (250 lines)
├─ Refactoring workflow (300 lines)
├─ Impact analysis (200 lines)
└─ Debugging (140 lines)
```

After (split into 4 focused skills):

```
architecture/
├─ exploring.md (250 lines)
├─ refactoring.md (300 lines)
├─ impact-analysis.md (200 lines)
└─ debugging.md (140 lines)
```

Each stays under 500 lines, each is independently useful.

### 5.4 Consolidation Rules

**When to Consolidate (vs. Split):**

- **Same domain** (e.g., all architecture-related)
- **Complementary workflows** (often used together)
- **Shared context** (understand one helps understand the other)
- **Combined size <500 lines**

Example — Consolidating Related Skills:

Before (3 separate small skills):

```
gitnexus-exploring.md (200 lines): How does X work?
gitnexus-refactoring.md (180 lines): How to safely rename?
gitnexus-impact-analysis.md (150 lines): What breaks if I change X?
Total: 530 lines (across 3 files, redundant headers)
```

After (consolidated):

```
gitnexus/core-skills.md (280 lines)
├─ Exploring Architecture (110 lines)
├─ Refactoring Safely (110 lines)
└─ Impact Analysis (60 lines)
Total: 280 lines (1 cohesive file)
```

### 5.5 AI Skill Optimization Checklist

After consolidating/splitting:

- [ ] All SKILL.md files <500 lines
- [ ] Related skills grouped in directories (architecture/, devops/, etc.)
- [ ] No duplicate instructions across skills
- [ ] Each skill has clear, single purpose
- [ ] Cross-skill references updated
- [ ] Workspace tool configurations updated to point to new skill paths
- [ ] All skills tested (AI can load and use each one)

---

## 6. Dependency Optimization

### 6.1 Dependency Audit

**Objective:** Identify and remove unused or redundant dependencies.

**Audit Steps:**

1. **List all production dependencies:**

   ```bash
   bun pm ls
   ```

2. **Identify unused packages:**
   - Use `depcheck` or similar tool
   - Manual inspection of imports in `packages/*/` and `apps/*/`
   - Check if dev dependencies leaked into production

3. **Identify heavy packages:**
   - Check `node_modules/` sizes for outliers
   - Use `npm-check-updates` to identify outdated packages
   - Review transitive dependency bloat

4. **Generate audit report:** `audits/DEPENDENCY_AUDIT.md`:

```markdown
## Unused Dependencies (Candidates for Removal)

| Package | Size   | Location        | Reason to Remove          |
| ------- | ------ | --------------- | ------------------------- |
| `pkg-1` | 2.5 MB | transitive      | No imports found anywhere |
| `pkg-2` | 1.2 MB | devDependencies | Not used in any test      |

## Oversized Dependencies (Candidates for Replacement)

| Package     | Size  | Alternative | Size (Alt) | Reason                     |
| ----------- | ----- | ----------- | ---------- | -------------------------- |
| `lodash`    | 80 KB | `lodash-es` | 20 KB      | ESM version is 75% smaller |
| `heavy-lib` | 5 MB  | `light-lib` | 0.5 MB     | Functionality overlap      |

## Transitive Bloat

| Top-level | Pulls in   | # Transitive | Total Size | Action           |
| --------- | ---------- | ------------ | ---------- | ---------------- |
| `pkg-a`   | `peer-dep` | 12           | 3.5 MB     | Review necessity |

Total Production Dependencies: X
Total Lock File: Y MB
After Removal: -Z MB (estimated)
```

### 6.2 Dependency Cleanup

**CLARIFICATION Q5 APPLIED:** Use conservative removal strategy. Only remove dependencies with zero import references across the entire workspace. Do NOT aggressively remove transitive dependencies without explicit import verification, as this risks breaking hidden dependencies or dynamic requires. This aligns with Zidney's stability-first mandate.

**Steps:**

1. **Identify unused dependencies (conservative criteria):**
   - Package appears in package.json or bun.lock
   - Grep entire workspace for all references: `grep -r "package-name" apps/ packages/`
   - Only remove if ZERO results across all source files
   - If removed dependency is re-imported somewhere, stop and document reason for keeping

   ```bash
   # Example: Verify no imports of unused-package before removal
   grep -r "unused-package" apps/ packages/ scripts/ --include="*.ts" --include="*.js" || echo "Safe to remove"
   ```

2. **Replace oversized dependencies (with verification):**
   - Identify alternative package
   - Check API compatibility carefully
   - Test all features using the new package before committing

   ```bash
   bun remove heavy-lib
   bun add light-lib
   # Then run full test suite to verify no breakage
   bun run test:ci
   ```

3. **Deduplicate transitive versions (low-risk):**

   ```bash
   bun pm install  # Deduplicates lock file
   ```

4. **Prune unreachable dependencies (verify first):**

   ```bash
   # Only prune if no hidden imports exist
   bun pm prune
   bun run type-check  # Verify no type errors
   ```

5. **Validate build (mandatory before merge):**
   ```bash
   bun run build
   bun run type-check
   bun run test:ci  # Full integration test run
   ```

**Removal Decision Tree:**

```
Is dependency in package.json?
├─ No → Not candidate for removal
├─ Yes: Search all imports in workspace
    ├─ Found imports → Keep dependency
    ├─ No imports found:
        ├─ Is it a peer dependency of another package? → Keep
        ├─ Is it documented as needed for type resolution? → Keep
        └─ truly unused → Safe to remove (conservative approach)
```

### 6.3 Lock File Optimization

**Target:** Reduce `bun.lock` size by 15-25%

**Strategies:**

1. **Remove duplicate versions** (same package, multiple resolved versions)
2. **Prefer single major version** when possible
3. **Document peer dependency reasons** if multiple versions unavoidable

**Success Metrics:**

| Metric                     | Before | After  | Target                    |
| -------------------------- | ------ | ------ | ------------------------- |
| bun.lock size              | 5-8 MB | 4-6 MB | <6 MB                     |
| # dependencies (top-level) | X      | X-Y    | Reduced by removals       |
| # transitive dependencies  | X      | X-Z    | Reduced by consolidations |

---

## 7. Architecture Tool Performance

### 7.1 Performance Profiling of Architecture Tools

**Objective:** Identify and optimize bottlenecks in ai-guard.ts, infra-audit.ts, architecture-diff.ts.

**Profiling Methodology:**

For each tool:

1. **Break into phases:**
   - Phase A: I/O setup (read files, initialize)
   - Phase B: Core algorithm (graph building, validation, diff)
   - Phase C: Output generation (write reports, artifacts)

2. **Measure each phase:**

   ```typescript
   const start = performance.now();
   const result = await coreAlgorithm();
   const duration = performance.now() - start;
   console.log(`Phase B took ${duration}ms`);
   ```

3. **Identify hotspots:**
   - Which phase takes >50% of total time?
   - What specific operations are slowest?
   - Can they be optimized or cached?

4. **Generate profile report:** `audits/ARCHITECTURE_TOOL_PROFILE.md`

### 7.2 Optimization Techniques

#### 7.2.1 Cached Dependency Graph

**Problem:** Every audit walk the entire `packages/` and `apps/` directories to build dependency graph.

**Solution:** Cache the built graph:

```typescript
interface CachedGraph {
  timestamp: number;
  sourceHashes: Record<string, string>; // SHA256 of all package.json files
  graph: DependencyGraph;
}

function loadOrBuildGraph(): DependencyGraph {
  const cached = loadCache("dependency-graph");
  const currentHashes = computePackageJsonHashes();

  if (cached && deepEqual(cached.sourceHashes, currentHashes)) {
    return cached.graph; // Cache hit: use cached graph
  }

  // Cache miss: rebuild from scratch
  const graph = buildGraphFromScratch();
  saveCache("dependency-graph", { timestamp: Date.now(), sourceHashes: currentHashes, graph });
  return graph;
}
```

**Expected Speedup:**

- First run: No change (cold cache)
- Unchanged repo: 50-70% faster (skip graph rebuild)
- Single file change: Incremental update possible (if implemented)

#### 7.2.2 Incremental Architecture Checks

**Problem:** `ai-guard.ts` re-validates all rules even if only 1 file changed.

**Solution:** Incremental validation:

```typescript
function runIncrementalGuard(changedFiles: string[]): Violations {
  const allViolations = loadPreviousViolations();
  const changedModules = new Set(
    changedFiles
      .filter((f) => isModuleDefinition(f)) // package.json, tsconfig.json
      .map((f) => extractModuleFromPath(f)),
  );

  // Re-validate only affected rules
  for (const violation of allViolations) {
    if (changedModules.has(violation.source) || changedModules.has(violation.target)) {
      violation.rechecked = await validateRule(violation);
    }
  }

  const newViolations = await validateNewRules(changedFiles);
  return { allViolations, newViolations };
}
```

**Expected Speedup:**

- Typical small change: 80-90% faster (validate only affected rules)
- Large refactor: Falls back to full validation

#### 7.2.3 Lightweight Dependency Scanning

**Problem:** `infra-audit.ts` fully walks file system for every audit.

**Solution:** Use pre-built module roster:

```typescript
// Pre-built module list (generated once, cached)
interface ModuleRoster {
  modules: ModuleInfo[];
  lastUpdated: number;
}

function scanDependencies(rosterVersion: number): void {
  const roster = loadModuleRoster();

  if (roster.lastUpdated > rosterVersion) {
    // Already up-to-date, skip full scan
    return useCachedRoster(roster);
  }

  // Only scan if new modules possible
  const newModules = findNewModulesInDirectories();
  if (newModules.length === 0) {
    return useCachedRoster(roster);
  }

  // Minimal scan: just analyze new modules
  return augmentRoster(roster, newModules);
}
```

**Expected Speedup:** 40-60% faster on stable repository structure

#### 7.2.4 Parallel Rule Validation

**Problem:** Rules validated sequentially in ai-guard.ts.

**Solution:** Parallelize independent rule checks:

```typescript
async function validateRulesInParallel(rules: Rule[]): Promise<Violation[]> {
  // Group rules by dependency
  const groups = groupRulesByDependency(rules);

  // Validate each group in parallel
  const results = await Promise.all(groups.map((group) => validateRuleGroup(group)));

  return results.flat();
}

// Example: Layer rules (no dependencies on each other)
const violations = await Promise.all([
  validateNoUIImportsDB(),
  validateNoAppsToApps(),
  validateNoPackagesToApps(),
  validateNoCrossLayerViolations(),
]);
```

**Expected Speedup:** 3-6x faster (if 3-6 independent rule groups)

### 7.3 Target Performance Goals

After optimization:

| Tool                             | Before     | After  | Target | Technique                       |
| -------------------------------- | ---------- | ------ | ------ | ------------------------------- |
| `ai-guard.ts`                    | 200-800ms  | <800ms | <1s    | Parallel validation             |
| `infra-audit.ts`                 | 2-4s       | 1-2s   | <3s    | Cached graph + lightweight scan |
| `type-safety-guard.ts`           | 500-1200ms | <800ms | <1s    | Parallel type checks            |
| `architecture-diff.ts`           | 2-5s       | 1-2s   | <2s    | Cached graph                    |
| `validate-architecture-brain.ts` | 300-800ms  | <500ms | <1s    | Streaming JSON parser           |

---

## 8. Repository Health Metrics

### 8.1 Health Report Structure

**Objective:** Generate a comprehensive `HEALTH_REPORT.md` that tracks repository health over time.

**Report Sections:**

```markdown
# Repository Health Report — 2026-03-14

## Executive Summary

- Overall health score: 85/100
- Change since last report: +12 points
- Critical issues: 0
- Action items: 3

## Metrics Summary

| Category        | Metric                          | Value     | Target     | Status      |
| --------------- | ------------------------------- | --------- | ---------- | ----------- |
| Repository Size | Total size (excl. node_modules) | 180 MB    | <150 MB    | ⚠️ Above    |
| AI Context      | ai-context-mini.json            | 42 KB     | <50 KB     | ✓ Within    |
| AI Context      | Total AI artifacts              | 920 KB    | <1.5 MB    | ✓ Within    |
| Scripts         | Total execution time (all)      | 8.5s      | <6s        | ⚠️ Above    |
| Scripts         | ai-guard.ts                     | 650ms     | <1s        | ✓ Within    |
| Scripts         | infra-audit.ts                  | 3.2s      | <3s        | ⚠️ Marginal |
| CI              | Total duration                  | 11 min    | <8 min     | ⚠️ Above    |
| Dependencies    | Lock file size                  | 7.2 MB    | <6 MB      | ⚠️ Above    |
| Skills          | Largest SKILL.md                | 620 lines | <500 lines | ⚠️ Above    |
| Code Quality    | Type check time                 | 2.8s      | <3s        | ✓ Within    |

## Detailed Metrics

### Repository Size Breakdown
```

docs/ai/context/ 42 MB [Target: <10 MB] ← Bloat identified
scripts/ 2.1 MB [Target: <2 MB] ✓
.agents/skills/ 1.8 MB [Target: <2 MB] ✓
docs/ 45 MB [Target: <40 MB] ~
coverage/ 0 MB [gitignored] ✓
Total (excl. node_modules) 180 MB [Target: <150 MB] ⚠️

```

### AI Context Artifact Sizes

```

ai-layer-model.json 32 KB [Target: <100 KB] ✓
ai-module-map.json 180 KB [Target: <200 KB] ✓
ai-dependency-graph.json 480 KB [Target: <500 KB] ✓
ai-context-mini.json 42 KB [Target: <50 KB] ✓
ai-architecture-brain.json 420 KB [Target: <400 KB] ✓
Total 920 KB [Target: <1.5 MB] ✓

```

### Script Execution Baselines

```

ai-guard.ts 650ms [Target: <1s] ✓
infra-audit.ts 3.2s [Target: <3s] ⚠️ Marginal
type-safety-guard.ts 820ms [Target: <1s] ⚠️ Marginal
architecture-diff.ts 1.8s [Target: <2s] ✓
validate-architecture-brain.ts 620ms [Target: <1s] ✓
Total (sequential) 8.5s [Target: <6s] ⚠️
Total (parallelized) 3.2s [Achievable: <4s] ✓

```

### CI Performance

```

Code Quality (Biome + tsc) 4.2 min [Sequential]
Tests (Vitest) 3.5 min [Sequential]
Architecture checks 2.8 min [Sequential]
Artifacts + reports 1.5 min [Sequential]
Total (Serial) 11.0 min [Baseline]
Total (Parallelized) 5.0 min [Target: <8 min] ✓

```

### Dependency Metrics

```

Top-level dependencies 42 [Healthy]
Total transitive 280 [Monitor for bloat]
Lock file size 7.2 MB [Target: <6 MB] ⚠️
Unused packages 1 [Remove: pkg-name]
Heavy packages (>5MB) 2 [Review: pkg-a, pkg-b]

```

### AI Skills Audit

```

Largest skill files (lines):

- skill-a.md: 620 lines [Target: <500] ⚠️
- skill-b.md: 520 lines [Target: <500] ⚠️
- skill-c.md: 480 lines [Target: <500] ✓

Consolidation opportunities: 2
Splitting recommendations: 1

```

## Trends

### Size Evolution (Last 3 months)
```

Dec 2025: 142 MB
Jan 2026: 158 MB (+16 MB, +11%)
Feb 2026: 173 MB (+15 MB, +9%)
Mar 2026: 180 MB (+7 MB, +4%) ← Growth rate slowing

```

### Performance Evolution (Last 3 months)
```

infra-audit.ts:
Dec 2025: 2.1s
Jan 2026: 2.8s (+33%)
Feb 2026: 3.5s (+25%)
Mar 2026: 3.2s (-9%) ← Optimization starting to help

```

## Action Items

### Critical (Complete Before Next Phase)
1. [ ] Reduce `docs/ai/context/` from 42 MB to <10 MB (artifact cleanup)
2. [ ] Optimize `infra-audit.ts` from 3.2s to <3s (caching)

### High (Complete This Quarter)
3. [ ] Consolidate oversized SKILL.md files (>500 lines)
4. [ ] Parallelize CI job groups (reduce from 11 min to <8 min)
5. [ ] Remove heavy dependencies (reduce lock file from 7.2 MB to <6 MB)

### Medium (Complete Before End of Year)
6. [ ] Implement incremental model checking in ai-guard.ts
7. [ ] Cache module roster in infra-audit.ts
8. [ ] Stream large JSON artifacts during generation

## Recommendations

1. **Immediate:** Archive old AI context snapshots (keeping only latest 2)
2. **Short-term:** Parallelize CI jobs (biggest time saver)
3. **Medium-term:** Implement caching layer for architecture tools
4. **Long-term:** Monitor trends — plan next major optimization wave if size/time exceeds targets

## Next Review

**Scheduled:** 2026-04-14 (30 days)
**Generated by:** Repository Health CI Job
**Duration of this report:** 2 min
```

### 8.2 Health Metrics Monitoring Workflow

**Automation:**

1. **Generate report on every main branch push:**

   ```yaml
   jobs:
     artifacts:
       # ... (after tests + architecture pass)
       - name: Generate Repository Health Report
         run: bun scripts/dev/repository-health.ts

       - name: Upload Report Artifact
         uses: actions/upload-artifact@v3
         with:
           name: health-report
           path: HEALTH_REPORT.md
   ```

2. **Track trends over time:**
   - Store reports in `docs/reports/health/` directory
   - Compute change deltas between reports
   - Alert if any metric exceeds target

3. **Monthly trend analysis:**
   - Extract metrics from historical reports
   - Generate growth/shrinkage trends
   - Highlight concerning patterns

### 8.3 Success Metrics Validation

**Repository Health Report must include:**

- [ ] Repository size (current vs. target vs. trend)
- [ ] AI context artifact sizes and generation times
- [ ] Script execution performance (all 5 key scripts)
- [ ] CI pipeline duration (serial vs. parallel)
- [ ] Dependency metrics (count, lock file size, transitive bloat)
- [ ] Skill file sizes and consolidation status
- [ ] Trend analysis (growth/shrinkage over time)
- [ ] Action items (prioritized by impact)

---

## Assumptions & Constraints

1. **Backward Compatibility:**
   - Script modularization must not change CLI interfaces
   - External tools relying on script outputs must continue to work
   - Migration period allowed for dependent tools

2. **Performance Baselines:**
   - Baselines measured on consistent hardware (CI runner specs)
   - Network latency not included (local filesystem operations)
   - Cold cache (first run) baselines separate from warm cache

3. **Artifact Stability:**
   - AI context artifacts are pre-commit generated (not manual edits)
   - Caching assumes source files are the only inputs
   - Cache invalidation based on file hashes (SHA256) is reliable

4. **CI Platform Constraints:**
   - GitHub Actions is the CI platform
   - Ubuntu latest runner standard
   - Bun package manager (not npm or pnpm)

5. **No Breaking Changes:**
   - Team workflows must not be disrupted during optimization
   - Documentation and tooling must remain accessible
   - All changes must be mergeable without coordination

---

## Risk Mitigation

| Risk                          | Probability | Impact | Mitigation                                          |
| ----------------------------- | ----------- | ------ | --------------------------------------------------- |
| Cache invalidation bugs       | Medium      | High   | Validate cache against source files on each load    |
| Performance regression        | Low         | High   | Profile before/after, keep old version as fallback  |
| Script API breakage           | Low         | High   | Extensive integration testing before merge          |
| Incomplete artifact migration | Medium      | Medium | Dry-run on staging branch, manual validation        |
| CI false positives            | Low         | High   | Test CI changes on feature branch before main merge |

---

## Implementation Phases

### Phase 1: Diagnostics & Planning (1 week)

- [ ] Run all audits (file size, directory size, AI artifacts, script profiling)
- [ ] Generate baseline health report
- [ ] Identify top 3 optimization opportunities

### Phase 2: Script Modularization (2 weeks)

- [ ] Extract core utilities to scripts/core/
- [ ] Modularize architecture scripts
- [ ] Modularize AI context generators
- [ ] Validate CLI backward compatibility

### Phase 3: AI Context Optimization (1 week)

- [ ] Implement caching layer
- [ ] Remove bidirectional redundancy
- [ ] Add parallelization
- [ ] Validate artifact sizes and generation time

### Phase 4: CI Optimization (1 week)

- [ ] Parallelize job groups in GitHub Actions
- [ ] Eliminate duplicate checks
- [ ] Cache dependencies
- [ ] Validate CI duration reduction

### Phase 5: Dependency & Skill Cleanup (1 week)

- [ ] Dependency audit and removal
- [ ] Skill consolidation/splitting
- [ ] Lock file optimization
- [ ] Validate build outputs

### Phase 6: Architecture Tool Performance (1 week)

- [ ] Profile each tool
- [ ] Implement caching
- [ ] Implement incremental validation
- [ ] Validate performance targets

### Phase 7: Health Monitoring Setup (3 days)

- [ ] Create repository health script
- [ ] Generate baseline report
- [ ] Hook into CI
- [ ] Establish trend tracking

### Phase 8: Validation & Closure (1 week)

- [ ] Run full validation suite
- [ ] Measure all success criteria
- [ ] Generate final health report
- [ ] Document learnings for future optimization

**Total Duration:** 8 weeks (with parallel work on non-blocking phases)

---

## Non-Goals

This stage does NOT:

- Change architectural rules or design decisions
- Modify feature behavior or user-facing APIs
- Upgrade major framework versions (Bun, Hono, Vue, etc.)
- Implement new features or product changes
- Move or rename phases/stages within SpecKit
- Replace governance tools with different approaches

These are explicitly handled in other stages or future work.

---

## Compliance Statement

**Compliant with Zidney Constitution v1.2.0 — No violations detected.**

This is an **infrastructure optimization stage** with no data model changes, no tenant isolation impacts, no attempt engine modifications, and no security boundary weakening. All optimizations maintain existing governance rules and architecture constraints.

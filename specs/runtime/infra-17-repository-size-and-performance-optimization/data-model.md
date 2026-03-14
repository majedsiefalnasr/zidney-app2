# INFRA-17 Data Model — Cache, Metrics, and Artifact Structures

**Date:** 2026-03-14  
**Stage:** INFRA-17 Repository Size and Performance Optimization  
**Purpose:** Define data structures for cache management, performance metrics, and artifact validation

---

## 1. Cache Entry Structure

**Purpose:** Define how artifacts are cached for phase 3 selective caching strategy (Q2)

```typescript
// File: scripts/ai-context/cache-manager.ts

interface CacheEntry {
  // Metadata
  timestamp: number; // ISO 8601 timestamp of cache creation
  artifact: "dependency-graph" | "runtime-dependents"; // Which artifact is cached

  // Validation
  fileHashes: Record<string, string>; // SHA256 hashes of source files
  sourceFilesSet: string[]; // Array of source file paths used for hash computation

  // Cached content
  content: unknown; // The actual cached JSON artifact
  contentHash: string; // SHA256 of content for integrity verification

  // Performance metrics
  generationTimeMs: number; // How long generation took (cold run)
  compressionRatio: number; // gzip size vs raw size

  // Lifecycle
  expirationMs?: number; // Optional TTL (if implementing time-based expiry)
  invalidateOnChange: string[]; // Which file patterns trigger invalidation
}

// Example: Cached dependency graph
const exampleEntry: CacheEntry = {
  timestamp: "2026-03-14T09:15:00.000Z",
  artifact: "dependency-graph",
  fileHashes: {
    "packages/api-client/package.json": "abc123...",
    "packages/domain-core/package.json": "def456...",
    "apps/api/package.json": "ghi789...",
    "tsconfig.json": "jkl012...",
  },
  sourceFilesSet: [
    "packages/*/package.json",
    "apps/*/package.json",
    "scripts/**/*.ts",
    "tsconfig.json",
  ],
  content: {
    edges: [
      { from: "packages/domain-core", to: "packages/types" },
      { from: "packages/api-client", to: "packages/domain-core" },
      // ... more edges
    ],
  },
  contentHash: "mnop345...",
  generationTimeMs: 2547,
  compressionRatio: 8.0,
  invalidateOnChange: ["packages/*/package.json", "apps/*/package.json", "tsconfig.json"],
};
```

---

## 2. Module Roster Structure (Cache Index)

**Purpose:** Fast lookup of known modules without full filesystem scan (Phase 2 optimization)

```typescript
// File: scripts/architecture/core/module-roster.ts

interface ModuleInfo {
  name: string; // e.g., "packages/domain-core"
  type: "package" | "app"; // Classification
  packagePath: string; // Path to package.json
  mainFile: string; // Entry point
  dependencies: string[]; // Array of module names it depends on
  dependents: string[]; // Array of modules that depend on it
}

interface ModuleRoster {
  // Metadata
  timestamp: number; // When roster was generated
  version: number; // Roster format version (for migrations)

  // Module inventory
  modules: ModuleInfo[]; // All known modules
  moduleIndex: Record<string, ModuleInfo>; // Fast lookup by name

  // Validation
  totalModuleCount: number; // Expected number of modules
  fileHashes: Record<string, string>; // Hash of each package.json

  // Performance metrics
  generationTimeMs: number; // How long to scan filesystem

  // Lifecycle
  lastUpdated: number; // Timestamp of last update
  nextScanRequired: boolean; // Flag if new modules might exist
}

// Example
const exampleRoster: ModuleRoster = {
  timestamp: Date.now(),
  version: 1,
  modules: [
    {
      name: "packages/domain-core",
      type: "package",
      packagePath: "packages/domain-core/package.json",
      mainFile: "packages/domain-core/src/index.ts",
      dependencies: ["packages/types", "packages/validation"],
      dependents: ["packages/api-client", "apps/api"]
    },
    // ... more modules
  ],
  moduleIndex: {
    "packages/domain-core": {...},
    // ... index entries
  },
  totalModuleCount: 10,
  fileHashes: {
    "packages/domain-core/package.json": "abc123...",
    // ...
  },
  generationTimeMs: 850,
  lastUpdated: Date.now(),
  nextScanRequired: false
};
```

---

## 3. Performance Metrics Schema

**Purpose:** Track performance characteristics for all optimization targets

```typescript
// File: scripts/dev/repository-health.ts

interface PerformanceMetric {
  name: string; // e.g., "ai-guard-execution-time"
  value: number; // Current value
  unit: string; // "ms", "MB", "second", "%", "lines"
  target: number; // Target value
  status: "PASS" | "WARN" | "FAIL"; // Pass if <= target, warn if close, fail if > target
  trend: "IMPROVING" | "STABLE" | "DEGRADING"; // Direction of change
  timestamp: number; // When measured
}

interface PerformanceSnapshot {
  // Identification
  date: string; // ISO 8601 date
  time: string; // ISO 8601 time
  commitSha: string; // Git commit being measured
  branch: string; // Git branch

  // Repository metrics
  repoSizeBytes: number; // Total size excluding node_modules
  repoSizeMb: number; // Convenience field

  // AI context metrics
  aiContextGenerationTimeMs: number; // Total generation time
  aiContextDependencyGraphTimeMs: number; // Hotspot #1
  aiContextBrainTimeMs: number; // Hotspot #2
  aiContextArtifactSizeBytes: number; // All artifacts combined
  aiContextMiniSizeBytes: number; // Critical mini artifact

  // Script performance metrics (95th percentile)
  aiGuardExecTimeMs: number;
  infraAuditExecTimeMs: number;
  typeSafetyGuardExecTimeMs: number;
  architectureDiffExecTimeMs: number;
  validateBrainExecTimeMs: number;

  // CI metrics
  ciTotalDurationMinutes: number; // Total CI time
  ciParallelDurationMinutes: number; // Estimated parallel duration

  // Dependencies
  lockFileSizeBytes: number; // bun.lock size
  topLevelDependencyCount: number; // # of packages
  transitiveDependencyCount: number; // # of transitive deps

  // Skills
  skillFileMetrics: {
    totalSkillFiles: number;
    largestSkillLines: number; // Max line count
    oversizedSkillCount: number; // # exceeding 500 lines
    averageSkillLines: number;
  };

  // Derived metrics
  overallHealthScore: number; // 0-100 scale
  metricsWithinTarget: number; // Count of metrics meeting targets
  metricsWithinTargetPercentage: number; // %

  // All individual metrics
  allMetrics: PerformanceMetric[];
}

// Example
const exampleSnapshot: PerformanceSnapshot = {
  date: "2026-03-14",
  time: "14:30:00Z",
  commitSha: "abc123def456",
  branch: "spec/infra-17-repository-size-and-performance-optimization",

  repoSizeBytes: 188457600, // 180 MB
  repoSizeMb: 180,

  aiContextGenerationTimeMs: 6500, // 5-8s range
  aiContextDependencyGraphTimeMs: 2500, // Hotspot
  aiContextBrainTimeMs: 1800, // Hotspot
  aiContextArtifactSizeBytes: 940000, // ~920 KB
  aiContextMiniSizeBytes: 43000, // ~42 KB

  aiGuardExecTimeMs: 700,
  infraAuditExecTimeMs: 3240,
  typeSafetyGuardExecTimeMs: 884,
  architectureDiffExecTimeMs: 1800,
  validateBrainExecTimeMs: 600,

  ciTotalDurationMinutes: 14.5, // ~14.5 min serial
  ciParallelDurationMinutes: 6.2, // Estimated

  lockFileSizeBytes: 7549747, // 7.2 MB
  topLevelDependencyCount: 42,
  transitiveDependencyCount: 280,

  skillFileMetrics: {
    totalSkillFiles: 14,
    largestSkillLines: 680, // architecture-self-healing violation
    oversizedSkillCount: 2, // 2 violations
    averageSkillLines: 371,
  },

  overallHealthScore: 78,
  metricsWithinTarget: 8,
  metricsWithinTargetPercentage: 67,

  allMetrics: [
    { name: "repo-size-mb", value: 180, unit: "MB", target: 150, status: "FAIL", trend: "STABLE" },
    {
      name: "ai-context-gen-ms",
      value: 6500,
      unit: "ms",
      target: 2000,
      status: "FAIL",
      trend: "IMPROVING",
    },
    // ... more metrics
  ],
};
```

---

## 4. Artifact Validation Schema

**Purpose:** Ensure generated artifacts pass integrity checks

```typescript
// File: scripts/architecture/core/brain-validator.ts

interface ArtifactValidationResult {
  // Identification
  artifact:
    | "ai-context-mini"
    | "ai-module-map"
    | "ai-dependency-graph"
    | "ai-architecture-brain"
    | "ai-runtime-dependents"
    | "ai-layer-model"
    | "ai-runtime-map"
    | "ai-architecture-summary";

  // Validation status
  isValid: boolean; // Overall pass/fail
  timestamp: number; // When validated

  // Schema checks
  schemaValid: boolean; // JSON schema compliance
  schemaErrors?: string[]; // Specific schema violations

  // Content checks
  contentValid: boolean; // Semantic content validation
  contentErrors?: string[]; // Specific content violations

  // Performance metrics
  sizeBytes: number; // Artifact size
  sizeRecommendation: "OK" | "WARNING" | "BLOAT"; // Size assessment
  compressionRatio: number; // Gzip compression ratio

  // Freshness checks
  isFresh: boolean; // Generated from current source
  sourceFilesHash: string; // Hash of source files used

  // Detailed checks (optional, per artifact)
  detailedChecks?: {
    hasCycles?: boolean; // For graphs
    duplicateEdges?: number; // For dependency graphs
    isComplete?: boolean; // All modules represented?
    orphanModules?: string[]; // Modules not in graph
  };
}

// Example result
const exampleValidation: ArtifactValidationResult = {
  artifact: "ai-dependency-graph",
  isValid: true,
  timestamp: Date.now(),

  schemaValid: true,
  schemaErrors: undefined,

  contentValid: true,
  contentErrors: undefined,

  sizeBytes: 245760, // 240 KB (after optimization)
  sizeRecommendation: "OK", // Under 500 KB target
  compressionRatio: 8.2,

  isFresh: true,
  sourceFilesHash: "xyz789...",

  detailedChecks: {
    hasCycles: false,
    duplicateEdges: 0,
    isComplete: true,
    orphanModules: [],
  },
};
```

---

## 5. Trend Analysis Schema

**Purpose:** Track metrics evolution over time (Phase 7 health monitoring)

```typescript
// File: scripts/dev/repository-health.ts

interface MetricTrend {
  metric: string; // e.g., "repo-size-mb"
  snapshots: PerformanceSnapshot[]; // Historical data points

  // Current values
  current: number;
  target: number;

  // Trend analysis
  trendDirection: "IMPROVING" | "STABLE" | "DEGRADING";
  trendSlopePerDay: number; // Rate of change (units per day)
  trendDaysToTarget?: number; // Projected days to reach target (if improving)
  trendDaysToBreakage?: number; // If degrading, when will it exceed limit?

  // Statistics
  min: number; // Minimum value in snapshot history
  max: number; // Maximum value in snapshot history
  mean: number; // Average value
  median: number; // Median value
  stdDev: number; // Standard deviation

  // Alerts
  recentRegressions: number; // # of times metric went above previous value
  consecutiveImprovements: number; // # of in-a-row improvements
}

// Example: Repository size trend
const exampleTrend: MetricTrend = {
  metric: "repo-size-mb",
  snapshots: [
    // Historical snapshots (last 30 days)
  ],

  current: 180,
  target: 150,

  trendDirection: "DEGRADING", // Size growing
  trendSlopePerDay: 1.5, // Growing ~1.5 MB/day recently
  trendDaysToTarget: undefined, // Not improving toward target
  trendDaysToBreakage: 20, // At current rate, will hit 200 MB in ~20 days

  min: 142, // Dec 2025
  max: 180, // Current
  mean: 163,
  median: 170,
  stdDev: 12.5,

  recentRegressions: 3, // Last 3 weeks showed growth
  consecutiveImprovements: 0, // No recent improvements
};

// Summary report combining all trends
interface HealthReport {
  date: string; // Report date
  snapshot: PerformanceSnapshot; // Current metrics snapshot
  trends: MetricTrend[]; // Trends for each key metric

  alerts: {
    critical: string[]; // Metrics exceeding hard limits
    warning: string[]; // Metrics approaching targets
    good: string[]; // Metrics well within targets
  };

  recommendations: string[]; // Actionable next steps
}
```

---

## 6. GitHub Actions Cache Action Contract

**Purpose:** Define cache invalidation and storage strategy (Phase 4, Q1)

```yaml
# File: .github/workflows/ci.yml (cache action section)

cache:
  # Cache ID generation
  key: |
    ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}

  # Fallback keys (used if primary key not found)
  restore-keys: |
    ${{ runner.os }}-bun-

  # Paths to cache (dependencies)
  path: |
    ~/.bun/install/cache
    node_modules/.cache

  # Cache invalidation:
  # - Primary key changes if bun.lock changes → cache miss
  # - Fallback key used if primary not found → partial restore
  # - Old caches auto-expire after 7 days (GitHub default)

# Strategy data structure (documented in workflow)
CacheStrategy:
  PrimaryKey: "runner.os + bun.lock hash" # Invalidates on dependency changes
  FallbackKey: "runner.os + bun-" # Partial restore if no exact match
  Paths:
    - "~/.bun/install/cache" # Prevent download on each job
    - "node_modules/.cache" # For tools that use npm caches

  Validation:
    - "If bun.lock unchanged: cache HIT → 30-60s saved per job"
    - "If bun.lock changed: cache MISS → fresh install (normal)"
    - "If job fails: cache still useful for next run"

# Estimated Impact:
# - 3 parallel jobs × 1-2 min per dependency cache = 3-6 min total saved per CI run
# - Over 30 CI runs/month = 1.5-3 hours/month saved
```

---

## 7. Health Report Contract

**Purpose:** Define health report generation and format (Phase 7)

```typescript
// File: scripts/dev/repository-health.ts & docs/reports/health/README.md

interface HealthReportContract {
  // Standard sections every report must include
  sections: {
    executiveSummary: {
      overallScore: number; // 0-100
      changeFromPrevious: number; // +/- points
      criticalIssues: number;
      actionItems: number;
    };

    metricsSummary: {
      table: {
        headers: ["Category", "Metric", "Value", "Target", "Status", "Trend"];
        rows: Array<[string, string, string, string, "✓"|"⚠️"|"✗", "↑"|"→"|"↓"]>;
      };
      withinTarget: number; // Count
      aboveTarget: number; // Count
    };

    detailedMetrics: {
      repositorySize: {
        totalBytes: number;
        breakdown: Record<string, number>; // By directory
      };
      aiContextMetrics: {
        generationTimeMs: number;
        artifactSizeKb: number;
        cacheHitRate?: number;
      };
      scriptPerformance: {
        scripts: Record<string, number>; // Execution times
      };
      ciPerformance: {
        serialMinutes: number;
        parallelMinutes: number;
      };
    };

    trends: {
      sizeEvolution: Array<{date: string; bytes: number}>;
      performanceEvolution: Array<{date: string; metrics: Record<string, number>}>;
    };

    actionItems: {
      critical: Array<{item: string; daysUntilBreakage?: number}>;
      high: string[];
      medium: string[];
    };
  };

  // Format requirements
  format: "markdown"; // Always markdown for git-friendly storage
  filename: "HEALTH_REPORT-{ISO8601}.md"; // Timestamped
  symlinkLatest: "HEALTH_REPORT.md"; // Always points to latest

  // Automation contract
  generation: {
    trigger: "Push to main branch";
    timing: "After tests + architecture pass";
    retention: "Last 30 days" + "Archive older";
    updateFrequency: "Every main branch push";
  };
}

// Validation: Reports must be deterministic and reproducible
// Same source files → same metrics (within rounding)
```

---

## 8. Dependency Graph Schema (Optimization)

**Purpose:** Define optimized forward-edges-only format (Phase 3, after Q2 removal of bidirectional redundancy)

```typescript
// Current (before optimization) — Bidirectional edges
interface CurrentDependencyGraph {
  edges: Array<{
    from: string;
    to: string;
    // Also includes reverse: { from: "to", to: "from" } ← REDUNDANT
  }>;
}

// Optimized (after Phase 3) — Forward edges only
interface OptimizedDependencyGraph {
  edges: Array<{
    from: string;
    to: string;
    // Reverse edges computed on-demand from ai-runtime-dependents.json
  }>;

  // Metadata
  generationTime: number; // ms to generate
  edgeCount: number; // Total forward edges
  moduleCount: number; // Total modules

  // Optimization notes
  format: "forward-edges-only";
  reverseGraphLocation: "ai-runtime-dependents.json";
  reverseDependencyTime: "computed on-demand"; // From forward edges
}

// Runtime Dependents Graph (NEW)
interface RuntimeDependentsGraph {
  // This is the reverse graph: computed from forward edges
  dependents: Record<string, string[]>; // module → modules that depend on it

  // Example:
  // {
  //   "packages/types": ["packages/domain-core", "packages/api-client"],
  //   "packages/domain-core": ["packages/api-client", "apps/api"],
  //   ...
  // }

  format: "reverse-adjacency-list";
  generatedFrom: "ai-dependency-graph.json";
  generation: "computed on-demand from forward edges";
}

// Savings calculation:
// Before: 480 KB (both forward + reverse edges)
// After:
//   - Forward edges: 240 KB (50% of original)
//   - Reverse graph: 198 KB (computed)
//   - Net size: 440 KB (against original 680 KB total)
//   - Compression: Better (no redundancy)
```

---

## Summary of Data Structures

| Structure                    | Purpose                                | Phase | Size Impact                         |
| ---------------------------- | -------------------------------------- | ----- | ----------------------------------- |
| **CacheEntry**               | Cache validation & management          | 3     | Enables 65% speedup                 |
| **ModuleRoster**             | Fast module lookup (skip fs scan)      | 2     | 40-60% speedup for infra-audit      |
| **PerformanceMetric**        | Individual metric tracking             | 7     | Monitoring infrastructure           |
| **PerformanceSnapshot**      | Full metrics snapshot at point-in-time | 7     | Health report foundation            |
| **ArtifactValidationResult** | Artifact integrity checking            | 8     | Ensures freshness                   |
| **MetricTrend**              | Trend analysis & projections           | 7     | Identify regressions                |
| **HealthReport**             | Comprehensive repository health        | 7     | Auto-generated post-CI              |
| **CacheStrategy**            | GitHub Actions cache contract          | 4     | 15-20% CI speedup                   |
| **OptimizedDependencyGraph** | Forward-edges-only format              | 3     | 30-40% artifact size reduction      |
| **RuntimeDependentsGraph**   | Reverse graph (computed)               | 3     | Eliminates bidirectional redundancy |

---

_Data model created: 2026-03-14_  
_Purpose: Define all data structures for INFRA-17 optimization_  
_Status: Ready for Phase 1-8 implementation_

# GitHub Actions Cache Action Contract

**Purpose:** Define the cache strategy for GitHub Actions workflow acceleration  
**Phase:** 4 (CI Pipeline Optimization)  
**Clarification:** Q1 (GitHub Actions cache action with workflow context)

---

## Cache Configuration Contract

```yaml
# Contract: GitHub Actions cache action configuration
# Implementation: .github/workflows/ci.yml (cache@v3 action)

Cache Action Contract:
  Version: 3
  Provider: GitHub Actions

  # Identification
  Action: actions/cache@v3
  CacheBackend:
    Type: GitHub Actions built-in cache
    StorageScope: Repository-level
    Retention: 7 days (GitHub default)
    SizeLimit: 5 GB per repository

  # Cache Keys
  PrimaryKey: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
  RestoreKeys:
    - ${{ runner.os }}-bun-

  # Rationale for key strategy:
  # - hashFiles('**/bun.lock') invalidates cache when dependencies change
  # - runner.os ensures OS-specific binaries not shared
  # - Fallback key allows partial restore if exact match not found

  # Cached Paths
  Paths:
    - ~/.bun/install/cache
    - node_modules/.cache

  # Why these paths:
  # - ~/.bun/install/cache: Bun's package download cache (not rebuilt)
  # - node_modules/.cache: Tool-specific caches (ESLint, TypeScript, etc.)

  # Cache Invalidation Strategy
  Invalidation:
    Trigger: Deterministic
    ViaFileChange: bun.lock
    Condition: If any hash in bun.lock changes → new primary key → cache miss
    Fallback: Existing older caches with same OS still available
    Recovery: Fresh install on cache miss (normal flow)

  # Cache Hit Scenario
  CacheHit:
    Condition: bun.lock unchanged since last CI run
    Outcome: Cache restored; no package re-download
    TimeSavings: 30-60 seconds per job (3-6 minutes total for 3 parallel jobs)

  # Cache Miss Scenario
  CacheMiss:
    Condition: bun.lock changed or cache expired (>7 days)
    Outcome: Fresh install of packages from bun.lock
    TimeSavings: None (full install required)
    CacheStorage: New cache created for future runs
```

---

## Validation Requirements

```typescript
// Validation contract: Cache action must satisfy these requirements

interface CacheActionValidation {
  // Pre-execution checks
  preExecution: {
    bunLockExists: boolean; // bun.lock must exist
    runnerOs: "linux" | "macos" | "windows"; // OS-specific
    cachePaths: { path: string; exists: boolean }[]; // Paths are valid
  };

  // Post-execution checks (after cache restore)
  postRestore: {
    cacheHit: boolean; // Did cache hit or miss?
    restoredSize: number; // How much data restored (bytes)
    restoreTimeMs: number; // How long to restore
    bunInstallRequired: boolean; // Still need to run `bun install`?
  };

  // Performance validation
  performance: {
    estimatedTimeSaving: number; // ms saved by hitting cache
    expectedRestoreTimeMs: number; // Typical restore duration
    minTimeSaving: number; // At least this much saved
    maxTimeSaving: number; // At most this much saved
  };

  // Correctness validation
  correctness: {
    binariesMatch: boolean; // Restored binaries match current bun.lock
    noCorruptedCache: boolean; // Cache integrity verified
    noStaleLockfile: boolean; // Lock file current with CI commit
  };
}
```

---

## Integration Points

```yaml
# Where cache action integrates in CI workflow

Workflow Integration:
  Stage: Setup (first job after checkout)

  Dependencies:
    - actions/checkout (must run first)
    - oven-sh/setup-bun (setup Bun before caching)

  Consumers:
    - Lint job (uses cached bun modules)
    - Type check job (uses cached TypeScript)
    - Test job (uses cached dependencies)
    - Architecture checks (uses cached utilities)

  Order: 1. Checkout code
    2. Setup Bun runtime
    3. Restore cache (this action)
    4. Run `bun install` (if cache miss)
    5. Run actual CI job

# Example: How jobs reference the cache
jobs:
  code-quality:
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - uses: actions/cache@v3 # ← This contract
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
          restore-keys: ${{ runner.os }}-bun-

      - run: bun install # Quick if cache hit; full if miss
      - run: bun biome check # Uses restored modules
```

---

## Performance Metrics

```typescript
// Expected performance impact of caching

interface CachePerformanceContract {
  // Cache hit scenario (typical)
  cacheHit: {
    restoreTimeMs: 15000; // ~15 seconds to restore
    installTimeMs: 5000; // ~5 seconds for `bun install` validation
    totalSavings: 45000; // ~45 seconds saved (vs 60s fresh install)
    perJob: 45000; // Savings per job
    parallelJobs: 3; // 3 parallel jobs
    totalSavingsPerRun: 180000; // ~3 minutes total
  };

  // Cache miss scenario (less frequent)
  cacheMiss: {
    downloadTimeMs: 60000; // ~60 seconds fresh download
    installTimeMs: 30000; // ~30 seconds install
    totalTimeMs: 90000; // Total time when no cache
    cacheCreationTimeMs: 10000; // Store new cache for future
  };

  // Overall impact (assuming 70% cache hit rate)
  overall: {
    avgTimeSavingPerRun: 130000; // ~2 min savings per CI run
    runsPerMonth: 30; // Estimated
    totalTimeSavingPerMonth: 3900000; // ~65 hours/month
    frequencyOfPushes: 30; // 30 pushes/month (12 tests during weeks, etc)
    estimatedMonthlyTimeSavings: "~1-2 hours developer time";
  };
}
```

---

## Failure Modes & Recovery

```yaml
# How cache action fails and how to recover

Failure Modes:

  1. Cache Corruption
     Symptoms: CI fails after cache restore; binaries corrupted
     Detection: Binary checksums mismatch
     Recovery: GitHub Actions auto-invalidates; fresh install on next push
     Prevention: GitHub Actions validates cache integrity automatically

  2. Cache Staleness
     Symptoms: Old bun.lock used; dependencies not updated
     Detection: Resolved dependencies don't match current bun.lock
     Recovery: Manual cache clear via GitHub UI; next push uses fresh
     Prevention: bun.lock hash in key triggers new cache on changes

  3. Disk Space Exhaustion
     Symptoms: Cache action fails to store (5 GB repo limit hit)
     Detection: Action error "Cache size exceeded"
     Recovery: GitHub auto-evicts oldest caches; next push tries again
     Prevention: Monitor cache size; older caches auto-expire after 7 days

  4. Race Condition (Multiple Concurrent Pushes)
     Symptoms: Multiple cache writes from parallel runs
     Detection: Unpredictable cache content
     Recovery: GitHub Actions uses lock mechanism to prevent conflicts
     Prevention: Built into cache action (no action needed)
```

---

## Compliance & Standards

```yaml
# Standardization contract

Compliance:
  Standard: "GitHub Actions cache@v3 API"
  Compatibility: "GitHub Actions runner (ubuntu-latest)"
  SecurityModel: "Repository-level secrets allowed; no cross-repo access"
  DataHandling: "Cache data encrypted at rest; HTTPS in transit"

Auditability:
  LoggingLevel: "Cache hit/miss logged in action output"
  MetricsExported: "Cache hit ratio visible in GitHub Actions UI"
  Retention: "7-day default; configurable up to 30 days"

BestPractices:
  KeyStrategy: "Minimal (only dependency hash + OS)"
  PathStrategy: "Specific paths only (not entire directories)"
  SizeManagement: "Monitor cache size growth monthly"
  InvalidationTesting: "Test cache behavior on dependency updates"
```

---

## Implementation Checklist (Phase 4)

```markdown
# Cache Action Implementation Checklist

## Setup (Day 1)

- [ ] Add cache@v3 action to .github/workflows/ci.yml
- [ ] Configure primary key: runner.os + hashFiles('\*\*/bun.lock')
- [ ] Configure fallback key: runner.os + bun-
- [ ] Configure cached paths: ~/.bun/install/cache, node_modules/.cache
- [ ] Test on feature branch: verify cache hit/miss detection

## Validation (Day 2)

- [ ] Run CI with fresh cache: measure full install time
- [ ] Run CI again: measure cache-hit time (should save ~45s per job)
- [ ] Modify bun.lock: verify cache invalidated correctly
- [ ] Check cache size: ensure <5GB repository limit

## Monitoring (Day 3+)

- [ ] Monitor cache hit rate (target: >80%)
- [ ] Log cache effectiveness over time
- [ ] Alert if cache hit rate drops below 60%
- [ ] Verify estimated 3-6 minute savings per run

## Documentation (Day 3)

- [ ] Document cache strategy in CONTRIBUTING.md
- [ ] Add troubleshooting guide for cache issues
- [ ] Document manual cache clear procedure (if needed)
```

---

**Contract Status:** READY FOR PHASE 4 IMPLEMENTATION

_Created: 2026-03-14_

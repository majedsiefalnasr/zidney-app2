# AI Context Artifact Caching Strategy

## Overview

Phase 3 implements selective caching for expensive artifact generation (Q2 strategy).

## Artifacts Strategy

Only cache the two most expensive artifacts:

- `dependency-graph`: 2.5s generation time → <500ms with cache (80% improvement)
- `runtime-dependents`: 2s generation time → <400ms with cache (80% improvement)

Don't cache:

- `ai-context-mini.json`: <100ms generation (too cheap to cache)
- `ai-module-map.json`: <200ms generation
- `ai-architecture-brain.json`: composite artifact, regenerated from graph
- Other small artifacts: overhead of cache validation exceeds generation time

## Cache Key Strategy

Use multi-level hashing to detect changes:

### Primary Hash (Full Invalidation)

Inputs: All package.json files in packages/ and apps/, plus core config files

- If any module's package.json changes → cache invalidates
- If TypeScript config changes → cache invalidates
- If bun.lock changes → cache invalidates

### Hash Format

`ai-context-cache-{SHA256(files)}`

Example: `ai-context-cache-a1b2c3d4e5f6...`

## Cache Behavior

### Cold Run (First execution after branch creation)

1. No cache found for this hash
2. Generate all artifacts from scratch
3. Save generated artifacts to cache
4. Duration: 5-8 seconds

### Warm Run (Subsequent execution, same hash)

1. Cache found for this hash
2. Load dependency-graph and runtime-dependents from cache
3. Regenerate only non-cached artifacts (mini, brain, etc.)
4. Duration: <2 seconds (70% improvement)

### Cache Invalidation (Source files changed)

1. package.json modified → new hash generated
2. Old cache key no longer matches
3. Generate all artifacts from scratch
4. Save to new cache entry
5. Old cache gradually expires after 7 days (platform default)

## Expected Metrics

### Before (Phase 2)

- Cold build: 5-8 seconds
- Warm build: 5-8 seconds (no cache)
- Total CI time: 12-18 minutes

### After (Phase 3)

- Cold build: 5-8 seconds (first time, no cache)
- Warm build: <2 seconds (70% improvement)
- Total CI time: <8 minutes (25-35% reduction)

### Cache Hit Ratio

- Expected: >80% in dev branches
- This assumes developers don't frequently change module dependencies
- If modules change, cache invalidates (correct behavior)

## Operational Notes

1. **Cache storage:** GitHub provides 5GB free cache per repository
   - AI context artifacts: ~100KB total
   - Expected cache usage: <1MB
2. **Cache expiry:** GitHub deletes unused cache after 7 days
   - Not an issue since we regenerate on each build
   - Old caches naturally expire

3. **Cache sharing:** Cache is per-branch by default
   - main branch cache: used by main CI runs
   - feature branches: accumulate own caches
   - Setting `restore-keys` allows fallback to main cache

4. **Local Development:**
   - Cache is stored in `docs/ai/context/.cache/`
   - Developers can delete to force regeneration
   - Cache persists across local runs (no 7-day expiration)

## CI Integration Checklist

- [x] T068: Cache configuration documented
- [ ] T069: Add cache restore step to ci.yml
- [ ] T070: Add cache invalidation pattern documentation
- [ ] T071: Test cache effectiveness in CI

## Related Tasks

- T060: Implement cache in dependency-graph-generator
- T061: Implement cache in runtime-dependents-generator
- T062: File hash-based invalidation in cache-manager
- T063: Validate >80% cache hit ratio

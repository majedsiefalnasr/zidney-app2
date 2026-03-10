# Research: Incremental Architecture Guard

**Stage:** STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD  
**Status:** Complete — all clarifications resolved

---

## 1. How `ai-dependency-graph.json` Is Currently Populated

### Generation Source

`scripts/infra-audit.ts` (2033 lines) is the sole authorized generator of `docs/ai/context/ai-dependency-graph.json`. It performs a full repository scan: reading all TypeScript/Vue source files, extracting import statements, and constructing a dependency graph. The graph is written as a side-effect of a full audit run.

### Current Schema (v1)

Inspection of the live file reveals the current format:

```json
{
  "nodes": [
    "packages/job-queue",
    "packages/logger",
    ...
  ],
  "edges": [
    { "from": "packages/job-queue", "to": "packages/logger" },
    { "from": "packages/domain-core", "to": "packages/logger" },
    ...duplicate edges present...
  ]
}
```

**Key observations:**

1. **Schema v1 has no `schema_version` field.** The incremental guard must treat absent/mismatched version as stale and trigger regeneration.
2. **Duplicate edges exist.** The current generator writes one edge per import statement — if `packages/domain-core` has 10 files each importing `packages/logger`, it writes 10 `{from: domain-core, to: logger}` edges. The v2 schema must deduplicate by `from|to` key.
3. **No `reverse_dependencies` map exists.** This reverse adjacency is needed for impact scope computation and must be computed and stored in schema v2.
4. **No `generated_at` timestamp.** Cache freshness cannot be checked without it.

### What the `--generate-graph` Flag Must Do

The new flag must:

1. Load `ARCHITECTURE_MAP.json` to get the authoritative list of module paths
2. For each module, recursively enumerate `.ts`, `.tsx`, `.vue` source files (excluding test files and `node_modules`)
3. Extract import declarations for each file
4. Resolve each import to a module key using the same prefix-matching algorithm
5. Build a deduplicated edge set
6. Invert edges to build `reverse_dependencies`
7. Write schema v2 with `generated_at: new Date().toISOString()`

**Fast-path constraint:** This must NOT run the full `infra-audit.ts` report pipeline (which generates `ai-architecture-brain.json`, `ai-module-map.json`, etc.). It only writes `ai-dependency-graph.json`. Target runtime: <500ms.

---

## 2. `ARCHITECTURE_MAP.json` — Module Registry Structure

### Actual Structure (verified)

The file at `docs/architecture/intelligence/ARCHITECTURE_MAP.json` uses this structure:

```json
{
  "system": "Zidney",
  "architecture_model": "layered-monorepo",
  "version": "1.0",
  "layers": ["domain", "infrastructure", "runtime", "ui"],
  "modules": {
    "packages/types":      { "layer": "domain", ... },
    "packages/logger":     { "layer": "infrastructure", ... },
    "packages/config":     { "layer": "infrastructure", ... },
    "packages/redis-utils":{ "layer": "infrastructure", ... },
    "packages/ui-system":  { "layer": "ui", ... },
    "packages/api-client": { "layer": "infrastructure", ... },
    "packages/domain-core":{ "layer": "domain", ... },
    "packages/validation": { "layer": "domain", ... },
    "packages/job-queue":  { "layer": "infrastructure", ... },
    "apps/mmc":            { "layer": "ui", ... },
    "apps/frontoffice":    { "layer": "ui", ... },
    "apps/backoffice":     { "layer": "ui", ... },
    "apps/api":            { "layer": "runtime", ... },
    "apps/worker":         { "layer": "runtime", ... }
  }
}
```

**Total: 13 modules** (9 packages + 4 apps + 1 more = 5 apps actually: mmc, frontoffice, backoffice, api, worker).

### Key for Implementation

- Module paths are the **keys** of the `modules` object: `Object.keys(archMap.modules)`
- Format: always `apps/<name>` or `packages/<name>` — two-segment paths
- No trailing slash

---

## 3. Git Diff Strategies

### Pre-Commit Context: Staging Index

```bash
git diff --cached --name-only --diff-filter=ACM
```

**Why `--cached` (not `HEAD`):** Before `git commit` completes, `HEAD` still points to the previous commit. The staging index (also called the "index" or "stage") contains files added via `git add`. Using `--cached` reads the index against `HEAD`, giving exactly the set of files about to be committed.

**Why `--diff-filter=ACM`:**

- `A` = Added (new files) — can introduce violations
- `C` = Copied — destination file can introduce violations
- `M` = Modified — modified files can introduce violations
- Excluded: `D` (Deleted) — cannot introduce new architecture violations; `R` (Renamed) — covered by the new name appearing as `A`

**Why NOT `HEAD~1..HEAD`:** The commit doesn't exist yet at pre-commit time. This command would fail or reference the wrong commit.

### Pre-Push / CI Context: Merge-Base

```bash
git diff --name-only "$(git merge-base HEAD main)"..HEAD
```

This gives all files changed across the entire branch, from the point it forked from `main`. Used to provide `STAGED_FILES` for the pre-push full-scan invocation if needed. In CI, the `--full` flag bypasses file detection entirely.

### Empty Staged Files

When `git commit --allow-empty` is used, or when only deleted files are staged, `--diff-filter=ACM` returns an empty list. The hook must exit 0 immediately without spawning the TypeScript process.

### Merge Commits

During `git merge`, the pre-commit hook runs with the merge resolution in the staging index. `git diff --cached --name-only --diff-filter=ACM` correctly returns the files changed in the merge resolution. No special handling needed.

---

## 4. Module Path Prefix Matching Algorithm

### Problem Statement

Map a file path like `apps/api/src/routes/users/list.ts` to the module key `apps/api`.

### Algorithm: Longest-Prefix Match

```typescript
function findModuleForFile(filePath: string, moduleKeys: string[]): string | null {
  let best: string | null = null;
  let bestLen = 0;

  for (const key of moduleKeys) {
    // Module key "apps/api" matches file "apps/api/src/..." but not "apps/api-client/..."
    if (filePath.startsWith(key + "/") || filePath === key) {
      if (key.length > bestLen) {
        best = key;
        bestLen = key.length;
      }
    }
  }

  return best;
}
```

**Why longest-prefix?** Not actually needed for 2-segment module paths (`apps/X`, `packages/X`), since no two module keys can be a prefix of each other given the structure. However, the algorithm is written to be safe for future modules with nested paths (e.g. `apps/api/v2`). Adding the `+ '/'` guard prevents `apps/api` from matching `apps/api-client/...`.

**Performance:** O(n × m) where n = number of files (typically 1–10 in a commit), m = 13 modules. For 50 files: 50 × 13 = 650 string comparisons, each a `startsWith` call. Well within <10ms target.

---

## 5. Graph Traversal Algorithm for Transitive Impact Scope

### Problem Statement

Given changed modules, find all modules that would be affected by the change — including modules that transitively depend on the changed module.

**Direction:** We traverse **reverse** dependencies (dependents, not dependencies). If `packages/logger` changes, we need to revalidate `apps/api` (which imports logger), `packages/job-queue` (which imports logger), etc.

### BFS Algorithm

```typescript
function computeImpactScope(
  directlyChanged: Set<string>,
  reverseMap: Record<string, string[]>,
): Set<string> {
  const scope = new Set(directlyChanged);
  const queue = [...directlyChanged];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = reverseMap[current] ?? [];
    for (const dep of dependents) {
      if (!scope.has(dep)) {
        scope.add(dep);
        queue.push(dep); // Explore transitively
      }
    }
  }

  return scope;
}
```

**Why BFS over DFS?** BFS processes level-by-level, naturally producing the "closest dependents first" ordering which matches how impact reports are most useful to read. Both are O(V + E) and equivalent for correctness.

**Performance:** 13 nodes, max 13×12 = 156 directed edges. BFS terminates in <1ms. Well within <20ms target.

**Cycle safety:** The `scope.has(dep)` check before `queue.push` prevents infinite loops even if the dependency graph contains cycles (circular dependencies). The BFS terminates correctly.

### Example Traversal

Reverse dependencies for the existing graph:

```
packages/logger is imported by:
  packages/job-queue
  packages/redis-utils
  packages/domain-core
  apps/api
  apps/worker
  apps/backoffice
  ...

packages/types is imported by:
  packages/domain-core
  ...
```

If `packages/logger` is changed → scope expands to all modules that import it (transitively).

---

## 6. Cache Freshness Detection

### File Modification Time

```typescript
import { statSync } from "node:fs";

function isGraphStale(graphPath: string, maxAgeHours: number): boolean {
  try {
    const stat = statSync(graphPath);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs > maxAgeHours * 3_600_000;
  } catch {
    return true; // Missing file = stale
  }
}
```

`stat.mtimeMs` is the last modification time in milliseconds since Unix epoch. Available in Node.js / Bun without any additional imports.

**Why `mtime` over `generated_at` inside the file?**

- `mtime` requires no file parse — can check staleness before parsing
- `generated_at` is the authoritative value once the file is parsed
- Implementation uses both: `mtime` for a fast pre-check, `generated_at` for authoritative freshness verification after parse

### Configuration

`ARCH_GRAPH_MAX_AGE_HOURS` environment variable:

```typescript
const maxAgeHours = Number(process.env.ARCH_GRAPH_MAX_AGE_HOURS ?? "24");
```

Default: 24 hours. Override examples:

```bash
# Longer TTL for stable repos
ARCH_GRAPH_MAX_AGE_HOURS=168 bun scripts/ai-guard.ts --incremental  # 1 week

# Force freshness check every commit
ARCH_GRAPH_MAX_AGE_HOURS=0 bun scripts/ai-guard.ts --incremental
```

When `ARCH_GRAPH_MAX_AGE_HOURS=0`, the graph is always considered stale, causing a regeneration on every incremental run. Useful in CI environments that want to guarantee graph freshness without explicit `--generate-graph` calls.

### Schema Version Check

After loading and parsing:

```typescript
if (graph.schema_version !== EXPECTED_SCHEMA_VERSION) {
  return null; // Treat as missing — triggers regeneration
}
```

`EXPECTED_SCHEMA_VERSION = 2`. If v1 graph exists (missing version field), this returns null and triggers transparent regeneration.

---

## 7. Environment Variable Passing: Shell Hooks → TypeScript Scripts

### Pattern Used

```sh
# .husky/pre-commit
STAGED_FILES="$STAGED_FILES" bun scripts/ai-guard.ts --incremental
```

This uses the `KEY=VALUE command` shell syntax which sets `KEY` as an environment variable only for the duration of `command` execution. The value of `STAGED_FILES` is already set earlier in the hook via:

```sh
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | tr '\n' '\n')
```

(Note: `tr '\n' '\n'` is a pass-through — the newlines are preserved for splitting in TypeScript.)

### Consuming in TypeScript

```typescript
const stagedFiles = (process.env.STAGED_FILES ?? "")
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean);
```

**Security note:** The `STAGED_FILES` value is file paths from the local git repository. No sanitization is required for path-prefix matching. The paths are never passed to `execSync` or `eval`. Module mapping is purely string comparison operations.

### Alternative Considered: `--modules` flag via shell

Another approach would be to compute module mapping entirely in shell and pass the result as `--modules apps/mmc,packages/api`. This was rejected because:

1. Shell module-mapping logic would be complex and fragile
2. TypeScript implementation is easier to test
3. Impact scope (BFS traversal) cannot reasonably be implemented in shell
4. The env var approach keeps the shell hook minimal

### Size Constraints

In typical commits, `STAGED_FILES` contains 1–20 file paths each ~50 characters. Total env var size: ~1KB. Well within shell/OS limits (typically 256KB per variable on macOS/Linux).

---

## 8. Key Implementation Decisions Summary

| Decision                      | Choice                                   | Rationale                                                      |
| ----------------------------- | ---------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Incremental trigger mechanism | Env var `STAGED_FILES`                   | Simple, testable, no shell complexity                          |
| Graph format                  | v2 JSON with deduplication + reverse map | Enables O(1) reverse lookup in TypeScript                      |
| Cache check                   | `mtime` + `schema_version`               | Fast pre-check before full parse                               |
| Traversal algorithm           | BFS                                      | Natural level order, cycle-safe, O(V+E)                        |
| Fallback scope                | All `ARCHITECTURE_MAP.json` modules      | Identical to CI — no partial fallback                          |
| Edge deduplication            | `Set<"from                               | to">`                                                          | Simple, correct, avoids duplicate reverse entries |
| Pre-commit parallelism        | Removed (sequential)                     | Incremental guard is fast enough; sequential output is clearer |
| New-module detection          | Disk scan vs ARCHITECTURE_MAP keys       | Detects undeclared modules without false positives on docs/    |

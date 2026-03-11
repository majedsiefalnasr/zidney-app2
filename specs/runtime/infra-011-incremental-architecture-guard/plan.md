# Implementation Plan: Incremental Architecture Guard

**Stage:** STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD  
**Phase:** 01_PLATFORM_FOUNDATION  
**Feature ID:** infra-011-incremental-architecture-guard  
**Status:** IN PROGRESS  
**Planned:** 2026-03-10

---

## Technical Context

| Item                             | Value                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Changed files                    | `scripts/ai-guard.ts`, `scripts/infra-audit.ts`, `.husky/pre-commit`, `.husky/pre-push`, `docs/ai/context/ai-dependency-graph.json` (schema extension) |
| New packages                     | None                                                                                                                                                   |
| New apps                         | None                                                                                                                                                   |
| New modules                      | None                                                                                                                                                   |
| External dependencies introduced | None                                                                                                                                                   |
| Architecture map changes         | None (read-only)                                                                                                                                       |

---

## Constitution Check

| Rule                         | Status  | Notes                                        |
| ---------------------------- | ------- | -------------------------------------------- |
| No cross-tenant access       | ✅ PASS | Scripts layer only; no DB access             |
| License middleware unchanged | ✅ PASS | N/A — governance scripts                     |
| No attempt engine changes    | ✅ PASS | N/A                                          |
| No global DB singleton       | ✅ PASS | N/A                                          |
| Layer boundaries respected   | ✅ PASS | Changes are in `scripts/` and `.husky/` only |
| Import boundary rules        | ✅ PASS | No new cross-module imports                  |
| Backward compatibility       | ✅ PASS | Existing invocations unchanged               |

**Verdict: PASS — no constitutional violations.**

---

## Gate Evaluation

| Gate                              | Result |
| --------------------------------- | ------ |
| No new modules required           | PASS   |
| No DB migrations required         | PASS   |
| No license middleware affected    | PASS   |
| No cross-tenant logic             | PASS   |
| Backward compatibility guaranteed | PASS   |

---

## Phase 0: Research Summary

All clarifications resolved. See `research.md` for full findings.

| Unknown                  | Resolution                                                                    |
| ------------------------ | ----------------------------------------------------------------------------- |
| Pre-commit diff strategy | `git diff --cached --name-only --diff-filter=ACM` (staged index)              |
| Cache TTL configuration  | `ARCH_GRAPH_MAX_AGE_HOURS` env var, default 24h                               |
| Unmapped file handling   | Silent skip + `skipped_unmapped_files` counter in impact report               |
| Full fallback scope      | All modules from `ARCHITECTURE_MAP.json` — identical to CI full scan          |
| Empty commit handling    | `exit 0` immediately — no validation, no report                               |
| Merge commit baseline    | `git merge-base HEAD main`                                                    |
| Graph schema extension   | Add `generated_at`, `schema_version`, `reverse_dependencies` to existing JSON |

---

## Phase 1: Design & Contracts

### 1.1 Five-Step Incremental Pipeline

```
staged files → module mapping → impact scope → incremental guard → [fallback?]
```

#### Step 1: `get_staged_files()`

**Context:** Pre-commit only (staging index).  
**Command:**

```bash
git diff --cached --name-only --diff-filter=ACM
```

- `--diff-filter=ACM` = Added, Copied, Modified. Excludes Deleted (D) and Renamed (R) — deleted files cannot introduce new violations; renamed files are covered by the new name via the Added filter.
- Empty result → `exit 0` immediately. No validation. No impact report written.
- Result is passed to the TypeScript script via the `STAGED_FILES` environment variable (newline-separated list).

**Pre-push / CI Context (different!):**

```bash
git diff --name-only "$(git merge-base HEAD main)"..HEAD
```

This covers all commits on the current branch since it diverged from `main`. Used by the pre-push hook to provide `STAGED_FILES` to a full-scan invocation, if desired. In CI, the `--full` flag bypasses staged file detection entirely — it always scans all modules.

#### Step 2: `map_to_modules(files, ARCHITECTURE_MAP)`

**Input:** Array of file paths from step 1.  
**Output:** Deduplicated set of module identifiers (e.g. `apps/api`, `packages/logger`).

**Algorithm (longest-prefix match):**

```typescript
function mapToModules(
  files: string[],
  moduleKeys: string[], // keys from ARCHITECTURE_MAP.modules
): { modules: Set<string>; skipped: string[] } {
  const modules = new Set<string>();
  const skipped: string[] = [];

  for (const file of files) {
    // Find longest matching module prefix
    let best: string | null = null;
    for (const key of moduleKeys) {
      if (file.startsWith(key + "/") || file === key) {
        if (best === null || key.length > best.length) {
          best = key;
        }
      }
    }
    if (best) {
      modules.add(best);
    } else {
      skipped.push(file);
    }
  }

  return { modules, skipped };
}
```

**Unmapped files:** Any file whose path is not prefixed by a known module path (e.g. `docs/`, `.github/`, `scripts/`, `.husky/`) is **silently skipped**. The `skipped` list is included in the impact report as `skipped_unmapped_files`. This does NOT trigger a fallback — unmapped files are governance tooling, not architecture modules.

**New-module fallback trigger (separate check):**

```typescript
// After module mapping, check if any apps/* or packages/* top-level dir
// exists on disk but is absent from ARCHITECTURE_MAP
function detectNewModules(moduleKeys: string[]): boolean {
  const dirsOnDisk = [
    ...readdirSync("apps").map((d) => `apps/${d}`),
    ...readdirSync("packages").map((d) => `packages/${d}`),
  ].filter((d) => statSync(d).isDirectory());

  return dirsOnDisk.some((dir) => !moduleKeys.includes(dir));
}
```

#### Step 3: `compute_impact_scope(affected_modules, graph)`

**Input:** Set of directly changed modules.  
**Output:** Expanded set = changed modules ∪ all modules that transitively depend on them.

**Why reverse dependencies?** If `packages/logger` changes, `apps/api` imports from it. `apps/api` could now have a broken import. We must re-validate `apps/api` too.

**Algorithm (BFS over reverse adjacency):**

```typescript
function computeImpactScope(changed: Set<string>, graph: DependencyGraph): Set<string> {
  const scope = new Set(changed);
  const queue = [...changed];

  while (queue.length > 0) {
    const module = queue.shift()!;
    const dependents = graph.reverse_dependencies[module] ?? [];
    for (const dep of dependents) {
      if (!scope.has(dep)) {
        scope.add(dep);
        queue.push(dep);
      }
    }
  }

  return scope;
}
```

**Full-scope check:** If `scope.size === all modules count`, skip incremental — fall through to full validation (same result, avoids overhead of per-module routing).

#### Step 4: `run_guard_incremental(scope)`

**New CLI flags added to `scripts/ai-guard.ts`:**

| Flag              | Behavior                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `--incremental`   | Enable incremental mode. Reads `STAGED_FILES` env var to detect changed files, maps to modules, computes scope, validates scope only.         |
| `--full`          | Explicit full scan. Validates all modules in `ARCHITECTURE_MAP.json`.                                                                         |
| `--modules <csv>` | Override scope explicitly. Comma-separated list of module paths. Used by incremental mode internally; also callable standalone for debugging. |
| _(no flags)_      | Existing behavior (full scan) — unchanged for backward compatibility.                                                                         |

**Invocation examples:**

```bash
# Pre-commit hook (new)
STAGED_FILES="apps/mmc/src/foo.ts" bun scripts/ai-guard.ts --incremental

# Explicit module override (debug)
bun scripts/ai-guard.ts --incremental --modules apps/mmc,packages/ui-system

# Force full (pre-push, CI)
bun scripts/ai-guard.ts --full

# Legacy (unchanged)
bun scripts/ai-guard.ts
```

**Validation checks performed per module (same as full scan):**

- Forbidden dependency check (via `ARCHITECTURE_MAP.json`)
- Layer violation check (via `module-boundaries.json`)
- Cross-app import check
- Relative architecture leak check
- Architecture contract compliance check

#### Step 5: `fallback_to_full()`

Triggered before running step 4 if any of these conditions hold:

| Condition                                | Detection                                               | Action                                                                                                |
| ---------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE_MAP.json` staged           | `stagedFiles.some(f => f.includes('ARCHITECTURE_MAP'))` | Full scan with `fallback_reason: "map_changed"`                                                       |
| Dependency graph missing                 | `loadDependencyGraph().reason === "missing"`            | Regenerate graph with `--generate-graph`, then full scan with `fallback_reason: "graph_missing"`      |
| Dependency graph stale                   | `loadDependencyGraph().reason === "stale"`              | Full scan with `fallback_reason: "graph_stale"` — no regeneration                                     |
| Dependency graph schema version mismatch | `loadDependencyGraph().reason === "schema_mismatch"`    | Full scan with `fallback_reason: "graph_unusable"` — no regeneration                                  |
| Dependency graph corrupt (invalid JSON)  | `loadDependencyGraph().reason === "corrupt"`            | Full scan with `fallback_reason: "graph_unusable"` — no regeneration                                  |
| New module on disk not in map            | `detectNewModules()` returns true                       | Full scan with `fallback_reason: "new_module_detected"` (warn user to run `infra-audit.ts --fix-map`) |
| Scope = all modules                      | `scope.size >= allModules.length`                       | Full scan with `fallback_reason: "full_scope"` (no efficiency gain from incremental routing)          |

**Graph regeneration:**

```bash
bun scripts/infra-audit.ts --generate-graph
```

This is a fast-path flag added to `infra-audit.ts` that recomputes only the dependency graph and writes `ai-dependency-graph.json`, without running the full audit report.

---

### 1.2 Changes to `scripts/ai-guard.ts`

#### New: CLI Argument Parsing

```typescript
interface GuardConfig {
  mode: "full" | "incremental";
  explicitModules: string[] | null; // from --modules flag
  outputJson: boolean; // from --output json
}

function parseArgs(): GuardConfig {
  const args = process.argv.slice(2);
  const mode = args.includes("--incremental")
    ? "incremental"
    : args.includes("--full")
      ? "full"
      : "full"; // default = full (backward compat)

  const modulesIdx = args.indexOf("--modules");
  const explicitModules =
    modulesIdx >= 0
      ? (args[modulesIdx + 1]
          ?.split(",")
          .map((m) => m.trim())
          .filter(Boolean) ?? null)
      : null;

  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";

  return { mode, explicitModules, outputJson };
}
```

#### New: Graph Cache Loading

```typescript
const GRAPH_PATH = "docs/ai/context/ai-dependency-graph.json";
const EXPECTED_SCHEMA_VERSION = "2"; // string — matches SchemaVersion type in packages/types/src/ai-context.ts
const DEFAULT_MAX_AGE_HOURS = 24;

function loadDependencyGraph(): GraphLoadResult {
  if (!existsSync(GRAPH_PATH)) return { graph: null, reason: "missing" };

  try {
    const raw = readFileSync(GRAPH_PATH, "utf-8");
    const graph = JSON.parse(raw) as AIDependencyGraph;

    if (graph.schema_version !== EXPECTED_SCHEMA_VERSION) {
      return { graph: null, reason: "schema_mismatch" };
    }

    const maxAgeHours = Number(process.env.ARCH_GRAPH_MAX_AGE_HOURS ?? DEFAULT_MAX_AGE_HOURS);
    const ageMs = Date.now() - new Date(graph.generated_at).getTime();
    if (ageMs > maxAgeHours * 3_600_000) return { graph: null, reason: "stale" };

    return { graph };
  } catch {
    return { graph: null, reason: "corrupt" };
  }
}
```

#### New: Incremental Execution Path

```typescript
async function runIncremental(config: GuardConfig): Promise<ValidationResult> {
  const start = performance.now();

  // Read staged files
  const stagedFiles = (process.env.STAGED_FILES ?? "")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  if (stagedFiles.length === 0) {
    console.log("[ai-guard] No staged files — skipping validation");
    process.exit(0);
  }

  // Load module keys
  const archMap = loadArchitectureMap();
  const moduleKeys = Object.keys(archMap.modules ?? {});

  // Fallback triggers
  const mapChanged = stagedFiles.some((f) => f.includes("ARCHITECTURE_MAP"));
  const newModuleDetected = detectNewModules(moduleKeys);

  if (mapChanged) {
    return runFull({ ...config, mode: "full" }, { fallbackReason: "map_changed" });
  }
  if (newModuleDetected) {
    return runFull({ ...config, mode: "full" }, { fallbackReason: "new_module_detected" });
  }

  // Load dependency graph via discriminated union (T006)
  let loadResult = loadDependencyGraph();

  if (loadResult.graph === null) {
    if (loadResult.reason === "missing") {
      execSync("bun scripts/infra-audit.ts --generate-graph", { stdio: "inherit" });
      const retry = loadDependencyGraph();
      if (retry.graph === null) {
        return runFull({ ...config, mode: "full" }, { fallbackReason: "graph_missing" });
      }
      // Regeneration succeeded — continue incremental validation with regenerated graph
      loadResult = retry;
    } else if (loadResult.reason === "corrupt" || loadResult.reason === "schema_mismatch") {
      // Do NOT regenerate — treat as unusable cache
      return runFull({ ...config, mode: "full" }, { fallbackReason: "graph_unusable" });
    } else if (loadResult.reason === "stale") {
      // Do NOT regenerate inline — time-based staleness falls back to full scan
      return runFull({ ...config, mode: "full" }, { fallbackReason: "graph_stale" });
    }
  }

  const graph = loadResult.graph!;

  // Use explicit modules or compute from staged files
  let scope: Set<string>;
  let skippedFiles: string[] = [];

  if (config.explicitModules) {
    scope = new Set(config.explicitModules);
  } else {
    const mapped = mapToModules(stagedFiles, moduleKeys);
    scope = computeImpactScope(mapped.modules, graph!);
    skippedFiles = mapped.skipped;
  }

  // Scope = everything? Fall through to full
  if (scope.size >= moduleKeys.length) {
    return runFull({ ...config, mode: "full" }, { fallbackReason: "full_scope" });
  }

  // Validate scoped modules
  return validateModules([...scope], { mode: "incremental", skippedFiles, start });
}
```

#### Modified: `main()` Entry Point

```typescript
async function main() {
  const config = parseArgs();

  if (config.mode === "incremental") {
    const result = await runIncremental(config);
    handleResult(result, config);
  } else {
    // mode === 'full' (or no flags — backward compatible)
    const result = await runFull(config, {});
    handleResult(result, config);
  }
}
```

---

### 1.3 Changes to `scripts/infra-audit.ts`

#### New: `--generate-graph` Flag

Adds a fast-path that:

1. Scans all modules listed in `ARCHITECTURE_MAP.json`
2. Extracts import declarations from each module's source files
3. Builds the `modules` object map (deduplicates dependency entries per module using a `Set<string>`)
4. Computes `reverse_dependencies` as an inverted adjacency list
5. Writes the result to `docs/ai/context/ai-dependency-graph.json` with `schema_version: "2"` (string)

```typescript
// CLI parsing addition
if (args.includes("--generate-graph")) {
  await generateDependencyGraph();
  process.exit(0);
}
```

```typescript
async function generateDependencyGraph(): Promise<void> {
  const archMap = loadArchitectureMap();
  const moduleKeys = Object.keys(archMap.modules ?? {});

  const reverseDeps: Record<string, string[]> = {};
  // Build modules object-map (canonical v2 AIDependencyGraph structure)
  const modules: Record<
    string,
    { dependencies: string[]; layer: string; type: "app" | "package" }
  > = {};

  for (const moduleKey of moduleKeys) {
    const deps = new Set<string>();
    const sourceFiles = getSourceFiles(moduleKey);
    for (const file of sourceFiles) {
      const imports = extractImports(file);
      for (const imp of imports) {
        const targetModule = resolveImportToModuleKey(imp, moduleKeys, file);
        if (targetModule && targetModule !== moduleKey) {
          deps.add(targetModule);
        }
      }
    }
    const depList = [...deps];
    const layer = archMap.modules[moduleKey]?.layer ?? "unknown";
    const type = moduleKey.startsWith("apps/") ? "app" : "package";
    modules[moduleKey] = { dependencies: depList, layer, type };
    for (const dep of depList) {
      if (!reverseDeps[dep]) reverseDeps[dep] = [];
      if (!reverseDeps[dep].includes(moduleKey)) reverseDeps[dep].push(moduleKey);
    }
  }

  const graph: AIDependencyGraph = {
    schema_version: "2", // string — matches SchemaVersion type
    generated_at: new Date().toISOString(),
    source_metadata: { infra_audit_timestamp: new Date().toISOString() },
    modules,
    reverse_dependencies: reverseDeps,
  };

  writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2));
  console.log(`[infra-audit] Dependency graph written → ${GRAPH_PATH}`);
}
```

**Important:** Edge deduplication is done via a `Set` of `"from|to"` strings. The existing `ai-dependency-graph.json` contains many **duplicate** edges for the same module pair (e.g. multiple `packages/domain-core → packages/logger` edges from separate file imports). The `--generate-graph` path must deduplicate so that graph traversal is efficient and the `reverse_dependencies` map has no duplicates.

---

### 1.4 Changes to `.husky/pre-commit`

Replace the existing architecture guards section:

**Before:**

```sh
# ── Architecture + Infrastructure Guards ──
CODE_FILES=$(echo "$STAGED_FILES" | grep -E '\.(ts|tsx|js|jsx|mjs|vue)$' || true)
if [ -n "$CODE_FILES" ]; then
  echo "Running architecture governance checks…"
  bun scripts/ai-guard.ts &
  PID_AI=$!
  bun scripts/infra-audit.ts --quick &
  PID_INFRA=$!
  wait $PID_AI
  wait $PID_INFRA
fi
```

**After:**

```sh
# ── Architecture + Infrastructure Guards ──
CODE_FILES=$(echo "$STAGED_FILES" | grep -E '\.(ts|tsx|js|jsx|mjs|vue)$' || true)
if [ -n "$CODE_FILES" ]; then
  echo "Running architecture governance checks…"

  # Pass staged files to the incremental guard via env var
  # --incremental reads STAGED_FILES and validates only affected modules
  _GUARD_STAGED=$(git diff --cached --name-only)
  STAGED_FILES="$_GUARD_STAGED" bun scripts/ai-guard.ts --incremental
  # Note: infra-audit.ts --quick is intentionally NOT in pre-commit (moved to pre-push).
  # infra-audit.ts --quick runs a full repository walk unconditionally (QUICK_MODE only
  # gates file writes, not the scan itself), making the hook ~500–870ms total and
  # defeating the <200ms target. See section 1.5 for pre-push placement.
fi
```

**Rationale for removing parallelism:**
The incremental guard now exits in <200ms, so the speed benefit of background parallelism is smaller than the complexity cost. Running sequentially also makes error output legible. `infra-audit.ts --quick` is moved to pre-push (not called in pre-commit) to meet the <200ms latency target.

---

### 1.5 Changes to `.husky/pre-push`

Replace the existing architecture governance section:

**Before:**

```sh
echo "Running architecture governance validation..."
bun scripts/ai-guard.ts
```

**After:**

```sh
echo "Running full architecture governance validation..."
bun scripts/ai-guard.ts --full
# infra-audit.ts --quick moved here from pre-commit to meet <200ms pre-commit target
bun scripts/infra-audit.ts --quick
```

The explicit `--full` flag documents intent clearly. Behavior is identical to the current `bun scripts/ai-guard.ts` invocation (no flags = full scan). `infra-audit.ts --quick` was moved from pre-commit (where it caused 500–870ms latency) to pre-push where governance coverage is maintained without blocking fast commits.

---

### 1.6 Dependency Graph Schema Migration

The existing `docs/ai/context/ai-dependency-graph.json` uses schema v1:

```json
{
  "nodes": [...],
  "edges": [{"from": ..., "to": ...}]
}
```

Schema v2 (required by incremental guard — canonical `AIDependencyGraph` from `packages/types/src/ai-context.ts`):

```json
{
  "schema_version": "2",
  "generated_at": "2026-03-10T14:30:00Z",
  "source_metadata": {
    "infra_audit_timestamp": "2026-03-10T14:30:00Z"
  },
  "modules": {
    "apps/api": {
      "dependencies": ["packages/domain-core", "packages/logger"],
      "layer": "api",
      "type": "app"
    },
    "packages/logger": {
      "dependencies": [],
      "layer": "util",
      "type": "package"
    }
  },
  "reverse_dependencies": {
    "packages/logger": ["apps/api", "apps/worker"]
  }
}
```

---

### 1.7 Architecture Impact Report

Generated on every validation run. Written to stdout always. Written to `docs/ai/context/architecture-impact-report.json` only in CI (when `CI=true` env var is set).

```json
{
  "run_id": "abc1234-1710080380000",
  "timestamp": "2026-03-10T14:32:00Z",
  "validation_mode": "incremental",
  "modules_validated": 2,
  "modules_skipped": 12,
  "skipped_unmapped_files": ["docs/README.md"],
  "fallback_reason": null,
  "verdict": "pass",
  "violations": [],
  "duration_ms": 145
}
```

| Field                    | Description                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `run_id`                 | Unique run identifier (short commit hash + epoch ms)                                                                             |
| `timestamp`              | ISO-8601 timestamp of the validation run                                                                                         |
| `validation_mode`        | `"incremental"` or `"full"`                                                                                                      |
| `modules_validated`      | Count of modules that were validated (scope size)                                                                                |
| `modules_skipped`        | `total_modules - modules_validated`                                                                                              |
| `skipped_unmapped_files` | Files outside any known module prefix (docs, scripts, etc.)                                                                      |
| `fallback_reason`        | If full scan triggered: `"map_changed" \| "graph_missing" \| "graph_stale" \| "graph_unusable" \| "new_module_detected" \| null` |
| `verdict`                | `"pass"` or `"fail"`                                                                                                             |
| `violations`             | Array of rule violations found; empty on pass                                                                                    |
| `duration_ms`            | Total validation duration in milliseconds                                                                                        |

---

### 1.8 Backward Compatibility Contract

| Invocation                                            | Before        | After                                   |
| ----------------------------------------------------- | ------------- | --------------------------------------- |
| `bun scripts/ai-guard.ts`                             | Full scan     | Full scan (unchanged)                   |
| `bun scripts/ai-guard.ts --full`                      | Not supported | Full scan (new)                         |
| `bun scripts/ai-guard.ts --incremental`               | Not supported | Incremental mode (new)                  |
| `bun scripts/ai-guard.ts --incremental --modules a,b` | Not supported | Explicit module override (new)          |
| `bun scripts/infra-audit.ts`                          | Full audit    | Full audit (unchanged)                  |
| `bun scripts/infra-audit.ts --quick`                  | Quick audit   | Quick audit (unchanged)                 |
| `bun scripts/infra-audit.ts --generate-graph`         | Not supported | Writes `ai-dependency-graph.json` (new) |

---

### 1.9 Performance Targets & Implementation Strategy

| Scenario                        | Target | Strategy                                                                                 |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| Pre-commit, 1–2 modules changed | <200ms | Skip module scan; load cached graph (<10ms); BFS traversal (<20ms); validate 2–3 modules |
| Pre-commit, <3 modules affected | <200ms | Same                                                                                     |
| Pre-commit, full fallback       | ~900ms | Identical to today                                                                       |
| Cache read                      | <5ms   | `JSON.parse` of small file (< 50KB)                                                      |
| Module mapping (50 files)       | <10ms  | Single O(n×m) pass; n=files, m=14 modules                                                |
| BFS traversal (full graph)      | <20ms  | 14 nodes, adjacency list lookup is O(1)                                                  |
| `--generate-graph`              | <500ms | Reads only source files; skips audit report generation                                   |

**No lazy loading or async I/O required** for the graph — the file is small enough (<50KB) that synchronous `readFileSync` + `JSON.parse` completes in <5ms.

---

### 1.10 CI/CD Integration

No changes to CI workflow files required. CI currently runs `bun scripts/ai-guard.ts` which maps to full scan. After implementation:

- Either add `--full` flag explicitly (recommended for clarity)
- Or leave as-is (defaults to full scan — backward compatible)

CI should never use `--incremental` — it runs on full branch diff and should validate all affected modules.

---

## Phase 2: Post-Design Constitution Check

| Rule                                           | Status  |
| ---------------------------------------------- | ------- |
| No new modules introduced                      | ✅ PASS |
| No cross-tenant access                         | ✅ PASS |
| No DB connections                              | ✅ PASS |
| No license middleware affected                 | ✅ PASS |
| Backward compatibility preserved               | ✅ PASS |
| ARCHITECTURE_MAP.json not structurally changed | ✅ PASS |
| All changes scoped to scripts + hooks          | ✅ PASS |

**Final Verdict: Architecture compliant. Implementation may proceed.**

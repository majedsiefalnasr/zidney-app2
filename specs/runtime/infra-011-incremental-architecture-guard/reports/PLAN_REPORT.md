# Plan Report — STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD

**Stage:** Incremental Architecture Guard  
**Phase:** 01_PLATFORM_FOUNDATION  
**Step:** 3 — Plan  
**Generated:** 2026-03-10T00:00:00Z  
**Guardian Verdict:** ✅ PASS (Architecture Checker)

---

## Summary

The implementation plan for the **Incremental Architecture Guard** is complete. All four plan
artifacts were generated and validated by the Architecture Checker guardian. The plan is
**architecture-compliant** and implementation is authorized pending task generation.

---

## Artifacts Generated

| File            | Lines | Purpose                                                                                                                                                         |
| --------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan.md`       | 631   | Full technical design — 10 design sections, backward compatibility contract, performance targets                                                                |
| `research.md`   | 339   | Existing graph population mechanism, schema observations, git diff strategy, BFS traversal design                                                               |
| `data-model.md` | 531   | Complete TypeScript interfaces: `DependencyGraph`, `ArchitectureImpactReport`, `GuardConfig`, `ModuleMappingResult`, `ScopeResolutionResult`, `FallbackContext` |
| `quickstart.md` | 226   | Developer experience guide: hook behavior table, graph refresh, TTL config, debugging guide                                                                     |

---

## Technical Design Summary

### Five-Step Incremental Pipeline

```
staged files (git diff --cached)
  → module mapping (ARCHITECTURE_MAP.json, longest-prefix match)
  → impact scope (BFS over reverse_dependencies)
  → incremental validation (ai-guard.ts --incremental --modules <scope>)
  → [fallback to full scan if: map changed | graph stale | new module | scope = all]
```

### Files Changed by This Stage

| File                                       | Change Type                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `scripts/ai-guard.ts`                      | Add `--incremental`, `--full`, `--modules <csv>` CLI flags + incremental execution path                            |
| `scripts/infra-audit.ts`                   | Add `--generate-graph` fast-path flag (graph only, no full audit)                                                  |
| `.husky/pre-commit`                        | Replace parallel full-scan with sequential incremental: `STAGED_FILES="..." bun scripts/ai-guard.ts --incremental` |
| `.husky/pre-push`                          | Add explicit `--full` flag (behavior unchanged, intent documented)                                                 |
| `docs/ai/context/ai-dependency-graph.json` | Schema migration from v1 (`nodes[]`+`edges[]`) to canonical `AIDependencyGraph` type                               |
| `.gitignore`                               | Add `docs/ai/context/architecture-impact-report.json` (CI-only artifact)                                           |

### No New Modules

All changes are within existing files in `scripts/` and `.husky/`. No entries added to
`ARCHITECTURE_MAP.json`. No `packages/*` or `apps/*` directories created.

### Backward Compatibility Contract

| Invocation                                    | Before        | After                         |
| --------------------------------------------- | ------------- | ----------------------------- |
| `bun scripts/ai-guard.ts`                     | Full scan     | Full scan ✅ (unchanged)      |
| `bun scripts/ai-guard.ts --full`              | Not supported | Full scan (new explicit flag) |
| `bun scripts/ai-guard.ts --incremental`       | Not supported | Incremental mode (new)        |
| `bun scripts/infra-audit.ts`                  | Full audit    | Full audit ✅ (unchanged)     |
| `bun scripts/infra-audit.ts --quick`          | Quick audit   | Quick audit ✅ (unchanged)    |
| `bun scripts/infra-audit.ts --generate-graph` | Not supported | Graph-only fast path (new)    |

---

## Key Design Decisions

### 1. Schema Alignment (Critical — Implementation Note)

The plan proposes "schema v2" for `ai-dependency-graph.json`. During guardian review, a conflict
was identified with the **canonical `AIDependencyGraph` interface** in
`packages/types/src/ai-context.ts` (line 299).

**Resolution for implementation:** The `--generate-graph` flag in `infra-audit.ts` must produce
a file conforming to `AIDependencyGraph` from `packages/types/src/ai-context.ts`:

```typescript
interface AIDependencyGraph {
  schema_version: SchemaVersion; // ← typed, not raw integer
  generated_at: Timestamp;
  source_metadata: { infra_audit_timestamp: Timestamp };
  modules: {
    [modulePath: string]: {
      dependencies: string[]; // ← forward deps (replaces edges[] array)
      layer: string;
      type: "app" | "package";
    };
  };
  reverse_dependencies: {
    [modulePath: string]: string[];
  };
}
```

- Module keys = `Object.keys(graph.modules)` (not `nodes[]`)
- Forward deps = `graph.modules[key].dependencies` (not `edges[]`)
- Reverse deps = `graph.reverse_dependencies[key]` (already in canonical type)

The current v1 file (`nodes[]` + `edges[]`) will be transparently replaced on first
`--generate-graph` invocation.

### 2. No Graph Refresh in Pre-commit

If graph is missing or stale (age > `ARCH_GRAPH_MAX_AGE_HOURS`): pre-commit hook falls
through to **full scan** and emits a warning. Graph regeneration is in pre-push and CI only
(via explicit dev invocation of `--generate-graph`). This preserves the <200ms target.

### 3. Fallback Trigger for Changed Architecture Files

The plan correctly uses `stagedFiles.some(f => f.includes('ARCHITECTURE_MAP'))` (substring
match, not exact match). The Architecture Checker noted `Array.includes('exact-filename')`
would be a silent bypass — the plan already uses the correct approach.

### 4. `architecture-impact-report.json` Must Be `.gitignore`d

This file is a CI-only ephemeral artifact. It must be added to `.gitignore` to prevent
accidental staging during `git add .` in local dev workflows.

### 5. Pre-commit Parallelism Removed

Both guards now run sequentially. With <200ms incremental validation, sequential execution
avoids stdout race conditions while maintaining acceptable latency. `infra-audit.ts --quick`
runs after the incremental guard.

---

## Performance Targets

| Scenario                      | Target     | Strategy                                                                |
| ----------------------------- | ---------- | ----------------------------------------------------------------------- |
| Pre-commit <3 modules changed | **<200ms** | Cache hit (<5ms) + mapping (<10ms) + BFS (<20ms) + validate 2–3 modules |
| Pre-commit full fallback      | ~900ms     | Identical to current behavior                                           |
| Cache read                    | <5ms       | `JSON.parse` of <50KB file (synchronous)                                |
| Module mapping (50 files)     | <10ms      | Single O(n×m) pass: n=files, m=~13 modules                              |
| BFS traversal (full graph)    | <20ms      | 13 nodes; O(V+E) BFS                                                    |
| `--generate-graph` fast path  | <500ms     | Reads source files, skips full audit                                    |

---

## Guardian Validation Results

### Architecture Checker — VERDICT: PASS

| Check                       | Result                                             |
| --------------------------- | -------------------------------------------------- |
| Layer violations            | ✅ None — scripts/ and .husky/ only                |
| Import boundaries           | ✅ Pass — no cross-app imports                     |
| Multi-tenancy isolation     | ✅ N/A — governance scripts                        |
| License middleware          | ✅ Unchanged                                       |
| Architecture map compliance | ✅ No new modules; ARCHITECTURE_MAP.json read-only |
| Backward compatibility      | ✅ Pass — existing invocations unchanged           |

**Findings captured:**

- `[HIGH]` Schema conflict with `AIDependencyGraph` canonical type → **resolved via implementation note above**
- `[MEDIUM]` Fallback trigger uses `.includes()` partial match → **plan already uses correct approach**
- `[LOW]` Graph refresh in pre-commit violates 200ms target → **plan already omits refresh in pre-commit**
- `[LOW]` `architecture-impact-report.json` not in `.gitignore` → **added as explicit task in implementation**

---

## Risk Assessment

| Risk                                          | Level | Mitigation                                                             |
| --------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| Schema migration breaks existing tooling      | LOW   | Canonical type already in `packages/types`; transparent auto-migration |
| False negative (incremental misses violation) | LOW   | BFS covers all transitive dependents; full fallback for edge cases     |
| Performance regression on full fallback       | NONE  | Fallback = current behavior                                            |
| Pre-commit hook breakage                      | LOW   | Exit 0 on empty staged file list; full fallback on any error           |

---

## Constitutional Compliance

| Rule                                    | Status  |
| --------------------------------------- | ------- |
| No new modules under packages/ or apps/ | ✅ PASS |
| No DB access, no tenant context         | ✅ PASS |
| No license middleware changes           | ✅ PASS |
| Backward compatibility preserved        | ✅ PASS |
| ARCHITECTURE_MAP.json read-only         | ✅ PASS |
| Layer boundaries respected              | ✅ PASS |

---

## Status

**Plan Step: COMPLETE**  
**Guardian Verdict: PASS**  
**Implementation Gate: AUTHORIZED after task generation and drift analysis**

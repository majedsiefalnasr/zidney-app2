# Tasks Report — STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD

**Stage:** Incremental Architecture Guard  
**Phase:** 01_PLATFORM_FOUNDATION  
**Step:** 4 — Tasks  
**Generated:** 2026-03-10T00:00:00Z  
**Total Tasks:** 24

---

## Summary

24 atomic tasks generated covering the full implementation of the Incremental Architecture Guard.
Tasks are ordered by execution dependency: setup → infra-audit changes → ai-guard changes →
hook updates → tests → validation.

---

## Task Distribution

| Phase                                 | Tasks | IDs       |
| ------------------------------------- | ----- | --------- |
| Setup                                 | 1     | T001      |
| `infra-audit.ts` — `--generate-graph` | 3     | T002–T004 |
| `ai-guard.ts` — Incremental pipeline  | 7     | T005–T011 |
| Hook updates                          | 2     | T012–T013 |
| Unit tests                            | 4     | T014–T017 |
| Integration tests                     | 3     | T018–T020 |
| Post-implementation validation        | 4     | T021–T024 |

---

## Task Summary

| ID   | Description                                                                 | File                                            |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| T001 | Add `architecture-impact-report.json` to `.gitignore`                       | `.gitignore`                                    |
| T002 | Add `--generate-graph` flag detection + dispatch                            | `scripts/infra-audit.ts`                        |
| T003 | Implement `generateDependencyGraph()` — module map + edges + reverse deps   | `scripts/infra-audit.ts`                        |
| T004 | Set schema metadata: `schema_version`, `generated_at`, `source_metadata`    | `scripts/infra-audit.ts`                        |
| T005 | Add `AIDependencyGraph` import + `GuardConfig` type + `parseArgs()`         | `scripts/ai-guard.ts`                           |
| T006 | Add constants + `loadDependencyGraph()` with TTL and schema validation      | `scripts/ai-guard.ts`                           |
| T007 | Implement `mapToModules()` — longest-prefix match                           | `scripts/ai-guard.ts`                           |
| T008 | Implement `detectNewModules()` — check apps/packages dirs vs map            | `scripts/ai-guard.ts`                           |
| T009 | Implement `computeImpactScope()` — BFS over reverse_dependencies            | `scripts/ai-guard.ts`                           |
| T010 | Implement `runIncremental()` — full 5-step incremental path                 | `scripts/ai-guard.ts`                           |
| T011 | Modify `main()` — dispatch on `config.mode`                                 | `scripts/ai-guard.ts`                           |
| T012 | Update pre-commit: sequential incremental + infra-audit                     | `.husky/pre-commit`                             |
| T013 | Update pre-push: explicit `--full` flag                                     | `.husky/pre-push`                               |
| T014 | Unit tests: `parseArgs()` all 4 modes                                       | `tests/unit/ai-guard/incremental-guard.test.ts` |
| T015 | Unit tests: `mapToModules()` prefix match, duplicates, skipped files        | `tests/unit/ai-guard/incremental-guard.test.ts` |
| T016 | Unit tests: `computeImpactScope()` BFS traversal                            | `tests/unit/ai-guard/incremental-guard.test.ts` |
| T017 | Unit tests: `loadDependencyGraph()` cache validation                        | `tests/unit/ai-guard/incremental-guard.test.ts` |
| T018 | [P] Integration test: `generateDependencyGraph()` schema output             | `tests/unit/infra-audit/generate-graph.test.ts` |
| T019 | Integration test: incremental path covers expected modules                  | `tests/unit/ai-guard/incremental-guard.test.ts` |
| T020 | Integration test: full fallback triggered on ARCHITECTURE_MAP change        | `tests/unit/ai-guard/incremental-guard.test.ts` |
| T021 | Regenerate `ai-dependency-graph.json` + verify schema v2 shape              | `docs/ai/context/ai-dependency-graph.json`      |
| T022 | [P] Smoke-test: backward compatibility (`bun scripts/ai-guard.ts` no flags) | —                                               |
| T023 | [P] Smoke-test: incremental mode with single staged file                    | —                                               |
| T024 | Run full unit test suite, verify no regressions                             | —                                               |

---

## Parallel Tasks

These tasks can be executed concurrently (marked `[P]`):

- T018 — `generate-graph.test.ts` (independent file from guard tests)
- T022 — backward compat smoke test (read-only validation)
- T023 — incremental smoke test (read-only validation)

---

## Critical Implementation Notes

### Schema: Use Canonical `AIDependencyGraph` Type

```typescript
import type { AIDependencyGraph } from "@zidney/types";
// or relative import from packages/types/src/ai-context.ts

// Module keys = Object.keys(graph.modules)
// Forward deps = graph.modules[key].dependencies
// Reverse deps = graph.reverse_dependencies[key]
// schema_version is SchemaVersion = string → use "2" (not 2)
```

### Fallback Precedence (T010 runIncremental)

1. ARCHITECTURE_MAP staged → full scan
2. New module on disk not in map → full scan
3. Graph missing → full scan (warn: run `--generate-graph`)
4. Graph stale → full scan (warn: run `--generate-graph`)
5. Schema version mismatch → full scan (warn: run `--generate-graph`)
6. Scope = all modules → full scan (no efficiency gain)

**Do NOT call `--generate-graph` inside pre-commit — fallback to full scan only.**

### Pre-Commit Hook Evolution

```sh
# BEFORE (parallel, full scan)
bun scripts/ai-guard.ts &
PID_AI=$!
bun scripts/infra-audit.ts --quick &
PID_INFRA=$!
wait $PID_AI
wait $PID_INFRA

# AFTER (sequential, incremental)
STAGED_FILES="$STAGED_FILES" bun scripts/ai-guard.ts --incremental
bun scripts/infra-audit.ts --quick
```

---

## Dependencies Between Tasks

```
T001 (independent — do first)
T002 → T003 → T004 (infra-audit sequence)
T005 → T006 → T007 → T008 → T009 → T010 → T011 (ai-guard sequence)
T012 depends on T011 (hook needs working incremental guard)
T013 independent of T012 (different hook)
T014–T020 depend on T005–T011
T018 [P] independent (different test file)
T021 depends on T002–T004
T022–T023 [P] depend on T021 + T011-T012
T024 depends on T014–T020
```

---

## Status

**Tasks Step: COMPLETE**  
**Total: 24 tasks, 0 deferred**  
**Next Step: Analyze (Drift Detector)**

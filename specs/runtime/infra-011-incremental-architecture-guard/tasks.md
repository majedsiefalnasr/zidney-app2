# Tasks: Incremental Architecture Guard

**Stage:** STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD
**Phase:** 01_PLATFORM_FOUNDATION
**Feature ID:** infra-011-incremental-architecture-guard
**Status:** IN PROGRESS
**Generated:** 2026-03-10

---

## Stage Context

- **Phase:** 01_PLATFORM_FOUNDATION
- **Stage:** STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD
- **Related Plan:** specs/runtime/infra-011-incremental-architecture-guard/plan.md
- **Related Spec:** specs/runtime/infra-011-incremental-architecture-guard/spec.md
- **Related ADR:** None (governance scripts only)

---

## Pre-Execution Checklist

- [x] Plan complied with Zidney Constitution v1.2.0 — PASS
- [x] No architectural violations exist — PASS (scripts/governance layer only)
- [x] Stage status: IN PROGRESS — implementation allowed
- [x] No new modules introduced — no ARCHITECTURE_MAP update required
- [x] Backward compatibility guaranteed — existing invocations unchanged

---

## Implementation Notes (Read Before Starting)

1. **Type source:** `AIDependencyGraph` from `packages/types/src/ai-context.ts`.
   - Forward deps: `graph.modules[key].dependencies` (NOT an `edges[]` array)
   - Reverse deps: `graph.reverse_dependencies[key]`
   - Module keys: `Object.keys(graph.modules)`

2. **SchemaVersion:** `SchemaVersion = string` in `packages/types/src/ai-context.ts`.
   Use `EXPECTED_SCHEMA_VERSION = "2"` (string), write `schema_version: "2"` in the generated JSON.

3. **Pre-commit fallback rule:** When fallback is triggered, do NOT call `--generate-graph`
   inside the pre-commit hook. Graph regeneration is handled inside `runIncremental()` in
   `ai-guard.ts` for the graph-missing/stale cases only. For new-module and map-changed
   fallbacks, run full scan immediately without regenerating.

4. **Empty staged files:** Exit 0 immediately — before spawning any TypeScript process.
   This is already handled in the existing `.husky/pre-commit` shell script; preserve it.

5. **Existing test directories:** `tests/unit/ai-guard/` and `tests/unit/infra-audit/`
   already exist. Add new test files there — do not create a `tests/unit/scripts/` directory.

---

## Phase 1: Setup

- [ ] T001 Add `docs/ai/context/architecture-impact-report.json` to `.gitignore` (new line under the `docs/ai/context/` block or at end of file)

---

## Phase 2: infra-audit.ts — Dependency Graph Generation

- [ ] T002 Add `--generate-graph` CLI flag detection at the top of `scripts/infra-audit.ts` startup block — when flag is present, call `generateDependencyGraph()` then `process.exit(0)` before any full-audit logic runs

- [ ] T003 Implement `generateDependencyGraph()` in `scripts/infra-audit.ts` — reads `docs/architecture/intelligence/ARCHITECTURE_MAP.json`, recursively enumerates `.ts`/`.tsx`/`.vue` source files per module (excluding `node_modules/`, test files matching `*.test.*`/`*.spec.*`), extracts inter-module import statements using regex or the existing import-parsing logic, builds a deduplicated `modules` map (`{ [path]: { dependencies: string[], layer: string, type: "app"|"package" } }`) where each `dependencies[]` entry appears at most once per module pair, computes `reverse_dependencies` by inverting the forward dependency map, and writes `AIDependencyGraph`-conformant JSON to `docs/ai/context/ai-dependency-graph.json`

- [ ] T004 Set required metadata fields in the output of `generateDependencyGraph()` in `scripts/infra-audit.ts` — `schema_version: "2"` (string to match `SchemaVersion = string`), `generated_at: new Date().toISOString()`, `source_metadata: { infra_audit_timestamp: new Date().toISOString() }`

---

## Phase 3: ai-guard.ts — New Utilities and Incremental Path

- [ ] T005 Add `import type { AIDependencyGraph } from "@zidney/types"` (or relative path equivalent) at the top of `scripts/ai-guard.ts`, then define the `GuardConfig` interface (`mode: "full"|"incremental"`, `explicitModules: string[]|null`, `outputJson: boolean`) and implement `parseArgs(): GuardConfig` — handles `--incremental`, `--full`, `--modules <csv>`, `--output json` flags; default (no flags) returns `{ mode: "full", explicitModules: null, outputJson: false }` for backward compatibility

- [ ] T006 Add constants `GRAPH_PATH = "docs/ai/context/ai-dependency-graph.json"`, `EXPECTED_SCHEMA_VERSION = "2"` (string), `DEFAULT_MAX_AGE_HOURS = 24` to `scripts/ai-guard.ts`, then implement `loadDependencyGraph(): AIDependencyGraph | null` — returns `null` if file missing, JSON parse fails, `schema_version !== EXPECTED_SCHEMA_VERSION`, or `generated_at` age exceeds `ARCH_GRAPH_MAX_AGE_HOURS ?? DEFAULT_MAX_AGE_HOURS` hours

- [ ] T007 Add `mapToModules(files: string[], moduleKeys: string[]): { modules: Set<string>; skipped: string[] }` to `scripts/ai-guard.ts` — for each file apply longest-prefix match against `moduleKeys` (test `file.startsWith(key + "/") || file === key`); collect unmatched files in `skipped[]`; return deduplicated `modules` Set

- [ ] T008 Add `detectNewModules(moduleKeys: string[]): boolean` to `scripts/ai-guard.ts` — reads `apps/` and `packages/` directories with `readdirSync`, filters to entries that are directories (`statSync(d).isDirectory()`), returns `true` if any `apps/<d>` or `packages/<d>` path is missing from `moduleKeys`

- [ ] T009 Add `computeImpactScope(changed: Set<string>, graph: AIDependencyGraph): Set<string>` to `scripts/ai-guard.ts` — BFS traversal over `graph.reverse_dependencies`: initialize `scope = new Set(changed)` and `queue = [...changed]`; while queue non-empty, pop module, iterate `graph.reverse_dependencies[module] ?? []`, add unseen dependents to scope and queue; return `scope`

- [ ] T010 Add `runIncremental(config: GuardConfig): Promise<ValidationResult>` to `scripts/ai-guard.ts` — full incremental execution path:
  1. Read `STAGED_FILES` env var (split on `\n`, trim, filter empty); if empty exit 0
  2. Load ARCHITECTURE_MAP; get `moduleKeys = Object.keys(archMap.modules ?? {})`
  3. Check fallback triggers: `mapChanged` (ARCHITECTURE_MAP in staged files), `newModuleDetected` (detectNewModules), `graph = loadDependencyGraph()`, `graphMissing = graph === null`
  4. If `mapChanged` or `newModuleDetected`: run full scan immediately (no regeneration)
  5. If `graphMissing`: call `execSync("bun scripts/infra-audit.ts --generate-graph")`, reload graph; if still null, run full scan with `fallback_reason: "graph_missing"`
  6. Use `config.explicitModules` as scope if provided; otherwise call `mapToModules()` then `computeImpactScope()`
  7. If `scope.size >= moduleKeys.length`: run full scan with `fallback_reason: "full_scope"`
  8. Call `validateModules([...scope], { mode: "incremental", skippedFiles, start })`

- [ ] T011 Modify `main()` in `scripts/ai-guard.ts` — add `const config = parseArgs()` at function start; dispatch to `runIncremental(config)` when `config.mode === "incremental"`, otherwise fall through to existing full-scan logic; existing behavior preserved for no-flag and `--full` invocations

---

## Phase 4: Hook Updates

- [ ] T012 Update `.husky/pre-commit` — inside the `if [ -n "$CODE_FILES" ]` block, replace the parallel execution pattern (`bun scripts/ai-guard.ts &` / `PID_AI=$!` / `bun scripts/infra-audit.ts --quick &` / `PID_INFRA=$!` / `wait $PID_AI` / `wait $PID_INFRA`) with sequential execution: first `STAGED_FILES="$STAGED_FILES" bun scripts/ai-guard.ts --incremental`, then `bun scripts/infra-audit.ts --quick`

- [ ] T013 Update `.husky/pre-push` — change the plain `bun scripts/ai-guard.ts` call (under the Architecture Governance section) to `bun scripts/ai-guard.ts --full` to make the full-scan intent explicit

---

## Phase 5: Unit Tests

- [ ] T014 Create `tests/unit/ai-guard/incremental-guard.test.ts` — unit tests for `parseArgs()`:
  - No flags → `{ mode: "full", explicitModules: null, outputJson: false }`
  - `--full` only → `{ mode: "full", explicitModules: null, outputJson: false }`
  - `--incremental` only → `{ mode: "incremental", explicitModules: null, outputJson: false }`
  - `--incremental --modules apps/mmc,packages/logger` → `{ mode: "incremental", explicitModules: ["apps/mmc", "packages/logger"], outputJson: false }`

- [ ] T015 Add unit tests for `mapToModules()` to `tests/unit/ai-guard/incremental-guard.test.ts`:
  - Single file `apps/api/src/index.ts` maps to `["apps/api"]`
  - Multiple files in same module deduplicate to one entry
  - File in `docs/README.md` lands in `skipped[]`, not in `modules`
  - Longer prefix wins: `apps/api/src/file.ts` maps to `apps/api` not to a hypothetical `apps/` entry
  - Empty files array returns `{ modules: empty Set, skipped: [] }`

- [ ] T016 Add unit tests for `computeImpactScope()` BFS to `tests/unit/ai-guard/incremental-guard.test.ts`:
  - Direct dependent added: change `packages/logger` → scope includes `apps/api` (if `reverse_dependencies["packages/logger"] === ["apps/api"]`)
  - Transitive chain fully expanded across 3 hops
  - Module with no entry in `reverse_dependencies` returns input set unchanged
  - Cycle-safe: no infinite loop when A depends on B and B depends on A

- [ ] T017 Add unit tests for `loadDependencyGraph()` to `tests/unit/ai-guard/incremental-guard.test.ts`:
  - Missing file → returns `null`
  - Valid file with `schema_version: "1"` → returns `null`
  - Valid file with `schema_version: "2"` but `generated_at` older than `DEFAULT_MAX_AGE_HOURS * 3600000 ms` → returns `null`
  - `ARCH_GRAPH_MAX_AGE_HOURS=0` set → always returns `null` (always stale)
  - Valid file with correct version and fresh `generated_at` → returns the parsed `AIDependencyGraph`

- [ ] T018 [P] Create `tests/unit/infra-audit/generate-graph.test.ts` — integration test for `generateDependencyGraph()`:
  - Output file `docs/ai/context/ai-dependency-graph.json` is written and parseable as JSON
  - `schema_version` equals `"2"`
  - `generated_at` is a valid ISO-8601 string
  - `source_metadata.infra_audit_timestamp` is a valid ISO-8601 string
  - `modules` is an object with keys matching `Object.keys(ARCHITECTURE_MAP.modules)`
  - `reverse_dependencies` contains no duplicate entries per key
  - All `dependencies[]` entries in `modules` reference keys that exist in `modules`

- [ ] T019 Add integration test for incremental pre-commit path to `tests/unit/ai-guard/incremental-guard.test.ts`:
  - With `STAGED_FILES="apps/mmc/src/views/Dashboard.vue"` and a valid graph, `runIncremental()` resolves scope to at minimum `{"apps/mmc"}` plus any modules listed under `reverse_dependencies["apps/mmc"]`
  - `fallback_reason` in result is `null` (no fallback triggered)

- [ ] T020 Add integration test for full fallback trigger to `tests/unit/ai-guard/incremental-guard.test.ts`:
  - With `STAGED_FILES` containing `"docs/architecture/intelligence/ARCHITECTURE_MAP.json"`, `runIncremental()` triggers full scan and result indicates `fallback_reason: "map_changed"`
  - With `STAGED_FILES` set to a valid module file but graph file deleted/absent, result indicates `fallback_reason: "graph_missing"`

---

## Phase 6: Post-Implementation Validation

- [ ] T021 Run `bun scripts/infra-audit.ts --generate-graph` to regenerate `docs/ai/context/ai-dependency-graph.json` — verify the output file contains `schema_version: "2"`, `generated_at`, `source_metadata`, `modules` object with 13 keys (9 packages + 4/5 apps), and non-empty `reverse_dependencies`

- [ ] T022 [P] Smoke-test backward compatibility — run `bun scripts/ai-guard.ts` (no flags) on the repo and confirm it exits 0, performs full scan of all modules, and produces no regressions vs. pre-implementation behavior

- [ ] T023 [P] Smoke-test incremental mode — run `STAGED_FILES="apps/mmc/src/views/Dashboard.vue" bun scripts/ai-guard.ts --incremental` and confirm validation runs only on `apps/mmc` plus reverse-dependency-expanded modules, duration is well below full-scan baseline, exit 0 on a clean repo

- [ ] T024 Run `bun run test:unit` (full unit test suite) and verify all new tests in `incremental-guard.test.ts` and `generate-graph.test.ts` pass, and no regressions in existing `ai-guard-boundaries.test.ts`, `ai-guard-validation.test.ts`, `infra-audit-boundaries.test.ts`

---

## Dependencies

```
T001 (setup)      → no prerequisites
T002              → no prerequisites (reads infra-audit.ts, adds --generate-graph flag)
T003              → T002 (flag detection added before implementing the function)
T004              → T003 (function called from flag dispatch)
T005              → T004 (adds import + GuardConfig; reads ai-guard.ts)
T006              → T005 (adds loadDependencyGraph; uses GRAPH_PATH constants)
T007              → T005 (adds mapToModules; uses GuardConfig type)
T008              → T005 (adds detectNewModules; standalone utility)
T009              → T005 (adds computeImpactScope; uses AIDependencyGraph type)
T010              → T006, T007, T008, T009 (runIncremental calls all utilities)
T011              → T010 (modifies main() to call runIncremental)
T012              → T011 (pre-commit uses new --incremental flag)
T013              → T011 (pre-push uses new --full flag)
T014              → T005 (tests parseArgs — needs function to exist)
T015              → T007 (tests mapToModules)
T016              → T009 (tests computeImpactScope)
T017              → T006 (tests loadDependencyGraph)
T018              → T003, T004 (tests generateDependencyGraph)  [P with T014–T017]
T019              → T010, T014 (integration test uses runIncremental + needs test file)
T020              → T010, T014 (integration test for fallback; uses test file from T014)
T021              → T003, T004 (post-impl: run --generate-graph)
T022              → T011 (smoke-test backward compat: main() dispatches correctly)  [P with T023]
T023              → T011, T021 (smoke-test incremental: needs fresh graph + main() dispatch)  [P with T022]
T024              → T014–T020, T022, T023 (full test run: all tests and smoke-tests done)
```

---

## Parallel Execution Opportunities

**Group A** (after T004 is merged into infra-audit.ts):

- T005, T006, T007, T008, T009 can be drafted in parallel as independent functions (different functions in the same file; merge sequentially into `scripts/ai-guard.ts`)

**Group B** (after T016 creates the test file `incremental-guard.test.ts`):

- T018 (`generate-graph.test.ts` — different file) can be written in parallel with T015, T016, T017

**Group C** (after T011 and T021 complete):

- T022 and T023 (smoke-tests for full and incremental modes) can run in parallel

---

## Implementation Strategy

**MVP scope (minimum viable increment):**

1. T001 → T002 → T003 → T004 (generate-graph flag working)
2. T005 → T006 → T007 → T008 → T009 → T010 → T011 (incremental path working)
3. T012 (pre-commit updated)
4. T021 (graph regenerated)

This produces a working incremental guard with updated pre-commit hook. Tests and pre-push update (T013–T020, T022–T024) complete the implementation.

**Validation sequence:**
After each phase, run `bun scripts/ai-guard.ts` (no flags) to confirm backward compatibility is intact before proceeding to the next phase.

---

## Task Summary

| Phase                                 | Tasks     | Count  |
| ------------------------------------- | --------- | ------ |
| Setup                                 | T001      | 1      |
| infra-audit.ts changes                | T002–T004 | 3      |
| ai-guard.ts utilities                 | T005–T009 | 5      |
| ai-guard.ts incremental path + main() | T010–T011 | 2      |
| Hook updates                          | T012–T013 | 2      |
| Unit tests — parseArgs                | T014      | 1      |
| Unit tests — mapToModules             | T015      | 1      |
| Unit tests — computeImpactScope       | T016      | 1      |
| Unit tests — loadDependencyGraph      | T017      | 1      |
| Integration tests — generate-graph    | T018      | 1      |
| Integration tests — incremental path  | T019–T020 | 2      |
| Post-implementation validation        | T021–T024 | 4      |
| **Total**                             |           | **24** |

Parallel opportunities identified: **3 groups** (Group A: T005–T009 drafting; Group B: T018 vs T015–T017; Group C: T022–T023)

Independent test criteria per phase:

- After T011: `bun scripts/ai-guard.ts` exits 0 with full scan (backward compat)
- After T012: pre-commit hook validates incrementally in <200ms for single-module commits
- After T013: pre-push hook explicitly flags as `--full`
- After T021: graph file contains schema v2 fields and all 13+ modules
- After T024: entire unit test suite green with no regressions

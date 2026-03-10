# Tasks: STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION

**Stage**: `STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION` **Phase**: `01_PLATFORM_FOUNDATION` **Feature
Dir**: `specs/runtime/infra-008-architecture-visualization/` **Generated**: 2026-03-09 **Status**:
Ready for implementation

---

## Summary

| Phase | Description                                                             | Tasks     |
| ----- | ----------------------------------------------------------------------- | --------- |
| 1     | Test Fixtures (Parallel)                                                | T001–T002 |
| 2     | Script Scaffold — Imports, Types, Constants                             | T003      |
| 3     | Pure Functions: filterTopLevelNodes + classifyLayerHeuristic + toNodeId | T004      |
| 4     | Pure Functions: deduplicateEdges + generateModuleGraph                  | T005      |
| 5     | Pure Function: generateLayerDiagram                                     | T006      |
| 6     | Pure Function: generateSystemOverview (static)                          | T007      |
| 7     | Pure Function: generateReadme                                           | T008      |
| 8     | Internal Helpers + main() CLI Entry Point                               | T009      |
| 9     | Unit Tests — 12 cases                                                   | T010      |
| 10    | Static Integration Tests — 6 cases                                      | T011      |
| 11    | package.json Script Entry                                               | T012      |
| 12    | Validation                                                              | T013–T018 |

**TASKS_TOTAL**: 18

---

## Phase 1 — Test Fixtures (Parallel)

> Create minimal JSON fixture files required by the unit test suite. T001 and T002 are fully
> independent — they create files in different paths and can be written concurrently.

- [x] T001 [P] [SETUP] Create `tests/unit/visualize/fixtures/dependency-graph.fixture.json` with 7
      nodes (5 top-level: `apps/api`, `apps/mmc`, `packages/domain-core`, `packages/logger`,
      `packages/api-client`; 2 deep submodule paths: `./apps/mmc/src/core/auth/token-manager`,
      `./apps/mmc/srcvue/test-utils`) and 5 edges including 1 duplicate `apps/api → packages/logger`
      and 1 edge from a deep submodule — exact content from plan.md Step 1
- [x] T002 [P] [SETUP] Create `tests/unit/visualize/fixtures/architecture-map.fixture.json` with
      system metadata (`system`, `architecture_model`, `version`, `layers`) and 5 modules mapping
      `apps/api → runtime`, `apps/mmc → ui`, `packages/domain-core → domain`,
      `packages/logger → infrastructure`, `packages/api-client → infrastructure` — exact content
      from plan.md Step 2

---

## Phase 2 — Script Scaffold (Sequential)

> Create the script file with the header comment, all Node.js built-in imports, file-path constants,
> TypeScript interfaces, and runtime constants. No function implementations yet. This file must
> exist before any function tasks (T004–T009) can proceed.

- [x] T003 Create `scripts/architecture/visualize.ts` with header comment
      `// CLI utility — exempt from service-layer logging standards.`; imports from
      `node:child_process` (execSync), `node:fs` (existsSync, mkdirSync, readFileSync,
      writeFileSync), `node:path` (join); path constants `ROOT` (process.cwd()),
      `DEPENDENCY_GRAPH_PATH`, `ARCHITECTURE_MAP_PATH`, `OUTPUT_DIR`; TypeScript interfaces
      `DependencyGraph`, `ArchitectureMapModule`, `ArchitectureMap`; and runtime constants
      `TOP_LEVEL_PATTERN` (/^(apps|packages)\/[^/]+$/), `HEURISTIC_LAYER_MAP`, `LAYER_ORDER`
      (['ui','runtime','domain','infrastructure','unknown']), `LAYER_LABELS` — exact shapes from
      data-model.md and plan.md Step 3

---

## Phase 3 — Pure Functions: Filter, Classify, NodeId (Sequential — depends on T003)

> Add the three simplest exported pure functions. Each is independently unit-testable.
> `filterTopLevelNodes` is gated on TOP_LEVEL_PATTERN; `classifyLayerHeuristic` on
> HEURISTIC_LAYER_MAP; `toNodeId` is a pure string transform with no dependencies.

- [x] T004 Implement and export in `scripts/architecture/visualize.ts`:
      `filterTopLevelNodes(nodes: string[]): string[]` (retains only paths matching
      TOP*LEVEL_PATTERN — exactly two path segments starting with `apps/` or `packages/`);
      `classifyLayerHeuristic(modulePath: string): string` (HEURISTIC_LAYER_MAP lookup, returns
      `"unknown"` for unrecognized paths); `toNodeId(modulePath: string): string` (replaces `/` and
      `-` with `*` via replace(/[/-]/g, '\_')) — exact implementations from plan.md Step 3

---

## Phase 4 — Pure Functions: deduplicateEdges + generateModuleGraph (Sequential — depends on T004)

> Add deduplication and the first diagram generator. `generateModuleGraph` depends on `toNodeId`
> (T004) and the internal `groupNodesByLayer` helper added in T009, so it must be compiled in the
> same file but `groupNodesByLayer` should be declared as a forward-referenced internal function
> stub until T009 completes its implementation.

- [x] T005 Implement and export in `scripts/architecture/visualize.ts`:
      `deduplicateEdges(edges: Array<{from:string;to:string}>, topLevelNodes: Set<string>): Array<{from:string;to:string}>`
      (filters edges where both endpoints are in topLevelNodes, removes duplicate (from,to) pairs
      using a Set key `from||to`, skips self-edges, sorts output alphabetically by from then to);
      `generateModuleGraph(nodes: string[], edges: Array<{from:string;to:string}>, layerMap: Map<string,string>): string`
      (returns `flowchart TD` Mermaid string — sorts nodes alphabetically, groups them into layer
      subgraphs via LAYER_ORDER, emits subgraph blocks with `subgraph layerId["Layer Label"]` /
      `  nodeId["module/path"]` / `end`, then emits blank line + edge declarations after all
      subgraphs; omits empty subgraphs) — exact implementations from plan.md Step 3

---

## Phase 5 — Pure Function: generateLayerDiagram (Sequential — depends on T005)

> `generateLayerDiagram` is structurally similar to `generateModuleGraph` but has a key difference:
> all four defined layers (ui, runtime, domain, infrastructure) are always emitted even if empty,
> making missing-layer assignments visually explicit.

- [x] T006 Implement and export
      `generateLayerDiagram(nodes: string[], edges: Array<{from:string;to:string}>, layerMap: Map<string,string>): string`
      in `scripts/architecture/visualize.ts` — returns `flowchart TD` Mermaid string that always
      emits all four defined layer subgraphs (ui, runtime, domain, infrastructure) even when empty;
      only the `unknown` subgraph is omitted when it has no members; edges are emitted after all
      `end` declarations (cross-layer arrows are therefore always visually separate from node
      declarations) — exact implementation from plan.md Step 3

---

## Phase 6 — Pure Function: generateSystemOverview (Sequential — depends on T006)

> Static hardcoded diagram reflecting the Zidney trust chain. Not derived from the dependency graph
> — it is the canonical platform topology as documented in AGENTS.md.

- [x] T007 Implement and export `generateSystemOverview(): string` in
      `scripts/architecture/visualize.ts` — returns a static hardcoded `flowchart TD` Mermaid string
      with three subgraphs: `subgraph ui["UI Layer"]` (mmc, backoffice, frontoffice),
      `subgraph backend["Backend Services"]` (api, worker),
      `subgraph Foundation["Foundation Packages"]` (packages/domain-core, packages/logger,
      packages/types, packages/config, packages/redis-utils); trust chain edges: `mmc → api`,
      `backoffice → api`, `frontoffice → api`, `api → worker`, `api → Foundation`,
      `worker → Foundation` — exact content from plan.md Step 3

---

## Phase 7 — Pure Function: generateReadme (Sequential — depends on T007)

> Generates the README.md for the visualization output directory. Accepts generation timestamp and
> git SHA as parameters to keep the function pure and testable.

- [x] T008 Implement and export `generateReadme(generatedAt: Date, gitSha: string): string` in
      `scripts/architecture/visualize.ts` — returns a Markdown string containing: auto-generated
      warning header; ISO 8601 timestamp from `generatedAt.toISOString()`; git SHA; three `###`
      diagram sections with file links and one-line descriptions (`module-dependency-graph.mmd`,
      `layer-architecture-diagram.mmd`, `system-overview-diagram.mmd`); Mermaid viewing instructions
      for GitHub / VS Code / mermaid.live; data sources table listing `dependency-graph.json`
      (required) and `ARCHITECTURE_MAP.json` (optional); governance reference links to AGENTS.md and
      docs/PROJECT_CONTEXT_PRIMER.md — exact content from plan.md Step 3

---

## Phase 8 — Internal Helpers and main() Entry Point (Sequential — depends on T008)

> Complete the script by adding the four internal helpers and the async `main()` function. This
> phase makes the script executable. After T009, `bun scripts/architecture/visualize.ts` must work
> end-to-end (given `dependency-graph.json` exists from a prior `arch:audit` run).

- [x] T009 Implement internal helpers in `scripts/architecture/visualize.ts`:
      `groupNodesByLayer(sortedNodes: string[], layerMap: Map<string,string>): Map<string,string[]>`
      (groups nodes by their layer value); `loadDependencyGraph(filePath: string): DependencyGraph`
      (exits with code 1 + `[VISUALIZE] ERROR: dependency-graph.json not found...` if file absent;
      exits with code 1 + `[VISUALIZE] ERROR: Failed to parse dependency-graph.json — <msg>` on JSON
      parse failure); `loadArchitectureMap(filePath: string): ArchitectureMap | null` (returns
      null + `[VISUALIZE] WARNING:` log if file absent or unparseable);
      `buildLayerMap(nodes: string[], archMap: ArchitectureMap | null): Map<string,string>` (prefers
      archMap.modules[node].layer, falls back to classifyLayerHeuristic, emits
      `[VISUALIZE] WARNING: No layer found for module <name>...` on unknown); `getGitSha(): string`
      (execSync `git rev-parse HEAD`, returns `"unknown"` on failure); then implement
      `async function main()` that calls all loaders, filterTopLevelNodes, deduplicateEdges,
      buildLayerMap, mkdirSync OUTPUT_DIR, all four generators, four writeFileSync calls, and prints
      `[VISUALIZE] Done — 3 diagrams written to docs/architecture/visualization/`; add `main()` call
      at end of file — exact implementations from plan.md Step 3

---

## Phase 9 — Unit Tests (Sequential — depends on T001, T002, T003–T009)

> Create the unit test file. All 12 tests use pure functions with fixture inputs — no vi.mock
> needed, no file I/O side effects during test execution.

- [x] T010 Create `tests/unit/visualize/visualize.test.ts` with `describe`/`it`/`expect` (vitest)
      importing `filterTopLevelNodes`, `deduplicateEdges`, `classifyLayerHeuristic`, `toNodeId`,
      `generateModuleGraph`, `generateLayerDiagram`, `generateSystemOverview` from
      `../../../scripts/architecture/visualize`; loads both fixture files via `readFileSync` at
      module level; implements 12 labeled tests: Test 1 (filterTopLevelNodes excludes paths starting
      with `./`), Test 2 (filterTopLevelNodes retains `apps/*` and `packages/*` top-level nodes),
      Test 3 (deduplicateEdges collapses duplicate `apps/api → packages/logger` to one edge), Test 4
      (deduplicateEdges excludes edges involving deep submodule endpoints), Test 5
      (generateModuleGraph starts with `flowchart TD` and contains `subgraph`/`end`), Test 6
      (generateLayerDiagram places `apps_api["apps/api"]` after `subgraph runtime` declaration),
      Test 7 (generateLayerDiagram edges appear after the last `  end` block), Test 8
      (generateSystemOverview contains all five service identifiers: mmc, backoffice, frontoffice,
      api, worker), Test 9 (classifyLayerHeuristic correctly classifies all 13 known module paths),
      Test 10 (classifyLayerHeuristic returns `"unknown"` for unrecognized paths), Test 11 (toNodeId
      converts `/` and `-` to `_` for apps/api, packages/domain-core, packages/redis-utils), Test 12
      (generateModuleGraph called twice with the same inputs returns byte-identical output) — exact
      test implementations from plan.md Step 4

---

## Phase 10 — Static Integration Tests (Sequential — depends on T009)

> Create the static test file validating output files generated by `bun run arch:visualize`. Tests
> use `existsSync`/`readFileSync` on real disk paths — `arch:visualize` must be run before executing
> `bun run test:static` to make these tests pass.

- [x] T011 Create `tests/static/06-architecture-visualization.test.ts` with 6 static tests: Test 6.1
      (`docs/architecture/visualization/` directory existsSync true), Test 6.2 (all four output
      files existsSync: module-dependency-graph.mmd, layer-architecture-diagram.mmd,
      system-overview-diagram.mmd, README.md — with descriptive failure messages instructing to run
      `bun run arch:visualize`), Test 6.3 (module-dependency-graph.mmd content does not contain `./`
      and does not match `apps\/[^/\s"]+\/[^/\s"]+` or `packages\/[^/\s"]+\/[^/\s"]+`), Test 6.4
      (layer-architecture-diagram.mmd subgraph count via `content.match(/subgraph /g)` is ≥ 4), Test
      6.5 (system-overview-diagram.mmd contains identifiers mmc, backoffice, frontoffice, api,
      worker), Test 6.6 (README.md contains references to module-dependency-graph.mmd,
      layer-architecture-diagram.mmd, system-overview-diagram.mmd) — exact test implementations from
      plan.md Step 5

---

## Phase 11 — package.json Script Entry (Sequential — depends on T009)

> Add the `arch:visualize` script entry adjacent to the existing `arch:` family. This is the last
> code change and makes the script invocable via `bun run arch:visualize`.

- [x] T012 Add `"arch:visualize": "bun scripts/architecture/visualize.ts"` to the `scripts` object
      in root `package.json` immediately after the `"arch:guard": "bun scripts/ai-guard.ts"` entry —
      preserving the existing arch: script ordering (arch:add-module, arch:generate, arch:audit,
      arch:context, arch:refresh, arch:fix, arch:guard, arch:visualize) — exact placement from
      plan.md Step 6

---

## Phase 12 — Validation (Sequential)

> Gate checks confirming all implementation layers integrate correctly. Must run in order: lint and
> typecheck before unit tests, unit tests before the E2E run, E2E run before static tests.

- [x] T013 Verify both fixture files parse as valid JSON: run
      `bun -e "JSON.parse(require('node:fs').readFileSync('tests/unit/visualize/fixtures/dependency-graph.fixture.json','utf-8'))"`
      and repeat for `architecture-map.fixture.json` — both must exit 0 without errors
- [x] T014 Run `bun run lint` from repo root and confirm exit code 0 — no Biome violations in
      `scripts/architecture/visualize.ts`, `tests/unit/visualize/visualize.test.ts`, or
      `tests/static/06-architecture-visualization.test.ts`
- [x] T015 Run `bun run typecheck` from repo root and confirm exit code 0 —
      `scripts/architecture/visualize.ts` passes strict TypeScript with no type errors (all exported
      function signatures match data-model.md §7)
- [x] T016 Run `vitest run tests/unit/visualize/visualize.test.ts` directly and confirm all 12 unit
      tests pass — validates all exported pure functions against the fixture data
- [x] T017 Run `bun run arch:audit` first (ensures `docs/architecture/graphs/dependency-graph.json`
      exists), then run `bun run arch:visualize` and verify: exit code 0, output line
      `[VISUALIZE] Done — 3 diagrams written to docs/architecture/visualization/`, and all four
      files exist in `docs/architecture/visualization/` (`module-dependency-graph.mmd`,
      `layer-architecture-diagram.mmd`, `system-overview-diagram.mmd`, `README.md`)
- [x] T018 Run `bun run test:static` from repo root and confirm all static tests pass including all
      6 new tests in `tests/static/06-architecture-visualization.test.ts`

---

## Dependencies

```
T001 ──┬─────────────────────────────────────── T010
T002 ──┘                                         │
                                                 ↓
T003 → T004 → T005 → T006 → T007 → T008 → T009 ─┤── T010 → T016
                                             │   ├── T011
                                             │   └── T012 → T017

T013 (after T001, T002)
T014 (after T009 — needs script file)
T015 (after T009 — needs script file)
T016 (after T010 — unit tests depend on fixtures + script)
T017 (after T012 — needs arch:visualize in package.json)
T018 (after T011 and T017 — needs static test file and generated output)
```

**Key sequential chains**:

- T001 and T002 are fully parallel (different fixture files, no shared state)
- T003 → T004 → T005 → T006 → T007 → T008 → T009 is strictly sequential (each phase adds to the same
  script file and later phases call functions added in earlier phases)
- T010 and T011 and T012 are parallel after T009 completes (different files, no interdependencies)
- T017 depends on T012 (the `arch:visualize` package.json entry) and implicitly on T009 (the script
  itself)
- T018 depends on T011 (static test file) and T017 (generated output files must exist)
- Validation tasks T013–T018 must run strictly in order

---

## Parallel Execution Opportunities

**Group A** — Fixtures (fully independent, no prerequisites):

```
T001: tests/unit/visualize/fixtures/dependency-graph.fixture.json
T002: tests/unit/visualize/fixtures/architecture-map.fixture.json
```

**Group B** — After T009 completes (independent files, different directories):

```
T010: tests/unit/visualize/visualize.test.ts  (12 unit tests)
T011: tests/static/06-architecture-visualization.test.ts  (6 static tests)
T012: package.json  (arch:visualize script entry)
```

---

## Implementation Strategy

**MVP Scope** (delivers a working `bun run arch:visualize` command):

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T012
```

After T012: `bun run arch:visualize` generates all four output files.

**Full scope** (adds automated verification):

T010 + T011 add the 18 automated test cases. T013–T018 gate the implementation.

**Stage-complete criteria**:

- `bun run lint` exits 0
- `bun run typecheck` exits 0
- `vitest run tests/unit/visualize/visualize.test.ts` — 12 tests pass
- `bun run arch:visualize` exits 0 and writes 4 files
- `bun run test:static` — all tests pass including `06-architecture-visualization.test.ts`

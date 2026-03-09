# Implementation Plan: STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION

**Feature Branch**: `spec/infra-008-architecture-visualization`  
**Stage**: `STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION`  
**Phase**: `01_PLATFORM_FOUNDATION`  
**Related Spec File**: `specs/runtime/infra-008-architecture-visualization/spec.md`  
**Related ADR**: None — this stage consumes existing architectural decisions without introducing new ones  
**Plan Generated**: 2026-03-09  
**Status**: Draft — ready for implementation gate review

---

## Stage Alignment

- **Phase**: `01_PLATFORM_FOUNDATION`
- **Stage**: `STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION`
- **Related Spec**: `specs/runtime/infra-008-architecture-visualization/spec.md`
- **Related ADR**: None required (confirmed by spec Constitutional Compliance Declaration)

---

## Architectural Scope Confirmation

| Rule                                | Status   | Notes                                                            |
| ----------------------------------- | -------- | ---------------------------------------------------------------- |
| No cross-tenant data access         | ✅ CLEAR | No database access of any kind                                   |
| No middleware bypass                | ✅ CLEAR | No API routes or middleware                                      |
| No direct DB instantiation          | ✅ CLEAR | Pure CLI tool, reads static JSON files                           |
| No grading logic outside Worker     | ✅ CLEAR | Not applicable — this is a developer tooling stage               |
| No weakening of snapshot integrity  | ✅ CLEAR | Not applicable                                                   |
| No weakening of version enforcement | ✅ CLEAR | Not applicable                                                   |
| No layer boundary violation         | ✅ CLEAR | Script lives in `scripts/` layer; imports only Node.js built-ins |

**This is a pure developer tooling stage. No cross-cutting architectural concerns apply.**

---

## Architecture Overview

`scripts/architecture/visualize.ts` is a standalone CLI script that reads two existing architecture data files and produces four curated output files:

```
INPUTS (read-only)
  docs/architecture/graphs/dependency-graph.json       [REQUIRED]
  docs/architecture/intelligence/ARCHITECTURE_MAP.json [OPTIONAL]

PROCESSING
  filterTopLevelNodes()     → keeps only apps/* and packages/* (two-segment paths)
  deduplicateEdges()        → removes duplicate (from, to) pairs
  buildLayerMap()           → merges ArchitectureMap lookup with heuristic fallback
  generateModuleGraph()     → module-dependency-graph.mmd content
  generateLayerDiagram()    → layer-architecture-diagram.mmd content
  generateSystemOverview()  → system-overview-diagram.mmd content (hardcoded)
  generateReadme()          → README.md content

OUTPUTS (written to docs/architecture/visualization/)
  module-dependency-graph.mmd
  layer-architecture-diagram.mmd
  system-overview-diagram.mmd
  README.md
```

### Module Relationship

```
scripts/architecture/visualize.ts
  ├── node:fs       (readFileSync, writeFileSync, existsSync, mkdirSync)
  ├── node:path     (join, resolve)
  └── node:child_process (execSync — for git SHA)

No imports from apps/* or packages/*
No imports from other scripts/*
```

---

## Implementation Layers

### CLI Script Layer (`scripts/`)

- **Script file**: `scripts/architecture/visualize.ts`
- **Execution**: `bun scripts/architecture/visualize.ts` or `bun run arch:visualize`
- **No API routes, no middleware, no tenant resolver, no license middleware**
- **Exit code 0** on success, **exit code 1** on fatal error
- **All messages prefixed with `[VISUALIZE]`**

### Test Layer (`tests/`)

- **Unit tests**: `tests/unit/visualize/visualize.test.ts` — pure function tests, no file I/O
- **Static test**: `tests/static/06-architecture-visualization.test.ts` — file existence and structure validation
- **Test fixtures**: `tests/unit/visualize/fixtures/` — minimal JSON files

### Configuration Layer (`package.json`)

- **One new script entry**: `"arch:visualize": "bun scripts/architecture/visualize.ts"`

---

## Database Impact

**None.** This stage does not access any database. No migrations required. No schema changes.

---

## Transaction Design

**Not applicable.** No mutating database operations.

---

## Idempotency Plan

**Structurally idempotent by design** (FR-011). Identical input files produce byte-identical output files on every run. The only non-deterministic element is the README.md timestamp, which is acceptable per spec.

---

## Version Enforcement Strategy

**Not applicable.** No schema_version or product_version validation required for this tooling stage.

---

## Authoritative Time Handling

**Not applicable as a security concern.** The generation timestamp in README.md (from `new Date()`) is informational only — not used for any deadline or lock enforcement.

---

## Implementation Design

### Files Overview

| File                                                          | Action | Purpose                                   |
| ------------------------------------------------------------- | ------ | ----------------------------------------- |
| `scripts/architecture/visualize.ts`                           | CREATE | Main visualization generator script       |
| `tests/unit/visualize/visualize.test.ts`                      | CREATE | 12 unit tests for exported pure functions |
| `tests/static/06-architecture-visualization.test.ts`          | CREATE | 6 static integration tests                |
| `tests/unit/visualize/fixtures/dependency-graph.fixture.json` | CREATE | Minimal dependency graph fixture          |
| `tests/unit/visualize/fixtures/architecture-map.fixture.json` | CREATE | Minimal architecture map fixture          |
| `package.json`                                                | MODIFY | Add `arch:visualize` script entry         |

---

## Step-by-Step Implementation

---

### Step 1 — CREATE: `tests/unit/visualize/fixtures/dependency-graph.fixture.json`

**File**: `tests/unit/visualize/fixtures/dependency-graph.fixture.json`

**Content** (exact):

```json
{
  "nodes": [
    "apps/api",
    "apps/mmc",
    "packages/domain-core",
    "packages/logger",
    "packages/api-client",
    "./apps/mmc/src/core/auth/token-manager",
    "./apps/mmc/srcvue/test-utils"
  ],
  "edges": [
    {"from": "apps/api", "to": "packages/domain-core"},
    {"from": "apps/api", "to": "packages/logger"},
    {"from": "apps/api", "to": "packages/logger"},
    {"from": "apps/mmc", "to": "packages/api-client"},
    {"from": "./apps/mmc/src/core/auth/token-manager", "to": "packages/domain-core"}
  ]
}
```

**Validation after creation**: `JSON.parse(readFileSync(...))` must not throw. Contains 5 top-level nodes, 2 deep submodule nodes, 5 edges (1 duplicate, 1 involving a deep submodule).

---

### Step 2 — CREATE: `tests/unit/visualize/fixtures/architecture-map.fixture.json`

**File**: `tests/unit/visualize/fixtures/architecture-map.fixture.json`

**Content** (exact):

```json
{
  "system": "Zidney",
  "architecture_model": "layered-monorepo",
  "version": "1.0",
  "layers": ["domain", "infrastructure", "runtime", "ui"],
  "modules": {
    "apps/api": {
      "layer": "runtime",
      "description": "Main backend API",
      "criticality": "runtime",
      "allowed_dependencies": [],
      "forbidden_dependencies": []
    },
    "apps/mmc": {
      "layer": "ui",
      "description": "Management console",
      "criticality": "ui",
      "allowed_dependencies": [],
      "forbidden_dependencies": []
    },
    "packages/domain-core": {
      "layer": "domain",
      "description": "Core domain models",
      "criticality": "core",
      "allowed_dependencies": [],
      "forbidden_dependencies": []
    },
    "packages/logger": {
      "layer": "infrastructure",
      "description": "Structured logging",
      "criticality": "infrastructure",
      "allowed_dependencies": [],
      "forbidden_dependencies": []
    },
    "packages/api-client": {
      "layer": "infrastructure",
      "description": "HTTP client for UI",
      "criticality": "infrastructure",
      "allowed_dependencies": [],
      "forbidden_dependencies": []
    }
  }
}
```

---

### Step 3 — CREATE: `scripts/architecture/visualize.ts`

**File**: `scripts/architecture/visualize.ts`

**Complete implementation**:

```typescript
// CLI utility — exempt from service-layer logging standards.
import {execSync} from 'node:child_process'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

const ROOT = process.cwd()
const DEPENDENCY_GRAPH_PATH = join(ROOT, 'docs/architecture/graphs/dependency-graph.json')
const ARCHITECTURE_MAP_PATH = join(ROOT, 'docs/architecture/intelligence/ARCHITECTURE_MAP.json')
const OUTPUT_DIR = join(ROOT, 'docs/architecture/visualization')

// ─── Type Definitions ────────────────────────────────────────────────────────

interface DependencyGraph {
  nodes: string[]
  edges: Array<{from: string; to: string}>
}

interface ArchitectureMapModule {
  layer: string
  description: string
  criticality: string
  allowed_dependencies: string[]
  forbidden_dependencies: string[]
}

interface ArchitectureMap {
  system: string
  architecture_model: string
  version: string
  layers: string[]
  modules: Record<string, ArchitectureMapModule>
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOP_LEVEL_PATTERN = /^(apps|packages)\/[^/]+$/

const HEURISTIC_LAYER_MAP: Record<string, string> = {
  'apps/mmc': 'ui',
  'apps/backoffice': 'ui',
  'apps/frontoffice': 'ui',
  'apps/api': 'runtime',
  'apps/worker': 'runtime',
  'packages/ui-system': 'ui',
  'packages/api-client': 'infrastructure',
  'packages/domain-core': 'domain',
  'packages/validation': 'domain',
  'packages/types': 'domain',
  'packages/logger': 'infrastructure',
  'packages/config': 'infrastructure',
  'packages/redis-utils': 'infrastructure',
}

const LAYER_ORDER = ['ui', 'runtime', 'domain', 'infrastructure', 'unknown']

const LAYER_LABELS: Record<string, string> = {
  ui: 'UI Layer',
  runtime: 'Runtime Layer',
  domain: 'Domain Layer',
  infrastructure: 'Infrastructure Layer',
  unknown: 'Unknown Layer',
}

// ─── Pure Exported Functions (unit-testable) ──────────────────────────────────

/**
 * Filters a raw node list to top-level modules only.
 * Keeps only paths matching apps/<name> or packages/<name> (exactly 2 segments).
 */
export function filterTopLevelNodes(nodes: string[]): string[] {
  return nodes.filter(n => TOP_LEVEL_PATTERN.test(n))
}

/**
 * Deduplicates edges, retaining only edges where both endpoints
 * are top-level modules. One entry per unique (from, to) pair.
 * Output is sorted alphabetically by from then to (determinism).
 */
export function deduplicateEdges(
  edges: Array<{from: string; to: string}>,
  topLevelNodes: Set<string>
): Array<{from: string; to: string}> {
  const seen = new Set<string>()
  const result: Array<{from: string; to: string}> = []

  for (const edge of edges) {
    if (!topLevelNodes.has(edge.from) || !topLevelNodes.has(edge.to)) continue
    if (edge.from === edge.to) continue

    const key = `${edge.from}||${edge.to}`
    if (seen.has(key)) continue

    seen.add(key)
    result.push({from: edge.from, to: edge.to})
  }

  return result.sort((a, b) => {
    const fromCmp = a.from.localeCompare(b.from)
    return fromCmp !== 0 ? fromCmp : a.to.localeCompare(b.to)
  })
}

/**
 * Applies heuristic layer classification when ARCHITECTURE_MAP.json is
 * unavailable or a module path is absent from its modules map.
 * Returns "unknown" for unrecognized paths.
 */
export function classifyLayerHeuristic(modulePath: string): string {
  return HEURISTIC_LAYER_MAP[modulePath] ?? 'unknown'
}

/**
 * Converts a module path to a safe Mermaid node ID.
 * Replaces '/' and '-' with '_'.
 *
 * "apps/api"             → "apps_api"
 * "packages/domain-core" → "packages_domain_core"
 */
export function toNodeId(modulePath: string): string {
  return modulePath.replace(/[/-]/g, '_')
}

/**
 * Generates the module-dependency-graph.mmd content.
 * Nodes grouped by layer in subgraphs, edges follow.
 */
export function generateModuleGraph(
  nodes: string[],
  edges: Array<{from: string; to: string}>,
  layerMap: Map<string, string>
): string {
  const sorted = [...nodes].sort()
  const byLayer = groupNodesByLayer(sorted, layerMap)
  const lines: string[] = ['flowchart TD']

  for (const layer of LAYER_ORDER) {
    const layerNodes = byLayer.get(layer)
    if (!layerNodes || layerNodes.length === 0) continue

    const label = LAYER_LABELS[layer] ?? layer
    lines.push(`  subgraph ${toNodeId(layer)}["${label}"]`)
    for (const n of layerNodes) {
      lines.push(`    ${toNodeId(n)}["${n}"]`)
    }
    lines.push('  end')
  }

  if (edges.length > 0) {
    lines.push('')
    for (const edge of edges) {
      lines.push(`  ${toNodeId(edge.from)} --> ${toNodeId(edge.to)}`)
    }
  }

  return lines.join('\n') + '\n'
}

/**
 * Generates the layer-architecture-diagram.mmd content.
 * Identical structure to generateModuleGraph — all four defined layers
 * are always emitted (even if empty) to make layer assignments explicit.
 */
export function generateLayerDiagram(
  nodes: string[],
  edges: Array<{from: string; to: string}>,
  layerMap: Map<string, string>
): string {
  const sorted = [...nodes].sort()
  const byLayer = groupNodesByLayer(sorted, layerMap)
  const lines: string[] = ['flowchart TD']

  for (const layer of LAYER_ORDER) {
    const layerNodes = byLayer.get(layer) ?? []
    // Always emit the four defined layers; skip Unknown if empty
    if (layer === 'unknown' && layerNodes.length === 0) continue

    const label = LAYER_LABELS[layer] ?? layer
    lines.push(`  subgraph ${toNodeId(layer)}["${label}"]`)
    for (const n of layerNodes) {
      lines.push(`    ${toNodeId(n)}["${n}"]`)
    }
    lines.push('  end')
  }

  if (edges.length > 0) {
    lines.push('')
    for (const edge of edges) {
      lines.push(`  ${toNodeId(edge.from)} --> ${toNodeId(edge.to)}`)
    }
  }

  return lines.join('\n') + '\n'
}

/**
 * Generates the system-overview-diagram.mmd content.
 * STATIC — not derived from the dependency graph.
 * Reflects the Zidney trust chain model from AGENTS.md.
 */
export function generateSystemOverview(): string {
  return [
    'flowchart TD',
    '  subgraph ui["UI Layer"]',
    '    mmc["MMC\\n(Management Console)"]',
    '    backoffice["Backoffice\\n(Institution Panel)"]',
    '    frontoffice["Frontoffice\\n(Student Runtime)"]',
    '  end',
    '  subgraph backend["Backend Services"]',
    '    api["API\\n(Bun + Hono)"]',
    '    worker["Worker\\n(Job Processor)"]',
    '  end',
    '  subgraph Foundation["Foundation Packages"]',
    '    domain_core["packages/domain-core"]',
    '    pkg_logger["packages/logger"]',
    '    pkg_types["packages/types"]',
    '    pkg_config["packages/config"]',
    '    pkg_redis["packages/redis-utils"]',
    '  end',
    '',
    '  mmc --> api',
    '  backoffice --> api',
    '  frontoffice --> api',
    '  api --> worker',
    '  api --> Foundation',
    '  worker --> Foundation',
    '',
  ].join('\n')
}

/**
 * Generates the README.md content for docs/architecture/visualization/.
 */
export function generateReadme(generatedAt: Date, gitSha: string): string {
  return [
    '# Architecture Visualization',
    '',
    '> **Auto-generated** — do not edit manually.',
    '> Re-run `bun run arch:visualize` to refresh after running `bun run arch:audit`.',
    '',
    `Generated: ${generatedAt.toISOString()}`,
    `Git SHA: ${gitSha}`,
    '',
    '---',
    '',
    '## Diagrams',
    '',
    '### [module-dependency-graph.mmd](./module-dependency-graph.mmd)',
    '',
    'Top-level module dependency graph with layer subgraph annotations.',
    'Shows all registered `apps/*` and `packages/*` modules and their deduplicated',
    'dependency edges, grouped by architectural layer (UI, Runtime, Domain, Infrastructure).',
    '',
    '### [layer-architecture-diagram.mmd](./layer-architecture-diagram.mmd)',
    '',
    'Layer hierarchy diagram showing modules grouped by their assigned architectural layer.',
    'Cross-layer dependency edges are rendered after subgraph declarations — any edge',
    'pointing against the `UI → Runtime → Domain → Infrastructure` direction indicates',
    'a potential architectural violation.',
    '',
    '### [system-overview-diagram.mmd](./system-overview-diagram.mmd)',
    '',
    'Static Zidney platform trust chain and service topology.',
    'Shows the five named services (MMC, Backoffice, Frontoffice, API, Worker) and the',
    'Foundation package group. Reflects the trust chain model defined in `AGENTS.md`.',
    '',
    '---',
    '',
    '## How to View',
    '',
    '- **GitHub**: `.mmd` files render automatically as Mermaid diagrams in the GitHub UI.',
    '- **VS Code**: Install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) extension.',
    '- **Online**: Paste the `.mmd` file content into [mermaid.live](https://mermaid.live).',
    '',
    '---',
    '',
    '## Data Sources',
    '',
    '| File | Role |',
    '| ---- | ---- |',
    '| `docs/architecture/graphs/dependency-graph.json` | Primary data source (required). Produced by `bun run arch:audit`. |',
    '| `docs/architecture/intelligence/ARCHITECTURE_MAP.json` | Layer classification source (optional). Produced by `bun run arch:generate`. |',
    '',
    '---',
    '',
    '## Governance Reference',
    '',
    'See `AGENTS.md` for the authoritative Zidney trust chain, platform identity, and',
    'multi-tenancy rules that govern the architecture shown in these diagrams.',
    '',
    'See `docs/PROJECT_CONTEXT_PRIMER.md` for the full platform context.',
    '',
  ].join('\n')
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function groupNodesByLayer(
  sortedNodes: string[],
  layerMap: Map<string, string>
): Map<string, string[]> {
  const result = new Map<string, string[]>()

  for (const n of sortedNodes) {
    const layer = layerMap.get(n) ?? 'unknown'
    if (!result.has(layer)) result.set(layer, [])
    result.get(layer)!.push(n)
  }

  return result
}

function loadDependencyGraph(filePath: string): DependencyGraph {
  if (!existsSync(filePath)) {
    console.log(
      `[VISUALIZE] ERROR: dependency-graph.json not found. Run 'bun run arch:audit' first.`
    )
    process.exit(1)
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as DependencyGraph
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`[VISUALIZE] ERROR: Failed to parse dependency-graph.json — ${message}`)
    process.exit(1)
  }
}

function loadArchitectureMap(filePath: string): ArchitectureMap | null {
  if (!existsSync(filePath)) {
    console.log(
      `[VISUALIZE] WARNING: ARCHITECTURE_MAP.json not found — using heuristic layer classification.`
    )
    return null
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as ArchitectureMap
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(
      `[VISUALIZE] WARNING: Failed to parse ARCHITECTURE_MAP.json (${message}) — using heuristic layer classification.`
    )
    return null
  }
}

function buildLayerMap(nodes: string[], archMap: ArchitectureMap | null): Map<string, string> {
  const result = new Map<string, string>()

  for (const node of nodes) {
    let layer: string

    if (archMap && archMap.modules[node]) {
      layer = archMap.modules[node].layer
    } else {
      layer = classifyLayerHeuristic(node)
    }

    if (layer === 'unknown') {
      console.log(`[VISUALIZE] WARNING: No layer found for module ${node} — classified as Unknown`)
    }

    result.set(node, layer)
  }

  return result
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', {encoding: 'utf-8'}).trim()
  } catch {
    return 'unknown'
  }
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const graph = loadDependencyGraph(DEPENDENCY_GRAPH_PATH)
  const archMap = loadArchitectureMap(ARCHITECTURE_MAP_PATH)

  const topLevelNodes = filterTopLevelNodes(graph.nodes)
  const topLevelNodeSet = new Set(topLevelNodes)
  const edges = deduplicateEdges(graph.edges, topLevelNodeSet)
  const layerMap = buildLayerMap(topLevelNodes, archMap)

  mkdirSync(OUTPUT_DIR, {recursive: true})

  const moduleGraph = generateModuleGraph(topLevelNodes, edges, layerMap)
  const layerDiagram = generateLayerDiagram(topLevelNodes, edges, layerMap)
  const systemOverview = generateSystemOverview()
  const readme = generateReadme(new Date(), getGitSha())

  writeFileSync(join(OUTPUT_DIR, 'module-dependency-graph.mmd'), moduleGraph, 'utf-8')
  writeFileSync(join(OUTPUT_DIR, 'layer-architecture-diagram.mmd'), layerDiagram, 'utf-8')
  writeFileSync(join(OUTPUT_DIR, 'system-overview-diagram.mmd'), systemOverview, 'utf-8')
  writeFileSync(join(OUTPUT_DIR, 'README.md'), readme, 'utf-8')

  console.log(`[VISUALIZE] Done — 3 diagrams written to docs/architecture/visualization/`)
}

main()
```

**Validation after creation**:

- File must be runnable: `bun scripts/architecture/visualize.ts` (requires `dependency-graph.json` to exist)
- Type check: `bun typecheck:src` must pass
- Lint: `bun lint` must pass
- All exported function names must match the function signatures in `data-model.md §7`

---

### Step 4 — CREATE: `tests/unit/visualize/visualize.test.ts`

**File**: `tests/unit/visualize/visualize.test.ts`

**Complete implementation**:

```typescript
/**
 * Unit tests: scripts/architecture/visualize.ts
 *
 * Tests pure exported functions using fixture data (no real disk operations).
 * 12 test cases covering all exported functions.
 *
 * Stage: STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION
 */

import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe, expect, it} from 'vitest'
import {
  classifyLayerHeuristic,
  deduplicateEdges,
  filterTopLevelNodes,
  generateLayerDiagram,
  generateModuleGraph,
  generateSystemOverview,
  toNodeId,
} from '../../../scripts/architecture/visualize'

const FIXTURES_DIR = join(process.cwd(), 'tests/unit/visualize/fixtures')

const GRAPH_FIXTURE = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'dependency-graph.fixture.json'), 'utf-8')
)
const MAP_FIXTURE = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'architecture-map.fixture.json'), 'utf-8')
)

// Build a minimal layerMap from the fixture for use in diagram tests
function buildFixtureLayerMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [module, meta] of Object.entries(
    MAP_FIXTURE.modules as Record<string, {layer: string}>
  )) {
    map.set(module, meta.layer)
  }
  return map
}

describe('visualize.ts — unit tests', () => {
  // ─── filterTopLevelNodes ───────────────────────────────────────────────────

  describe('filterTopLevelNodes', () => {
    /**
     * Test 1: Deep submodule paths starting with './' are excluded
     */
    it('Test 1: excludes deep submodule paths starting with "./"', () => {
      const result = filterTopLevelNodes(GRAPH_FIXTURE.nodes as string[])
      for (const node of result) {
        expect(node).not.toMatch(/^\.\//)
      }
    })

    /**
     * Test 2: apps/* and packages/* top-level nodes are retained
     */
    it('Test 2: retains apps/* and packages/* top-level nodes', () => {
      const result = filterTopLevelNodes(GRAPH_FIXTURE.nodes as string[])
      expect(result).toContain('apps/api')
      expect(result).toContain('apps/mmc')
      expect(result).toContain('packages/domain-core')
      expect(result).toContain('packages/logger')
      expect(result).toContain('packages/api-client')
    })
  })

  // ─── deduplicateEdges ──────────────────────────────────────────────────────

  describe('deduplicateEdges', () => {
    const topLevel = new Set([
      'apps/api',
      'apps/mmc',
      'packages/domain-core',
      'packages/logger',
      'packages/api-client',
    ])

    /**
     * Test 3: Duplicate (from, to) pairs are reduced to a single edge
     */
    it('Test 3: deduplicates multiple identical edges', () => {
      const result = deduplicateEdges(GRAPH_FIXTURE.edges, topLevel)
      const apApiToLogger = result.filter(e => e.from === 'apps/api' && e.to === 'packages/logger')
      expect(apApiToLogger).toHaveLength(1)
    })

    /**
     * Test 4: Edges involving deep submodule nodes are excluded
     */
    it('Test 4: excludes edges involving deep submodule nodes', () => {
      const result = deduplicateEdges(GRAPH_FIXTURE.edges, topLevel)
      for (const edge of result) {
        expect(edge.from).not.toMatch(/^\.\//)
        expect(edge.to).not.toMatch(/^\.\//)
      }
    })
  })

  // ─── generateModuleGraph ───────────────────────────────────────────────────

  describe('generateModuleGraph', () => {
    /**
     * Test 5: Output contains valid Mermaid flowchart TD directive and subgraph blocks
     */
    it('Test 5: generates valid Mermaid flowchart TD with subgraph blocks', () => {
      const topLevel = filterTopLevelNodes(GRAPH_FIXTURE.nodes as string[])
      const topLevelSet = new Set(topLevel)
      const edges = deduplicateEdges(GRAPH_FIXTURE.edges, topLevelSet)
      const layerMap = buildFixtureLayerMap()

      const result = generateModuleGraph(topLevel, edges, layerMap)

      expect(result).toMatch(/^flowchart TD/)
      expect(result).toContain('subgraph')
      expect(result).toContain('end')
    })

    /**
     * Test 12: Output is stable when nodes are ordered alphabetically
     */
    it('Test 12: output is stable — same input always produces identical output', () => {
      const topLevel = filterTopLevelNodes(GRAPH_FIXTURE.nodes as string[])
      const topLevelSet = new Set(topLevel)
      const edges = deduplicateEdges(GRAPH_FIXTURE.edges, topLevelSet)
      const layerMap = buildFixtureLayerMap()

      const result1 = generateModuleGraph(topLevel, edges, layerMap)
      const result2 = generateModuleGraph(topLevel, edges, layerMap)

      expect(result1).toBe(result2)
    })
  })

  // ─── generateLayerDiagram ─────────────────────────────────────────────────

  describe('generateLayerDiagram', () => {
    /**
     * Test 6: Nodes appear in the correct layer subgraph
     */
    it('Test 6: nodes appear in correct layer subgraph', () => {
      const topLevel = filterTopLevelNodes(GRAPH_FIXTURE.nodes as string[])
      const topLevelSet = new Set(topLevel)
      const edges = deduplicateEdges(GRAPH_FIXTURE.edges, topLevelSet)
      const layerMap = buildFixtureLayerMap()

      const result = generateLayerDiagram(topLevel, edges, layerMap)

      // apps/api is runtime — its node ID should appear after the runtime subgraph declaration
      const runtimeIdx = result.indexOf('subgraph runtime')
      const appsApiIdx = result.indexOf('apps_api["apps/api"]')
      expect(runtimeIdx).toBeGreaterThanOrEqual(0)
      expect(appsApiIdx).toBeGreaterThan(runtimeIdx)
    })

    /**
     * Test 7: Cross-layer edges appear after all subgraph declarations
     */
    it('Test 7: cross-layer edges appear after subgraph declarations', () => {
      const topLevel = filterTopLevelNodes(GRAPH_FIXTURE.nodes as string[])
      const topLevelSet = new Set(topLevel)
      const edges = deduplicateEdges(GRAPH_FIXTURE.edges, topLevelSet)
      const layerMap = buildFixtureLayerMap()

      const result = generateLayerDiagram(topLevel, edges, layerMap)

      const lastEndIdx = result.lastIndexOf('  end')
      const firstEdgeIdx = result.indexOf('-->')

      expect(lastEndIdx).toBeGreaterThanOrEqual(0)
      expect(firstEdgeIdx).toBeGreaterThan(lastEndIdx)
    })
  })

  // ─── generateSystemOverview ───────────────────────────────────────────────

  describe('generateSystemOverview', () => {
    /**
     * Test 8: System overview contains all five expected service nodes
     */
    it('Test 8: contains all five Zidney service nodes', () => {
      const result = generateSystemOverview()

      expect(result).toContain('mmc')
      expect(result).toContain('backoffice')
      expect(result).toContain('frontoffice')
      expect(result).toContain('api')
      expect(result).toContain('worker')
    })
  })

  // ─── classifyLayerHeuristic ───────────────────────────────────────────────

  describe('classifyLayerHeuristic', () => {
    /**
     * Test 9: Correctly classifies all 13 known modules
     */
    it('Test 9: correctly classifies all known modules', () => {
      expect(classifyLayerHeuristic('apps/mmc')).toBe('ui')
      expect(classifyLayerHeuristic('apps/backoffice')).toBe('ui')
      expect(classifyLayerHeuristic('apps/frontoffice')).toBe('ui')
      expect(classifyLayerHeuristic('apps/api')).toBe('runtime')
      expect(classifyLayerHeuristic('apps/worker')).toBe('runtime')
      expect(classifyLayerHeuristic('packages/ui-system')).toBe('ui')
      expect(classifyLayerHeuristic('packages/api-client')).toBe('infrastructure')
      expect(classifyLayerHeuristic('packages/domain-core')).toBe('domain')
      expect(classifyLayerHeuristic('packages/validation')).toBe('domain')
      expect(classifyLayerHeuristic('packages/types')).toBe('domain')
      expect(classifyLayerHeuristic('packages/logger')).toBe('infrastructure')
      expect(classifyLayerHeuristic('packages/config')).toBe('infrastructure')
      expect(classifyLayerHeuristic('packages/redis-utils')).toBe('infrastructure')
    })

    /**
     * Test 10: Returns "unknown" for unrecognized paths
     */
    it('Test 10: returns "unknown" for unrecognized module paths', () => {
      expect(classifyLayerHeuristic('packages/app')).toBe('unknown')
      expect(classifyLayerHeuristic('packages/ui')).toBe('unknown')
      expect(classifyLayerHeuristic('apps/something-new')).toBe('unknown')
    })
  })

  // ─── toNodeId ─────────────────────────────────────────────────────────────

  describe('toNodeId', () => {
    /**
     * Test 11: Handles '/' and '-' characters correctly
     */
    it('Test 11: converts "/" and "-" to "_" in node IDs', () => {
      expect(toNodeId('apps/api')).toBe('apps_api')
      expect(toNodeId('packages/domain-core')).toBe('packages_domain_core')
      expect(toNodeId('packages/redis-utils')).toBe('packages_redis_utils')
      expect(toNodeId('apps/mmc')).toBe('apps_mmc')
    })
  })
})
```

**Test coverage**: 12 test cases across 7 exported functions. All pure function tests — no file I/O mocking required.

---

### Step 5 — CREATE: `tests/static/06-architecture-visualization.test.ts`

**File**: `tests/static/06-architecture-visualization.test.ts`

**Complete implementation**:

```typescript
/**
 * Area 6: Architecture Visualization Output Validation (Static Analysis)
 *
 * Verifies that docs/architecture/visualization/ is populated with the
 * expected output files after bun run arch:visualize has been executed.
 *
 * NOTE: This test validates the OUTPUT of the visualization script, not
 * the script itself. It assumes arch:visualize has been run and the output
 * files exist. Run `bun run arch:visualize` before running this test in CI.
 *
 * Stage: STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION
 */

import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe, expect, it} from 'vitest'

const VIZ_DIR = join(process.cwd(), 'docs/architecture/visualization')
const MODULE_GRAPH = join(VIZ_DIR, 'module-dependency-graph.mmd')
const LAYER_DIAGRAM = join(VIZ_DIR, 'layer-architecture-diagram.mmd')
const SYSTEM_OVERVIEW = join(VIZ_DIR, 'system-overview-diagram.mmd')
const README = join(VIZ_DIR, 'README.md')

describe('Area 6: Architecture Visualization Output Validation', () => {
  /**
   * Test 6.1: Output directory exists
   */
  it('Test 6.1: docs/architecture/visualization/ directory exists', () => {
    expect(existsSync(VIZ_DIR)).toBe(true)
  })

  /**
   * Test 6.2: All four expected output files exist
   */
  it('Test 6.2: all four output files exist', () => {
    expect(
      existsSync(MODULE_GRAPH),
      `module-dependency-graph.mmd must exist — run 'bun run arch:visualize' first`
    ).toBe(true)
    expect(
      existsSync(LAYER_DIAGRAM),
      `layer-architecture-diagram.mmd must exist — run 'bun run arch:visualize' first`
    ).toBe(true)
    expect(
      existsSync(SYSTEM_OVERVIEW),
      `system-overview-diagram.mmd must exist — run 'bun run arch:visualize' first`
    ).toBe(true)
    expect(existsSync(README), `README.md must exist — run 'bun run arch:visualize' first`).toBe(
      true
    )
  })

  /**
   * Test 6.3: module-dependency-graph.mmd contains no deep submodule paths
   */
  it('Test 6.3: module-dependency-graph.mmd contains no deep submodule paths', () => {
    if (!existsSync(MODULE_GRAPH)) return // Skip if not generated yet

    const content = readFileSync(MODULE_GRAPH, 'utf-8')

    // Deep submodule paths start with './' or contain more than two path segments
    // in the form apps/.../something or packages/.../something
    expect(content).not.toContain('./')
    expect(content).not.toMatch(/apps\/[^/\s"]+\/[^/\s"]+/)
    expect(content).not.toMatch(/packages\/[^/\s"]+\/[^/\s"]+/)
  })

  /**
   * Test 6.4: layer-architecture-diagram.mmd contains at least four subgraph declarations
   */
  it('Test 6.4: layer-architecture-diagram.mmd contains at least four subgraph declarations', () => {
    if (!existsSync(LAYER_DIAGRAM)) return

    const content = readFileSync(LAYER_DIAGRAM, 'utf-8')
    const subgraphCount = (content.match(/subgraph /g) ?? []).length

    expect(subgraphCount).toBeGreaterThanOrEqual(4)
  })

  /**
   * Test 6.5: system-overview-diagram.mmd contains all five application node identifiers
   */
  it('Test 6.5: system-overview-diagram.mmd contains all five application nodes', () => {
    if (!existsSync(SYSTEM_OVERVIEW)) return

    const content = readFileSync(SYSTEM_OVERVIEW, 'utf-8')

    expect(content).toContain('mmc')
    expect(content).toContain('backoffice')
    expect(content).toContain('frontoffice')
    expect(content).toContain('api')
    expect(content).toContain('worker')
  })

  /**
   * Test 6.6: README.md references all three diagram files
   */
  it('Test 6.6: README.md references all three diagram files', () => {
    if (!existsSync(README)) return

    const content = readFileSync(README, 'utf-8')

    expect(content).toContain('module-dependency-graph.mmd')
    expect(content).toContain('layer-architecture-diagram.mmd')
    expect(content).toContain('system-overview-diagram.mmd')
  })
})
```

---

### Step 6 — MODIFY: `package.json`

**File**: `package.json`  
**Change**: Add one script entry to the `scripts` object.

**Current `arch:` block** (last arch: entry is `arch:guard`):

```json
"arch:guard": "bun scripts/ai-guard.ts"
```

**New entry to insert after `arch:guard`**:

```json
"arch:visualize": "bun scripts/architecture/visualize.ts"
```

**Result** (the `arch:` block after modification):

```json
"arch:add-module": "bun scripts/architecture/add-module.ts",
"arch:generate": "bun scripts/architecture/generate-architecture-map.ts",
"arch:audit": "bun scripts/infra-audit.ts",
"arch:context": "bun scripts/gitnexus-context.ts",
"arch:refresh": "bun scripts/infra-audit.ts && bun scripts/gitnexus-context.ts",
"arch:fix": "bun scripts/infra-audit.ts --fix-map",
"arch:guard": "bun scripts/ai-guard.ts",
"arch:visualize": "bun scripts/architecture/visualize.ts"
```

**Validation**: `bun run arch:visualize` must execute without "script not found" error.

---

## Validation Checklist

After completing all steps, validate in this sequence:

### 1. Type Check

```bash
bun typecheck:src
```

Expected: 0 errors. `scripts/architecture/visualize.ts` must pass strict TypeScript.

### 2. Lint

```bash
bun lint
```

Expected: No new violations in `scripts/architecture/visualize.ts` or test files.

### 3. Unit Tests

```bash
bun run test:unit
# Or targeted:
vitest run tests/unit/visualize/visualize.test.ts
```

Expected: 12 tests pass.

### 4. End-to-End Script Run

```bash
# Ensure dependency-graph.json exists first
bun run arch:audit

# Then run the visualization
bun run arch:visualize
```

Expected output:

```
[VISUALIZE] Done — 3 diagrams written to docs/architecture/visualization/
```

Expected files created:

```
docs/architecture/visualization/module-dependency-graph.mmd
docs/architecture/visualization/layer-architecture-diagram.mmd
docs/architecture/visualization/system-overview-diagram.mmd
docs/architecture/visualization/README.md
```

### 5. Static Tests

```bash
bun run test:static
```

Expected: All existing static tests still pass + 6 new tests (06-architecture-visualization) pass.

### 6. Missing Input Error Handling

```bash
# Rename the file temporarily to test error path
mv docs/architecture/graphs/dependency-graph.json /tmp/dep-graph-backup.json
bun run arch:visualize
# Expected: exit code 1, message: [VISUALIZE] ERROR: dependency-graph.json not found...
mv /tmp/dep-graph-backup.json docs/architecture/graphs/dependency-graph.json
```

### 7. Architecture Governance

```bash
bun scripts/infra-audit.ts
```

Expected: `scripts/architecture/visualize.ts` must not introduce any layer violations or undeclared module warnings.

---

## Error Handling Specification

All error paths are handled in `main()` or the loader functions. No unhandled exceptions escape.

| Condition                                        | Where Handled                                 | Action                                                                                      |
| ------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `dependency-graph.json` not found                | `loadDependencyGraph()`                       | `console.log('[VISUALIZE] ERROR: ...')` + `process.exit(1)`                                 |
| `dependency-graph.json` invalid JSON             | `loadDependencyGraph()`                       | `console.log('[VISUALIZE] ERROR: ...')` + `process.exit(1)`                                 |
| `ARCHITECTURE_MAP.json` not found                | `loadArchitectureMap()`                       | `console.log('[VISUALIZE] WARNING: ...')` + return `null`                                   |
| `ARCHITECTURE_MAP.json` invalid JSON             | `loadArchitectureMap()`                       | `console.log('[VISUALIZE] WARNING: ...')` + return `null`                                   |
| Module absent from ArchitectureMap and heuristic | `buildLayerMap()`                             | `console.log('[VISUALIZE] WARNING: No layer found for module ...')` + classify as `unknown` |
| Output directory does not exist                  | `main()`                                      | `mkdirSync(OUTPUT_DIR, { recursive: true })` — auto-creates                                 |
| Git SHA unavailable                              | `getGitSha()`                                 | Returns `'unknown'` string                                                                  |
| Write failure                                    | Not caught — OS-level error bubbles naturally | None required (developer-local tool)                                                        |

---

## Dependencies

### Upstream Stage Dependencies

| Stage                | Dependency Confirmed                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- |
| INFRA-01 to INFRA-05 | `docs/architecture/intelligence/ARCHITECTURE_MAP.json` exists                            |
| INFRA-06             | `scripts/ai-guard.ts` and `arch:guard` script exist                                      |
| INFRA-07             | `docs/architecture/module-boundaries.json` exists (read by ai-guard, not by this script) |

### Runtime Dependencies

| Dependency           | Version  | Source                                      |
| -------------------- | -------- | ------------------------------------------- |
| Bun runtime          | v1.x     | All other `scripts/` files use same version |
| `node:fs`            | Built-in | No installation required                    |
| `node:path`          | Built-in | No installation required                    |
| `node:child_process` | Built-in | No installation required                    |

### No New npm Packages

`devDependencies` count must not increase after this stage (FR-010 compliance).

---

## Success Criteria

1. `bun run arch:visualize` exits 0 and prints `[VISUALIZE] Done — 3 diagrams written to docs/architecture/visualization/`
2. Four files exist in `docs/architecture/visualization/` after the run
3. `module-dependency-graph.mmd` contains zero deep submodule paths and zero duplicate edges
4. `layer-architecture-diagram.mmd` contains at least four `subgraph` blocks
5. `system-overview-diagram.mmd` names all five Zidney services
6. Running without `dependency-graph.json` exits 1 with a clear, actionable error message
7. All 12 unit tests pass (`vitest run tests/unit/visualize/visualize.test.ts`)
8. All 6 static tests pass (`vitest run tests/static/06-architecture-visualization.test.ts`)
9. `package.json` gains one new script entry — `devDependencies` count unchanged
10. `bun typecheck:src` and `bun lint` pass with zero new errors

---

## Implementation Notes

### No `vi.mock` Required for Unit Tests

Unlike `tests/unit/ai-guard/ai-guard-boundaries.test.ts`, the visualize unit tests do **not** need to mock `node:fs`. All exported functions are pure — they accept data as parameters and return strings. File I/O is isolated in `loadDependencyGraph()`, `loadArchitectureMap()`, `buildLayerMap()`, and `main()`, which are **not exported** and are tested via the static integration test instead.

### Static Test Graceful Skip Pattern

The static test uses `if (!existsSync(...)) return` for individual test cases. This allows the static test file to be included in the test suite even before `arch:visualize` has been run, without causing hard failures. The first test (`Test 6.1: directory exists`) will fail if the directory does not exist — this is intentional and serves as the gating failure.

In CI, `arch:visualize` must be run before `test:static` if the visualization tests must pass. This is advisory (per spec Scenario 2 note on CI integration) and is not implemented as a CI file change in this stage.

### Biome Formatting

The script file must comply with the Biome configuration in `biome.json`. Key rules observed from existing scripts:

- Single quotes for strings
- No trailing semicolons (Biome auto-formats)
- 2-space indentation
- Arrow functions for callbacks

### Layer Order Rationale

The `LAYER_ORDER` constant controls the order of subgraph declarations:

```typescript
const LAYER_ORDER = ['ui', 'runtime', 'domain', 'infrastructure', 'unknown']
```

This top-to-bottom order matches the Zidney trust chain direction (UI at top, Infrastructure at bottom), making the flowchart visually intuitive: data and requests flow downward, matching the `flowchart TD` (top-down) rendering direction.

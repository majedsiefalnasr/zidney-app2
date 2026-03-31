#!/usr/bin/env bun
/**
 * @script arch:visualize
 * @domain arch
 * @category dev
 * @description Generate Mermaid architecture diagrams and documentation from
 *   the dependency graph and architecture map artifacts.
 * @usage bun run arch:visualize
 */
// CLI utility — exempt from service-layer logging standards.
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exit, hasCiFlag, log } from '../utils/logger'

const ROOT = process.cwd()
const DEPENDENCY_GRAPH_PATH = join(ROOT, 'docs/architecture/graphs/dependency-graph.json')
const ARCHITECTURE_MAP_PATH = join(ROOT, 'docs/architecture/intelligence/ARCHITECTURE_MAP.json')
const OUTPUT_DIR = join(ROOT, 'docs/architecture/visualization')
const isCi = hasCiFlag()
log.setScript('arch:visualize')

// ─── Type Definitions ────────────────────────────────────────────────────────

interface DependencyGraph {
  nodes: string[]
  edges: Array<{ from: string; to: string }>
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
  return nodes.filter((n) => TOP_LEVEL_PATTERN.test(n))
}

/**
 * Deduplicates edges, retaining only edges where both endpoints
 * are top-level modules. One entry per unique (from, to) pair.
 * Output is sorted alphabetically by from then to (determinism).
 */
export function deduplicateEdges(
  edges: Array<{ from: string; to: string }>,
  topLevelNodes: Set<string>
): Array<{ from: string; to: string }> {
  const seen = new Set<string>()
  const result: Array<{ from: string; to: string }> = []

  for (const edge of edges) {
    if (!topLevelNodes.has(edge.from) || !topLevelNodes.has(edge.to)) continue
    if (edge.from === edge.to) continue

    const key = `${edge.from}||${edge.to}`
    if (seen.has(key)) continue

    seen.add(key)
    result.push({ from: edge.from, to: edge.to })
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
 * Empty subgraphs are omitted.
 */
export function generateModuleGraph(
  nodes: string[],
  edges: Array<{ from: string; to: string }>,
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

  return `${lines.join('\n')}\n`
}

/**
 * Generates the layer-architecture-diagram.mmd content.
 * Identical structure to generateModuleGraph — all four defined layers
 * are always emitted (even if empty) to make layer assignments explicit.
 * The "unknown" subgraph is only emitted when it has members.
 */
export function generateLayerDiagram(
  nodes: string[],
  edges: Array<{ from: string; to: string }>,
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

  return `${lines.join('\n')}\n`
}

/**
 * Generates the system-overview-diagram.mmd content.
 * STATIC — not derived from the dependency graph.
 * Reflects the Zidney trust chain model from AGENTS.md.
 * Note: subgraph-targeted edges (api --> Foundation, worker --> Foundation)
 * require Mermaid v9+ for correct rendering.
 */
export function generateSystemOverview(): string {
  return [
    'flowchart TD',
    '  subgraph ui["UI Layer"]',
    '    mmc["MMC (Management Console)"]',
    '    backoffice["Backoffice (Institution Panel)"]',
    '    frontoffice["Frontoffice (Student Runtime)"]',
    '  end',
    '  subgraph backend["Backend Services"]',
    '    api["API (Bun + Hono)"]',
    '    worker["Worker (Job Processor)"]',
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
 * Pure function — accepts generation timestamp and git SHA as parameters
 * to keep the function testable.
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
    result.get(layer)?.push(n)
  }

  return result
}

function loadDependencyGraph(filePath: string): DependencyGraph {
  if (!existsSync(filePath)) {
    log.error(`[VISUALIZE] ERROR: dependency-graph.json not found. Run 'bun run arch:audit' first.`)
    exit(1)
  }

  let graph: unknown
  try {
    const raw = readFileSync(filePath, 'utf-8')
    graph = JSON.parse(raw)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error(`[VISUALIZE] ERROR: Failed to parse dependency-graph.json — ${message}`)
    exit(1)
  }

  const g = graph as Record<string, unknown>
  if (!Array.isArray(g?.nodes) || !Array.isArray(g?.edges)) {
    log.error(
      `[VISUALIZE] ERROR: dependency-graph.json is missing required 'nodes' or 'edges' arrays.`
    )
    exit(1)
  }

  return graph as DependencyGraph
}

function loadArchitectureMap(filePath: string): ArchitectureMap | null {
  if (!existsSync(filePath)) {
    log.warn(
      `[VISUALIZE] WARNING: ARCHITECTURE_MAP.json not found — using heuristic layer classification.`
    )
    return null
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as ArchitectureMap
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn(
      `[VISUALIZE] WARNING: Failed to parse ARCHITECTURE_MAP.json (${message}) — using heuristic layer classification.`
    )
    return null
  }
}

function buildLayerMap(nodes: string[], archMap: ArchitectureMap | null): Map<string, string> {
  const result = new Map<string, string>()

  for (const node of nodes) {
    let layer: string

    if (archMap?.modules[node]) {
      layer = archMap.modules[node].layer
    } else {
      layer = classifyLayerHeuristic(node)
    }

    if (layer === 'unknown') {
      log.warn(`[VISUALIZE] WARNING: No layer found for module ${node} — classified as Unknown`)
    }

    result.set(node, layer)
  }

  return result
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

function main(): void {
  log.header('ARCHITECTURE VISUALIZE', 'Generates Mermaid diagrams from dependency graph')
  if (isCi) {
    log.info('[arch:visualize] CI mode enabled')
  }
  const graph = loadDependencyGraph(DEPENDENCY_GRAPH_PATH)
  const archMap = loadArchitectureMap(ARCHITECTURE_MAP_PATH)

  const topLevelNodes = filterTopLevelNodes(graph.nodes)
  const topLevelNodeSet = new Set(topLevelNodes)
  const edges = deduplicateEdges(graph.edges, topLevelNodeSet)
  const layerMap = buildLayerMap(topLevelNodes, archMap)

  mkdirSync(OUTPUT_DIR, { recursive: true })

  const moduleGraph = generateModuleGraph(topLevelNodes, edges, layerMap)
  const layerDiagram = generateLayerDiagram(topLevelNodes, edges, layerMap)
  const systemOverview = generateSystemOverview()
  const readme = generateReadme(new Date(), getGitSha())

  writeFileSync(join(OUTPUT_DIR, 'module-dependency-graph.mmd'), moduleGraph, 'utf-8')
  writeFileSync(join(OUTPUT_DIR, 'layer-architecture-diagram.mmd'), layerDiagram, 'utf-8')
  writeFileSync(join(OUTPUT_DIR, 'system-overview-diagram.mmd'), systemOverview, 'utf-8')
  writeFileSync(join(OUTPUT_DIR, 'README.md'), readme, 'utf-8')

  log.success(`[VISUALIZE] Done — 3 diagrams written to docs/architecture/visualization/`)
  log.progressResult(
    { success: 4 },
    { title: '3 Diagrams + README Generated', showPercentage: false }
  )
  exit(0)
}

function isDirectExecution(): boolean {
  const entry = process.argv[1] ?? ''
  return /(?:^|[\\/])visualize\.ts$/.test(entry)
}

if (isDirectExecution()) {
  main()
}

/**
 * Unit tests: scripts/architecture/visualize.ts
 *
 * Tests pure exported functions using fixture data (no real disk operations).
 * 14 test cases covering all exported functions, including guardian-required
 * tests for generateReadme coverage and empty-layer generateLayerDiagram.
 *
 * Stage: STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifyLayerHeuristic,
  deduplicateEdges,
  filterTopLevelNodes,
  generateLayerDiagram,
  generateModuleGraph,
  generateReadme,
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
    MAP_FIXTURE.modules as Record<string, { layer: string }>
  )) {
    map.set(module, meta.layer)
  }
  return map
}

describe('visualize.ts — unit tests', () => {
  // ─── filterTopLevelNodes ───────────────────────────────────────────────────

  describe('filterTopLevelNodes', () => {
    /**
     * Test 1: Deep submodule paths are excluded
     */
    it('Test 1: excludes deep submodule paths not matching apps/<name> or packages/<name>', () => {
      const result = filterTopLevelNodes(GRAPH_FIXTURE.nodes as string[])
      for (const node of result) {
        expect(node).toMatch(/^(apps|packages)\/[^/]+$/)
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
      const apiToLogger = result.filter((e) => e.from === 'apps/api' && e.to === 'packages/logger')
      expect(apiToLogger).toHaveLength(1)
    })

    /**
     * Test 4: Edges involving deep submodule nodes are excluded
     */
    it('Test 4: excludes edges with endpoints not in the top-level node set', () => {
      const result = deduplicateEdges(GRAPH_FIXTURE.edges, topLevel)
      for (const edge of result) {
        expect(topLevel.has(edge.from)).toBe(true)
        expect(topLevel.has(edge.to)).toBe(true)
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
     * Test 12: Output is deterministic — same input always produces identical output
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
    it('Test 6: nodes appear in the correct layer subgraph', () => {
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

    /**
     * Test 14 (guardian): All four defined layers are emitted even with empty layer members
     */
    it('Test 14: emits all four defined layers even when some are empty', () => {
      // Build a layerMap with only one node in one layer — the others should still appear
      const nodes = ['apps/api'] // only runtime layer
      const edges: Array<{ from: string; to: string }> = []
      const layerMap = new Map<string, string>([['apps/api', 'runtime']])

      const result = generateLayerDiagram(nodes, edges, layerMap)

      // All four defined layers must appear
      expect(result).toContain('subgraph ui')
      expect(result).toContain('subgraph runtime')
      expect(result).toContain('subgraph domain')
      expect(result).toContain('subgraph infrastructure')
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

  // ─── generateReadme ───────────────────────────────────────────────────────

  describe('generateReadme', () => {
    /**
     * Test 13 (guardian): generateReadme produces correct ISO date, git SHA, and .mmd references
     */
    it('Test 13: includes ISO date, git SHA string, and all three .mmd filenames', () => {
      const fixedDate = new Date('2024-01-15T10:30:00.000Z')
      const fixedSha = 'abc1234def5678ghijklmnopqrstuvwx90123456'

      const result = generateReadme(fixedDate, fixedSha)

      // ISO timestamp must match the date passed in
      expect(result).toContain('2024-01-15T10:30:00.000Z')

      // Git SHA must appear verbatim
      expect(result).toContain(fixedSha)

      // All three diagram filenames must be referenced
      expect(result).toContain('module-dependency-graph.mmd')
      expect(result).toContain('layer-architecture-diagram.mmd')
      expect(result).toContain('system-overview-diagram.mmd')
    })
  })
})

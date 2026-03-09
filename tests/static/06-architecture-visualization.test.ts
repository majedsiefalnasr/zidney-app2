/**
 * Area 6: Architecture Visualization Output Validation (Static Analysis)
 *
 * Verifies that docs/architecture/visualization/ is populated with the
 * expected output files after `bun run arch:visualize` has been executed.
 *
 * NOTE: This test validates the OUTPUT of the visualization script, not
 * the script itself. It assumes arch:visualize has been run and the output
 * files exist. Run `bun run arch:visualize` before running this test in CI.
 *
 * Stage: STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

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
    expect(
      existsSync(VIZ_DIR),
      `docs/architecture/visualization/ must exist — run 'bun run arch:visualize' first`
    ).toBe(true)
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
    if (!existsSync(MODULE_GRAPH)) return

    const content = readFileSync(MODULE_GRAPH, 'utf-8')

    // Deep submodule paths start with './'
    expect(content, 'must not contain relative paths starting with "./"').not.toContain('./')

    // Should not contain paths with more than two segments in quoted labels
    expect(content, 'must not contain deep apps/**/* paths').not.toMatch(/apps\/[^/\s"]+\/[^/\s"]+/)

    expect(content, 'must not contain deep packages/**/* paths').not.toMatch(
      /packages\/[^/\s"]+\/[^/\s"]+/
    )
  })

  /**
   * Test 6.4: layer-architecture-diagram.mmd contains at least four subgraph declarations
   * (ui, runtime, domain, infrastructure — the four defined Zidney architectural layers)
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

    expect(content, 'must contain mmc node').toContain('mmc')
    expect(content, 'must contain backoffice node').toContain('backoffice')
    expect(content, 'must contain frontoffice node').toContain('frontoffice')
    expect(content, 'must contain api node').toContain('api')
    expect(content, 'must contain worker node').toContain('worker')
  })

  /**
   * Test 6.6: README.md references all three diagram files
   */
  it('Test 6.6: README.md references all three diagram files', () => {
    if (!existsSync(README)) return

    const content = readFileSync(README, 'utf-8')

    expect(content, 'must reference module-dependency-graph.mmd').toContain(
      'module-dependency-graph.mmd'
    )
    expect(content, 'must reference layer-architecture-diagram.mmd').toContain(
      'layer-architecture-diagram.mmd'
    )
    expect(content, 'must reference system-overview-diagram.mmd').toContain(
      'system-overview-diagram.mmd'
    )
  })
})

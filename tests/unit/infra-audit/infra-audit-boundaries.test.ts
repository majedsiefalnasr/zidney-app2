/**
 * Unit test: infra-audit.ts FR-008 undeclared module detection
 *
 * FR-008: Modules present on disk but absent from module-boundaries.json
 *         must be reported as "undeclared module: <path>"
 *
 * Tests the exported `findUndeclaredModulesFromBoundaries` pure function
 * from scripts/infra-audit.ts using fixture data (no real disk operations).
 */

import { describe, expect, it } from 'vitest'
import { findUndeclaredModulesFromBoundaries } from '../../../scripts/infra-audit'

const FIXTURE_BOUNDARIES = {
  layers: {
    infrastructure: [
      'packages/logger',
      'packages/config',
      'packages/types',
      'packages/redis-utils',
    ],
    domain: ['packages/domain-core', 'packages/validation'],
    runtime: ['apps/api', 'apps/worker'],
    ui: [
      'apps/mmc',
      'apps/backoffice',
      'apps/frontoffice',
      'packages/ui-system',
      'packages/api-client',
    ],
  },
}

const KNOWN_NODES = [
  'packages/logger',
  'packages/config',
  'packages/types',
  'packages/redis-utils',
  'packages/domain-core',
  'packages/validation',
  'apps/api',
  'apps/worker',
  'apps/mmc',
  'apps/backoffice',
  'apps/frontoffice',
  'packages/ui-system',
  'packages/api-client',
]

describe('findUndeclaredModulesFromBoundaries — FR-008 undeclared module detection', () => {
  describe('Scenario: unregistered module on disk', () => {
    it('reports packages/canary-unregistered-test as undeclared when absent from boundaries', () => {
      const discoveredNodes = [...KNOWN_NODES, 'packages/canary-unregistered-test']
      const result = findUndeclaredModulesFromBoundaries(discoveredNodes, FIXTURE_BOUNDARIES)
      expect(result).toContain('packages/canary-unregistered-test')
    })

    it('reports apps/canary-unregistered-app as undeclared when absent from boundaries', () => {
      const discoveredNodes = [...KNOWN_NODES, 'apps/canary-unregistered-app']
      const result = findUndeclaredModulesFromBoundaries(discoveredNodes, FIXTURE_BOUNDARIES)
      expect(result).toContain('apps/canary-unregistered-app')
    })

    it('does not report known/registered modules as undeclared', () => {
      const result = findUndeclaredModulesFromBoundaries(KNOWN_NODES, FIXTURE_BOUNDARIES)
      expect(result).toHaveLength(0)
    })
  })

  describe('Scenario: registered module (fix working — Scenario 3 criterion #2)', () => {
    it('produces zero undeclared-module warnings when all discovered modules are registered', () => {
      // Boundaries now include the canary module → should produce zero warnings
      const boundariesWithCanary = {
        layers: {
          ...FIXTURE_BOUNDARIES.layers,
          domain: [...FIXTURE_BOUNDARIES.layers.domain, 'packages/canary-unregistered-test'],
        },
      }
      const discoveredNodes = [...KNOWN_NODES, 'packages/canary-unregistered-test']
      const result = findUndeclaredModulesFromBoundaries(discoveredNodes, boundariesWithCanary)
      expect(result).toHaveLength(0)
    })

    it('produces zero violations for an empty discovered nodes list', () => {
      const result = findUndeclaredModulesFromBoundaries([], FIXTURE_BOUNDARIES)
      expect(result).toHaveLength(0)
    })
  })

  describe('Edge cases', () => {
    it('returns empty array when boundaries is null', () => {
      const result = findUndeclaredModulesFromBoundaries(
        [...KNOWN_NODES, 'packages/canary-unregistered-test'],
        null
      )
      expect(result).toHaveLength(0)
    })

    it('ignores non-packages/non-apps paths (e.g. nested source files)', () => {
      const nodesWithSrcFile = [
        ...KNOWN_NODES,
        'packages/logger/src/index.ts', // path deeper than module root — should be ignored
        'scripts/some-script.ts', // scripts directory — not packages/ or apps/
      ]
      const result = findUndeclaredModulesFromBoundaries(nodesWithSrcFile, FIXTURE_BOUNDARIES)
      expect(result).toHaveLength(0)
    })

    it('reports multiple unregistered modules simultaneously', () => {
      const nodes = [...KNOWN_NODES, 'packages/notifications', 'apps/mobile', 'packages/analytics']
      const result = findUndeclaredModulesFromBoundaries(nodes, FIXTURE_BOUNDARIES)
      expect(result).toHaveLength(3)
      expect(result).toContain('packages/notifications')
      expect(result).toContain('apps/mobile')
      expect(result).toContain('packages/analytics')
    })
  })
})

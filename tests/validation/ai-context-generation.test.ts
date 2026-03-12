/**
 * Unit Tests for AI Context Builders
 * Task: T029
 * Path: tests/validation/ai-context-generation.test.ts
 */

import { describe, expect, it } from 'vitest'
import { buildArchitectureBrain } from '../../scripts/ai-context/artifact-builders/architecture-brain-builder'
import { buildArchitectureSummary } from '../../scripts/ai-context/artifact-builders/architecture-summary-builder'
import { buildDependencyGraph } from '../../scripts/ai-context/artifact-builders/dependency-graph-builder'
import { buildLayerModel } from '../../scripts/ai-context/artifact-builders/layer-model-builder'
import { buildModuleMap } from '../../scripts/ai-context/artifact-builders/module-map-builder'
import { buildRuntimeMap } from '../../scripts/ai-context/artifact-builders/runtime-map-builder'
import type { SourceMetadata } from '../../scripts/ai-context/source-loader'

const mockMetadata: SourceMetadata = {
  adrFiles: [
    {
      number: 1,
      title: 'Database per Tenant',
      status: 'ACCEPTED',
      path: 'docs/architecture/adr/adr-0001.md',
      content: '# ADR-0001: Database per Tenant',
    },
  ],
  moduleBoundaries: {
    version: '1.0.0',
    layers: [
      { name: 'ui', description: 'UI Layer', order: 1 },
      { name: 'runtime', description: 'Runtime Layer', order: 2 },
      { name: 'domain', description: 'Domain Layer', order: 3 },
      { name: 'infrastructure', description: 'Infrastructure Layer', order: 4 },
    ],
    rules: {
      ui: {
        imports_allowed: ['packages/ui-system', 'packages/types'],
        imports_forbidden: ['packages/domain-core', 'apps/api'],
      },
      runtime: {
        imports_allowed: ['packages/domain-core', 'packages/types'],
        imports_forbidden: ['packages/ui-system', 'apps/api'],
      },
    },
  },
  modules: [
    { path: 'apps/api', name: 'api', type: 'app', layer: 'runtime' },
    {
      path: 'packages/domain-core',
      name: 'domain-core',
      type: 'package',
      layer: 'domain',
    },
    {
      path: 'packages/ui-system',
      name: 'ui-system',
      type: 'package',
      layer: 'ui',
    },
  ],
  dockerServices: [{ name: 'api', image: 'zidney-api:latest', ports: ['3000:3000'] }],
  architectureContext: null,
  sourceHash: 'abc123',
  sourceTimestamp: new Date().toISOString(),
  errors: [],
}

describe('AI Context Builders', () => {
  describe('buildModuleMap', () => {
    it('should generate valid module map', async () => {
      const result = await buildModuleMap(mockMetadata)

      expect(result.schema_version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(result.modules).toBeDefined()
      expect(Object.keys(result.modules).length).toBeGreaterThan(0)
    })

    it('should assign layers to all modules', async () => {
      const result = await buildModuleMap(mockMetadata)

      for (const module of Object.values(result.modules)) {
        expect(['ui', 'runtime', 'domain', 'infrastructure']).toContain(module.layer)
      }
    })

    it('should include source metadata for change detection', async () => {
      const result = await buildModuleMap(mockMetadata)

      expect(result.source_metadata).toBeDefined()
      expect(result.source_metadata.module_boundaries_hash).toBeTruthy()
    })
  })

  describe('buildLayerModel', () => {
    it('should generate valid layer model', async () => {
      const result = await buildLayerModel(mockMetadata)

      expect(result.schema_version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(result.layers).toHaveLength(4)
      expect(result.rules).toBeDefined()
    })

    it('should include layer ordering', async () => {
      const result = await buildLayerModel(mockMetadata)

      const orders = result.layers.map((l) => l.order).filter((o) => o)
      expect(orders.length).toBeGreaterThan(0)
    })
  })

  describe('buildDependencyGraph', () => {
    it('should generate valid dependency graph', async () => {
      const result = await buildDependencyGraph(mockMetadata)

      expect(result.schema_version).toBe('2')
      expect(result.modules).toBeDefined()
      expect(result.reverse_dependencies).toBeDefined()
    })

    it('should initialize all modules in graph', async () => {
      const result = await buildDependencyGraph(mockMetadata)

      expect(Object.keys(result.modules).length).toBe(mockMetadata.modules.length)
    })

    it('should preserve canonical dependency edges from architecture context', async () => {
      const metadataWithContext: SourceMetadata = {
        ...mockMetadata,
        architectureContext: {
          generatedAt: '2026-03-09T12:00:00Z',
          modules: ['apps/api', 'packages/domain-core', 'packages/ui-system'],
          edges: [{ from: 'apps/api', to: 'packages/domain-core' }],
        },
      }

      const result = await buildDependencyGraph(metadataWithContext)

      expect(result.schema_version).toBe('2')
      expect(result.modules['apps/api']?.dependencies).toEqual(['packages/domain-core'])
      expect(result.reverse_dependencies['packages/domain-core']).toEqual(['apps/api'])
      expect(result.edges).toEqual([{ from: 'apps/api', to: 'packages/domain-core' }])
    })
  })

  describe('buildArchitectureBrain', () => {
    it('should include dependency edges for downstream validators', async () => {
      const metadataWithContext: SourceMetadata = {
        ...mockMetadata,
        architectureContext: {
          generatedAt: '2026-03-09T12:00:00Z',
          modules: ['apps/api', 'packages/domain-core', 'packages/ui-system'],
          edges: [{ from: 'apps/api', to: 'packages/domain-core' }],
        },
      }

      const [moduleMap, layerModel, dependencyGraph] = await Promise.all([
        buildModuleMap(metadataWithContext),
        buildLayerModel(metadataWithContext),
        buildDependencyGraph(metadataWithContext),
      ])

      const result = await buildArchitectureBrain(
        metadataWithContext,
        moduleMap,
        layerModel,
        dependencyGraph
      )

      expect(result.edges).toEqual([{ from: 'apps/api', to: 'packages/domain-core' }])
      expect(result.dependencies['apps/api']?.imports).toEqual(['packages/domain-core'])
    })
  })

  describe('buildArchitectureSummary', () => {
    it('should generate markdown summary', async () => {
      const result = await buildArchitectureSummary(mockMetadata)

      expect(result).toContain('# Zidney Architecture Summary')
      expect(result).toContain('## System Layers Overview')
    })

    it('should include all applications', async () => {
      const result = await buildArchitectureSummary(mockMetadata)

      for (const module of mockMetadata.modules.filter((m) => m.type === 'app')) {
        expect(result).toContain(module.name)
      }
    })
  })

  describe('buildRuntimeMap', () => {
    it('should generate valid runtime map', async () => {
      const result = await buildRuntimeMap(mockMetadata)

      expect(result.schema_version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(result.services).toBeDefined()
    })

    it('should map docker services to modules', async () => {
      const result = await buildRuntimeMap(mockMetadata)

      expect(Object.keys(result.services).length).toBeGreaterThan(0)
    })
  })
})

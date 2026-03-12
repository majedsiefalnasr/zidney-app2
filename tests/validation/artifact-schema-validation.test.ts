/**
 * Schema Validation Tests
 * Task: T030
 * Path: tests/validation/artifact-schema-validation.test.ts
 */

import { describe, expect, it } from 'vitest'
import type {
  AIArchitectureBrain,
  AIContextMini,
  AIDependencyGraph,
  AILayerModel,
  AIModuleMap,
  AIRuntimeMap,
  LayerType,
} from '../../packages/types/src/ai-context'
import {
  validateArchitectureBrain,
  validateContextMini,
  validateDependencyGraph,
  validateLayerModel,
  validateModuleMap,
  validateRuntimeMap,
} from '../../scripts/ai-context/schema-validator'

describe('Schema Validation', () => {
  describe('Module Map Validation', () => {
    it('should validate correct module map', () => {
      const validMap: AIModuleMap = {
        schema_version: '1.0.0',
        generated_at: '2026-03-09T12:00:00Z',
        source_metadata: {
          module_boundaries_hash: 'abc123',
          audit_timestamp: '2026-03-09T12:00:00Z',
        },
        modules: {
          'apps/api': {
            layer: 'runtime',
            type: 'application',
            description: 'API service',
            path: 'apps/api',
          },
        },
      }

      const errors = validateModuleMap(validMap)
      expect(errors).toHaveLength(0)
    })

    it('should reject invalid schema version', () => {
      const invalidMap: Record<string, unknown> = {
        schema_version: 'invalid',
        generated_at: '2026-03-09T12:00:00Z',
        modules: {},
      }

      const errors = validateModuleMap(invalidMap as unknown as AIModuleMap)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e) => e.path === '$.schema_version')).toBeTruthy()
    })

    it('should reject invalid layer assignment', () => {
      const invalidMap: Record<string, unknown> = {
        schema_version: '1.0.0',
        generated_at: '2026-03-09T12:00:00Z',
        modules: {
          'apps/api': {
            layer: 'invalid-layer',
            type: 'application',
            description: 'API',
            path: 'apps/api',
          },
        },
      }

      const errors = validateModuleMap(invalidMap as unknown as AIModuleMap)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('Layer Model Validation', () => {
    it('should validate correct layer model', () => {
      const validModel: AILayerModel = {
        schema_version: '1.0.0',
        generated_at: '2026-03-09T12:00:00Z',
        source_metadata: {
          module_boundaries_hash: 'abc123',
        },
        layers: [
          {
            name: 'ui',
            description: 'UI Layer',
          },
        ],
        rules: {
          ui: {
            imports_allowed: ['packages/ui-system'],
            imports_forbidden: ['packages/domain-core'],
          },
        },
      }

      const errors = validateLayerModel(validModel)
      expect(errors).toHaveLength(0)
    })

    it('should validate all layer names', () => {
      const validLayers = ['ui', 'runtime', 'domain', 'infrastructure']

      const validModel: AILayerModel = {
        schema_version: '1.0.0',
        generated_at: '2026-03-09T12:00:00Z',
        source_metadata: {
          module_boundaries_hash: 'abc123',
        },
        layers: validLayers.map((name) => ({
          name: name as LayerType,
          description: `${name} layer`,
        })),
        rules: {},
      }

      const errors = validateLayerModel(validModel)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Dependency Graph Validation', () => {
    it('should validate correct dependency graph', () => {
      const validGraph: AIDependencyGraph = {
        schema_version: '2',
        generated_at: '2026-03-09T12:00:00Z',
        source_metadata: {
          infra_audit_timestamp: '2026-03-09T12:00:00Z',
        },
        modules: {
          'apps/api': {
            dependencies: ['packages/domain-core'],
            layer: 'runtime',
            type: 'app',
          },
        },
        reverse_dependencies: {
          'packages/domain-core': ['apps/api'],
        },
        edges: [{ from: 'apps/api', to: 'packages/domain-core' }],
      }

      const errors = validateDependencyGraph(validGraph)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Runtime Map Validation', () => {
    it('should validate correct runtime map', () => {
      const validMap: AIRuntimeMap = {
        schema_version: '1.0.0',
        generated_at: '2026-03-09T12:00:00Z',
        services: {
          api: {
            module: 'apps/api',
            runtime: 'Bun',
            framework: 'Hono',
            depends_on: [],
          },
        },
      }

      const errors = validateRuntimeMap(validMap)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Architecture Brain Validation', () => {
    it('should validate correct architecture brain', () => {
      const validBrain: AIArchitectureBrain = {
        schema_version: '1.0.0',
        generated_at: '2026-03-09T12:00:00Z',
        metadata: {
          total_modules: 10,
          total_violations: 0,
          generation_time_ms: 150,
          source_hash: 'abc123',
          source_timestamp: '2026-03-09T12:00:00Z',
          generator_version: '1.0.0',
        },
        layers: [],
        modules: {},
        rules: {},
        dependencies: {},
        edges: [],
        violations: [],
        metrics: {
          max_severity: 'none',
          compliance_percentage: 100,
          violating_modules: [],
        },
      }

      const errors = validateArchitectureBrain(validBrain)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Context Mini Validation', () => {
    it('should validate correct context mini', () => {
      const validMini: AIContextMini = {
        schema_version: '1.0.0',
        generated_at: '2026-03-09T12:00:00Z',
        layers: [
          {
            name: 'ui',
            description: 'UI Layer',
          },
        ],
        modules_by_layer: {
          ui: ['packages/ui-system'],
        },
        rules: {
          ui: {
            forbidden: ['packages/domain-core'],
          },
        },
        full_context_url: 'docs/ai/context/',
        full_context_size_bytes: 15 * 1024 * 1024,
      }

      const errors = validateContextMini(validMini)
      expect(errors).toHaveLength(0)
    })
  })
})

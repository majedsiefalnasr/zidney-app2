/**
 * Schema Validator - Validate generated artifacts against JSON schemas
 * Task: T015
 * Path: scripts/ai-context/schema-validator.ts
 */

import type {
  AIArchitectureBrain,
  AIContextMini,
  AIDependencyGraph,
  AILayerModel,
  AIModuleMap,
  AIRuntimeMap,
} from '../../packages/types/src/ai-context'

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  artifact_name: string
  validation_time_ms: number
}

interface ValidationError {
  path: string
  message: string
  value?: unknown
  expected?: unknown
}

/**
 * Validate ai-module-map.json structure
 */
export function validateModuleMap(artifact: AIModuleMap): ValidationError[] {
  const errors: ValidationError[] = []

  if (!artifact.schema_version || !artifact.schema_version.match(/^\d+\.\d+\.\d+$/)) {
    errors.push({
      path: '$.schema_version',
      message: 'Invalid schema version format. Expected MAJOR.MINOR.PATCH',
      value: artifact.schema_version,
      expected: '1.0.0',
    })
  }

  if (!artifact.generated_at || !isValidISO8601(artifact.generated_at)) {
    errors.push({
      path: '$.generated_at',
      message: 'Invalid ISO 8601 timestamp',
      value: artifact.generated_at,
    })
  }

  if (!artifact.modules || typeof artifact.modules !== 'object') {
    errors.push({
      path: '$.modules',
      message: 'Modules must be an object',
      value: typeof artifact.modules,
    })
  } else {
    for (const [modulePath, entry] of Object.entries(artifact.modules)) {
      if (!entry.layer || !['ui', 'runtime', 'domain', 'infrastructure'].includes(entry.layer)) {
        errors.push({
          path: `$.modules['${modulePath}'].layer`,
          message: 'Invalid layer assignment',
          value: entry.layer,
          expected: 'ui | runtime | domain | infrastructure',
        })
      }

      if (!entry.type || !['application', 'package'].includes(entry.type)) {
        errors.push({
          path: `$.modules['${modulePath}'].type`,
          message: 'Invalid module type',
          value: entry.type,
        })
      }

      if (!entry.description) {
        errors.push({
          path: `$.modules['${modulePath}'].description`,
          message: 'Description is required',
        })
      }

      if (!entry.path) {
        errors.push({
          path: `$.modules['${modulePath}'].path`,
          message: 'Path is required',
        })
      }
    }
  }

  return errors
}

/**
 * Validate ai-layer-model.json structure
 */
export function validateLayerModel(artifact: AILayerModel): ValidationError[] {
  const errors: ValidationError[] = []

  if (!artifact.schema_version) {
    errors.push({
      path: '$.schema_version',
      message: 'Schema version is required',
    })
  }

  if (!artifact.layers || !Array.isArray(artifact.layers)) {
    errors.push({
      path: '$.layers',
      message: 'Layers must be an array',
    })
  } else {
    const validLayers = ['ui', 'runtime', 'domain', 'infrastructure']
    for (const layer of artifact.layers) {
      if (!validLayers.includes(layer.name)) {
        errors.push({
          path: `$.layers[${artifact.layers.indexOf(layer)}].name`,
          message: 'Invalid layer name',
          value: layer.name,
        })
      }
    }
  }

  if (!artifact.rules || typeof artifact.rules !== 'object') {
    errors.push({
      path: '$.rules',
      message: 'Rules must be an object',
    })
  } else {
    for (const [layerName, rule] of Object.entries(artifact.rules)) {
      if (!Array.isArray(rule.imports_allowed)) {
        errors.push({
          path: `$.rules['${layerName}'].imports_allowed`,
          message: 'Must be an array',
        })
      }

      if (!Array.isArray(rule.imports_forbidden)) {
        errors.push({
          path: `$.rules['${layerName}'].imports_forbidden`,
          message: 'Must be an array',
        })
      }
    }
  }

  return errors
}

/**
 * Validate ai-dependency-graph.json structure
 */
export function validateDependencyGraph(artifact: AIDependencyGraph): ValidationError[] {
  const errors: ValidationError[] = []

  if (!artifact.schema_version) {
    errors.push({
      path: '$.schema_version',
      message: 'Schema version is required',
    })
  }

  if (!artifact.modules || typeof artifact.modules !== 'object') {
    errors.push({
      path: '$.modules',
      message: 'Modules must be an object',
    })
  }

  if (!artifact.reverse_dependencies || typeof artifact.reverse_dependencies !== 'object') {
    errors.push({
      path: '$.reverse_dependencies',
      message: 'Reverse dependencies must be an object',
    })
  }

  if (!Array.isArray(artifact.edges)) {
    errors.push({
      path: '$.edges',
      message: 'Edges must be an array',
    })
  }

  if (artifact.violations && Array.isArray(artifact.violations)) {
    for (let i = 0; i < artifact.violations.length; i++) {
      const v = artifact.violations[i]
      if (!v || !v.from || !v.to) {
        errors.push({
          path: `$.violations[${i}]`,
          message: "Violation must have 'from' and 'to' fields",
        })
      }
    }
  }

  return errors
}

/**
 * Validate ai-runtime-map.json structure
 */
export function validateRuntimeMap(artifact: AIRuntimeMap): ValidationError[] {
  const errors: ValidationError[] = []

  if (!artifact.schema_version) {
    errors.push({
      path: '$.schema_version',
      message: 'Schema version is required',
    })
  }

  if (!artifact.services || typeof artifact.services !== 'object') {
    errors.push({
      path: '$.services',
      message: 'Services must be an object',
    })
  } else {
    for (const [serviceName, service] of Object.entries(artifact.services)) {
      if (!service.module) {
        errors.push({
          path: `$.services['${serviceName}'].module`,
          message: 'Module is required',
        })
      }

      if (!service.framework) {
        errors.push({
          path: `$.services['${serviceName}'].framework`,
          message: 'Framework is required',
        })
      }
    }
  }

  return errors
}

/**
 * Validate ai-architecture-brain.json structure
 */
export function validateArchitectureBrain(artifact: AIArchitectureBrain): ValidationError[] {
  const errors: ValidationError[] = []

  if (!artifact.schema_version) {
    errors.push({
      path: '$.schema_version',
      message: 'Schema version is required',
    })
  }

  if (!artifact.metadata) {
    errors.push({
      path: '$.metadata',
      message: 'Metadata is required',
    })
  } else {
    if (typeof artifact.metadata.total_modules !== 'number') {
      errors.push({
        path: '$.metadata.total_modules',
        message: 'Must be a number',
      })
    }

    if (typeof artifact.metadata.generation_time_ms !== 'number') {
      errors.push({
        path: '$.metadata.generation_time_ms',
        message: 'Must be a number',
      })
    }
  }

  if (!Array.isArray(artifact.edges)) {
    errors.push({
      path: '$.edges',
      message: 'Edges must be an array',
    })
  }

  return errors
}

/**
 * Validate ai-context-mini.json structure
 */
export function validateContextMini(artifact: AIContextMini): ValidationError[] {
  const errors: ValidationError[] = []

  if (!artifact.schema_version) {
    errors.push({
      path: '$.schema_version',
      message: 'Schema version is required',
    })
  }

  if (!artifact.layers || !Array.isArray(artifact.layers)) {
    errors.push({
      path: '$.layers',
      message: 'Layers must be an array',
    })
  }

  if (!artifact.modules_by_layer || typeof artifact.modules_by_layer !== 'object') {
    errors.push({
      path: '$.modules_by_layer',
      message: 'Modules by layer must be an object',
    })
  }

  if (!artifact.full_context_url) {
    errors.push({
      path: '$.full_context_url',
      message: 'Reference URL is required',
    })
  }

  return errors
}

/**
 * Helper: Check if string is valid ISO 8601
 */
function isValidISO8601(dateString: string): boolean {
  return !Number.isNaN(Date.parse(dateString))
}

/**
 * Comprehensive validation of all artifacts
 */
export interface AllArtifactsValidationResult {
  all_valid: boolean
  results: {
    [artifactName: string]: ValidationResult
  }
  total_time_ms: number
}

export function validateAllArtifacts(artifacts: {
  module_map: AIModuleMap
  layer_model: AILayerModel
  dependency_graph: AIDependencyGraph
  runtime_map: AIRuntimeMap
  architecture_brain: AIArchitectureBrain
  context_mini: AIContextMini
}): AllArtifactsValidationResult {
  const startTime = performance.now()
  const results: { [key: string]: ValidationResult } = {}

  const validators = [
    ['ai-module-map.json', () => validateModuleMap(artifacts.module_map)],
    ['ai-layer-model.json', () => validateLayerModel(artifacts.layer_model)],
    ['ai-dependency-graph.json', () => validateDependencyGraph(artifacts.dependency_graph)],
    ['ai-runtime-map.json', () => validateRuntimeMap(artifacts.runtime_map)],
    ['ai-architecture-brain.json', () => validateArchitectureBrain(artifacts.architecture_brain)],
    ['ai-context-mini.json', () => validateContextMini(artifacts.context_mini)],
  ] as const

  for (const [name, validator] of validators) {
    const validationStart = performance.now()
    const errors = validator()
    const validationTime = performance.now() - validationStart

    results[name] = {
      valid: errors.length === 0,
      errors,
      warnings: [],
      artifact_name: name,
      validation_time_ms: validationTime,
    }
  }

  const totalTime = performance.now() - startTime
  const allValid = Object.values(results).every((r) => r.valid)

  return {
    all_valid: allValid,
    results,
    total_time_ms: totalTime,
  }
}

/**
 * Module Map Builder - Generate ai-module-map.json
 * Task: T017
 * Path: scripts/ai-context/artifact-builders/module-map-builder.ts
 */

import type { AIModuleMap, LayerType } from '../../../packages/types/src/ai-context'
import type { SourceMetadata } from '../source-loader'

export async function buildModuleMap(metadata: SourceMetadata): Promise<AIModuleMap> {
  const modules: AIModuleMap['modules'] = {}

  // Map each discovered module to its layer assignment
  for (const moduleInfo of metadata.modules) {
    const boundaries = metadata.moduleBoundaries

    // Find layer assignment from boundaries config
    let assignedLayer: LayerType | undefined
    if (boundaries.rules) {
      for (const [layer, rule] of Object.entries(boundaries.rules)) {
        // Simple heuristic: check if module path matches allowed patterns
        if (rule.imports_allowed?.some((p) => moduleInfo.path.startsWith(p))) {
          assignedLayer = layer as LayerType
          break
        }
      }
    }

    // Fallback layer assignment based on path convention
    if (!assignedLayer) {
      if (moduleInfo.path.includes('ui-system')) assignedLayer = 'ui'
      else if (moduleInfo.path.includes('domain-core')) assignedLayer = 'domain'
      else if (moduleInfo.path.includes('apps/api') || moduleInfo.path.includes('apps/worker'))
        assignedLayer = 'runtime'
      else if (
        moduleInfo.path.includes('logger') ||
        moduleInfo.path.includes('redis') ||
        moduleInfo.path.includes('config')
      )
        assignedLayer = 'infrastructure'
      else assignedLayer = 'runtime' // Default
    }

    modules[moduleInfo.path] = {
      layer: assignedLayer,
      type: moduleInfo.type === 'app' ? 'application' : 'package',
      description: `Module: ${moduleInfo.name}`,
      path: moduleInfo.path,
      dependencies: [], // Will be populated by dependency graph
    }
  }

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source_metadata: {
      module_boundaries_hash: metadata.sourceHash,
      audit_timestamp: metadata.sourceTimestamp,
    },
    modules,
  }
}

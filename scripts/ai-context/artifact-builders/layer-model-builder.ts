/**
 * Layer Model Builder - Generate ai-layer-model.json
 * Task: T018
 * Path: scripts/ai-context/artifact-builders/layer-model-builder.ts
 */

import type { AILayerModel } from '../../../packages/types/src/ai-context'
import type { SourceMetadata } from '../source-loader'

export async function buildLayerModel(metadata: SourceMetadata): Promise<AILayerModel> {
  const boundaries = metadata.moduleBoundaries

  // Convert layers from object format (if present) to array format
  let layersArray: Array<{ name: string; description: string; order: number }>

  if (
    boundaries.layers &&
    typeof boundaries.layers === 'object' &&
    !Array.isArray(boundaries.layers)
  ) {
    // Convert object format { layerName: [...modules] } to array format
    const layerOrder: Record<string, number> = {
      infrastructure: 1,
      domain: 2,
      runtime: 3,
      ui: 4,
    }

    layersArray = Object.entries(boundaries.layers).map(([name, _modules], index) => ({
      name,
      description: `${name.charAt(0).toUpperCase() + name.slice(1)} layer`,
      order: layerOrder[name] || index + 1,
    }))
  } else if (Array.isArray(boundaries.layers)) {
    // Already in array format
    layersArray = boundaries.layers
  } else {
    // Fallback to default layers
    layersArray = [
      { name: 'ui', description: 'User interface layer', order: 1 },
      { name: 'runtime', description: 'Runtime services', order: 2 },
      { name: 'domain', description: 'Business logic', order: 3 },
      { name: 'infrastructure', description: 'Infrastructure layer', order: 4 },
    ]
  }

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source_metadata: {
      module_boundaries_hash: metadata.sourceHash,
    },
    layers: layersArray.map((l) => ({
      name: (l.name || 'unknown') as string,
      description: l.description || '',
      order: l.order,
    })),
    rules: boundaries.rules || {},
  }
}

/**
 * Layer Model Builder - Generate ai-layer-model.json
 * Task: T018
 * Path: scripts/ai-context/artifact-builders/layer-model-builder.ts
 */

import type { SourceMetadata } from '../source-loader'
import type { AILayerModel } from '../../../packages/types/src/ai-context'

export async function buildLayerModel(metadata: SourceMetadata): Promise<AILayerModel> {
  const boundaries = metadata.moduleBoundaries

  const layers = boundaries.layers || [
    { name: 'ui', description: 'User interface layer', order: 1 },
    { name: 'runtime', description: 'Runtime services', order: 2 },
    { name: 'domain', description: 'Business logic', order: 3 },
    { name: 'infrastructure', description: 'Infrastructure layer', order: 4 },
  ]

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source_metadata: {
      module_boundaries_hash: metadata.sourceHash,
    },
    layers: layers.map((l) => ({
      name: (l.name || 'unknown') as string,
      description: l.description || '',
      order: l.order,
    })),
    rules: boundaries.rules || {},
  }
}

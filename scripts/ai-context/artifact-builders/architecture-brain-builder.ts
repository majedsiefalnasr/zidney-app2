/**
 * Architecture Brain Builder - Generate ai-architecture-brain.json
 * Task: T022
 * Path: scripts/ai-context/artifact-builders/architecture-brain-builder.ts
 */

import type {
  AIArchitectureBrain,
  AIDependencyGraph,
  AILayerModel,
  AIModuleMap,
} from '../../../packages/types/src/ai-context'
import type { SourceMetadata } from '../source-loader'

export async function buildArchitectureBrain(
  metadata: SourceMetadata,
  moduleMap: AIModuleMap,
  layerModel: AILayerModel,
  dependencyGraph: AIDependencyGraph
): Promise<AIArchitectureBrain> {
  const startTime = performance.now()
  const edges =
    dependencyGraph.edges.length > 0
      ? dependencyGraph.edges
      : Object.entries(dependencyGraph.modules).flatMap(([from, moduleData]) =>
          (moduleData.dependencies || []).map((to) => ({ from, to }))
        )

  // Aggregate all architecture data
  const dependencies: AIArchitectureBrain['dependencies'] = {}

  for (const modulePath of Object.keys(moduleMap.modules)) {
    const moduleData = dependencyGraph.modules[modulePath]
    dependencies[modulePath] = {
      imports: moduleData?.dependencies || [],
      imported_by: dependencyGraph.reverse_dependencies[modulePath] || [],
      violations: (dependencyGraph.violations || []).filter(
        (violation) => violation.from === modulePath
      ),
    }
  }

  // Calculate compliance metrics
  const violations = dependencyGraph.violations || []
  const totalModules = Object.keys(moduleMap.modules).length
  const violatingModules = new Set(violations.map((v) => v.from))
  const compliancePercentage =
    totalModules > 0 ? ((totalModules - violatingModules.size) / totalModules) * 100 : 100

  const generationTime = performance.now() - startTime

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    metadata: {
      total_modules: totalModules,
      total_violations: violations.length,
      generation_time_ms: Math.round(generationTime),
      source_hash: metadata.sourceHash,
      source_timestamp: metadata.sourceTimestamp,
      generator_version: '1.0.0',
    },
    layers: layerModel.layers,
    modules: moduleMap.modules,
    rules: layerModel.rules,
    dependencies,
    edges,
    violations,
    metrics: {
      max_severity: violations[0]?.severity ?? 'none',
      compliance_percentage: Math.round(compliancePercentage),
      violating_modules: Array.from(violatingModules),
      hotspots: metadata.architectureContext?.hotspots?.map((hotspot) => ({
        module: hotspot.module,
        violation_count: hotspot.score,
      })),
    },
  }
}

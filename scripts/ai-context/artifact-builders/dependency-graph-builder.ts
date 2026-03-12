/**
 * Dependency Graph Builder - Generate ai-dependency-graph.json
 * Task: T019
 * Path: scripts/ai-context/artifact-builders/dependency-graph-builder.ts
 */

import type { AIDependencyGraph } from '../../../packages/types/src/ai-context'
import type { SourceMetadata } from '../source-loader'

function inferLayer(modulePath: string, explicitLayer?: string): string {
  if (explicitLayer) return explicitLayer
  if (modulePath.includes('ui-system')) return 'ui'
  if (modulePath.includes('domain-core')) return 'domain'
  if (
    modulePath.includes('logger') ||
    modulePath.includes('redis') ||
    modulePath.includes('config')
  )
    return 'infrastructure'
  return 'runtime'
}

export async function buildDependencyGraph(metadata: SourceMetadata): Promise<AIDependencyGraph> {
  const modules: AIDependencyGraph['modules'] = {}
  const reverseDependencies: AIDependencyGraph['reverse_dependencies'] = {}
  const edges: AIDependencyGraph['edges'] = []
  const modulePaths = new Set(metadata.modules.map((moduleInfo) => moduleInfo.path))
  const dependencySets = new Map<string, Set<string>>()
  const reverseDependencySets = new Map<string, Set<string>>()

  // Initialize module entries
  for (const moduleInfo of metadata.modules) {
    modules[moduleInfo.path] = {
      dependencies: [],
      layer: inferLayer(moduleInfo.path, moduleInfo.layer),
      type: moduleInfo.type,
      external_dependencies: [],
    }
    reverseDependencies[moduleInfo.path] = []
    dependencySets.set(moduleInfo.path, new Set())
    reverseDependencySets.set(moduleInfo.path, new Set())
  }

  for (const edge of metadata.architectureContext?.edges ?? []) {
    if (!modulePaths.has(edge.from) || !modulePaths.has(edge.to)) {
      continue
    }

    if (!dependencySets.get(edge.from)?.has(edge.to)) {
      dependencySets.get(edge.from)?.add(edge.to)
      modules[edge.from]?.dependencies.push(edge.to)
    }

    if (!reverseDependencySets.get(edge.to)?.has(edge.from)) {
      reverseDependencySets.get(edge.to)?.add(edge.from)
      reverseDependencies[edge.to]?.push(edge.from)
    }

    edges.push({ from: edge.from, to: edge.to })
  }

  return {
    schema_version: '2',
    generated_at: new Date().toISOString(),
    source_metadata: {
      infra_audit_timestamp: metadata.architectureContext?.generatedAt ?? metadata.sourceTimestamp,
    },
    modules,
    reverse_dependencies: reverseDependencies,
    edges,
    violations: [],
  }
}

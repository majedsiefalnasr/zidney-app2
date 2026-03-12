import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FallbackReason } from '../types'
import { moduleFromPath } from './changed-files'
import { resolveFallbackReason } from './fallback'

interface GraphShape {
  generated_at?: string
  modules?: string[]
  reverse_dependencies?: Record<string, string[]>
  edges?: Array<{ from: string; to: string }>
}

export interface ImpactExpansionResult {
  scopeModules: Set<string>
  fallbackReason: FallbackReason
  skippedUnmappedFiles: string[]
}

function loadGraph(repoRoot: string): { graph: GraphShape | null; reason: FallbackReason } {
  const graphPath = join(repoRoot, 'docs/ai/context/ai-dependency-graph.json')
  if (!existsSync(graphPath)) {
    return { graph: null, reason: resolveFallbackReason({ graphMissing: true }) }
  }

  try {
    const graph = JSON.parse(readFileSync(graphPath, 'utf-8')) as GraphShape
    if (!graph.generated_at) {
      return { graph: null, reason: resolveFallbackReason({ graphUnusable: true }) }
    }
    const generatedAt = new Date(graph.generated_at).getTime()
    if (Number.isNaN(generatedAt) || Date.now() - generatedAt > 24 * 60 * 60 * 1000) {
      return { graph: null, reason: resolveFallbackReason({ graphStale: true }) }
    }
    return { graph, reason: null }
  } catch {
    return { graph: null, reason: resolveFallbackReason({ graphUnusable: true }) }
  }
}

function buildReverseDependencies(graph: GraphShape): Record<string, string[]> {
  if (graph.reverse_dependencies) {
    return graph.reverse_dependencies
  }
  const reverse: Record<string, string[]> = {}
  for (const edge of graph.edges ?? []) {
    if (!reverse[edge.to]) {
      reverse[edge.to] = []
    }
    const bucket = reverse[edge.to]
    if (bucket) {
      bucket.push(edge.from)
    }
  }
  return reverse
}

export function expandChangedScope(
  repoRoot: string,
  changedFiles: string[],
  allModules: string[],
  explicitModules?: string[]
): ImpactExpansionResult {
  if (explicitModules && explicitModules.length > 0) {
    return {
      scopeModules: new Set(explicitModules),
      fallbackReason: null,
      skippedUnmappedFiles: [],
    }
  }

  const mapChanged = changedFiles.some(
    (file) =>
      file.includes('docs/architecture/intelligence/ARCHITECTURE_MAP.json') ||
      file.startsWith('docs/architecture/intelligence/')
  )
  if (mapChanged) {
    return {
      scopeModules: new Set(allModules),
      fallbackReason: resolveFallbackReason({ mapChanged: true }),
      skippedUnmappedFiles: [],
    }
  }

  const changedModules = new Set<string>()
  const skippedUnmappedFiles: string[] = []
  for (const file of changedFiles) {
    const module = moduleFromPath(file)
    if (!module) {
      skippedUnmappedFiles.push(file)
      continue
    }
    changedModules.add(module)
  }

  if (changedModules.size === 0) {
    return {
      scopeModules: new Set(allModules),
      fallbackReason: resolveFallbackReason({ fullScope: true }),
      skippedUnmappedFiles,
    }
  }

  const knownModules = new Set(allModules)
  const hasNewModule = [...changedModules].some((module) => !knownModules.has(module))
  if (hasNewModule) {
    return {
      scopeModules: new Set(allModules),
      fallbackReason: resolveFallbackReason({ hasNewModule: true }),
      skippedUnmappedFiles,
    }
  }

  const loaded = loadGraph(repoRoot)
  if (!loaded.graph) {
    return {
      scopeModules: new Set(allModules),
      fallbackReason: loaded.reason,
      skippedUnmappedFiles,
    }
  }

  const reverse = buildReverseDependencies(loaded.graph)
  const scope = new Set<string>(changedModules)
  const queue = [...changedModules]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    for (const dependent of reverse[current] ?? []) {
      if (!scope.has(dependent) && knownModules.has(dependent)) {
        scope.add(dependent)
        queue.push(dependent)
      }
    }
  }

  return {
    scopeModules: scope,
    fallbackReason: null,
    skippedUnmappedFiles,
  }
}

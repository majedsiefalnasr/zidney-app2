/**
 * Dependency Graph Generator (T028)
 *
 * Purpose: Generate complete module dependency graph
 * Target: <200KB artifact (with bidirectional edge optimization per Phase 3)
 * Caching: Phase 3 Q2 - implements selective caching for this expensive artifact
 *
 * Provides:
 * - Complete module dependency graph
 * - Cycle detection results
 * - Graph metrics
 */

import { createCacheManager } from '../../core/cache-manager'
import { detectCycles, getNodeDegrees } from '../../core/graph-analyzer'
import { createLogger } from '../../core/logger-factory'

const logger = createLogger('dependency-graph-generator')

export interface DependencyGraphData {
  timestamp: number
  schema_version: string
  modules: string[]
  edges: Array<{
    from: string
    to: string
    weight?: number
  }>
  cycles?: string[][]
  hasCycles: boolean
  nodeStats?: Record<
    string,
    {
      inDegree: number
      outDegree: number
    }
  >
}

/**
 * Generate dependency graph (with Phase 3 Q2 caching support)
 */
export async function generateDependencyGraph(useCache = true): Promise<DependencyGraphData> {
  logger.info('Generating dependency graph', { cache_enabled: useCache })

  const cacheManager = createCacheManager('dependency-graph')

  // Phase 3: Try cache first if enabled
  if (useCache) {
    const cached = await cacheManager.get([
      'packages/*/package.json',
      'apps/*/package.json',
      'tsconfig.json',
    ])
    if (cached) {
      logger.info('Using cached dependency graph')
      return cached as DependencyGraphData
    }
  }

  try {
    // Placeholder: Full implementation in Phase 3
    const modules = [
      'packages/domain-core',
      'packages/types',
      'packages/validation',
      'packages/api-client',
      'packages/config',
      'packages/logger',
      'packages/redis-utils',
      'packages/job-queue',
      'packages/ui-system',
      'apps/api',
      'apps/backoffice',
      'apps/frontoffice',
      'apps/mmc',
      'apps/worker',
    ]

    const edges = [
      { from: 'packages/api-client', to: 'packages/types' },
      { from: 'packages/api-client', to: 'packages/validation' },
      { from: 'packages/domain-core', to: 'packages/types' },
      { from: 'packages/ui-system', to: 'packages/types' },
      { from: 'apps/api', to: 'packages/domain-core' },
      { from: 'apps/api', to: 'packages/logger' },
      { from: 'apps/backoffice', to: 'packages/ui-system' },
      { from: 'apps/backoffice', to: 'packages/api-client' },
      { from: 'apps/frontoffice', to: 'packages/ui-system' },
      { from: 'apps/mmc', to: 'packages/logger' },
      { from: 'apps/worker', to: 'packages/job-queue' },
    ]

    // Detect cycles
    const cycleResult = detectCycles(edges)

    // Calculate node degrees
    const nodeDegrees = getNodeDegrees(edges)

    const data: DependencyGraphData = {
      timestamp: Date.now(),
      schema_version: '2',
      modules,
      edges,
      cycles: cycleResult.cycle ? [cycleResult.cycle] : undefined,
      hasCycles: cycleResult.hasCycle,
      nodeStats: Object.fromEntries(nodeDegrees.entries()),
    }

    // Phase 3: Cache the result if caching enabled
    if (useCache) {
      await cacheManager.set(
        data,
        ['packages/*/package.json', 'apps/*/package.json', 'tsconfig.json'],
        50, // Est. gen time 50ms
        undefined // Use default TTL from env
      )
    }

    const sizeBytes = JSON.stringify(data).length
    logger.info('Dependency graph generated', {
      modules: modules.length,
      edges: edges.length,
      has_cycles: data.hasCycles,
      size_kb: (sizeBytes / 1024).toFixed(1),
    })

    return data
  } catch (error) {
    logger.error('Dependency graph generation failed', { error: String(error) })
    throw error
  }
}

/**
 * Validate dependency graph for completeness
 */
export function validateDependencyGraph(data: DependencyGraphData): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []

  if (!data.modules || data.modules.length === 0) {
    issues.push('No modules in graph')
  }

  if (!data.edges || data.edges.length === 0) {
    if (data.modules && data.modules.length > 1) {
      issues.push('Multiple modules but no edges (incomplete graph)')
    }
  }

  // Check for edges referencing non-existent modules
  const moduleSet = new Set(data.modules)
  for (const edge of data.edges || []) {
    if (!moduleSet.has(edge.from)) {
      issues.push(`Edge references unknown module: ${edge.from}`)
    }
    if (!moduleSet.has(edge.to)) {
      issues.push(`Edge references unknown module: ${edge.to}`)
    }
  }

  if (data.hasCycles) {
    logger.warn('Cycles detected in dependency graph')
  }

  return {
    isValid: issues.length === 0 && !data.hasCycles,
    issues,
  }
}

/**
 * Get dependency graph statistics
 */
export function getDependencyGraphStats(data: DependencyGraphData): Record<string, unknown> {
  return {
    modules: data.modules.length,
    edges: data.edges.length,
    has_cycles: data.hasCycles,
    schema_version: data.schema_version,
    size_bytes: JSON.stringify(data).length,
    avg_dependencies_per_module: (data.edges.length / (data.modules.length || 1)).toFixed(2),
  }
}

export default generateDependencyGraph

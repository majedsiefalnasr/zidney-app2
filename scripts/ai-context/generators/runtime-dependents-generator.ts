/**
 * Runtime Dependents Generator (T030)
 *
 * Purpose: Generate reverse dependency map for impact analysis
 * Target: <200KB artifact
 * Caching: Phase 3 Q2 - implements selective caching
 *
 * Provides:
 * - Who depends on each module
 * - Blast radius analysis
 * - Change impact prediction
 
 * @library-module
*/

import { createCacheManager } from '../../core/cache-manager'
import { createLogger } from '../../utils/logger'

const logger = createLogger('runtime-dependents-generator')

export interface RuntimeDependentsData {
  timestamp: number
  dependents: Record<string, string[]>
  moduleCount: number
  totalDependentEdges: number
}

/**
 * Generate runtime dependents (reverse dependency map)
 */
export async function generateRuntimeDependents(useCache = true): Promise<RuntimeDependentsData> {
  logger.info('Generating runtime dependents', { cache_enabled: useCache })

  const cacheManager = createCacheManager('runtime-dependents')

  // Phase 3: Try cache first if enabled
  if (useCache) {
    const cached = await cacheManager.get(['packages/*/package.json', 'apps/*/package.json'])
    if (cached) {
      logger.info('Using cached runtime dependents')
      return cached as RuntimeDependentsData
    }
  }

  try {
    // Placeholder: Inverts dependency graph to show who depends on each module
    const dependents: Record<string, string[]> = {
      'packages/types': [
        'packages/domain-core',
        'packages/validation',
        'packages/api-client',
        'packages/ui-system',
        'apps/api',
        'apps/backoffice',
        'apps/frontoffice',
      ],
      'packages/domain-core': ['packages/api-client', 'apps/api'],
      'packages/api-client': ['apps/backoffice', 'apps/frontoffice'],
      'packages/ui-system': ['apps/backoffice', 'apps/frontoffice'],
      'packages/logger': ['apps/api', 'apps/mmc', 'apps/worker'],
      'packages/redis-utils': ['apps/api'],
      'packages/job-queue': ['apps/worker', 'apps/api'],
      'packages/config': ['apps/api', 'apps/backoffice', 'apps/frontoffice'],
      'packages/validation': ['apps/api', 'apps/backoffice'],
    }

    const data: RuntimeDependentsData = {
      timestamp: Date.now(),
      dependents,
      moduleCount: Object.keys(dependents).length,
      totalDependentEdges: Object.values(dependents).reduce((sum, deps) => sum + deps.length, 0),
    }

    // Phase 3: Cache the result if caching enabled
    if (useCache) {
      await cacheManager.set(
        data,
        ['packages/*/package.json', 'apps/*/package.json'],
        30, // Est. gen time 30ms
        undefined // Use default TTL from env
      )
    }

    const sizeBytes = JSON.stringify(data).length
    logger.info('Runtime dependents generated', {
      modules: data.moduleCount,
      edges: data.totalDependentEdges,
      size_kb: (sizeBytes / 1024).toFixed(1),
    })

    return data
  } catch (error) {
    logger.error('Runtime dependents generation failed', { error: String(error) })
    throw error
  }
}

/**
 * Get blast radius for a module change
 */
export function getBlastRadius(module: string, data: RuntimeDependentsData): string[] {
  const directDependents = data.dependents[module] || []
  const transitiveDependents: Set<string> = new Set(directDependents)

  // Recursively find transitive dependents
  const queue = [...directDependents]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    for (const dependent of data.dependents[current] || []) {
      if (!transitiveDependents.has(dependent)) {
        transitiveDependents.add(dependent)
        queue.push(dependent)
      }
    }
  }

  return Array.from(transitiveDependents)
}

/**
 * Get runtime dependents statistics
 */
export function getRuntimeDependentsStats(data: RuntimeDependentsData): Record<string, unknown> {
  const avgDependents = data.totalDependentEdges / (data.moduleCount || 1)

  // Find most depended-on modules
  const dependencyCount = Object.entries(data.dependents).map(([module, deps]) => ({
    module,
    count: deps.length,
  }))
  dependencyCount.sort((a, b) => b.count - a.count)

  return {
    total_modules: data.moduleCount,
    total_dependent_edges: data.totalDependentEdges,
    avg_dependents_per_module: avgDependents.toFixed(2),
    most_depended_on: dependencyCount
      .slice(0, 5)
      .map((d) => ({ module: d.module, dependents: d.count })),
    size_bytes: JSON.stringify(data).length,
  }
}

export default generateRuntimeDependents

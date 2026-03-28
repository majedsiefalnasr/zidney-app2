#!/usr/bin/env node
/** @library-module */

/**
 * Infrastructure Audit — Refactored Entry Point
 *
 * Purpose: Comprehensive repository architecture audit with extracted utilities
 * Uses: audit-engine, schema-validator, performance-profiler, cache-manager
 *
 * Supports:
 * - Full audit mode (default)
 * - Incremental audit mode (--incremental flag)
 * - Graph generation mode (--generate-graph flag)
 * - Graph caching for performance (TTL-based validation)
 */

import { existsSync, readFileSync } from 'node:fs'
import { createArchitectureGraphCache } from '../core/architecture-graph-cache'
import { createCacheManager } from '../core/cache-manager'
import { getHealthStatus, Timer } from '../core/performance-profiler'
import { validateDependencyGraph } from '../core/schema-validator'
import { createLogger, log } from '../utils/logger'
import { computeModuleHashes, detectChangedModules } from './core/change-detector'

const logger = createLogger('infra-audit')
const timer = new Timer('infra-audit-execution')

/**
 * Main entry point for Infrastructure Audit with refactored utilities
 */
async function main(): Promise<void> {
  log.header('ARCHITECTURE INFRA AUDIT', 'Architecture audit with refactored utilities')
  timer.start()

  try {
    logger.info('Infrastructure Audit started with refactored utilities')

    // Check if running at incremental mode
    const isIncremental = process.argv.includes('--incremental')
    if (isIncremental) {
      logger.info('Incremental audit mode enabled')
      const changeDetection = detectChangedModules()
      logger.info('Change detection complete', {
        changed_modules: changeDetection.changedModules.length,
        scope: changeDetection.analysisScope,
      })
    }

    // Initialize architecture graph cache
    const graphCache = createArchitectureGraphCache()
    logger.info('Architecture graph cache initialized', {
      cache_path: graphCache.getCacheFilePath(),
      is_valid: graphCache.isCacheValid(),
    })

    // Initialize cache manager for dependency graph caching (Phase 3 Q2)
    const cacheManager = createCacheManager('dependency-graph')
    logger.info('Cache manager initialized for dependency-graph artifact')

    // Validate dependency graph if it exists
    if (existsSync('docs/ai/context/ai-dependency-graph.json')) {
      try {
        const graphContent = readFileSync('docs/ai/context/ai-dependency-graph.json', 'utf-8')
        const graph = JSON.parse(graphContent)
        const validation = validateDependencyGraph(graph)

        if (!validation.valid) {
          logger.warn('Dependency graph schema validation failed', {
            errors: validation.errors.slice(0, 3),
          })
        } else {
          logger.info('Dependency graph schema validated')
        }

        // Attempt to cache the validated graph
        if (validation.valid && graph.nodes && graph.edges) {
          try {
            const sourceHashes = computeModuleHashes(
              graph.nodes.filter((n: string) => n.includes('packages/') || n.includes('apps/'))
            )
            graphCache.cacheGraph(graph.nodes, graph.edges, sourceHashes)
            logger.info('Dependency graph cached for future runs')
          } catch (cacheError) {
            logger.warn('Failed to cache dependency graph', { error: String(cacheError) })
          }
        }
      } catch (error) {
        logger.warn('Could not validate dependency graph', { error: String(error) })
      }
    }

    // Import and run the original infra-audit logic
    // This maintains backward compatibility while using the refactored utilities
    const originalInfraAudit = await import('../infra-audit')
    if (originalInfraAudit && typeof originalInfraAudit.default === 'function') {
      await originalInfraAudit.default()
    } else if (typeof originalInfraAudit.runAudit === 'function') {
      originalInfraAudit.runAudit()
    } else {
      logger.error('Could not locate infra-audit implementation')
      process.exit(1)
    }

    const elapsed = timer.end()
    const stats = timer.getStats()
    const health = getHealthStatus(stats, 3000) // 3s target

    logger.info(`Infrastructure Audit completed in ${elapsed.toFixed(0)}ms (Health: ${health})`)

    // Report cache stats
    const cacheStats = cacheManager.getStats()
    logger.info('Cache statistics', { hitratio: `${(cacheStats.hitratio * 100).toFixed(1)}%` })

    const graphCacheStats = graphCache.getStats()
    logger.info('Graph cache statistics', {
      hits: graphCacheStats.hits,
      misses: graphCacheStats.misses,
      hitratio: `${(graphCacheStats.hitRatio * 100).toFixed(1)}%`,
    })

    if (health === 'FAIL') {
      logger.warn('Performance target exceeded', {
        target: '3s',
        actual: `${elapsed.toFixed(0)}ms`,
      })
    }
  } catch (error) {
    logger.error('Infrastructure Audit failure', { error: String(error) })
    process.exit(1)
  }
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log.error(`[infra-audit] Fatal error: ${String(error)}`)
    process.exit(1)
  })
}

export default main

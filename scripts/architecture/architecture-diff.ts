#!/usr/bin/env node

/**
 * Architecture Diff — Refactored Entry Point
 *
 * Purpose: Compare architecture states and detect drift with extracted utilities
 * Uses: diff-engine, schema-validator, performance-profiler
 *
 * Entry point delegates to existing implementation with enhanced utilities
 */

import { existsSync, readFileSync } from 'node:fs'
import { getHealthStatus, Timer } from '../core/performance-profiler'
import { validateDependencyGraph } from '../core/schema-validator'
import { createLogger, flushAi, log } from '../utils/logger'
import { compareSnapshots, createSnapshot } from './core/diff-engine'

const logger = createLogger('architecture-diff')
const timer = new Timer('architecture-diff-execution')

/**
 * Main entry point for Architecture Diff with refactored utilities
 */
async function main(): Promise<void> {
  log.header('ARCHITECTURE DIFF', 'Compare architecture states and detect drift')\n  timer.start()

  try {
    logger.info('Architecture Diff started with refactored utilities')

    // Load current dependency graph for comparison
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
          logger.info('Current dependency graph validated')
        }

        // Create a snapshot of current state
        const currentSnapshot = createSnapshot(graph.modules || [], graph.edges || [])
        logger.info(`Current architecture snapshot created`, {
          modules: currentSnapshot.moduleCount,
          edges: currentSnapshot.edgeCount,
        })

        // Load previous snapshot if available
        if (existsSync('docs/ai/context/ai-architecture-diff.json')) {
          try {
            const prevDiffContent = readFileSync(
              'docs/ai/context/ai-architecture-diff.json',
              'utf-8'
            )
            const prevDiff = JSON.parse(prevDiffContent)

            if (prevDiff.snapshotB) {
              // Compare with previous state
              const snapshotB = prevDiff.snapshotB
              const diff = compareSnapshots(snapshotB, currentSnapshot)

              logger.info('Architecture comparison completed', {
                hasChanged: diff.hasChanged,
                driftDetected: diff.driftDetected,
                addedModules: diff.addedModules.length,
                removedModules: diff.removedModules.length,
                changedDependencies: diff.changedDependencies.length,
              })

              if (diff.hasChanged) {
                logger.warn('Architecture has changed since last snapshot')
              }
            }
          } catch (error) {
            logger.debug('Could not load previous architecture snapshot', { error: String(error) })
          }
        }
      } catch (error) {
        logger.error('Could not load current dependency graph', { error: String(error) })
      }
    } else {
      logger.warn('Dependency graph not found at docs/ai/context/ai-dependency-graph.json')
    }

    // Import and run the original architecture-diff logic
    // This maintains backward compatibility while using the refactored utilities
    const originalDiff = await import('../architecture-diff')
    if (originalDiff && typeof originalDiff.default === 'function') {
      await originalDiff.default()
    } else if (typeof originalDiff.runDiff === 'function') {
      originalDiff.runDiff()
    } else {
      logger.debug(
        'Original architecture-diff implementation not directly callable, continuing with refactored utilities'
      )
    }

    const elapsed = timer.end()
    const stats = timer.getStats()
    const health = getHealthStatus(stats, 2000) // 2s target

    logger.info(`Architecture Diff completed in ${elapsed.toFixed(0)}ms (Health: ${health})`)

    if (health === 'FAIL') {
      logger.warn('Performance target exceeded', {
        target: '2s',
        actual: `${elapsed.toFixed(0)}ms`,
      })
    }

    log.result({ message: `Architecture Diff completed in ${elapsed.toFixed(0)}ms (Health: ${health})` })
    flushAi()
  } catch (error) {
    logger.error('Architecture Diff failure', { error: String(error) })
    log.progressResult(
      { error: 1 },
      { title: 'Architecture Diff Failed', showPercentage: false }
    )
    flushAi()
    process.exit(1)
  }
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log.error('[architecture-diff] Fatal error: ' + String(error))
    process.exit(1)
  })
}

export default main

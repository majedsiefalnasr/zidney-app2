#!/usr/bin/env node

/**
 * AI Guard — Refactored Entry Point
 *
 * Purpose: Enforce architecture rules with extracted utilities
 * Uses: rule-engine, schema-validator, performance-profiler
 *
 * Entry point delegates to existing implementation with enhanced utilities
 */

import { readFileSync } from 'node:fs'
import { getHealthStatus, Timer } from '../core/performance-profiler'
import { validateArchitectureContract } from '../core/schema-validator'
import { createLogger, flushAi, log } from '../utils/logger'

const logger = createLogger('ai-guard')
const timer = new Timer('ai-guard-execution')

/**
 * Main entry point for AI Guard with refactored utilities
 */
async function main(): Promise<void> {
  log.header('AI GUARD', 'Architecture rule enforcement with refactored utilities')
  timer.start()

  try {
    logger.info('AI Guard started with refactored utilities')

    // Load contract and validate schema
    try {
      const contractContent = readFileSync(
        'docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json',
        'utf-8'
      )
      const contract = JSON.parse(contractContent)
      const validation = validateArchitectureContract(contract)

      if (!validation.valid) {
        logger.error('Architecture contract schema validation failed', {
          errors: validation.errors,
        })
        process.exit(1)
      }

      logger.info('Architecture contract schema validated')
    } catch (error) {
      logger.warn('Could not validate architecture contract schema', { error: String(error) })
      // Continue with execution even if contract validation is not available
    }

    // Import and run the original ai-guard logic
    // This maintains backward compatibility while using the refactored utilities
    const originalAiGuard = await import('../ai-guard')
    if (originalAiGuard && typeof originalAiGuard.default === 'function') {
      await originalAiGuard.default()
    } else if (typeof originalAiGuard.runGuard === 'function') {
      originalAiGuard.runGuard()
    } else {
      logger.error('Could not locate ai-guard implementation')
      process.exit(1)
    }

    const elapsed = timer.end()
    const stats = timer.getStats()
    const health = getHealthStatus(stats, 1000) // 1s target

    logger.info(`AI Guard completed in ${elapsed.toFixed(0)}ms (Health: ${health})`)

    if (health === 'FAIL') {
      logger.warn('Performance target exceeded', {
        target: '1s',
        actual: `${elapsed.toFixed(0)}ms`,
      })
    }

    log.progressResult(
      { success: 1, info: 1 },
      { title: `AI Guard Health Check (${health})`, showPercentage: false }
    )
    flushAi()
  } catch (error) {
    logger.error('AI Guard failure', { error: String(error) })
    log.progressResult({ error: 1 }, { title: 'AI Guard Validation Failed', showPercentage: false })
    flushAi()
    process.exit(1)
  }
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log.error(`[ai-guard] Fatal error: ${String(error)}`)
    process.exit(1)
  })
}

export default main

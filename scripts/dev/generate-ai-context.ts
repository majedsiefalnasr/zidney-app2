/**
 * CLI Entry Point - Generate AI Context Artifacts
 * Task: T026 / T036 moved to scripts/dev/
 * Path: scripts/dev/generate-ai-context.ts
 *
 * Usage:
 *   bun run ai:context:generate              # Generate if changed
 *   bun run ai:context:generate -- --force  # Force generation
 *   bun run ai:context:generate -- --validate # Validate after generation
 */

import { join } from 'node:path'
import { generateAllArtifacts } from '../ai-context/artifact-generator'
import { detectChanges, updateChangeCache } from '../ai-context/change-detector'
import { flushAi, log } from '../utils/logger'

const REPO_ROOT = process.cwd()
const OUTPUT_DIR = join(REPO_ROOT, 'docs/ai/context')

/**
 * Parse command-line arguments
 */
function parseArgs(): {
  force: boolean
  validate: boolean
  verbose: boolean
  outputDir: string
} {
  const args = process.argv.slice(2)

  return {
    force: args.includes('--force'),
    validate: args.includes('--validate'),
    verbose: args.includes('--verbose'),
    outputDir: OUTPUT_DIR,
  }
}

/**
 * Main entry point
 */
async function main() {
  log.header('AI CONTEXT GENERATE', 'Generate AI context artifacts from repo source')
  const opts = parseArgs()

  try {
    if (opts.verbose) {
      log.info('AI Context Artifact Generation')
      log.info(`Repository: ${REPO_ROOT}`)
      log.info(`Output: ${opts.outputDir}`)
    }

    // Check for changes (unless --force)
    if (!opts.force) {
      if (opts.verbose) log.info('Checking for source changes...')

      // Create a dummy source content for change detection
      const sourceContent = `${Date.now()}-generation`
      const changes = await detectChanges(REPO_ROOT, sourceContent)

      if (!changes.should_regenerate) {
        log.success('Artifacts are up-to-date (use --force to regenerate)')
        log.result({ total: 1, passed: 1, failed: 0, message: 'up-to-date' })
        flushAi()
        process.exit(0)
      }

      if (opts.verbose) {
        log.info(`Last generated: ${changes.last_generated_at}`)
        log.info(`Time since: ${changes.time_since_generation_seconds}s`)
      }
    }

    // Generate artifacts
    const result = await generateAllArtifacts({
      repoRoot: REPO_ROOT,
      outputDir: opts.outputDir,
      validate: opts.validate,
      verbose: opts.verbose,
    })

    // Update cache
    const sourceContent = `${Date.now()}-generation`
    await updateChangeCache(REPO_ROOT, sourceContent)

    log.step('Generation Results:')
    log.info(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`)
    log.info(`Artifacts: ${result.artifacts_generated.length}`)
    log.info(`Duration: ${result.duration_ms}ms`)
    log.info(`Modules: ${result.metrics.total_modules}`)
    log.info(`Violations: ${result.metrics.total_violations}`)

    if (result.warnings.length > 0) {
      log.warn(`Warnings: ${result.warnings.length}`)
      for (const warning of result.warnings.slice(0, 5)) {
        log.warn(`  - ${warning.message}`)
      }
    }

    if (result.errors.length > 0) {
      log.error(`Errors: ${result.errors.length}`)
      for (const error of result.errors.slice(0, 5)) {
        log.error(`  - ${error.message}`)
      }
      log.result({
        total: result.artifacts_generated.length,
        passed: 0,
        failed: result.errors.length,
      })
      flushAi()
      process.exit(1)
    }

    log.result({
      total: result.artifacts_generated.length,
      passed: result.success ? result.artifacts_generated.length : 0,
      failed: result.success ? 0 : result.artifacts_generated.length,
    })
    flushAi()
    process.exit(result.success ? 0 : 1)
  } catch (err) {
    log.error(`Fatal error: ${String(err)}`)
    flushAi()
    process.exit(1)
  }
}

// Run if this is the main module
if (import.meta.main) {
  main()
}

export { main }

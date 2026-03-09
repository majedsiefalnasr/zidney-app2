/**
 * CLI Entry Point - Generate AI Context Artifacts
 * Task: T026
 * Path: scripts/generate-ai-context.ts
 *
 * Usage:
 *   bun run generate-ai-context.ts              # Generate if changed
 *   bun run generate-ai-context.ts --force      # Force generation
 *   bun run generate-ai-context.ts --validate   # Validate after generation
 */

import { join } from 'node:path'
import { generateAllArtifacts } from './ai-context/artifact-generator'
import { detectChanges, updateChangeCache } from './ai-context/change-detector'

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
  const opts = parseArgs()

  try {
    if (opts.verbose) {
      console.log('🚀 AI Context Artifact Generation')
      console.log(`   Repository: ${REPO_ROOT}`)
      console.log(`   Output: ${opts.outputDir}`)
      console.log('')
    }

    // Check for changes (unless --force)
    if (!opts.force) {
      if (opts.verbose) console.log('🔍 Checking for source changes...')

      // Create a dummy source content for change detection
      const sourceContent = `${Date.now()}-generation`
      const changes = await detectChanges(REPO_ROOT, sourceContent)

      if (!changes.should_regenerate) {
        console.log('✓ Artifacts are up-to-date (use --force to regenerate)')
        process.exit(0)
      }

      if (opts.verbose) {
        console.log(`   Last generated: ${changes.last_generated_at}`)
        console.log(`   Time since: ${changes.time_since_generation_seconds}s`)
        console.log('')
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

    // Report results
    console.log('')
    console.log('📊 Generation Results:')
    console.log(`   Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`)
    console.log(`   Artifacts: ${result.artifacts_generated.length}`)
    console.log(`   Duration: ${result.duration_ms}ms`)
    console.log(`   Modules: ${result.metrics.total_modules}`)
    console.log(`   Violations: ${result.metrics.total_violations}`)

    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings: ${result.warnings.length}`)
      for (const warning of result.warnings.slice(0, 5)) {
        console.log(`   - ${warning.message}`)
      }
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors: ${result.errors.length}`)
      for (const error of result.errors.slice(0, 5)) {
        console.log(`   - ${error.message}`)
      }
      process.exit(1)
    }

    process.exit(result.success ? 0 : 1)
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

// Run if this is the main module
if (import.meta.main) {
  main()
}

export { main }

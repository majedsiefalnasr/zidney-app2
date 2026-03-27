/** @library-module */
import { existsSync } from 'node:fs'

const MARKERS = ['package.json', 'docs/ai/context']

/**
 * Assert the script is run from the monorepo root.
 * If any marker path is missing, writes structured JSON to stderr and exits 3.
 * This is the ONLY file in scripts/ai-engine/ permitted to write to process.stderr directly.
 */
export function assertMonorepoRoot(): void {
  const missing = MARKERS.filter((m) => !existsSync(m))
  if (missing.length > 0) {
    process.stderr.write(
      `${JSON.stringify({
        error: 'MONOREPO_ROOT_NOT_FOUND',
        missing,
        message: 'Scripts must be run from the monorepo root directory.',
      })}\n`
    )
    process.exit(3)
  }
}

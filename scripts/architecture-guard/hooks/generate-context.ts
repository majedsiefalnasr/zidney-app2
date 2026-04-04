/** @library-module */
import { execSync } from 'node:child_process'

/**
 * Architecture context generation hook.
 *
 * 1. `arch:audit` refreshes architecture intelligence files
 *    (ARCHITECTURE_CONTEXT.json, ARCHITECTURE_CONTRACT.json, dashboards, etc.)
 *    but does NOT write AI context files — those are exclusively owned by
 *    `ai:context:refresh` to prevent format conflicts.
 *
 * 2. `ai:context:refresh` generates the 7 AI context artifacts
 *    (ai-architecture-brain.json, ai-module-map.json, etc.)
 *    using the dedicated artifact-generator with the richer schema.
 */
export function runContextGenerationHook(): void {
  execSync('bun run arch:audit', {
    stdio: 'pipe',
    encoding: 'utf-8',
  })

  execSync('bun run ai:context:refresh', {
    stdio: 'pipe',
    encoding: 'utf-8',
  })
}

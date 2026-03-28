/** @library-module */
import { execSync } from 'node:child_process'

export function runContextGenerationHook(): void {
  execSync('bun scripts/infra-audit.ts', {
    stdio: 'pipe',
    encoding: 'utf-8',
  })

  execSync('bun scripts/generate-ai-context.ts --force', {
    stdio: 'pipe',
    encoding: 'utf-8',
  })
}

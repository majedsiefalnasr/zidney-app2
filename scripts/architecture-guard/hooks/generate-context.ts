/** @library-module */
import { execSync } from 'node:child_process'

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

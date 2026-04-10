/**
 * Confirms each app creates its own Pinia instance (not a shared singleton).
 * Covers Test 5.1: Store Isolation Across Apps.
 * Stage: STAGE_TEST_01_UI_RUNTIME_VALIDATION
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

// Convention: each app must declare `const pinia = createPinia()` in its own main.ts.
// This ensures no cross-app singleton is shared and each Pinia instance is isolated.
function readMain(app: string): string {
  return readFileSync(join(ROOT, 'apps', app, 'src', 'main.ts'), 'utf-8')
}

describe('Pinia store isolation per app (Test 5.1)', () => {
  const apps = ['mmc', 'backoffice', 'frontoffice'] as const

  for (const app of apps) {
    it(`${app}/main.ts calls createPinia() locally`, () => {
      expect(readMain(app)).toContain('createPinia()')
    })

    it(`${app}/main.ts wires local pinia instance via app.use(pinia)`, () => {
      expect(readMain(app), `${app}/main.ts missing app.use(pinia) wiring`).toMatch(
        /app\.use\(\s*pinia\s*\)/
      )
    })

    it(`${app}/main.ts imports createPinia from 'pinia' package (not a cross-app singleton)`, () => {
      expect(readMain(app)).toMatch(/import\s+\{[^}]*createPinia[^}]*\}\s+from\s+['"]pinia['"]/)
    })

    it(`${app}/main.ts does NOT import createPinia from a @zidney/* shared package`, () => {
      expect(readMain(app)).not.toMatch(/from\s+['"]@zidney\/[^'"]*pinia[^'"]*['"]/)
    })
  }

  it('each app independently declares const pinia = createPinia()', () => {
    for (const app of apps) {
      expect(readMain(app), `${app}/main.ts missing local pinia declaration`).toMatch(
        /const pinia\s*=\s*createPinia\(\)/
      )
    }
  })
})

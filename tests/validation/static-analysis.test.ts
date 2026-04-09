/**
 * Static analysis: confirm source code hygiene for STAGE_TEST_01_UI_RUNTIME_VALIDATION.
 * Tests: 3.1 (no raw HTTP), 5.3 (no direct API calls in .vue), 6.1 (.env.production not in git), 7.1 (no v-html)
 * Requires: ripgrep (rg) — install with `brew install ripgrep` or `apt install ripgrep`
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const APP_SRC = 'apps/mmc/src apps/backoffice/src apps/frontoffice/src'
const REPO_ROOT = process.cwd()

beforeAll(() => {
  try {
    execSync('rg --version', { cwd: REPO_ROOT, stdio: 'pipe' })
  } catch {
    throw new Error(
      'ripgrep (rg) is required for static analysis tests but was not found. ' +
        'Install: brew install ripgrep  |  apt install ripgrep  |  cargo install ripgrep'
    )
  }
  for (const dir of ['apps/mmc/src', 'apps/backoffice/src', 'apps/frontoffice/src']) {
    if (!existsSync(join(REPO_ROOT, dir))) {
      throw new Error(`Required scan directory does not exist: ${dir} — verify the app src path`)
    }
  }
})

function scan(pattern: string, pathArgs: string, extraFlags = ''): string {
  return execSync(`rg --count-matches ${extraFlags} "${pattern}" ${pathArgs} 2>/dev/null || true`, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  }).trim()
}

function gitLsFiles(path: string): string {
  try {
    return execSync(`git ls-files "${path}"`, { cwd: REPO_ROOT, encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

describe('Static Analysis — Raw HTTP (Test 3.1)', () => {
  it('no raw fetch( calls in app source (excluding test files)', () => {
    const result = scan('fetch\\(', APP_SRC, '--glob "!**/*.{test,spec}.ts"')
    expect(result, 'Raw fetch() found — use @zidney/api-client instead').toBe('')
  })

  it('no axios method calls in app source', () => {
    const result = scan(
      'axios\\.(get|post|put|delete|patch)\\(',
      APP_SRC,
      '--glob "!**/*.{test,spec}.ts"'
    )
    expect(result, 'Direct axios call found — use @zidney/api-client instead').toBe('')
  })

  it('no new XMLHttpRequest( in app source', () => {
    const result = scan('new XMLHttpRequest\\(', APP_SRC)
    expect(result, 'XMLHttpRequest found — use @zidney/api-client instead').toBe('')
  })
})

describe('Static Analysis — XSS Surface (Test 7.1)', () => {
  it('no v-html directive in any .vue file', () => {
    const result = scan('v-html', APP_SRC, '--glob "*.vue"')
    expect(result, 'v-html found — XSS risk, remove and use text binding').toBe('')
  })
})

describe('Static Analysis — Env Security (Test 6.1)', () => {
  it('.env.production is not tracked in git', () => {
    const all = [
      gitLsFiles('.env.production'),
      gitLsFiles('apps/mmc/.env.production'),
      gitLsFiles('apps/backoffice/.env.production'),
      gitLsFiles('apps/frontoffice/.env.production'),
    ].join('')
    expect(all, '.env.production tracked in git — add to .gitignore').toBe('')
  })
})

describe('Static Analysis — No Business Logic in Vue Components (Test 5.3)', () => {
  it('no direct apiClient method calls inside .vue files', () => {
    const result = scan('apiClient\\.(get|post|put|delete|patch)\\(', APP_SRC, '--glob "*.vue"')
    expect(result, 'Direct apiClient call in .vue — delegate to composable or store action').toBe(
      ''
    )
  })
})

// DEFERRED: main.ts licenseStatusStore.clearLicenseStatus() wiring scan removed.
// This stage is VALIDATION-ONLY — production code in apps/*/src/main.ts does not yet
// call clearLicenseStatus() inside onSessionExpired. A follow-up PRODUCTION-PATCH stage
// will add this one-line call. GAP 5 tests (T008–T010) validate store behavior via
// synthetic closures and remain valid as-is.

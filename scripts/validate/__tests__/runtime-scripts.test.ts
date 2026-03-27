/**
 * Unit tests for scripts/validate/runtime-scripts.ts
 * Covers: script reference extraction, exclusion filtering, CLI-flag non-match,
 *         loadRegisteredScripts, missing-script detection, all-registered pass
 
 * @library-module
*/

import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  EXCLUDED_NAMES,
  extractScriptReferences,
  loadRegisteredScripts,
  SCRIPT_REGEX,
} from '../runtime-scripts'

// ─── Test 1: Standard extraction ─────────────────────────────────────────────
describe('extractScriptReferences', () => {
  it('extracts standard bun run references from markdown content', () => {
    const content = `
## Commands

Run \`bun run db:migrate\` to apply migrations.
Then run \`bun run db:status:pool\` to verify.
Also \`bun run validate:ai-context-fresh\` before deploying.
`
    const refs = extractScriptReferences(content)
    expect(refs).toContain('db:migrate')
    expect(refs).toContain('db:pool-status')
    expect(refs).toContain('validate:ai-context-fresh')
    expect(refs.length).toBe(3)
  })

  // ─── Test 2: Excluded-name filter ──────────────────────────────────────────
  it('filters out excluded script names', () => {
    const content = `
bun run my-new-script
bun run scripts
bun run wrapper
bun run lint:staged
bun run db:migrate
`
    const refs = extractScriptReferences(content)
    expect(refs).not.toContain('my-new-script')
    expect(refs).not.toContain('scripts')
    expect(refs).not.toContain('wrapper')
    expect(refs).not.toContain('lint:staged')
    expect(refs).toContain('db:migrate')
    expect(refs.length).toBe(1)
  })

  // ─── Test 3: CLI flag forms excluded ───────────────────────────────────────
  it('does not match CLI flag forms like bun run --watch', () => {
    const content = `
bun run --watch
bun run --config=vite.config.ts
bun run db:migrate
`
    const refs = extractScriptReferences(content)
    expect(refs).not.toContain('--watch')
    expect(refs).not.toContain('--config=vite.config.ts')
    expect(refs).toContain('db:migrate')
    expect(refs.length).toBe(1)
  })

  // ─── Test 4: Deduplication ──────────────────────────────────────────────────
  it('deduplicates repeated references', () => {
    const content = `
bun run db:migrate
bun run db:migrate
bun run db:status:pool
`
    const refs = extractScriptReferences(content)
    expect(refs.length).toBe(2)
    expect(refs).toContain('db:migrate')
    expect(refs).toContain('db:pool-status')
  })
})

// ─── Test 5: EXCLUDED_NAMES set ───────────────────────────────────────────────
describe('EXCLUDED_NAMES', () => {
  it('contains expected exclusion entries', () => {
    expect(EXCLUDED_NAMES.has('my-new-script')).toBe(true)
    expect(EXCLUDED_NAMES.has('scripts')).toBe(true)
    expect(EXCLUDED_NAMES.has('wrapper')).toBe(true)
    expect(EXCLUDED_NAMES.has('lint:staged')).toBe(true)
  })
})

// ─── Test 6: loadRegisteredScripts returns Set<string> ───────────────────────
describe('loadRegisteredScripts', () => {
  let tmpPkg: string

  beforeAll(() => {
    tmpPkg = join(tmpdir(), `test-pkg-${Date.now()}.json`)
    const pkg = {
      scripts: {
        'db:migrate': 'bun scripts/db/migrate.ts',
        'db:pool-status': 'bun scripts/db/pool-status.ts',
        lint: 'biome check .',
      },
    }
    writeFileSync(tmpPkg, JSON.stringify(pkg))
  })

  afterAll(() => {
    try {
      const { unlinkSync } = require('node:fs') as typeof import('node:fs')
      unlinkSync(tmpPkg)
    } catch {
      // ignore
    }
  })

  it('returns a Set<string> of script keys from package.json', () => {
    const result = loadRegisteredScripts(tmpPkg)
    expect(result).toBeInstanceOf(Set)
    expect(result.has('db:migrate')).toBe(true)
    expect(result.has('db:pool-status')).toBe(true)
    expect(result.has('lint')).toBe(true)
  })

  // ─── Test 7: Missing script detection ──────────────────────────────────────
  it('identifies missing script references when compared against refs', () => {
    const registered = loadRegisteredScripts(tmpPkg)
    const refs = ['db:migrate', 'db:pool-status', 'missing-script', 'also-missing']
    const missing = refs.filter((r) => !registered.has(r))
    expect(missing).toContain('missing-script')
    expect(missing).toContain('also-missing')
    expect(missing.length).toBe(2)
  })

  // ─── Test 8: All-registered returns empty array ────────────────────────────
  it('returns empty missing array when all references are registered', () => {
    const registered = loadRegisteredScripts(tmpPkg)
    const refs = ['db:migrate', 'db:pool-status', 'lint']
    const missing = refs.filter((r) => !registered.has(r))
    expect(missing).toHaveLength(0)
  })
})

// ─── Test 9: SCRIPT_REGEX pattern ────────────────────────────────────────────
describe('SCRIPT_REGEX', () => {
  it('matches valid bun run references', () => {
    const re = new RegExp(SCRIPT_REGEX.source, 'g')
    const line = 'Run bun run db:migrate to apply'
    const matches: string[] = []
    let m = re.exec(line)
    while (m !== null) {
      matches.push(m[1])
      m = re.exec(line)
    }
    expect(matches).toContain('db:migrate')
  })
})

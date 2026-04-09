import { describe, expect, it } from 'vitest'
import { parseMetaHeader } from '../script-docs'

describe('script-docs parser', () => {
  it('parses metadata header including explicit @flag', () => {
    const content = `/**
 * @script test:do
 * @domain dev
 * @category dev
 * @description This is a test description.
 *   continues on the next line.
 * @usage bun run test:do
 * @flag --ci boolean Enable CI mode | bun run test:do -- --ci
 */`

    const meta = parseMetaHeader(content, '/repo/scripts/generate/test.ts')
    expect(meta).not.toBeNull()
    expect(meta?.script).toBe('test:do')
    expect(meta?.domain).toBe('dev')
    expect(meta?.category).toBe('dev')
    expect(meta?.description).toContain('This is a test description')
    expect(Array.isArray(meta?.flags)).toBe(true)
    expect(meta?.flags.length).toBeGreaterThanOrEqual(1)
    expect(meta?.flags.some((f) => f.name === '--ci')).toBe(true)
  })

  it('auto-detects flags from common code patterns when no @flag present', () => {
    const content = `/**
 * @script test:auto
 * @domain dev
 * @category dev
 * @description Flag detection
 * @usage bun run test:auto
 */
const args = process.argv.slice(2)
if (args.includes('--json')) log.info('json')
`

    const meta = parseMetaHeader(content, '/repo/scripts/generate/auto.ts')
    expect(meta).not.toBeNull()
    // Should detect --json as a flag via code pattern
    expect(meta?.flags.some((f) => f.name === '--json')).toBe(true)
  })
})

import { parseScriptFlags } from '../script-docs'

describe('script-docs parsing utilities', () => {
  it('parses meta header with flags from JSDoc', () => {
    const content = `/**
 * @script dev:generate:script-docs
 * @domain dev
 * @category dev
 * @description Generate script docs and registry
 * @usage bun run dev:generate:script-docs [-- --check-only]
 * @flag --check-only boolean Validate without writing files | bun run dev:generate:script-docs -- --check-only
 */`

    const meta = parseMetaHeader(content, '/repo/scripts/generate/script-docs.ts')
    expect(meta).not.toBeNull()
    expect(meta?.script).toBe('dev:generate:script-docs')
    expect(meta?.domain).toBe('dev')
    expect(meta?.category).toBe('dev')
    expect(meta?.description).toMatch(/Generate script docs/)
    expect(meta?.flags.length).toBeGreaterThanOrEqual(1)
    const flag = meta?.flags.find((f) => f.name === '--check-only')
    expect(flag).toBeDefined()
    expect(flag?.type).toBe('boolean')
  })

  it('detects flags from common code patterns', () => {
    const content = `const args = process.argv.slice(2)
if (args.includes('--ci')) { runCiMode() }
if (args.includes('--json')) log.info(JSON.stringify({}))
if (arg === '--name') value = args[++i]
`
    const flags = parseScriptFlags(content, 'scripts:example')
    expect(flags.some((f) => f.name === '--ci')).toBeTruthy()
    expect(flags.some((f) => f.name === '--json')).toBeTruthy()
    expect(flags.some((f) => f.name === '--name' && f.type === 'string')).toBeTruthy()
  })
})

/**
 * Unit Tests: rules/SCRIPTS-003.rule.ts
 *
 * Covers:
 * - Script referencing bun scripts/foo.ts not in existingScriptPaths → error violation
 * - Existing path → no violation
 * - Non-scripts/ path patterns ignored
 * - context.existingScriptPaths undefined → no violations
 * - No filesystem I/O in evaluate()
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { _resetRegistryForTesting, getRules } from '../../../../scripts/policy-engine/registry'
import type { PolicyContext } from '../../../../scripts/policy-engine/types'

function makeContext(
  scripts: Record<string, string> = {},
  existingScriptPaths?: string[]
): PolicyContext {
  return {
    mode: 'full',
    timeout: 5000,
    changedFiles: [],
    dependencyGraph: null,
    scripts,
    existingScriptPaths,
  }
}

describe('SCRIPTS-003 rule', () => {
  beforeAll(async () => {
    _resetRegistryForTesting()
    await import('../../../../scripts/policy-engine/rules/scripts/SCRIPTS-003.rule')
  })

  afterAll(() => {
    _resetRegistryForTesting()
  })

  it('registers the SCRIPTS-003 rule', () => {
    const rules = getRules()
    expect(rules.some((r) => r.id === 'SCRIPTS-003')).toBe(true)
  })

  it('missing script path produces error violation', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-003')!

    const context = makeContext({ 'run:script': 'bun scripts/missing.ts' }, ['scripts/exists.ts'])

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(1)
    expect(results[0]!.ruleId).toBe('SCRIPTS-003')
    expect(results[0]!.severity).toBe('error')
    expect(results[0]!.message).toContain('scripts/missing.ts')
  })

  it('existing path produces no violation', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-003')!

    const context = makeContext({ 'run:script': 'bun scripts/exists.ts' }, ['scripts/exists.ts'])

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(0)
  })

  it('bun run scripts/ syntax detected', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-003')!

    const context = makeContext({ 'run:script': 'bun run scripts/missing.ts --flag' }, [
      'scripts/existing.ts',
    ])

    const results = await rule.evaluate(context)
    expect(results.some((r) => r.message.includes('scripts/missing.ts'))).toBe(true)
  })

  it('non-scripts/ path patterns are ignored', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-003')!

    const context = makeContext({ 'build:api': 'bun --cwd apps/api build' }, [])

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(0)
  })

  it('undefined existingScriptPaths skips checks (no violations)', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-003')!

    const context = makeContext({ 'run:script': 'bun scripts/something.ts' }, undefined)

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(0)
  })
})

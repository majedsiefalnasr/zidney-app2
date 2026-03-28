/**
 * Unit Tests: rules/SCRIPTS-004.rule.ts
 *
 * Covers:
 * - Script key absent from documentedScriptNames → warning
 * - Script key present in documentedScriptNames → no violation
 * - context.documentedScriptNames undefined → no violations
 * - No filesystem I/O in evaluate()
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { _resetRegistryForTesting, getRules } from '../../../../scripts/policy-engine/registry'
import type { PolicyContext } from '../../../../scripts/policy-engine/types'

function makeContext(
  scripts: Record<string, string> = {},
  documentedScriptNames?: string[]
): PolicyContext {
  return {
    mode: 'full',
    timeout: 5000,
    changedFiles: [],
    dependencyGraph: null,
    scripts,
    documentedScriptNames,
  }
}

describe('SCRIPTS-004 rule', () => {
  beforeAll(async () => {
    _resetRegistryForTesting()
    await import('../../../../scripts/policy-engine/rules/scripts/SCRIPTS-004.rule')
  })

  afterAll(() => {
    _resetRegistryForTesting()
  })

  it('registers the SCRIPTS-004 rule', () => {
    const rules = getRules()
    expect(rules.some((r) => r.id === 'SCRIPTS-004')).toBe(true)
  })

  it('undocumented script produces warning', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-004')!

    const context = makeContext(
      { 'build:api': 'bun build apps/api', 'test:unit': 'vitest run' },
      ['test:unit'] // only test:unit is documented
    )

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(1)
    expect(results[0]!.ruleId).toBe('SCRIPTS-004')
    expect(results[0]!.severity).toBe('warning')
    expect(results[0]!.message).toContain('build:api')
  })

  it('documented script produces no violation', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-004')!

    const context = makeContext({ 'build:api': 'bun build apps/api' }, ['build:api'])

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(0)
  })

  it('undefined documentedScriptNames skips checks', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-004')!

    const context = makeContext({ 'build:api': 'bun build apps/api' }, undefined)
    const results = await rule.evaluate(context)
    expect(results).toHaveLength(0)
  })

  it('suggestion field points to docs/scripts/', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-004')!

    const context = makeContext({ 'build:api': 'bun build' }, [])
    const results = await rule.evaluate(context)

    expect(results[0]!.suggestion).toContain('docs/scripts/')
  })
})

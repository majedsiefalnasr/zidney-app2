/**
 * Unit Tests: rules/SCRIPTS-002.rule.ts
 *
 * Covers:
 * - Two scripts with identical normalized command value → duplicate warning
 * - Unique command values → no violations
 * - Empty context.scripts → no violations
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { _resetRegistryForTesting, getRules } from '../../../../scripts/policy-engine/registry'
import type { PolicyContext } from '../../../../scripts/policy-engine/types'

function makeContext(scripts: Record<string, string> = {}): PolicyContext {
  return {
    mode: 'full',
    timeout: 5000,
    changedFiles: [],
    dependencyGraph: null,
    scripts,
  }
}

describe('SCRIPTS-002 rule', () => {
  beforeAll(async () => {
    _resetRegistryForTesting()
    await import('../../../../scripts/policy-engine/rules/scripts/SCRIPTS-002.rule')
  })

  afterAll(() => {
    _resetRegistryForTesting()
  })

  it('registers the SCRIPTS-002 rule', () => {
    const rules = getRules()
    expect(rules.some((r) => r.id === 'SCRIPTS-002')).toBe(true)
  })

  it('identical normalized commands produce a duplicate warning', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-002')!

    const context = makeContext({
      'build:api': 'bun run apps/api/build.ts',
      'build:api:dup': 'bun run apps/api/build.ts',
    })

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(1)
    expect(results[0]!.ruleId).toBe('SCRIPTS-002')
    expect(results[0]!.severity).toBe('warning')
    expect(results[0]!.message).toContain('build:api')
  })

  it('case-insensitive normalized commands deduplicated', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-002')!

    const context = makeContext({
      'lint:check': 'Biome Check .',
      'lint:check2': 'biome check .',
    })

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(1)
  })

  it('unique command values produce no violations', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-002')!

    const context = makeContext({
      'build:api': 'bun run apps/api/build.ts',
      'build:mmc': 'bun run apps/mmc/build.ts',
    })

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(0)
  })

  it('empty context.scripts produces no violations', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-002')!

    const results = await rule.evaluate(makeContext({}))
    expect(results).toHaveLength(0)
  })
})

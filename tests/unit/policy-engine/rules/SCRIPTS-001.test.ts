/**
 * Unit Tests: rules/SCRIPTS-001.rule.ts
 *
 * Covers:
 * - Valid <domain>:<action> patterns pass
 * - Single-segment names flagged
 * - Names with uppercase flagged
 * - Empty context.scripts → no violations
 * - suggestion field populated with expected format
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

describe('SCRIPTS-001 rule', () => {
  beforeAll(async () => {
    _resetRegistryForTesting()
    await import('../../../../scripts/policy-engine/rules/scripts/SCRIPTS-001.rule')
  })

  afterAll(() => {
    _resetRegistryForTesting()
  })

  it('registers the SCRIPTS-001 rule', () => {
    const rules = getRules()
    expect(rules.some((r) => r.id === 'SCRIPTS-001')).toBe(true)
  })

  it('valid naming patterns produce no violations', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-001')!

    const context = makeContext({
      'build:api': 'bun build apps/api',
      'test:unit:api': 'vitest run',
      'dev:mmc': 'bun dev',
      'lint:fix': 'biome check --write .',
    })

    const results = await rule.evaluate(context)
    expect(results).toHaveLength(0)
  })

  it('single-segment name is flagged', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-001')!

    const context = makeContext({ build: 'bun run build' })
    const results = await rule.evaluate(context)

    expect(results).toHaveLength(1)
    expect(results[0]!.ruleId).toBe('SCRIPTS-001')
    expect(results[0]!.severity).toBe('warning')
    expect(results[0]!.message).toContain('build')
  })

  it('name with uppercase is flagged', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-001')!

    const context = makeContext({ 'Build:API': 'bun run build' })
    const results = await rule.evaluate(context)

    expect(results).toHaveLength(1)
    expect(results[0]!.message).toContain('Build:API')
  })

  it('suggestion field is populated', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-001')!

    const context = makeContext({ buildapi: 'bun run build' })
    const results = await rule.evaluate(context)

    expect(results[0]!.suggestion).toContain('<domain>:<action>')
  })

  it('empty context.scripts produces no violations', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-001')!

    const results = await rule.evaluate(makeContext({}))
    expect(results).toHaveLength(0)
  })

  it('undefined context.scripts produces no violations', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SCRIPTS-001')!

    const context = makeContext()
    delete context.scripts
    const results = await rule.evaluate(context)
    expect(results).toHaveLength(0)
  })
})

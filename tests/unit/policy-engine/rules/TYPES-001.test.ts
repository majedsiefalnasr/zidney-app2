/**
 * Unit Tests: rules/TYPES-001.rule.ts
 *
 * Covers:
 * - rule.sequential === true (must run sequentially)
 * - evaluate() delegates to runTypeSafety adapter
 * - adapter errors returned as PolicyResult[]
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { _resetRegistryForTesting, getRules } from '../../../../scripts/policy-engine/registry'
import type { PolicyContext } from '../../../../scripts/policy-engine/types'

vi.mock('../../../../scripts/policy-engine/adapters/type-safety.adapter', () => ({
  runTypeSafety: vi.fn(async () => []),
}))

function makeContext(): PolicyContext {
  return {
    mode: 'full',
    timeout: 5000,
    changedFiles: [],
    dependencyGraph: null,
  }
}

describe('TYPES-001 rule', () => {
  beforeAll(async () => {
    _resetRegistryForTesting()
    await import('../../../../scripts/policy-engine/rules/types/TYPES-001.rule')
  })

  afterAll(() => {
    _resetRegistryForTesting()
    vi.clearAllMocks()
  })

  it('registers the TYPES-001 rule', () => {
    const rules = getRules()
    expect(rules.some((r) => r.id === 'TYPES-001')).toBe(true)
  })

  it('rule has sequential: true', () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'TYPES-001')!
    expect(rule.sequential).toBe(true)
  })

  it('evaluate() delegates to runTypeSafety', async () => {
    const { runTypeSafety } = await import(
      '../../../../scripts/policy-engine/adapters/type-safety.adapter'
    )
    const mockAdapter = vi.mocked(runTypeSafety)

    const rules = getRules()
    const rule = rules.find((r) => r.id === 'TYPES-001')!
    const context = makeContext()
    await rule.evaluate(context)

    expect(mockAdapter).toHaveBeenCalledWith(context)
  })

  it('returns adapter results unchanged', async () => {
    const { runTypeSafety } = await import(
      '../../../../scripts/policy-engine/adapters/type-safety.adapter'
    )
    const mockResult = {
      ruleId: 'TYPES-001',
      domain: 'TYPES' as const,
      severity: 'error' as const,
      message: "TS2345: Argument of type 'string' is not assignable",
      file: 'src/foo.ts',
      line: 10,
      column: 5,
    }
    vi.mocked(runTypeSafety).mockResolvedValueOnce([mockResult])

    const rules = getRules()
    const rule = rules.find((r) => r.id === 'TYPES-001')!
    const results = await rule.evaluate(makeContext())

    expect(results).toEqual([mockResult])
  })

  it('empty adapter results → empty PolicyResult[]', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'TYPES-001')!
    const results = await rule.evaluate(makeContext())
    expect(results).toEqual([])
  })
})

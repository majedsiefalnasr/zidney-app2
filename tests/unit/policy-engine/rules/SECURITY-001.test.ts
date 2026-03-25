/**
 * Unit Tests: rules/SECURITY-001.rule.ts
 *
 * Covers:
 * - evaluate() delegates to runTrivy adapter
 * - Critical/High CVEs returned as PolicyResult[]
 * - Empty adapter results → empty PolicyResult[]
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { _resetRegistryForTesting, getRules } from '../../../../scripts/policy-engine/registry'
import type { PolicyContext } from '../../../../scripts/policy-engine/types'

vi.mock('../../../../scripts/policy-engine/adapters/trivy.adapter', () => ({
  runTrivy: vi.fn(async () => []),
}))

function makeContext(): PolicyContext {
  return {
    mode: 'full',
    timeout: 5000,
    changedFiles: [],
    dependencyGraph: null,
  }
}

describe('SECURITY-001 rule', () => {
  beforeAll(async () => {
    _resetRegistryForTesting()
    await import('../../../../scripts/policy-engine/rules/security/SECURITY-001.rule')
  })

  afterAll(() => {
    _resetRegistryForTesting()
    vi.clearAllMocks()
  })

  it('registers the SECURITY-001 rule', () => {
    const rules = getRules()
    expect(rules.some((r) => r.id === 'SECURITY-001')).toBe(true)
  })

  it('evaluate() delegates to runTrivy', async () => {
    const { runTrivy } = await import('../../../../scripts/policy-engine/adapters/trivy.adapter')
    const mockAdapter = vi.mocked(runTrivy)

    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SECURITY-001')!
    const context = makeContext()
    await rule.evaluate(context)

    expect(mockAdapter).toHaveBeenCalledWith(context)
  })

  it('returns adapter results unchanged', async () => {
    const { runTrivy } = await import('../../../../scripts/policy-engine/adapters/trivy.adapter')
    const mockResult = {
      ruleId: 'SECURITY-001',
      domain: 'SECURITY' as const,
      severity: 'error' as const,
      message: 'CVE-2024-12345: lodash@4.17.15 - Prototype Pollution',
      suggestion: 'Fix: upgrade to 4.17.21',
    }
    vi.mocked(runTrivy).mockResolvedValueOnce([mockResult])

    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SECURITY-001')!
    const results = await rule.evaluate(makeContext())

    expect(results).toEqual([mockResult])
  })

  it('empty adapter results → empty PolicyResult[]', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SECURITY-001')!
    const results = await rule.evaluate(makeContext())
    expect(results).toEqual([])
  })

  it('rule has sequential: false (parallelizable)', () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'SECURITY-001')!
    expect(rule.sequential).toBeFalsy()
  })
})

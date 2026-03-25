/**
 * Unit Tests: rules/ARCH-001.rule.ts
 *
 * Covers:
 * - evaluate() delegates to adapter mock
 * - passes context.mode to adapter
 * - returns adapter results unchanged
 * - empty adapter results → empty PolicyResult[]
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { _resetRegistryForTesting, getRules } from '../../../../scripts/policy-engine/registry'
import type { PolicyContext } from '../../../../scripts/policy-engine/types'

// Mock the adapter before importing the rule
vi.mock('../../../../scripts/policy-engine/adapters/architecture-guard.adapter', () => ({
  runArchitectureGuard: vi.fn(async () => []),
}))

function makeContext(mode: 'changed' | 'full' = 'full'): PolicyContext {
  return {
    mode,
    timeout: 5000,
    changedFiles: [],
    dependencyGraph: null,
  }
}

describe('ARCH-001 rule', () => {
  beforeAll(async () => {
    _resetRegistryForTesting()
    // Import to trigger registerRule() side-effect (runs once per test file)
    await import('../../../../scripts/policy-engine/rules/architecture/ARCH-001.rule')
  })

  afterAll(() => {
    _resetRegistryForTesting()
    vi.clearAllMocks()
  })

  it('registers the ARCH-001 rule', () => {
    const rules = getRules()
    expect(rules.some((r) => r.id === 'ARCH-001')).toBe(true)
  })

  it('evaluate() delegates to runArchitectureGuard', async () => {
    const { runArchitectureGuard } = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    const mockAdapter = vi.mocked(runArchitectureGuard)

    const rules = getRules()
    const rule = rules.find((r) => r.id === 'ARCH-001')!
    const context = makeContext()
    await rule.evaluate(context)

    expect(mockAdapter).toHaveBeenCalledWith(context)
  })

  it('returns adapter results unchanged', async () => {
    const { runArchitectureGuard } = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    const mockAdapter = vi.mocked(runArchitectureGuard)

    const expectedResult = {
      ruleId: 'ARCH-001',
      domain: 'ARCH' as const,
      severity: 'error' as const,
      message: 'Boundary violation',
    }
    mockAdapter.mockResolvedValueOnce([expectedResult])

    const rules = getRules()
    const rule = rules.find((r) => r.id === 'ARCH-001')!
    const results = await rule.evaluate(makeContext())

    expect(results).toEqual([expectedResult])
  })

  it('returns empty array when adapter returns empty array', async () => {
    const { runArchitectureGuard } = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    vi.mocked(runArchitectureGuard).mockResolvedValueOnce([])

    const rules = getRules()
    const rule = rules.find((r) => r.id === 'ARCH-001')!
    const results = await rule.evaluate(makeContext())

    expect(results).toEqual([])
  })

  it('rule has sequential: false (parallelizable)', () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'ARCH-001')!
    expect(rule.sequential).toBeFalsy()
  })
})

/**
 * Unit Tests: adapters/type-safety.adapter.ts
 *
 * Covers:
 * - runTypeSafety returns PolicyResult[]
 * - Adapter never throws
 * - All returned items conform to PolicyResult shape
 * - ruleId is "TYPES-001" on all results
 */

import { describe, expect, it } from 'vitest'
import type { PolicyContext } from '../../../../scripts/policy-engine/types'

function makeContext(): PolicyContext {
  return {
    mode: 'full',
    timeout: 5000,
    changedFiles: [],
    dependencyGraph: null,
  }
}

describe('type-safety.adapter', () => {
  it('exports runTypeSafety function', async () => {
    const mod = await import('../../../../scripts/policy-engine/adapters/type-safety.adapter')
    expect(typeof mod.runTypeSafety).toBe('function')
  })

  it('returns an array (never throws)', async () => {
    const { runTypeSafety } = await import(
      '../../../../scripts/policy-engine/adapters/type-safety.adapter'
    )
    const result = await runTypeSafety(makeContext())
    expect(Array.isArray(result)).toBe(true)
  })

  it('all returned items conform to PolicyResult shape', async () => {
    const { runTypeSafety } = await import(
      '../../../../scripts/policy-engine/adapters/type-safety.adapter'
    )
    const results = await runTypeSafety(makeContext())
    for (const r of results) {
      expect(r).toHaveProperty('ruleId')
      expect(r).toHaveProperty('domain')
      expect(r).toHaveProperty('severity')
      expect(r).toHaveProperty('message')
    }
  })

  it('ruleId on TYPES results is TYPES-001', async () => {
    const { runTypeSafety } = await import(
      '../../../../scripts/policy-engine/adapters/type-safety.adapter'
    )
    const results = await runTypeSafety(makeContext())
    for (const r of results) {
      if (r.ruleId !== 'ENGINE-001') {
        expect(r.ruleId).toBe('TYPES-001')
      }
    }
  })
})

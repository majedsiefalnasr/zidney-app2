/**
 * Unit Tests: adapters/script-governance.adapter.ts
 *
 * Covers:
 * - runScriptGovernance returns PolicyResult[]
 * - Adapter never throws
 * - All returned items conform to PolicyResult shape
 * - ruleIds are from SCRIPTS-001..004 or ENGINE domain
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

describe('script-governance.adapter', () => {
  it('exports runScriptGovernance function', async () => {
    const mod = await import('../../../../scripts/policy-engine/adapters/script-governance.adapter')
    expect(typeof mod.runScriptGovernance).toBe('function')
  })

  it('returns an array (never throws)', async () => {
    const { runScriptGovernance } = await import(
      '../../../../scripts/policy-engine/adapters/script-governance.adapter'
    )
    const result = await runScriptGovernance(makeContext())
    expect(Array.isArray(result)).toBe(true)
  })

  it('all returned items conform to PolicyResult shape', async () => {
    const { runScriptGovernance } = await import(
      '../../../../scripts/policy-engine/adapters/script-governance.adapter'
    )
    const results = await runScriptGovernance(makeContext())
    for (const r of results) {
      expect(r).toHaveProperty('ruleId')
      expect(r).toHaveProperty('domain')
      expect(r).toHaveProperty('severity')
      expect(r).toHaveProperty('message')
    }
  })

  it('ruleIds are SCRIPTS-001..004 or ENGINE', async () => {
    const { runScriptGovernance } = await import(
      '../../../../scripts/policy-engine/adapters/script-governance.adapter'
    )
    const validRuleIds = new Set([
      'SCRIPTS-001',
      'SCRIPTS-002',
      'SCRIPTS-003',
      'SCRIPTS-004',
      'ENGINE-001',
    ])
    const results = await runScriptGovernance(makeContext())
    for (const r of results) {
      expect(validRuleIds.has(r.ruleId)).toBe(true)
    }
  })
})

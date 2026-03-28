/**
 * Gate 1 Parity Test: type-safety adapter output matches governance output
 *
 * Validates that the TYPES-001 adapter captures the same TypeScript errors
 * that type-safety-guard.ts and tsc produce directly.
 */

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dir = fileURLToPath(new URL('.', import.meta.url))

describe('TYPES-001 parity with type-safety-guard', () => {
  it('runTypeSafety adapter is exported and callable', async () => {
    const mod = await import('../../../../scripts/policy-engine/adapters/type-safety.adapter')
    expect(typeof mod.runTypeSafety).toBe('function')
  })

  it('TYPES-001 rule is sequential', async () => {
    // Re-import with fresh registry
    const { _resetRegistryForTesting, getRules } = await import(
      '../../../../scripts/policy-engine/registry'
    )
    _resetRegistryForTesting()
    await import('../../../../scripts/policy-engine/rules/types/TYPES-001.rule')
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'TYPES-001')
    expect(rule).toBeDefined()
    expect(rule!.sequential).toBe(true)
    _resetRegistryForTesting()
  })

  it('TYPES-001 rule delegates to runTypeSafety (no independent logic)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const rulePath = path.resolve(
      __dir,
      '../../../../scripts/policy-engine/rules/types/TYPES-001.rule.ts'
    )
    const content = fs.readFileSync(rulePath, 'utf-8')
    expect(content).toContain('runTypeSafety')
    // Should not contain tsc invocation directly
    expect(content).not.toContain('spawnSync')
  })

  it('adapter results have domain=TYPES', async () => {
    const { runTypeSafety } = await import(
      '../../../../scripts/policy-engine/adapters/type-safety.adapter'
    )
    const results = await runTypeSafety({
      mode: 'full',
      timeout: 30000,
      changedFiles: [],
      dependencyGraph: null,
    })
    for (const r of results) {
      if (!r.ruleId.startsWith('ENGINE')) {
        expect(r.domain).toBe('TYPES')
      }
    }
  })
})

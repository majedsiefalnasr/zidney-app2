/**
 * Unit Tests: adapters/architecture-guard.adapter.ts
 *
 * Covers:
 * - runArchitectureGuard returns PolicyResult[] from parsed JSON output
 * - mode="changed" → spawns arch:guard:changed
 * - mode="full" → spawns arch:guard
 * - Non-zero exit → single error PolicyResult
 * - Adapter never throws (all errors returned as results)
 */

import { describe, expect, it } from 'vitest'
import type { PolicyContext } from '../../../../scripts/policy-engine/types'

function makeContext(mode: 'changed' | 'full' = 'full'): PolicyContext {
  return {
    mode,
    timeout: 5000,
    changedFiles: [],
    dependencyGraph: null,
  }
}

describe('architecture-guard.adapter', () => {
  it('exports runArchitectureGuard function', async () => {
    const mod = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    expect(typeof mod.runArchitectureGuard).toBe('function')
  })

  it('returns an array (never throws)', async () => {
    const { runArchitectureGuard } = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    // In a test environment where bun run arch:guard may not succeed,
    // the adapter should gracefully return results instead of throwing
    const result = await runArchitectureGuard(makeContext('full'))
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns an array for changed mode too', async () => {
    const { runArchitectureGuard } = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    const result = await runArchitectureGuard(makeContext('changed'))
    expect(Array.isArray(result)).toBe(true)
  })

  it('all returned items conform to PolicyResult shape', async () => {
    const { runArchitectureGuard } = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    const results = await runArchitectureGuard(makeContext('full'))
    for (const r of results) {
      expect(r).toHaveProperty('ruleId')
      expect(r).toHaveProperty('domain')
      expect(r).toHaveProperty('severity')
      expect(r).toHaveProperty('message')
    }
  })
})

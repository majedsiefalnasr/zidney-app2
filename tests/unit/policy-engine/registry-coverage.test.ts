/**
 * Gate 3 Registry Coverage Test
 *
 * Validates that all expected rule files register exactly one rule each,
 * and the registry contains all 8 expected rules with no duplicates.
 *
 * NOTE: ES modules are cached per Vitest worker after first import.
 * Side-effect registrations (registerRule) only execute once.
 * All tests in this describe share the registry state loaded in beforeAll.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  _resetRegistryForTesting,
  getRegistryStats,
  getRules,
} from '../../../scripts/policy-engine/registry'
import type { PolicyDomain } from '../../../scripts/policy-engine/types'

const EXPECTED_RULES = [
  'ARCH-001',
  'SCRIPTS-001',
  'SCRIPTS-002',
  'SCRIPTS-003',
  'SCRIPTS-004',
  'TYPES-001',
  'AI-001',
  'SECURITY-001',
] as const

const EXPECTED_DOMAIN_COUNTS: Record<string, number> = {
  ARCH: 1,
  SCRIPTS: 4,
  TYPES: 1,
  AI: 1,
  SECURITY: 1,
}

describe('Registry Coverage Gate', () => {
  beforeAll(async () => {
    // Reset first so any prior state is cleared, then import all 8 rule files.
    // Each file executes registerRule() exactly once (module is fresh per worker).
    _resetRegistryForTesting()
    await Promise.all([
      import('../../../scripts/policy-engine/rules/architecture/ARCH-001.rule'),
      import('../../../scripts/policy-engine/rules/scripts/SCRIPTS-001.rule'),
      import('../../../scripts/policy-engine/rules/scripts/SCRIPTS-002.rule'),
      import('../../../scripts/policy-engine/rules/scripts/SCRIPTS-003.rule'),
      import('../../../scripts/policy-engine/rules/scripts/SCRIPTS-004.rule'),
      import('../../../scripts/policy-engine/rules/types/TYPES-001.rule'),
      import('../../../scripts/policy-engine/rules/ai/AI-001.rule'),
      import('../../../scripts/policy-engine/rules/security/SECURITY-001.rule'),
    ])
  })

  afterAll(() => {
    _resetRegistryForTesting()
  })

  it('all 8 rule files can be imported without error', () => {
    // If we reached here, beforeAll imports succeeded without throwing.
    // Verify at least one rule is registered as a proxy for successful import.
    expect(getRules().length).toBe(8)
  })

  it('exactly 8 rules registered after loading all rule files', () => {
    const stats = getRegistryStats()
    expect(stats.totalRules).toBe(8)
  })

  it('all expected rule IDs are present in registry', () => {
    const registeredIds = getRules().map((r) => r.id)
    for (const expectedId of EXPECTED_RULES) {
      expect(registeredIds, `Missing rule: ${expectedId}`).toContain(expectedId)
    }
  })

  it('domain counts match expected distribution', () => {
    const stats = getRegistryStats()
    for (const [domain, count] of Object.entries(EXPECTED_DOMAIN_COUNTS)) {
      expect(stats.domainCounts[domain as PolicyDomain], `Wrong count for domain ${domain}`).toBe(
        count
      )
    }
  })

  it('no duplicate rule IDs (idempotent import)', async () => {
    // Importing the same module again returns the cached version — no re-execution.
    // The registry should still contain exactly one entry per rule.
    await import('../../../scripts/policy-engine/rules/architecture/ARCH-001.rule')
    await import('../../../scripts/policy-engine/rules/architecture/ARCH-001.rule')

    const rules = getRules()
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length)
  })
})

/**
 * Unit Tests: registry.ts
 *
 * Covers:
 * - registerRule() uniqueness enforcement
 * - getRules() returns frozen copy
 * - getRegistryStats() domain counts are correct
 * - duplicate ID registration throws synchronously
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetRegistryForTesting,
  getRegistryStats,
  getRules,
  registerRule,
} from '../../../scripts/policy-engine/registry'

describe('registry', () => {
  afterEach(() => {
    _resetRegistryForTesting()
  })

  it('registers a rule and returns it via getRules()', () => {
    registerRule({
      id: 'ARCH-001',
      domain: 'ARCH',
      description: 'Test rule',
      severity: 'error',
      evaluate: async () => [],
    })

    const rules = getRules()
    expect(rules).toHaveLength(1)
    expect(rules[0]!.id).toBe('ARCH-001')
  })

  it('returns a frozen copy from getRules()', () => {
    registerRule({
      id: 'ARCH-001',
      domain: 'ARCH',
      description: 'Test rule',
      severity: 'error',
      evaluate: async () => [],
    })

    const rules = getRules()
    expect(Object.isFrozen(rules)).toBe(true)
  })

  it('throws synchronously on duplicate rule ID', () => {
    const rule = {
      id: 'ARCH-001',
      domain: 'ARCH' as const,
      description: 'Test rule',
      severity: 'error' as const,
      evaluate: async () => [],
    }

    registerRule(rule)
    expect(() => registerRule(rule)).toThrowError(/duplicate rule ID/i)
  })

  it('getRegistryStats() returns correct domain counts', () => {
    registerRule({
      id: 'ARCH-001',
      domain: 'ARCH',
      description: 'Arch rule',
      severity: 'error',
      evaluate: async () => [],
    })
    registerRule({
      id: 'SCRIPTS-001',
      domain: 'SCRIPTS',
      description: 'Scripts rule',
      severity: 'warning',
      evaluate: async () => [],
    })
    registerRule({
      id: 'SCRIPTS-002',
      domain: 'SCRIPTS',
      description: 'Scripts rule 2',
      severity: 'warning',
      evaluate: async () => [],
    })

    const stats = getRegistryStats()
    expect(stats.totalRules).toBe(3)
    expect(stats.domainCounts.ARCH).toBe(1)
    expect(stats.domainCounts.SCRIPTS).toBe(2)
    expect(stats.domainCounts.TYPES).toBeUndefined()
  })

  it('getRules() returns empty array when no rules registered', () => {
    expect(getRules()).toHaveLength(0)
  })
})

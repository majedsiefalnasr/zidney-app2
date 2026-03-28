/**
 * Unit Tests: engine.ts
 *
 * Covers:
 * - check() runs parallel rules via Promise.all
 * - sequential rules execute after parallel batch
 * - timeout fires ENGINE-001 and exits
 * - safeEvaluate() catches thrown rule → emits error result without halting others
 * - results sorted error→warning→info
 * - loaderWarnings prepended as ENGINE-002/ENGINE-003 results
 */

import { afterEach, describe, expect, it } from 'vitest'
import { PolicyEngine } from '../../../scripts/policy-engine/engine'
import { _resetRegistryForTesting, registerRule } from '../../../scripts/policy-engine/registry'
import type {
  ContextWarning,
  PolicyContext,
  PolicyResult,
  PolicyRule,
} from '../../../scripts/policy-engine/types'

function makeContext(overrides?: Partial<PolicyContext>): PolicyContext {
  return {
    mode: 'full',
    timeout: 5000,
    changedFiles: [],
    dependencyGraph: null,
    ...overrides,
  }
}

function makeRule(overrides: Partial<PolicyRule> & { id: string }): PolicyRule {
  return {
    domain: 'ARCH',
    description: 'Test rule',
    severity: 'error',
    evaluate: async () => [],
    ...overrides,
  }
}

describe('PolicyEngine', () => {
  afterEach(() => {
    _resetRegistryForTesting()
  })

  it('returns empty array with no rules registered', async () => {
    const engine = new PolicyEngine()
    const results = await engine.check(makeContext())
    expect(results).toEqual([])
  })

  it('runs parallel rules and returns results', async () => {
    const result1: PolicyResult = {
      ruleId: 'ARCH-001',
      domain: 'ARCH',
      severity: 'error',
      message: 'Violation 1',
    }
    const result2: PolicyResult = {
      ruleId: 'SCRIPTS-001',
      domain: 'SCRIPTS',
      severity: 'warning',
      message: 'Violation 2',
    }

    registerRule(makeRule({ id: 'ARCH-001', evaluate: async () => [result1] }))
    registerRule(
      makeRule({
        id: 'SCRIPTS-001',
        domain: 'SCRIPTS',
        severity: 'warning',
        evaluate: async () => [result2],
      })
    )

    const engine = new PolicyEngine()
    const results = await engine.check(makeContext())

    // Should contain both results (order: errors first)
    expect(results.some((r) => r.ruleId === 'ARCH-001')).toBe(true)
    expect(results.some((r) => r.ruleId === 'SCRIPTS-001')).toBe(true)
  })

  it('runs sequential rules after parallel batch', async () => {
    const executionOrder: string[] = []

    registerRule(
      makeRule({
        id: 'PARALLEL-001',
        evaluate: async () => {
          executionOrder.push('parallel')
          return []
        },
      })
    )

    registerRule(
      makeRule({
        id: 'SEQUENTIAL-001',
        sequential: true,
        evaluate: async () => {
          executionOrder.push('sequential')
          return []
        },
      })
    )

    const engine = new PolicyEngine()
    await engine.check(makeContext())

    expect(executionOrder[0]!).toBe('parallel')
    expect(executionOrder[1]!).toBe('sequential')
  })

  it('safeEvaluate() catches thrown rule exception and returns error result', async () => {
    registerRule(
      makeRule({
        id: 'THROWING-001',
        evaluate: async () => {
          throw new Error('Rule crashed')
        },
      })
    )

    const engine = new PolicyEngine()
    const results = await engine.check(makeContext())

    expect(results).toHaveLength(1)
    expect(results[0]!.severity).toBe('error')
    expect(results[0]!.message).toContain('Rule crashed')
  })

  it('safeEvaluate() does not halt other rules when one throws', async () => {
    registerRule(
      makeRule({
        id: 'THROWING-001',
        evaluate: async () => {
          throw new Error('Rule crashed')
        },
      })
    )

    const goodResult: PolicyResult = {
      ruleId: 'GOOD-001',
      domain: 'ARCH',
      severity: 'warning',
      message: 'Good rule still ran',
    }

    registerRule(
      makeRule({
        id: 'GOOD-001',
        domain: 'ARCH',
        severity: 'warning',
        evaluate: async () => [goodResult],
      })
    )

    const engine = new PolicyEngine()
    const results = await engine.check(makeContext())

    expect(results.some((r) => r.ruleId === 'THROWING-001')).toBe(true)
    expect(results.some((r) => r.ruleId === 'GOOD-001')).toBe(true)
  })

  it('sorts results: error → warning → info', async () => {
    registerRule(
      makeRule({
        id: 'INFO-001',
        severity: 'info',
        evaluate: async () => [
          { ruleId: 'INFO-001', domain: 'ARCH', severity: 'info', message: 'Info' },
        ],
      })
    )
    registerRule(
      makeRule({
        id: 'WARN-001',
        severity: 'warning',
        evaluate: async () => [
          {
            ruleId: 'WARN-001',
            domain: 'ARCH',
            severity: 'warning',
            message: 'Warning',
          },
        ],
      })
    )
    registerRule(
      makeRule({
        id: 'ERR-001',
        severity: 'error',
        evaluate: async () => [
          { ruleId: 'ERR-001', domain: 'ARCH', severity: 'error', message: 'Error' },
        ],
      })
    )

    const engine = new PolicyEngine()
    const results = await engine.check(makeContext())

    expect(results[0]!.severity).toBe('error')
    expect(results[1]!.severity).toBe('warning')
    expect(results[2]!.severity).toBe('info')
  })

  it('prepends loaderWarnings as ENGINE-002/ENGINE-003 results before rule results', async () => {
    const ruleResult: PolicyResult = {
      ruleId: 'ARCH-001',
      domain: 'ARCH',
      severity: 'error',
      message: 'Violation',
    }
    registerRule(makeRule({ id: 'ARCH-001', evaluate: async () => [ruleResult] }))

    const warnings: ContextWarning[] = [{ code: 'GIT_UNAVAILABLE', message: 'git unavailable' }]

    const engine = new PolicyEngine()
    const results = await engine.check(makeContext(), warnings)

    expect(results[0]!.ruleId).toBe('ENGINE-002')
    expect(results[0]!.domain).toBe('ENGINE')
    expect(results[0]!.severity).toBe('warning')
    // Rule results come after warning results
    expect(results.some((r) => r.ruleId === 'ARCH-001')).toBe(true)
  })

  it('maps GITNEXUS_STALE to ENGINE-003', async () => {
    const warnings: ContextWarning[] = [{ code: 'GITNEXUS_STALE', message: 'GitNexus stale' }]

    const engine = new PolicyEngine()
    const results = await engine.check(makeContext(), warnings)

    expect(results[0]!.ruleId).toBe('ENGINE-003')
  })

  it('emits ENGINE-001 on timeout', async () => {
    registerRule(
      makeRule({
        id: 'SLOW-001',
        evaluate: () => new Promise((resolve) => setTimeout(() => resolve([]), 9999)),
      })
    )

    const engine = new PolicyEngine()
    // Use very short timeout to force ENGINE-001
    const results = await engine.check(makeContext({ timeout: 10, mode: 'changed' }))

    expect(results.some((r) => r.ruleId === 'ENGINE-001')).toBe(true)
    expect(results.find((r) => r.ruleId === 'ENGINE-001')?.severity).toBe('error')
  }, 10000)
})

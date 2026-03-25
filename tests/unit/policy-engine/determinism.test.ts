/**
 * Gate 2 Determinism Test
 *
 * Validates that the policy engine produces the same results
 * on repeated runs with the same context (no randomness, no timestamp drift).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PolicyEngine } from '../../../scripts/policy-engine/engine'
import { _resetRegistryForTesting, registerRule } from '../../../scripts/policy-engine/registry'
import type { PolicyContext } from '../../../scripts/policy-engine/types'

function makeContext(): PolicyContext {
  return {
    mode: 'full',
    timeout: 5000,
    changedFiles: ['apps/mmc/src/index'],
    dependencyGraph: null,
    scripts: {
      'build:api': 'bun build apps/api',
      'test:unit': 'vitest run',
    },
    existingScriptPaths: ['scripts/build.ts'],
    documentedScriptNames: ['build:api'],
  }
}

describe('Policy Engine Determinism', () => {
  beforeEach(() => {
    _resetRegistryForTesting()
    // Register a deterministic test rule
    registerRule({
      id: 'TEST-DET-001',
      domain: 'SCRIPTS',
      description: 'Determinism test rule',
      severity: 'warning',
      evaluate: async (ctx) => {
        if (Object.keys(ctx.scripts ?? {}).length > 0) {
          return [
            {
              ruleId: 'TEST-DET-001',
              domain: 'SCRIPTS',
              severity: 'warning',
              message: 'Determinism check: scripts present',
            },
          ]
        }
        return []
      },
    })
  })

  afterEach(() => {
    _resetRegistryForTesting()
  })

  it('same context produces identical results on two runs', async () => {
    const engine = new PolicyEngine()
    const context = makeContext()

    const run1 = await engine.check(context)
    const run2 = await engine.check(context)

    expect(run1).toEqual(run2)
  })

  it('result order is stable across runs', async () => {
    // Register two rules to verify sort order is stable
    registerRule({
      id: 'TEST-DET-002',
      domain: 'ARCH',
      description: 'Second determinism test rule',
      severity: 'error',
      evaluate: async () => [
        {
          ruleId: 'TEST-DET-002',
          domain: 'ARCH',
          severity: 'error',
          message: 'Error A',
        },
        {
          ruleId: 'TEST-DET-002',
          domain: 'ARCH',
          severity: 'warning',
          message: 'Warning B',
        },
      ],
    })

    const engine = new PolicyEngine()
    const context = makeContext()

    const run1 = await engine.check(context)
    const run2 = await engine.check(context)
    const run3 = await engine.check(context)

    // All runs should produce the same order
    expect(run1.map((r) => r.ruleId + r.message)).toEqual(run2.map((r) => r.ruleId + r.message))
    expect(run2.map((r) => r.ruleId + r.message)).toEqual(run3.map((r) => r.ruleId + r.message))
  })

  it('errors always appear before warnings in sorted output', async () => {
    registerRule({
      id: 'TEST-DET-003',
      domain: 'AI',
      description: 'Mixed severity rule',
      severity: 'error',
      evaluate: async () => [
        {
          ruleId: 'TEST-DET-003',
          domain: 'AI',
          severity: 'warning',
          message: 'warn',
        },
        {
          ruleId: 'TEST-DET-003',
          domain: 'AI',
          severity: 'error',
          message: 'err',
        },
        {
          ruleId: 'TEST-DET-003',
          domain: 'AI',
          severity: 'info',
          message: 'info',
        },
      ],
    })

    const engine = new PolicyEngine()
    const results = await engine.check(makeContext())

    const severities = results.map((r) => r.severity)
    // All errors before warnings before info (in the test-rule results)
    const firstWarning = severities.indexOf('warning')
    const firstError = severities.indexOf('error')
    const firstInfo = severities.indexOf('info')

    if (firstError !== -1 && firstWarning !== -1) {
      expect(firstError).toBeLessThan(firstWarning)
    }
    if (firstWarning !== -1 && firstInfo !== -1) {
      expect(firstWarning).toBeLessThan(firstInfo)
    }
  })
})

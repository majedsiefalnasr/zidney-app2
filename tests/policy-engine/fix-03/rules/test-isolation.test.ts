/**
 * T025 — test-isolation.test.ts
 * Tests for RULE_FIX_03_TEST_ISOLATION.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { testIsolationRule } from '../../../../scripts/policy-engine/rules/fix-03/test-isolation.js'
import type { PolicyContext } from '../../../../scripts/policy-engine/types.js'

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    mode: 'full' as const,
    workspaceRoot: process.cwd(),
    changedFiles: [],
    impactedModules: [],
    correlationId: 'fix03-test-005',
    autoFixedPaths: [],
    ...overrides,
  }
}

describe('RULE_FIX_03_TEST_ISOLATION metadata', () => {
  it('should have correct id', () => {
    expect(testIsolationRule.id).toBe('RULE_FIX_03_TEST_ISOLATION')
  })

  it('should have severity: error', () => {
    expect(testIsolationRule.severity).toBe('error')
  })

  it('should have domain: test', () => {
    expect(testIsolationRule.domain).toBe('test')
  })
})

describe('RULE_FIX_03_TEST_ISOLATION always-runs contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('always runs regardless of changedFiles', async () => {
    // Rule must not gate on changedFiles — stub subprocess to succeed
    vi.doMock('node:child_process', async (importOriginal) => {
      const original = await importOriginal<typeof import('node:child_process')>()
      return {
        ...original,
        spawnSync: vi
          .fn()
          .mockReturnValue({ status: 0, stdout: Buffer.from('OK'), stderr: Buffer.from('') }),
      }
    })

    const ctx = makeContext({ changedFiles: [] })
    const result = await testIsolationRule.run(ctx)
    // Regardless of changedFiles, rule runs
    expect(result.ruleId).toBe('RULE_FIX_03_TEST_ISOLATION')
    expect(typeof result.passed).toBe('boolean')
  })
})

describe('RULE_FIX_03_TEST_ISOLATION result shape', () => {
  it('failure includes violatingPaths listing the failed script', () => {
    const failureShape = {
      ruleId: 'RULE_FIX_03_TEST_ISOLATION',
      passed: false,
      violatingPaths: ['/workspace/scripts/init-test-db.sh'],
      messages: ['init-test-db.sh failed: connection refused'],
    }
    expect(failureShape.violatingPaths).toHaveLength(1)
    expect(failureShape.messages[0]).toContain('init-test-db.sh')
  })
})

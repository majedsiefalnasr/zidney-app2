/**
 * T021 — environment-ready.test.ts
 * Tests for RULE_FIX_03_ENVIRONMENT_READY.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { environmentReadyRule } from '../../../../scripts/policy-engine/rules/fix-03/environment-ready.js'
import type { PolicyContext } from '../../../../scripts/policy-engine/types.js'

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    mode: 'full' as const,
    workspaceRoot: process.cwd(),
    changedFiles: [],
    impactedModules: [],
    correlationId: 'fix03-test-001',
    autoFixedPaths: [],
    ...overrides,
  }
}

describe('RULE_FIX_03_ENVIRONMENT_READY metadata', () => {
  it('should have correct id', () => {
    expect(environmentReadyRule.id).toBe('RULE_FIX_03_ENVIRONMENT_READY')
  })

  it('should have severity: error', () => {
    expect(environmentReadyRule.severity).toBe('error')
  })

  it('should have domain: infra', () => {
    expect(environmentReadyRule.domain).toBe('infra')
  })

  it('should have run function', () => {
    expect(typeof environmentReadyRule.run).toBe('function')
  })
})

describe('RULE_FIX_03_ENVIRONMENT_READY result contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('result includes ruleId, domain, severity, passed, messages, violatingPaths', async () => {
    // We cannot run the actual subprocess in unit tests, so we verify result shape
    // by mocking execFileSync
    const { execFileSync } = await import('node:child_process')
    vi.spyOn(await import('node:child_process'), 'execFileSync').mockReturnValue(
      JSON.stringify({ success: true, data: {}, error: null })
    )

    const ctx = makeContext()
    const result = await environmentReadyRule.run(ctx)

    expect(result.ruleId).toBe('RULE_FIX_03_ENVIRONMENT_READY')
    expect(result.domain).toBe('infra')
    expect(result.severity).toBe('error')
    expect(typeof result.passed).toBe('boolean')
    expect(Array.isArray(result.messages)).toBe(true)
    expect(Array.isArray(result.violatingPaths)).toBe(true)
  })
})

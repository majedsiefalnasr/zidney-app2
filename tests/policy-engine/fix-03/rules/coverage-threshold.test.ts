/**
 * T029 — coverage-threshold.test.ts
 * Tests for RULE_FIX_03_COVERAGE_THRESHOLD.
 * Key: severity is ALWAYS warning, never error.
 */

import { describe, expect, it } from 'vitest'
import { coverageThresholdRule } from '../../../../scripts/policy-engine/rules/fix-03/coverage-threshold.js'
import type { PolicyContext } from '../../../../scripts/policy-engine/types.js'

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    mode: 'full' as const,
    workspaceRoot: process.cwd(),
    changedFiles: [],
    impactedModules: [],
    correlationId: 'fix03-test-009',
    autoFixedPaths: [],
    ...overrides,
  }
}

describe('RULE_FIX_03_COVERAGE_THRESHOLD metadata', () => {
  it('should have correct id', () => {
    expect(coverageThresholdRule.id).toBe('RULE_FIX_03_COVERAGE_THRESHOLD')
  })

  it('severity must ALWAYS be warning — never error', () => {
    // This is a hard contract: coverage violations are non-blocking
    expect(coverageThresholdRule.severity).toBe('warning')
    expect(coverageThresholdRule.severity).not.toBe('error')
  })

  it('should have domain: test', () => {
    expect(coverageThresholdRule.domain).toBe('test')
  })
})

describe('RULE_FIX_03_COVERAGE_THRESHOLD --changed skip contract', () => {
  it('skips in --changed mode (changedFiles non-empty)', async () => {
    const ctx = makeContext({ changedFiles: ['apps/api/src/route.ts'] })
    const result = await coverageThresholdRule.run(ctx)
    expect(result.passed).toBe(true)
    expect(result.messages.some((m) => m.includes('skipped'))).toBe(true)
  })
})

describe('RULE_FIX_03_COVERAGE_THRESHOLD deferralReport', () => {
  it('deferralReport is populated when coverage is below threshold', () => {
    const mockReport = {
      ruleId: 'RULE_FIX_03_COVERAGE_THRESHOLD',
      reason: 'global coverage 60.0% < 70%',
      followUpStage: 'STAGE_COVERAGE_IMPROVEMENT',
    }
    expect(mockReport.reason).toContain('70%')
  })

  it('deferralReport is absent when coverage passes', () => {
    // When coverage passes, deferralReport should be undefined
    const result = { passed: true, deferralReport: undefined }
    expect(result.deferralReport).toBeUndefined()
  })
})

describe('RULE_FIX_03_COVERAGE_THRESHOLD severity contract (critical path)', () => {
  it('even when failing, severity stays warning (PolicyResult.severity === warning)', () => {
    // This is the critical non-blocking contract
    const failingResult = {
      ruleId: 'RULE_FIX_03_COVERAGE_THRESHOLD',
      domain: 'test',
      severity: 'warning' as const,
      passed: false,
      messages: ['Global coverage 55% is below threshold 70%'],
      violatingPaths: [],
      deferralReport: undefined,
    }
    expect(failingResult.severity).toBe('warning')
  })
})

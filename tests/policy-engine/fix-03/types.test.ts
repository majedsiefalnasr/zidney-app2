/**
 * T018 — types.test.ts
 * Unit tests for policy-engine type contracts.
 */

import { describe, expect, it } from 'vitest'
import type {
  ArtifactSnapshot,
  DeferralReport,
  PolicyContext,
  PolicyResult,
} from '../../../scripts/policy-engine/types.js'

describe('PolicyResult contract', () => {
  it('should have required fields on a passing result', () => {
    const result: PolicyResult = {
      ruleId: 'RULE_FIX_03_BUILD_PASS',
      domain: 'build',
      severity: 'error',
      passed: true,
      messages: [],
      violatingPaths: [],
      deferralReport: undefined,
    }
    expect(result.passed).toBe(true)
    expect(result.messages).toHaveLength(0)
    expect(result.violatingPaths).toHaveLength(0)
    expect(result.deferralReport).toBeUndefined()
  })

  it('should have required fields on a failing result', () => {
    const result: PolicyResult = {
      ruleId: 'RULE_FIX_03_TEST_PASS',
      domain: 'test',
      severity: 'error',
      passed: false,
      messages: ['test suite failed'],
      violatingPaths: ['packages/domain-core/src/index.ts'],
      deferralReport: undefined,
    }
    expect(result.passed).toBe(false)
    expect(result.messages).toContain('test suite failed')
    expect(result.violatingPaths).toHaveLength(1)
  })

  it('should allow warning severity', () => {
    const result: PolicyResult = {
      ruleId: 'RULE_FIX_03_COVERAGE_THRESHOLD',
      domain: 'test',
      severity: 'warning',
      passed: false,
      messages: ['coverage below threshold'],
      violatingPaths: [],
      deferralReport: undefined,
    }
    expect(result.severity).toBe('warning')
  })
})

describe('PolicyContext contract', () => {
  it('should have required fields', () => {
    const ctx: PolicyContext = {
      mode: 'full',
      workspaceRoot: '/workspace',
      changedFiles: [],
      impactedModules: [],
      correlationId: 'fix03-123-abc',
      autoFixedPaths: [],
    }
    expect(ctx.autoFixedPaths).toBeDefined()
    expect(Array.isArray(ctx.autoFixedPaths)).toBe(true)
  })
})

describe('DeferralReport contract', () => {
  it('should have required fields', () => {
    const report: DeferralReport = {
      ruleId: 'RULE_FIX_03_COVERAGE_THRESHOLD',
      reason: 'global coverage 60% < 70%',
      followUpStage: 'STAGE_COVERAGE_IMPROVEMENT',
    }
    expect(report.ruleId).toBe('RULE_FIX_03_COVERAGE_THRESHOLD')
    expect(report.reason).toContain('coverage')
  })
})

describe('ArtifactSnapshot contract', () => {
  it('should have required fields', () => {
    const snapshot: ArtifactSnapshot = {
      timestamp: new Date().toISOString(),
      baseRef: 'abc1234',
      trackedFiles: ['apps/api/dist/index.js'],
      untrackedFiles: [],
      prohibitedPaths: [],
      hashes: { 'apps/api/dist/index.js': 'deadbeef' },
    }
    expect(snapshot.trackedFiles).toHaveLength(1)
    expect(snapshot.hashes?.['apps/api/dist/index.js']).toBe('deadbeef')
  })
})

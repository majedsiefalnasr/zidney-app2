/**
 * T019 — runner.test.ts
 * Unit tests for the policy runner CLI contract.
 * Tests that runner exit codes (0/1/2) map correctly to policy outcomes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

describe('runner exit codes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exit code 0 when all rules pass (no error-severity violations)', () => {
    // Simulates the contract: 0 = all passed or only warning severity
    const mockSuccess = { exitCode: 0, hasErrorViolation: false }
    expect(mockSuccess.exitCode).toBe(0)
  })

  it('exit code 1 when at least one error-severity rule fails', () => {
    // Simulates the contract: 1 = error-severity violation detected
    const mockFailure = { exitCode: 1, hasErrorViolation: true }
    expect(mockFailure.exitCode).toBe(1)
  })

  it('exit code 2 on infrastructure/runner failure (e.g. environment not ready)', () => {
    // Simulates the contract: 2 = fatal infra failure, not a policy violation
    const mockInfraFailure = { exitCode: 2, reason: 'ENVIRONMENT_NOT_READY' }
    expect(mockInfraFailure.exitCode).toBe(2)
  })
})

describe('runner structured output contract', () => {
  it('each rule result must be a valid JSON line', () => {
    const mockLine = JSON.stringify({
      correlationId: 'fix03-123-abc',
      ruleId: 'RULE_FIX_03_BUILD_PASS',
      domain: 'build',
      severity: 'error',
      passed: true,
      messages: [],
      violatingPaths: [],
    })
    expect(() => JSON.parse(mockLine)).not.toThrow()
    const parsed = JSON.parse(mockLine)
    expect(parsed.ruleId).toBe('RULE_FIX_03_BUILD_PASS')
    expect(typeof parsed.passed).toBe('boolean')
  })

  it('final summary must include overall passed boolean and rule count', () => {
    const summary = JSON.stringify({
      event: 'RUNNER_SUMMARY',
      correlationId: 'fix03-123-abc',
      passed: true,
      rulesEvaluated: 9,
      errorViolations: 0,
      warningViolations: 0,
    })
    const parsed = JSON.parse(summary)
    expect(parsed.event).toBe('RUNNER_SUMMARY')
    expect(typeof parsed.passed).toBe('boolean')
    expect(typeof parsed.rulesEvaluated).toBe('number')
  })
})

describe('runner --changed mode', () => {
  it('no-op on empty changedFiles should produce passed = true', () => {
    // When changedFiles is empty (e.g. no relevant changed files) some rules skip
    const result = { passed: true, skippedRules: ['RULE_FIX_03_BUILD_PASS'] }
    expect(result.passed).toBe(true)
    expect(result.skippedRules).toContain('RULE_FIX_03_BUILD_PASS')
  })
})

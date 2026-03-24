/**
 * T020 — registry.test.ts
 * Validates that the rule registry exports all 9 expected rules
 * in the correct execution order with required metadata.
 */

import { describe, expect, it } from 'vitest'
import { rules } from '../../../scripts/policy-engine/registry.js'

const EXPECTED_RULE_IDS = [
  'RULE_FIX_03_ENVIRONMENT_READY',
  'RULE_FIX_03_AUTO_FIX_ATTEMPT',
  'RULE_FIX_03_BUILD_PASS',
  'RULE_FIX_03_TEST_PASS',
  'RULE_FIX_03_TEST_ISOLATION',
  'RULE_FIX_03_REPO_CLEAN',
  'RULE_FIX_03_NO_ARTIFACT_DRIFT',
  'RULE_FIX_03_ARTIFACT_ALLOWLIST',
  'RULE_FIX_03_COVERAGE_THRESHOLD',
]

describe('rule registry', () => {
  it('should export exactly 9 rules', () => {
    expect(rules).toHaveLength(9)
  })

  it('should contain all expected rule IDs', () => {
    const ids = rules.map((r) => r.id)
    for (const expected of EXPECTED_RULE_IDS) {
      expect(ids).toContain(expected)
    }
  })

  it('should maintain execution order', () => {
    const ids = rules.map((r) => r.id)
    for (let i = 0; i < EXPECTED_RULE_IDS.length; i++) {
      expect(ids[i]).toBe(EXPECTED_RULE_IDS[i])
    }
  })

  it('each rule must have required metadata fields', () => {
    for (const rule of rules) {
      expect(rule.id).toBeTruthy()
      expect(rule.domain).toBeTruthy()
      expect(['error', 'warning']).toContain(rule.severity)
      expect(typeof rule.run).toBe('function')
    }
  })

  it('COVERAGE_THRESHOLD must be severity: warning', () => {
    const rule = rules.find((r) => r.id === 'RULE_FIX_03_COVERAGE_THRESHOLD')
    expect(rule?.severity).toBe('warning')
  })

  it('ENVIRONMENT_READY must be severity: error', () => {
    const rule = rules.find((r) => r.id === 'RULE_FIX_03_ENVIRONMENT_READY')
    expect(rule?.severity).toBe('error')
  })
})

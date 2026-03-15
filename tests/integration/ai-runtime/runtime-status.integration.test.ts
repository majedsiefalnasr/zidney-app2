/**
 * Integration tests: scripts/ai-runtime/runtime-status.ts
 *
 * Runs check functions against the actual repository state.
 * No mocking — uses process.cwd() as repo root.
 * Tests must not modify any files.
 *
 * Stage: STAGE_INFRA_19_AI_AGENT_RUNTIME_ENVIRONMENT
 */

import { describe, expect, it } from 'vitest'
import {
  checkArchitectureIntelligence,
  checkContextLoader,
  checkDeterministicExecution,
  checkMcpRouting,
  checkSkillLoader,
} from '../../../scripts/ai-runtime/runtime-status'

const ROOT = process.cwd()

describe('AI Runtime Integration — Live Repo State', () => {
  describe('checkContextLoader', () => {
    it('returns ok or warning (never error) in healthy repo', () => {
      const result = checkContextLoader(ROOT)
      expect(['ok', 'warning']).toContain(result.status)
      expect(result.label).toBe('Context Loader')
    })
  })

  describe('checkSkillLoader', () => {
    it('returns ok with (7/7) in message', () => {
      const result = checkSkillLoader(ROOT)
      expect(result.status).toBe('ok')
      expect(result.message).toContain('(7/7)')
    })
  })

  describe('checkArchitectureIntelligence', () => {
    it('returns ok or warning (never error) — brain parses and map exists', () => {
      const result = checkArchitectureIntelligence(ROOT)
      expect(['ok', 'warning']).toContain(result.status)
      expect(result.label).toBe('Architecture Intelligence')
    })
  })

  describe('checkMcpRouting', () => {
    it('returns ok — matrix present', () => {
      const result = checkMcpRouting(ROOT)
      expect(result.status).toBe('ok')
      expect(result.message).toBe('MCP activation matrix present')
    })
  })

  describe('checkDeterministicExecution', () => {
    it('returns ok — all 5 governance scripts present', () => {
      const result = checkDeterministicExecution(ROOT)
      expect(result.status).toBe('ok')
      expect(result.message).toBe('Runtime governance scripts present')
    })
  })

  describe('Combined health check', () => {
    it('none of the 5 results has status === error', () => {
      const results = [
        checkContextLoader(ROOT),
        checkSkillLoader(ROOT),
        checkArchitectureIntelligence(ROOT),
        checkMcpRouting(ROOT),
        checkDeterministicExecution(ROOT),
      ]

      const errors = results.filter((r) => r.status === 'error')
      expect(errors).toHaveLength(0)
    })
  })
})

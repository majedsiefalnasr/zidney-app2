/**
 * Unit Tests: rules/AI-001.rule.ts
 *
 * Covers:
 * - null dependencyGraph → no violations (no-op behavior)
 * - Fresh graph (recent analyzedAt) → no violations
 * - Stale graph (old analyzedAt) → warning
 * - GITNEXUS_MAX_AGE_HOURS env var override
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { _resetRegistryForTesting, getRules } from '../../../../scripts/policy-engine/registry'
import type { DependencyGraph, PolicyContext } from '../../../../scripts/policy-engine/types'

function makeFreshGraph(): DependencyGraph {
  return {
    analyzedAt: new Date().toISOString(),
    modules: {},
  }
}

function makeStaleGraph(): DependencyGraph {
  // 48 hours ago
  const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000)
  return {
    analyzedAt: staleDate.toISOString(),
    modules: {},
  }
}

function makeContext(dependencyGraph: DependencyGraph | null = null): PolicyContext {
  return {
    mode: 'full',
    timeout: 5000,
    changedFiles: [],
    dependencyGraph,
  }
}

describe('AI-001 rule', () => {
  beforeAll(async () => {
    _resetRegistryForTesting()
    await import('../../../../scripts/policy-engine/rules/ai/AI-001.rule')
  })

  afterAll(() => {
    _resetRegistryForTesting()
  })

  it('registers the AI-001 rule', () => {
    const rules = getRules()
    expect(rules.some((r) => r.id === 'AI-001')).toBe(true)
  })

  it('null dependencyGraph → no violations', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'AI-001')!
    const results = await rule.evaluate(makeContext(null))
    expect(results).toHaveLength(0)
  })

  it('fresh graph → no violations', async () => {
    const rules = getRules()
    const rule = rules.find((r) => r.id === 'AI-001')!
    const results = await rule.evaluate(makeContext(makeFreshGraph()))
    expect(results).toHaveLength(0)
  })

  it('stale graph (48h old) → warning', async () => {
    const original = process.env.GITNEXUS_MAX_AGE_HOURS
    try {
      delete process.env.GITNEXUS_MAX_AGE_HOURS
      const rules = getRules()
      const rule = rules.find((r) => r.id === 'AI-001')!
      const results = await rule.evaluate(makeContext(makeStaleGraph()))
      expect(results).toHaveLength(1)
      expect(results[0]!.ruleId).toBe('AI-001')
      expect(results[0]!.severity).toBe('warning')
      expect(results[0]!.message).toContain('stale')
    } finally {
      if (original === undefined) {
        delete process.env.GITNEXUS_MAX_AGE_HOURS
      } else {
        process.env.GITNEXUS_MAX_AGE_HOURS = original
      }
    }
  })

  it('GITNEXUS_MAX_AGE_HOURS=48 makes 24h-old graph fresh', async () => {
    const original = process.env.GITNEXUS_MAX_AGE_HOURS
    try {
      process.env.GITNEXUS_MAX_AGE_HOURS = '48'
      // 24h old — below 48h threshold
      const graph: DependencyGraph = {
        analyzedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        modules: {},
      }
      const rules = getRules()
      const rule = rules.find((r) => r.id === 'AI-001')!
      const results = await rule.evaluate(makeContext(graph))
      expect(results).toHaveLength(0)
    } finally {
      if (original === undefined) {
        delete process.env.GITNEXUS_MAX_AGE_HOURS
      } else {
        process.env.GITNEXUS_MAX_AGE_HOURS = original
      }
    }
  })
})

/**
 * AI-001 — AI Context Freshness Rule
 *
 * Detects stale AI context artifacts — GitNexus index age exceeds GITNEXUS_MAX_AGE_HOURS.
 *
 * Pure rule — no I/O in evaluate(). Checks context.dependencyGraph.analyzedAt only.
 * If context.dependencyGraph is null, this rule is a no-op (context loader already
 * emitted a warning).
 *
 * Self-registers on import via side-effect call to registerRule().
 *
 * @module scripts/policy-engine/rules/ai/AI-001.rule
 
 * @library-module
*/

import { registerRule } from '../../registry'
import type { PolicyContext, PolicyResult } from '../../types'

function getMaxAgeHours(): number {
  const envVal = process.env.GITNEXUS_MAX_AGE_HOURS
  if (envVal) {
    const parsed = Number(envVal)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return 24
}

registerRule({
  id: 'AI-001',
  domain: 'AI',
  description:
    'Detects stale AI context artifacts — GitNexus index age exceeds GITNEXUS_MAX_AGE_HOURS',
  severity: 'warning',
  sequential: false,
  evaluate(context: PolicyContext): Promise<PolicyResult[]> {
    // No-op when dependencyGraph is null — loader already emitted ENGINE-003 warning
    if (context.dependencyGraph === null) {
      return Promise.resolve([])
    }

    const { analyzedAt } = context.dependencyGraph
    const maxAgeHours = getMaxAgeHours()
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000
    const analyzedAtMs = new Date(analyzedAt).getTime()
    const ageMs = Date.now() - analyzedAtMs

    if (ageMs > maxAgeMs) {
      const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1)
      return Promise.resolve([
        {
          ruleId: 'AI-001',
          domain: 'AI',
          severity: 'warning',
          message: `GitNexus context is stale (${ageHours}h old, max ${maxAgeHours}h). AI context may not reflect current codebase.`,
          suggestion: `Run: bun run arch:gitnexus:context to refresh the GitNexus index`,
        },
      ])
    }

    return Promise.resolve([])
  },
})

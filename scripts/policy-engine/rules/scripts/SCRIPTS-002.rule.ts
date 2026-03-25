/**
 * SCRIPTS-002 — Duplicate Script Detection Rule
 *
 * Detects duplicate scripts — multiple package.json keys with identical or
 * near-identical command values (FR-029).
 *
 * Pure rule — no I/O in evaluate(). Uses context.scripts only.
 * Self-registers on import via side-effect call to registerRule().
 *
 * @module scripts/policy-engine/rules/scripts/SCRIPTS-002.rule
 */

import { registerRule } from '../../registry'
import type { PolicyContext, PolicyResult } from '../../types'

function normalizeCommand(cmd: string): string {
  return cmd.trim().toLowerCase()
}

registerRule({
  id: 'SCRIPTS-002',
  domain: 'SCRIPTS',
  description:
    'Detects duplicate scripts — multiple package.json keys with identical or near-identical command values',
  severity: 'warning',
  sequential: false,
  evaluate(context: PolicyContext): Promise<PolicyResult[]> {
    const scripts = context.scripts ?? {}
    const results: PolicyResult[] = []

    // Group script keys by normalized command value
    const commandMap = new Map<string, string[]>()

    for (const [name, cmd] of Object.entries(scripts)) {
      const normalized = normalizeCommand(cmd)
      const existing = commandMap.get(normalized) ?? []
      existing.push(name)
      commandMap.set(normalized, existing)
    }

    // Emit warnings for any groups with more than one key
    for (const [normalizedCmd, names] of commandMap.entries()) {
      if (names.length > 1) {
        const nameList = names.map((n) => `"${n}"`).join(', ')
        results.push({
          ruleId: 'SCRIPTS-002',
          domain: 'SCRIPTS',
          severity: 'warning',
          message: `Duplicate script command detected: ${nameList} all resolve to "${normalizedCmd}"`,
          suggestion: `Remove duplicate script entries or consolidate into a single named script`,
        })
      }
    }

    return Promise.resolve(results)
  },
})

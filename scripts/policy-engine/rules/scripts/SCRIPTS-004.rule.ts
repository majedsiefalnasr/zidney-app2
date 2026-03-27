/**
 * SCRIPTS-004 — Script Documentation Rule
 *
 * Detects scripts lacking a corresponding documentation entry in docs/scripts/ (FR-031).
 *
 * Pure rule — no I/O in evaluate(). Uses context.scripts and
 * context.documentedScriptNames (pre-fetched by context loader).
 * Self-registers on import via side-effect call to registerRule().
 *
 * @module scripts/policy-engine/rules/scripts/SCRIPTS-004.rule
 
 * @library-module
*/

import { registerRule } from '../../registry'
import type { PolicyContext, PolicyResult } from '../../types'

registerRule({
  id: 'SCRIPTS-004',
  domain: 'SCRIPTS',
  description: 'Detects scripts lacking a corresponding documentation entry in docs/scripts/',
  severity: 'warning',
  sequential: false,
  evaluate(context: PolicyContext): Promise<PolicyResult[]> {
    const scripts = context.scripts ?? {}
    const documentedNames = new Set(context.documentedScriptNames ?? [])
    const results: PolicyResult[] = []

    if (!context.documentedScriptNames) {
      // Context not pre-fetched — skip to avoid false positives
      return Promise.resolve([])
    }

    for (const [scriptName] of Object.entries(scripts)) {
      if (!documentedNames.has(scriptName)) {
        results.push({
          ruleId: 'SCRIPTS-004',
          domain: 'SCRIPTS',
          severity: 'warning',
          message: `Script "${scriptName}" has no documentation entry in docs/scripts/`,
          suggestion: `Create docs/scripts/${scriptName}.md documenting this script's purpose and usage`,
        })
      }
    }

    return Promise.resolve(results)
  },
})

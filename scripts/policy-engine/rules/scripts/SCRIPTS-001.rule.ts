/**
 * SCRIPTS-001 — Script Naming Convention Rule
 *
 * Detects scripts in package.json that do not follow <domain>:<action>[:scope]
 * naming convention (FR-028).
 *
 * Pure rule — no I/O in evaluate(). Uses context.scripts only.
 * Self-registers on import via side-effect call to registerRule().
 *
 * @module scripts/policy-engine/rules/scripts/SCRIPTS-001.rule
 
 * @library-module
*/

import { registerRule } from '../../registry'
import type { PolicyContext, PolicyResult } from '../../types'

// Valid pattern: <domain>:<action>[:<scope>]
// domain/action/scope: lowercase letters, digits, hyphens; must start with letter
const SCRIPT_NAMING_REGEX = /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/

registerRule({
  id: 'SCRIPTS-001',
  domain: 'SCRIPTS',
  description:
    'Detects scripts in package.json that do not follow <domain>:<action>[:scope] naming convention',
  severity: 'warning',
  sequential: false,
  evaluate(context: PolicyContext): Promise<PolicyResult[]> {
    const scripts = context.scripts ?? {}
    const results: PolicyResult[] = []

    for (const [name] of Object.entries(scripts)) {
      if (!SCRIPT_NAMING_REGEX.test(name)) {
        results.push({
          ruleId: 'SCRIPTS-001',
          domain: 'SCRIPTS',
          severity: 'warning',
          message: `Script "${name}" does not follow <domain>:<action>[:scope] naming convention`,
          suggestion: `Rename to follow pattern: <domain>:<action>[:scope] (e.g., "build:api" or "test:unit:api")`,
        })
      }
    }

    return Promise.resolve(results)
  },
})

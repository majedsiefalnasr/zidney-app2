/**
 * SCRIPTS-003 — Script Path Isolation Rule
 *
 * Detects script command values that reference a file path under scripts/
 * that does not exist in the repository (FR-030).
 *
 * Pure rule — no I/O in evaluate(). Uses context.scripts and
 * context.existingScriptPaths (pre-fetched by context loader).
 * Self-registers on import via side-effect call to registerRule().
 *
 * @module scripts/policy-engine/rules/scripts/SCRIPTS-003.rule
 */

import { registerRule } from '../../registry'
import type { PolicyContext, PolicyResult } from '../../types'

// Matches: bun scripts/... or bun run scripts/...
const SCRIPT_PATH_REGEX = /\bbun(?:\s+run)?\s+(scripts\/[^\s"']+)/g

registerRule({
  id: 'SCRIPTS-003',
  domain: 'SCRIPTS',
  description:
    'Detects script command values referencing a file path under scripts/ that does not exist',
  severity: 'error',
  sequential: false,
  evaluate(context: PolicyContext): Promise<PolicyResult[]> {
    const scripts = context.scripts ?? {}
    const existingPaths = new Set(context.existingScriptPaths ?? [])
    const results: PolicyResult[] = []

    if (!context.existingScriptPaths) {
      // Context not pre-fetched — skip to avoid false positives
      return Promise.resolve([])
    }

    for (const [scriptName, cmd] of Object.entries(scripts)) {
      // Reset regex state for each command
      SCRIPT_PATH_REGEX.lastIndex = 0
      let match: RegExpExecArray | null = SCRIPT_PATH_REGEX.exec(cmd)

      while (match !== null) {
        const scriptPath = match[1]
        if (scriptPath) {
          if (!existingPaths.has(scriptPath)) {
            results.push({
              ruleId: 'SCRIPTS-003',
              domain: 'SCRIPTS',
              severity: 'error',
              message: `Script "${scriptName}" references non-existent path: "${scriptPath}"`,
              file: scriptPath,
              suggestion: `Create the script file at "${scriptPath}" or update the command value`,
            })
          }
        }
        match = SCRIPT_PATH_REGEX.exec(cmd)
      }
    }

    return Promise.resolve(results)
  },
})

/**
 * auto-fix-attempt.ts — Rule RULE_FIX_03_AUTO_FIX_ATTEMPT
 * Runs lint:fix + format, then typecheck.
 * Populates context.autoFixedPaths with any paths changed by auto-fix.
 * Severity: warning (auto-fix itself is non-blocking; typecheck failure escalates).
 * domain: code-quality
 */

import { execSync, spawnSync } from 'node:child_process'
import type { PolicyContext, PolicyResult } from '../../types.js'

export const autoFixAttemptRule = {
  id: 'RULE_FIX_03_AUTO_FIX_ATTEMPT',
  domain: 'code-quality' as const,
  severity: 'warning' as const,
  description:
    'Attempts auto-fix via lint:fix and format; records touched paths in context.autoFixedPaths',

  async run(context: PolicyContext): Promise<PolicyResult> {
    const cwd = context.workspaceRoot
    const messages: string[] = []

    // Capture pre-fix dirty state
    const before = execSync('git status --porcelain', { cwd, encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(3).trim())

    // Run lint:fix
    spawnSync('bun', ['run', 'lint:fix'], { cwd, stdio: 'pipe' })

    // Run format
    spawnSync('bun', ['run', 'format'], { cwd, stdio: 'pipe' })

    // Capture post-fix dirty state
    const after = execSync('git status --porcelain', { cwd, encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(3).trim())

    const newlyFixed = after.filter((p) => !before.includes(p))
    context.autoFixedPaths.push(...newlyFixed)

    if (newlyFixed.length > 0) {
      messages.push(`Auto-fix applied to ${newlyFixed.length} file(s)`)
    }

    // Typecheck — escalate severity if it fails
    const tc = spawnSync('bun', ['run', 'typecheck'], { cwd, stdio: 'pipe' })
    if (tc.status !== 0) {
      const stderr = tc.stderr?.toString() ?? ''
      messages.push(`typecheck failed: ${stderr.slice(0, 300)}`)
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: 'error',
        passed: false,
        messages,
        violatingPaths: [],
        deferralReport: undefined,
      }
    }

    return {
      ruleId: this.id,
      domain: this.domain,
      severity: this.severity,
      passed: true,
      messages,
      violatingPaths: [],
      deferralReport: undefined,
    }
  },
}

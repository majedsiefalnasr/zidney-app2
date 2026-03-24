/**
 * build-pass.ts — Rule RULE_FIX_03_BUILD_PASS
 * Invokes `bun run build` and reports any failing packages.
 * Scoped to changed packages when context.changedFiles is non-empty.
 * domain: build | severity: error
 */

import { spawnSync } from 'node:child_process'
import type { PolicyContext, PolicyResult } from '../../types.js'

export const buildPassRule = {
  id: 'RULE_FIX_03_BUILD_PASS',
  domain: 'build' as const,
  severity: 'error' as const,
  description: 'Runs bun run build and fails if any package build fails',

  async run(context: PolicyContext): Promise<PolicyResult> {
    const cwd = context.workspaceRoot
    const messages: string[] = []

    // When --changed mode, only trigger if changed files touch a buildable package
    if (context.changedFiles.length > 0) {
      const hasBuildableChange = context.changedFiles.some(
        (f) => f.startsWith('apps/') || f.startsWith('packages/') || f.startsWith('scripts/')
      )
      if (!hasBuildableChange) {
        return {
          ruleId: this.id,
          domain: this.domain,
          severity: this.severity,
          passed: true,
          messages: ['No buildable paths changed — skipped'],
          violatingPaths: [],
          deferralReport: undefined,
        }
      }
    }

    const result = spawnSync('bun', ['run', 'build'], { cwd, stdio: 'pipe' })
    if (result.status !== 0) {
      const stderr = (result.stderr?.toString() ?? '').slice(0, 600)
      messages.push(`Build failed. stderr: ${stderr}`)
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: false,
        messages,
        violatingPaths: context.changedFiles.filter(
          (f) => f.startsWith('apps/') || f.startsWith('packages/')
        ),
        deferralReport: undefined,
      }
    }

    return {
      ruleId: this.id,
      domain: this.domain,
      severity: this.severity,
      passed: true,
      messages: [],
      violatingPaths: [],
      deferralReport: undefined,
    }
  },
}

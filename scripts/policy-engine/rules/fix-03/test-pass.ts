/**
 * test-pass.ts — Rule RULE_FIX_03_TEST_PASS
 * Invokes `bun run test:unit` and reports failing test files.
 * Scoped to changed packages when context.changedFiles is non-empty.
 * domain: test | severity: error
 */

import { spawnSync } from 'node:child_process'
import type { PolicyContext, PolicyResult } from '../../types.js'

export const testPassRule = {
  id: 'RULE_FIX_03_TEST_PASS',
  domain: 'test' as const,
  severity: 'error' as const,
  description: 'Runs bun run test:unit and fails if any test suite fails',

  async run(context: PolicyContext): Promise<PolicyResult> {
    const cwd = context.workspaceRoot
    const messages: string[] = []

    // When --changed, only trigger if changed files touch test paths or source files
    if (context.changedFiles.length > 0) {
      const hasTestableChange = context.changedFiles.some(
        (f) =>
          f.startsWith('apps/') ||
          f.startsWith('packages/') ||
          f.startsWith('tests/') ||
          f.startsWith('scripts/')
      )
      if (!hasTestableChange) {
        return {
          ruleId: this.id,
          domain: this.domain,
          severity: this.severity,
          passed: true,
          messages: ['No testable paths changed — skipped'],
          violatingPaths: [],
          deferralReport: undefined,
        }
      }
    }

    const result = spawnSync('bun', ['run', 'test:unit'], { cwd, stdio: 'pipe' })
    if (result.status !== 0) {
      const stderr = (result.stderr?.toString() ?? '').slice(0, 600)
      const stdout = (result.stdout?.toString() ?? '').slice(0, 600)
      messages.push(`test:unit failed. stdout: ${stdout} stderr: ${stderr}`)

      // Extract failing file hints from output
      const failingFiles = [...(stdout + stderr).matchAll(/FAIL\s+([\w./-]+)/g)]
        .map((m) => m[1])
        .filter((f) => f !== undefined) as string[]

      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: false,
        messages,
        violatingPaths: failingFiles,
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

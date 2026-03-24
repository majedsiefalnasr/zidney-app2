/**
 * environment-ready.ts — Rule RULE_FIX_03_ENVIRONMENT_READY
 * Invokes validate-runtime-env.ts via subprocess.
 * Hard-exits the entire runner (exit 2) if the infra probe fails.
 * domain: infra | severity: error
 */

import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import type { PolicyContext, PolicyResult } from '../../types.js'

export const environmentReadyRule = {
  id: 'RULE_FIX_03_ENVIRONMENT_READY',
  domain: 'infra' as const,
  severity: 'error' as const,
  description: 'Validates that Postgres, Redis, Bun and Node meet minimum version requirements',

  async run(context: PolicyContext): Promise<PolicyResult> {
    const scriptPath = join(context.workspaceRoot, 'scripts/validate/validate-runtime-env.ts')
    let raw = ''
    let exitCode = 0

    try {
      raw = execFileSync(process.execPath, [scriptPath], { encoding: 'utf-8' })
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & { status?: number; stdout?: string }
      exitCode = e.status ?? 1
      raw = e.stdout ?? ''
    }

    let parsed: {
      success: boolean
      data: Record<string, unknown> | null
      error: { code: string; message: string } | null
    } | null = null
    try {
      parsed = JSON.parse(raw.trim().split('\n').at(-1) ?? '')
    } catch {
      /* ignore */
    }

    if (exitCode === 2 || parsed === null) {
      // Infrastructure is unavailable — hard-exit to prevent misleading partial results
      process.stderr.write(
        `${JSON.stringify({
          event: 'RUNNER_HARD_EXIT',
          reason: 'ENVIRONMENT_NOT_READY',
          code: exitCode,
        })}\n`
      )
      process.exit(2)
    }

    if (!parsed.success) {
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: false,
        messages: [parsed.error?.message ?? 'Environment readiness probe failed'],
        violatingPaths: [],
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

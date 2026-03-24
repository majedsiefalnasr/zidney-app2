/**
 * artifact-allowlist.ts — Rule RULE_FIX_03_ARTIFACT_ALLOWLIST
 * Invokes repo-detect-artifacts.ts and fails if any prohibited artifact paths
 * are found committed or staged in the repository.
 * Always runs regardless of --changed/--full flag.
 * domain: repo | severity: error
 */

import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import type { PolicyContext, PolicyResult } from '../../types.js'

export const artifactAllowlistRule = {
  id: 'RULE_FIX_03_ARTIFACT_ALLOWLIST',
  domain: 'repo' as const,
  severity: 'error' as const,
  description: 'Ensures no prohibited artifact paths are committed or staged',

  async run(context: PolicyContext): Promise<PolicyResult> {
    const scriptPath = join(context.workspaceRoot, 'scripts/validate/repo-detect-artifacts.ts')
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
      data: { violatingPaths: string[] } | null
      error: { code: string; message: string } | null
    } | null = null
    try {
      parsed = JSON.parse(raw.trim().split('\n').at(-1) ?? '')
    } catch {
      /* ignore */
    }

    if (parsed === null) {
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: false,
        messages: ['repo-detect-artifacts.ts produced unparsable output'],
        violatingPaths: [],
        deferralReport: undefined,
      }
    }

    if (!parsed.success || exitCode !== 0) {
      const violatingPaths = parsed.data?.violatingPaths ?? []
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: false,
        messages: [
          parsed.error?.message ?? `${violatingPaths.length} prohibited artifact(s) detected`,
        ],
        violatingPaths,
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

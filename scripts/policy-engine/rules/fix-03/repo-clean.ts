/**
 * repo-clean.ts — Rule RULE_FIX_03_REPO_CLEAN
 * Asserts that the working tree is clean after all prior rules have run.
 * Excludes paths populated by Rule 2 (RULE_FIX_03_AUTO_FIX_ATTEMPT) from the dirty list
 * so that auto-fixed files do not cause a false positive.
 * Always runs (not scoped by --changed).
 * domain: repo | severity: error
 */

import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import type { PolicyContext, PolicyResult } from '../../types.js'

export const repoCleanRule = {
  id: 'RULE_FIX_03_REPO_CLEAN',
  domain: 'repo' as const,
  severity: 'error' as const,
  description: 'Asserts the working tree is clean, excluding paths auto-fixed by earlier rules',

  async run(context: PolicyContext): Promise<PolicyResult> {
    const scriptPath = join(context.workspaceRoot, 'scripts/validate/repo-assert-clean.ts')
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
      data: { dirtyPaths: string[] } | null
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
        messages: ['repo-assert-clean.ts produced unparsable output'],
        violatingPaths: [],
        deferralReport: undefined,
      }
    }

    const allDirty: string[] = parsed.data?.dirtyPaths ?? []

    // Exclude paths that were cleanly auto-fixed by RULE_FIX_03_AUTO_FIX_ATTEMPT
    const afterExclusion = allDirty.filter((p) => !context.autoFixedPaths.includes(p))

    if (
      afterExclusion.length > 0 ||
      (!parsed.success && exitCode !== 0 && afterExclusion.length > 0)
    ) {
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: false,
        messages: [`${afterExclusion.length} uncommitted dirty path(s) detected`],
        violatingPaths: afterExclusion,
        deferralReport: undefined,
      }
    }

    return {
      ruleId: this.id,
      domain: this.domain,
      severity: this.severity,
      passed: true,
      messages:
        context.autoFixedPaths.length > 0
          ? [`${context.autoFixedPaths.length} auto-fixed path(s) excluded from dirty check`]
          : [],
      violatingPaths: [],
      deferralReport: undefined,
    }
  },
}

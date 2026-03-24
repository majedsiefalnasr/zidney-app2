/**
 * coverage-threshold.ts — Rule RULE_FIX_03_COVERAGE_THRESHOLD
 * Only runs in --full mode. Executes test:unit --coverage and parses the JSON
 * coverage summary. Enforces global >= 70%, critical domain >= 80%.
 * Severity: warning (non-blocking, but surface to the developer).
 * domain: test | severity: warning
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DeferralReport, PolicyContext, PolicyResult } from '../../types.js'

const GLOBAL_THRESHOLD = 70
const CRITICAL_THRESHOLD = 80
const CRITICAL_DOMAINS = ['packages/domain-core', 'packages/validation', 'packages/types']

export const coverageThresholdRule = {
  id: 'RULE_FIX_03_COVERAGE_THRESHOLD',
  domain: 'test' as const,
  severity: 'warning' as const,
  description: `Enforces global coverage >= ${GLOBAL_THRESHOLD}% and critical domain >= ${CRITICAL_THRESHOLD}%`,

  async run(context: PolicyContext): Promise<PolicyResult> {
    const cwd = context.workspaceRoot
    const messages: string[] = []

    // This rule is --full mode only; skip in --changed mode
    if (context.changedFiles.length > 0) {
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: true,
        messages: ['Coverage threshold check skipped in --changed mode'],
        violatingPaths: [],
        deferralReport: undefined,
      }
    }

    // Run test:unit with coverage reporter
    const result = spawnSync('bun', ['run', 'test:unit', '--coverage', '--reporter=json'], {
      cwd,
      stdio: 'pipe',
    })

    if (result.status !== 0) {
      messages.push('test:unit --coverage failed — coverage report unavailable')
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: false,
        messages,
        violatingPaths: [],
        deferralReport: undefined,
      }
    }

    // Attempt to parse JSON coverage summary (v8/istanbul vitest formats)
    const coverageSummaryPath = join(cwd, 'coverage/coverage-summary.json')
    if (!existsSync(coverageSummaryPath)) {
      messages.push('Coverage summary file not found after run — check coverage reporter config')
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: true, // warning-only, not a hard fail
        messages,
        violatingPaths: [],
        deferralReport: undefined,
      }
    }

    let summary: Record<
      string,
      {
        lines: { pct: number }
        branches: { pct: number }
        functions: { pct: number }
        statements: { pct: number }
      }
    > = {}
    try {
      summary = JSON.parse(readFileSync(coverageSummaryPath, 'utf-8'))
    } catch {
      messages.push('Failed to parse coverage-summary.json')
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: true,
        messages,
        violatingPaths: [],
        deferralReport: undefined,
      }
    }

    const totalEntry = summary.total
    const violatingPaths: string[] = []
    const failureReasons: string[] = []

    if (totalEntry) {
      const globalPct = totalEntry.lines?.pct ?? 0
      if (globalPct < GLOBAL_THRESHOLD) {
        messages.push(
          `Global coverage ${globalPct.toFixed(1)}% is below threshold ${GLOBAL_THRESHOLD}%`
        )
        failureReasons.push(`global coverage ${globalPct.toFixed(1)}% < ${GLOBAL_THRESHOLD}%`)
      }
    }

    for (const domain of CRITICAL_DOMAINS) {
      for (const [file, entry] of Object.entries(summary)) {
        if (file.startsWith(domain)) {
          const pct = entry.lines?.pct ?? 0
          if (pct < CRITICAL_THRESHOLD) {
            messages.push(
              `${file}: ${pct.toFixed(1)}% coverage below critical threshold ${CRITICAL_THRESHOLD}%`
            )
            violatingPaths.push(file)
            failureReasons.push(`${file} coverage ${pct.toFixed(1)}% < ${CRITICAL_THRESHOLD}%`)
          }
        }
      }
    }

    const deferralReport: DeferralReport | undefined =
      failureReasons.length > 0
        ? {
            ruleId: this.id,
            reason: failureReasons.join(' | '),
            followUpStage: 'STAGE_COVERAGE_IMPROVEMENT',
          }
        : undefined

    const passed = messages.length === 0
    return {
      ruleId: this.id,
      domain: this.domain,
      severity: this.severity, // always 'warning'
      passed,
      messages,
      violatingPaths,
      deferralReport,
    }
  },
}

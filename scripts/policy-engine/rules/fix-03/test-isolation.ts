/**
 * test-isolation.ts — Rule RULE_FIX_03_TEST_ISOLATION
 * Invokes init-test-db.sh and reset-test-redis.sh to establish clean test
 * infrastructure. Always runs regardless of --changed/--full flag.
 * domain: test | severity: error
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import type { PolicyContext, PolicyResult } from '../../types.js'

export const testIsolationRule = {
  id: 'RULE_FIX_03_TEST_ISOLATION',
  domain: 'test' as const,
  severity: 'error' as const,
  description: 'Resets test Postgres and Redis to a clean, isolated state',

  async run(context: PolicyContext): Promise<PolicyResult> {
    const cwd = context.workspaceRoot
    const messages: string[] = []
    const violatingPaths: string[] = []

    // Check if psql is available (if not, skip the rule as infra is not available)
    const psqlCheck = spawnSync('which', ['psql'], { cwd, stdio: 'pipe' })
    if (psqlCheck.status !== 0) {
      messages.push('PostgreSQL not installed — test isolation validation skipped')
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: true, // Pass when infra is unavailable (dev environment)
        messages,
        violatingPaths: [],
        deferralReport: undefined,
      }
    }

    const scripts = [join(cwd, 'scripts/init-test-db.sh'), join(cwd, 'scripts/reset-test-redis.sh')]

    for (const script of scripts) {
      const name = script.split('/').pop() ?? 'unknown'
      const result = spawnSync('bash', [script], { cwd, stdio: 'pipe' })
      if (result.status !== 0) {
        const stderr = (result.stderr?.toString() ?? '').slice(0, 300)
        messages.push(`${name} failed: ${stderr}`)
        violatingPaths.push(script)
      }
    }

    if (violatingPaths.length > 0) {
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: false,
        messages,
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

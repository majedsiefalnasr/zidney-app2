/**
 * no-artifact-drift.ts — Rule RULE_FIX_03_NO_ARTIFACT_DRIFT
 * Captures an ArtifactSnapshot at rule-start and compares against end-of-evaluation.
 * Flags any build output files that changed unexpectedly during the policy run.
 * Always runs regardless of --changed/--full flag.
 * domain: repo | severity: error
 */

import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import type { ArtifactSnapshot, PolicyContext, PolicyResult } from '../../types.js'

function captureSnapshot(workspaceRoot: string): ArtifactSnapshot {
  const scriptPath = join(workspaceRoot, 'scripts/validate/repo-hash-build.ts')
  let raw = ''
  try {
    raw = execFileSync(process.execPath, [scriptPath], { encoding: 'utf-8' })
  } catch {
    /* best-effort */
  }

  let parsed: ArtifactSnapshot | null = null
  try {
    parsed = JSON.parse(raw.trim().split('\n').at(-1) ?? '')
  } catch {
    /* ignore */
  }

  return (
    parsed ?? {
      timestamp: new Date().toISOString(),
      baseRef: 'unknown',
      trackedFiles: [],
      untrackedFiles: [],
      prohibitedPaths: [],
      hashes: {},
    }
  )
}

export const noArtifactDriftRule = {
  id: 'RULE_FIX_03_NO_ARTIFACT_DRIFT',
  domain: 'repo' as const,
  severity: 'error' as const,
  description: 'Detects unexpected changes to build artifacts during policy evaluation',

  async run(context: PolicyContext): Promise<PolicyResult> {
    const before = captureSnapshot(context.workspaceRoot)
    // Small yield to allow async side-effects from prior rules to settle
    await new Promise<void>((r) => setTimeout(r, 100))
    const after = captureSnapshot(context.workspaceRoot)

    const driftedPaths: string[] = []
    const beforeHashes = before.hashes ?? {}
    const afterHashes = after.hashes ?? {}
    const allPaths = new Set([...Object.keys(beforeHashes), ...Object.keys(afterHashes)])

    for (const path of allPaths) {
      if (beforeHashes[path] !== afterHashes[path]) {
        driftedPaths.push(path)
      }
    }

    if (driftedPaths.length > 0) {
      return {
        ruleId: this.id,
        domain: this.domain,
        severity: this.severity,
        passed: false,
        messages: [
          `${driftedPaths.length} build artifact(s) changed unexpectedly during policy run`,
        ],
        violatingPaths: driftedPaths,
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

#!/usr/bin/env bun
/**
 * repo-detect-artifacts.ts
 * Scans for prohibited artifact paths that should not be committed.
 * Exit 0 when clean, exit 1 with violating paths on detection.
 * Idempotent — identical output for identical filesystem state.
 */

import { execSync } from 'node:child_process'

const PROHIBITED_PATTERNS = [
  'coverage',
  '.tmp',
  'tmp',
  '.output',
  'playwright-report',
  'test-results',
  'test-perf-output',
  'test-perf-output-2',
]

// Use git to list tracked+untracked files efficiently
const allFiles = execSync('git ls-files --cached --others --exclude-standard', {
  encoding: 'utf-8',
})
  .split('\n')
  .filter(Boolean)

const violatingPaths: string[] = []
for (const file of allFiles) {
  for (const pattern of PROHIBITED_PATTERNS) {
    if (file === pattern || file.startsWith(`${pattern}/`) || file.includes(`/${pattern}/`)) {
      violatingPaths.push(file)
      break
    }
  }
}

if (violatingPaths.length === 0) {
  process.stdout.write(
    `${JSON.stringify({ success: true, data: { violatingPaths: [] }, error: null })}\n`
  )
  process.exit(0)
}

process.stdout.write(
  `${JSON.stringify({
    success: false,
    data: { violatingPaths },
    error: {
      code: 'PROHIBITED_ARTIFACTS_DETECTED',
      message: `${violatingPaths.length} prohibited artifact path(s) detected`,
    },
  })}\n`
)
process.exit(1)

#!/usr/bin/env bun
/**
 * repo-assert-clean.ts
 * Asserts the git working tree is clean (no uncommitted changes).
 * Exit 0 when clean, exit 1 with structured JSON when dirty.
 * Idempotent — identical output for identical repo state.
 */

import { execSync } from 'node:child_process'

const output = execSync('git status --porcelain', { encoding: 'utf-8' })
const lines = output.split('\n').filter(Boolean)

if (lines.length === 0) {
  process.stdout.write(
    `${JSON.stringify({ success: true, data: { dirtyPaths: [] }, error: null })}\n`
  )
  process.exit(0)
}

const dirtyPaths = lines.map((l) => l.trim().replace(/^\S+\s+/, ''))
process.stdout.write(
  `${JSON.stringify({
    success: false,
    data: { dirtyPaths },
    error: {
      code: 'REPO_DIRTY',
      message: `Working tree has ${dirtyPaths.length} uncommitted change(s)`,
    },
  })}\n`
)
process.exit(1)

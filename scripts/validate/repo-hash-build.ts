#!/usr/bin/env bun
/**
 * repo-hash-build.ts
 * Enumerates all tracked and untracked files under workspace dist/ directories
 * and produces a SHA-256-based snapshot JSON. Read-only — always exits 0.
 * Idempotent — identical output for identical filesystem state.
 */

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

// Enumerate all dist/** paths tracked or on-disk
const raw = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf-8' })
  .split('\n')
  .filter((f) => f.startsWith('dist/') || f.includes('/dist/'))

const trackedFiles: string[] = []
const hashes: Record<string, string> = {}

for (const rel of raw) {
  const abs = join(root, rel)
  if (!existsSync(abs)) continue
  trackedFiles.push(rel)
  const content = readFileSync(abs)
  hashes[rel] = createHash('sha256').update(content).digest('hex')
}

// Also harvest workspace dist dirs (apps/*/dist, packages/*/dist)
const workspaceDist = execSync(
  'find apps packages -maxdepth 3 -type d -name dist 2>/dev/null || true',
  { encoding: 'utf-8' }
)
  .split('\n')
  .filter(Boolean)

for (const distDir of workspaceDist) {
  let listing: string[]
  try {
    listing = execSync(`find "${distDir}" -type f`, { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean)
  } catch {
    continue
  }
  for (const abs of listing) {
    const rel = abs.replace(/^\//, '')
    if (rel in hashes) continue
    if (!existsSync(abs)) continue
    trackedFiles.push(rel)
    const content = readFileSync(abs)
    hashes[rel] = createHash('sha256').update(content).digest('hex')
  }
}

const baseRef = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
})()

const snapshot = {
  timestamp: new Date().toISOString(),
  baseRef,
  trackedFiles,
  hashes,
}

process.stdout.write(`${JSON.stringify(snapshot)}\n`)
process.exit(0)

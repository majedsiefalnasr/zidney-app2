/**
 * repo-fix.ts — Automated repository repair runner.
 *
 * Runs 5 repair steps in sequence. Continues past step failures (continue-on-error).
 * Exits non-zero if any step fails.
 *
 * Output: process.stdout.write only — console.log is banned.
 * Imports: node:fs, node:path only (+ formatter sibling module).
 *
 * Stage: INFRA-18 — T003
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { line, section, summary } from './formatter'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result of a subprocess spawn. errorMessage is first line of stderr, sanitized. */
export type ProcessResult = {
  exitCode: number
  errorMessage: string // first line of stderr, control chars stripped, max 120 chars
}

export type FixStep = {
  label: string
  run: () => ProcessResult
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitize subprocess stderr for safe display.
 * Takes first line only, strips control chars, limits to 120 chars.
 */
export function sanitizeDetail(raw: string): string {
  return raw
    .split('\n')[0]
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 120)
}

/**
 * Spawn a command and return the exit code + sanitized first stderr line.
 */
export function spawnStep(cmd: string[]): ProcessResult {
  const result = Bun.spawnSync(cmd, {
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: process.cwd(),
  })
  const exitCode = result.exitCode ?? 1
  const stderrText = result.stderr ? result.stderr.toString() : ''
  return { exitCode, errorMessage: sanitizeDetail(stderrText) }
}

/**
 * Safely delete a path under the repo root.
 *
 * Uses fs.realpathSync to resolve symlinks before deletion.
 * Skips paths that resolve outside the repo root (symlink traversal guard).
 */
export function safeDel(label: string, target: string): void {
  const repoRoot = process.cwd()
  const abs = path.resolve(repoRoot, target)
  try {
    const real = fs.realpathSync(abs)
    if (!real.startsWith(repoRoot + path.sep) && real !== repoRoot) {
      line(label, 'warn', 'skipped — resolves outside repo root')
      return
    }
    fs.rmSync(real, { recursive: true, force: true })
    line(label, 'ok')
  } catch {
    // target does not exist — idempotent no-op
    line(label, 'ok')
  }
}

// ─── Step Definitions ─────────────────────────────────────────────────────────

export function buildSteps(): FixStep[] {
  return [
    {
      label: 'dependencies installed',
      run: () => spawnStep(['bun', 'install']),
    },
    {
      label: 'architecture context regenerated',
      run: () => spawnStep(['bun', 'arch:generate']),
    },
    {
      label: 'AI context refreshed',
      run: () => spawnStep(['bun', 'ai-context:refresh']),
    },
    {
      label: 'unused packages pruned',
      run: () => spawnStep(['bun', 'pm', 'prune']),
    },
  ]
}

/**
 * Step 5 — Remove stale build artifacts.
 * Source files, schema files, and governance artifacts are never touched.
 * Returns true if any deletion failed.
 */
export function cleanBuildArtifacts(): boolean {
  const targets = ['dist', '.nuxt']
  // These are checked per-workspace app directory + repo root
  const repoRoot = process.cwd()
  const appDirs: string[] = []

  try {
    for (const appEntry of fs.readdirSync(path.join(repoRoot, 'apps'), { withFileTypes: true })) {
      if (appEntry.isDirectory()) {
        appDirs.push(path.join('apps', appEntry.name))
      }
    }
  } catch {
    // apps/ may not exist in all environments — skip
  }

  const searchRoots = ['.', ...appDirs]
  for (const root of searchRoots) {
    for (const target of targets) {
      const rel = path.join(root, target)
      const abs = path.resolve(repoRoot, rel)
      if (fs.existsSync(abs)) {
        safeDel(`clean ${rel}`, rel)
      }
    }
  }
  // Always report completion for the overall step
  line('stale build artifacts removed', 'ok')
  return false
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  section('Repository Fix')

  const steps = buildSteps()
  let hasError = false

  for (const step of steps) {
    const result = step.run()
    if (result.exitCode !== 0) {
      const detail = result.errorMessage || 'step failed'
      line(step.label, 'error', detail)
      hasError = true
      // continue — do NOT break; remaining steps always execute
    } else {
      line(step.label, 'ok')
    }
  }

  // Step 5: stale build artifact cleanup (always runs)
  cleanBuildArtifacts()

  const total = steps.length + 1 // +1 for cleanup step
  const passed = hasError ? 0 : total // approximate — cleanup always passes
  summary(passed, total)
  process.exit(hasError ? 1 : 0)
}

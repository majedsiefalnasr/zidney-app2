/**
 * repo-doctor.ts — Repository health diagnostic runner.
 *
 * Runs 7 sequential checks and reports pass/warn/fail.
 * Exits non-zero if any check reaches error level.
 *
 * Output: process.stdout.write only — console.log is banned.
 * Imports: node:fs, node:path only (+ formatter sibling module).
 *
 * Stage: INFRA-18 — T002
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitize subprocess stderr for safe display.
 * Takes first line only, strips control chars, limits to 120 chars.
 */
export function sanitizeDetail(raw: string): string {
  return (raw.split('\n')[0] ?? '').replace(/[^\x20-\x7E]/g, '').slice(0, 120)
}

/**
 * Spawn a command and return the exit code + sanitized first stderr line.
 * stdout/stderr are captured and suppressed from terminal output.
 */
export function spawnCheck(cmd: string[]): ProcessResult {
  const result = Bun.spawnSync(cmd, {
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: process.cwd(),
  })
  const exitCode = result.exitCode ?? 1
  const stderrText = result.stderr ? result.stderr.toString() : ''
  return { exitCode, errorMessage: sanitizeDetail(stderrText) }
}

// ─── Check Functions ──────────────────────────────────────────────────────────

/**
 * Check 1 — Verify dependencies are installed and lockfile is up to date.
 * Returns true if the check recorded an error.
 */
export function checkDependencies(): boolean {
  const result = spawnCheck(['bun', 'install', '--frozen-lockfile'])
  if (result.exitCode !== 0) {
    line('dependencies', 'error', 'lockfile out of sync or install needed — run: bun install')
    return true
  }
  line('dependencies', 'ok')
  return false
}

/**
 * Check 2 — Verify workspace package links exist in node_modules.
 * Returns true if the check recorded an error.
 */
export function checkWorkspaceLinks(): boolean {
  const repoRoot = process.cwd()
  const workspaceDirs = ['apps', 'packages']
  const broken: string[] = []

  for (const dir of workspaceDirs) {
    const base = path.join(repoRoot, dir)
    if (!fs.existsSync(base)) continue

    const entries = fs.readdirSync(base, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const pkgPath = path.join(base, entry.name, 'package.json')
      if (!fs.existsSync(pkgPath)) continue

      let pkg: { name?: string }
      try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name?: string }
      } catch {
        continue
      }

      if (!pkg.name) continue
      const linkPath = path.join(repoRoot, 'node_modules', pkg.name)
      if (!fs.existsSync(linkPath)) {
        broken.push(pkg.name)
      }
    }
  }

  if (broken.length > 0) {
    line('workspace links', 'error', `missing: ${broken.join(', ')} — run: bun install`)
    return true
  }
  line('workspace links', 'ok')
  return false
}

/**
 * Check 3 — Validate architecture boundaries.
 * Returns true if the check recorded an error.
 */
export function checkArchitectureGuard(): boolean {
  const result = spawnCheck(['bun', 'arch:guard'])
  if (result.exitCode !== 0) {
    const detail = result.errorMessage || 'architecture violations found'
    line('architecture guard', 'error', `${detail} — run: bun arch:fix`)
    return true
  }
  line('architecture guard', 'ok')
  return false
}

/**
 * Check 4 — Validate architecture brain artifact.
 * Returns true if the check recorded an error.
 */
export function checkArchitectureBrain(): boolean {
  const result = spawnCheck(['bun', 'arch:validate-brain'])
  if (result.exitCode !== 0) {
    const detail = result.errorMessage || 'brain validation failed'
    line('architecture brain', 'error', `${detail} — run: bun scripts/infra-audit.ts`)
    return true
  }
  line('architecture brain', 'ok')
  return false
}

/**
 * Check 5 — Validate AI context artifacts (advisory / warn only).
 * Returns false (context staleness is non-blocking).
 */
export function checkAiContext(): boolean {
  const result = spawnCheck(['bun', 'ai-context:validate'])
  if (result.exitCode !== 0) {
    line('AI context', 'warn', 'stale — run: bun ai-context:refresh')
  } else {
    line('AI context', 'ok')
  }
  return false // warn only — never an error
}

/**
 * Check 6 — Verify .env keys match .env.example (existence only, values never read).
 * Returns true if the check recorded an error.
 */
export function checkEnvFile(): boolean {
  const repoRoot = process.cwd()
  const examplePath = path.join(repoRoot, '.env.example')
  const envPath = path.join(repoRoot, '.env')

  // .env.example absent → advisory warn only
  if (!fs.existsSync(examplePath)) {
    line('environment variables', 'warn', '.env.example not found — skipping key check')
    return false
  }

  // .env absent → error
  if (!fs.existsSync(envPath)) {
    line(
      'environment variables',
      'error',
      '.env not found — copy .env.example to .env and fill in values'
    )
    return true
  }

  const parseKeys = (content: string): Set<string> => {
    const keys = new Set<string>()
    for (const raw of content.split('\n')) {
      // Strip comments and blank lines
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      // Strip shell prefixes before key comparison
      const line = trimmed.replace(/^export\s+/, '').replace(/^declare\s+-x\s+/, '')
      const eqIdx = line.indexOf('=')
      if (eqIdx === -1) continue
      const key = line.slice(0, eqIdx).trim()
      if (key) keys.add(key)
    }
    return keys
  }

  const exampleKeys = parseKeys(fs.readFileSync(examplePath, 'utf-8'))
  const envKeys = parseKeys(fs.readFileSync(envPath, 'utf-8'))

  const missing: string[] = []
  for (const key of exampleKeys) {
    if (!envKeys.has(key)) missing.push(key)
  }

  if (missing.length > 0) {
    line(
      'environment variables',
      'error',
      `missing ${missing.length.toString()} key(s): ${missing.join(', ')} — copy .env.example to .env`
    )
    return true
  }

  line('environment variables', 'ok')
  return false
}

/**
 * Check 7 — TypeScript strict configuration check.
 * Returns true if the check recorded an error.
 */
export function checkTypeScript(): boolean {
  const result = spawnCheck(['bun', 'type-safety-guard'])
  if (result.exitCode !== 0) {
    const detail = result.errorMessage || 'type violations found'
    line('TypeScript configuration', 'error', `${detail} — run: bun typecheck`)
    return true
  }
  line('TypeScript configuration', 'ok')
  return false
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  section('Repository Doctor')

  const checks = [
    checkDependencies,
    checkWorkspaceLinks,
    checkArchitectureGuard,
    checkArchitectureBrain,
    checkAiContext,
    checkEnvFile,
    checkTypeScript,
  ]

  let errorCount = 0
  for (const check of checks) {
    if (check()) errorCount++
  }

  summary(checks.length - errorCount, checks.length)
  process.exit(errorCount > 0 ? 1 : 0)
}

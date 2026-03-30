#!/usr/bin/env bun
/**
 * @script repo:doctor
 * @domain repo
 * @category dev
 * @description Run seven repository health checks and report pass, warn, and
 *   fail status for local diagnostics.
 * @usage bun run repo:doctor
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { exit, hasCiFlag, log } from '../utils/logger'
import { line, section, summary } from './formatter'

const isCi = hasCiFlag()
log.setScript('repo:doctor')

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

function isDirectExecution(): boolean {
  const entry = process.argv[1] ?? ''
  return /(?:^|[\\/])repo-doctor\.ts$/.test(entry)
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
      const pkgOnFs = path.join(repoRoot, dir, entry.name)
      // Accept either a node_modules workspace link OR the package existing in the repo
      if (!(fs.existsSync(linkPath) || fs.existsSync(pkgOnFs))) {
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
    line('architecture guard', 'error', `${detail} — run: bun arch:governance:fix`)
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
  const result = spawnCheck(['bun', 'arch:validate:brain'])
  if (result.exitCode !== 0) {
    const detail = result.errorMessage || 'brain validation failed'
    line('architecture brain', 'error', `${detail} — run: bun run arch:audit`)
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

  // .env absent → warn only (do not fail repo-doctor in public repos)
  if (!fs.existsSync(envPath)) {
    line(
      'environment variables',
      'warn',
      '.env not found — copy .env.example to .env and fill in values'
    )
    return false
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
  for (const key of Array.from(exampleKeys)) {
    if (!envKeys.has(key)) missing.push(key)
  }

  if (missing.length > 0) {
    // Treat missing keys as a warning — many public forks omit a local .env intentionally.
    line(
      'environment variables',
      'warn',
      `missing ${missing.length.toString()} key(s): ${missing.join(', ')} — copy .env.example to .env`
    )
    return false
  }

  line('environment variables', 'ok')
  return false
}

/**
 * Check 7 — TypeScript strict configuration check.
 * Returns true if the check recorded an error.
 */
export function checkTypeScript(): boolean {
  const result = spawnCheck(['bun', 'arch:type-safety-guard'])
  if (result.exitCode !== 0) {
    const detail = result.errorMessage || 'type violations found'
    line('TypeScript configuration', 'error', `${detail} — run: bun typecheck`)
    return true
  }
  line('TypeScript configuration', 'ok')
  return false
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (isDirectExecution()) {
  log.header('REPOSITORY DOCTOR', 'Runs 7 sequential health checks and reports pass/warn/fail')
  if (isCi) {
    log.info('[repo:doctor] CI mode enabled')
  }
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
  log.result({ total: checks.length, passed: checks.length - errorCount, failed: errorCount })
  exit(errorCount > 0 ? 1 : 0)
}

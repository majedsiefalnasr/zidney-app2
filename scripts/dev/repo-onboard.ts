#!/usr/bin/env bun
/**
 * @script repo:onboard
 * @domain repo
 * @category dev
 * @description Prepare a complete local development environment in one command,
 *   including dependency install, hooks, and core service checks.
 * @usage bun run repo:onboard
 */

import * as net from 'node:net'
import { exit, hasCiFlag, log } from '../utils/logger'
import { line, section, summary } from './formatter'

const isCi = hasCiFlag()
log.setScript('repo:onboard')

// ─── Types ────────────────────────────────────────────────────────────────────

type ProcessResult = {
  exitCode: number
  errorMessage: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeDetail(raw: string): string {
  return (raw.split('\n')[0] ?? '').replace(/[^\x20-\x7E]/g, '').slice(0, 120)
}

function spawnStep(cmd: string[]): ProcessResult {
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
  return /(?:^|[\\/])repo-onboard\.ts$/.test(entry)
}

/**
 * Check if a TCP port is reachable.
 * Resolves true if connection succeeds within 3 seconds, false on error/timeout.
 */
export async function checkTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 3000)
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => {
      clearTimeout(timer)
      socket.destroy()
      resolve(false)
    })
  })
}

/**
 * Minimal semver satisfaction check — major.minor.patch only, >= operator.
 *
 * Pre-release suffixes are stripped before comparison.
 * Parse failure returns true (warn-and-continue; never hard-abort on bad version string).
 */
export function satisfiesSemver(detected: string, required: string): boolean {
  const clean = (v: string) => v.split('-')[0] ?? ''
  const parse = (v: string): [number, number, number] | null => {
    const parts = clean(v).split('.').map(Number)
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null
    return parts as [number, number, number]
  }
  const d = parse(detected)
  const r = parse(required.replace(/^[>=]+/, ''))
  // On parse failure: warn-and-continue — never hard-abort on unrecognised version string
  if (!d || !r) return true
  if (d[0] !== r[0]) return d[0] > r[0]
  if (d[1] !== r[1]) return d[1] > r[1]
  return d[2] >= r[2]
}

// ─── Onboarding Steps ─────────────────────────────────────────────────────────

/** Step 1 — Bun version verification (hard abort on mismatch). */
export function checkBunVersion(): { ok: boolean; abort: boolean } {
  // Import root package.json to read engines.bun
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let engines: Record<string, string> | undefined
  try {
    // Use dynamic require to avoid static import assertion complications
    const pkg = require('../../package.json') as { engines?: Record<string, string> }
    engines = pkg.engines
  } catch {
    line('bun version check', 'warn', 'could not read package.json engines field — skipping')
    return { ok: true, abort: false }
  }

  const required = engines?.bun
  if (!required) {
    line('bun version check', 'warn', 'engines.bun not declared in package.json — skipping')
    return { ok: true, abort: false }
  }

  const detected = Bun.version
  if (!satisfiesSemver(detected, required)) {
    line(
      'bun version',
      'error',
      `detected v${detected}, required ${required} — run: bun upgrade or install from https://bun.sh`
    )
    return { ok: false, abort: true }
  }
  line('bun detected', 'ok', `v${detected}`)
  return { ok: true, abort: false }
}

/** Step 2 — Install all workspace dependencies. */
export function installDependencies(): boolean {
  const result = spawnStep(['bun', 'install'])
  if (result.exitCode !== 0) {
    line('dependencies installed', 'error', result.errorMessage || 'bun install failed')
    return true
  }
  line('dependencies installed', 'ok')
  return false
}

/** Step 3 — Activate Husky git hooks. */
export function activateHusky(): boolean {
  const result = spawnStep(['bun', 'run', 'prepare'])
  if (result.exitCode !== 0) {
    line('husky hooks active', 'error', result.errorMessage || 'husky setup failed')
    return true
  }
  line('husky hooks active', 'ok')
  return false
}

/** Step 4 — TCP check for PostgreSQL (warn-only). */
export async function checkPostgres(): Promise<void> {
  const reachable = await checkTcp('localhost', 5432)
  if (!reachable) {
    line('PostgreSQL reachable', 'warn', 'unreachable — run: docker compose up postgres')
  } else {
    line('PostgreSQL reachable', 'ok')
  }
}

/** Step 5 — TCP check for Redis (warn-only). */
export async function checkRedis(): Promise<void> {
  const reachable = await checkTcp('localhost', 6379)
  if (!reachable) {
    line('Redis reachable', 'warn', 'unreachable — run: docker compose up redis')
  } else {
    line('Redis reachable', 'ok')
  }
}

/** Step 6 — Refresh AI context artifacts. */
export function refreshAiContext(): boolean {
  const result = spawnStep(['bun', 'ai-context:refresh'])
  if (result.exitCode !== 0) {
    line('AI context refreshed', 'error', result.errorMessage || 'ai-context:refresh failed')
    return true
  }
  line('AI context refreshed', 'ok')
  return false
}

/** Step 7 — Validate architecture boundaries. */
export function validateArchitecture(): boolean {
  const result = spawnStep(['bun', 'arch:guard'])
  if (result.exitCode !== 0) {
    line('architecture guard validated', 'error', result.errorMessage || 'arch:guard failed')
    return true
  }
  line('architecture guard validated', 'ok')
  return false
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.header(
    'REPOSITORY ONBOARD',
    'Prepares a complete local development environment in a single command'
  )
  if (isCi) {
    log.error('repo:onboard is a local bootstrap command and cannot run with --ci')
    exit(1)
  }
  section('Repository Onboard')

  let hasError = false
  const totalChecks = 7

  // Step 1 — Hard abort gate
  const bunCheck = checkBunVersion()
  if (bunCheck.abort) {
    exit(1)
  }
  if (!bunCheck.ok) hasError = true

  // Steps 2–3 — mark error; continue
  if (installDependencies()) hasError = true
  if (activateHusky()) hasError = true

  // Steps 4–5 — warn only; never affect hasError
  await checkPostgres()
  await checkRedis()

  // Steps 6–7 — mark error; continue
  if (refreshAiContext()) hasError = true
  if (validateArchitecture()) hasError = true

  summary(hasError ? 0 : totalChecks, totalChecks)
  log.result({ total: totalChecks, passed: hasError ? 0 : totalChecks, failed: hasError ? 1 : 0 })
  exit(hasError ? 1 : 0)
}

if (isDirectExecution()) {
  main().catch((e: unknown) => {
    process.stderr.write(`Unexpected error: ${String(e)}\n`)
    exit(1)
  })
}

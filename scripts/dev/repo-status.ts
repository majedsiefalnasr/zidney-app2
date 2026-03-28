/**
 * repo-status.ts — Read-only repository health summary reporter.
 *
 * Renders a concise table of current repository health indicators.
 * Never modifies any file. Always exits 0.
 *
 * Output: process.stdout.write only — console.log is banned.
 * Imports: node:fs, node:path (+ formatter sibling module).
 *
 * Stage: INFRA-18 — T005
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { flushAi, hasCiFlag, log } from '../utils/logger'
import { section } from './formatter'

const isCi = hasCiFlag()

// ─── Constants ────────────────────────────────────────────────────────────────

const KNOWN_STATUSES = ['Passing', 'Failing', 'Pending', 'Skipped', 'Unknown'] as const
type KnownStatus = (typeof KNOWN_STATUSES)[number]

/** Column width for label alignment (left-justified to colon position). */
const COL_WIDTH = 23

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitizes a CI status value.
 *
 * H-01 security contract:
 *  - Strip all non-printable ASCII characters.
 *  - Truncate to 32 characters.
 *  - Validate against KNOWN_STATUSES allowlist.
 *  - Fall back to "Unknown" if value is not in the allowlist.
 */
export function safeStatus(raw: unknown): string {
  if (typeof raw !== 'string') return 'Unknown'
  const sanitized = raw.replace(/[^\x20-\x7E]/g, '').slice(0, 32)
  const isKnown = (KNOWN_STATUSES as readonly string[]).includes(sanitized)
  return isKnown ? (sanitized as KnownStatus) : 'Unknown'
}

function pad(label: string): string {
  return label.padEnd(COL_WIDTH, ' ')
}

function spawnCheck(cmd: string[]): { exitCode: number; stdout: string } {
  const result = Bun.spawnSync(cmd, {
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: process.cwd(),
  })
  const exitCode = result.exitCode ?? 1
  const stdoutText = result.stdout ? result.stdout.toString().trim() : ''
  return { exitCode, stdout: stdoutText }
}

function statusSymbol(ok: boolean): string {
  return ok ? '✔' : '✗'
}

// ─── Status Readers ───────────────────────────────────────────────────────────

/**
 * Reads the cached CI status from `.cache/ci-status.json`.
 * Returns "Unknown (no cached state)" if the file is absent or unreadable.
 */
export function readCiStatus(): string {
  const cachePath = path.join(process.cwd(), '.cache', 'ci-status.json')
  try {
    const raw = fs.readFileSync(cachePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null && 'status' in parsed) {
      return safeStatus((parsed as Record<string, unknown>).status)
    }
    return 'Unknown'
  } catch {
    return 'Unknown (no cached state)'
  }
}

/** Runs `bun arch:health` and returns whether it passed. */
export function checkArchHealth(): boolean {
  return spawnCheck(['bun', 'arch:health']).exitCode === 0
}

/** Runs `bun ai-context:validate` and returns whether it passed. */
export function checkAiContext(): boolean {
  return spawnCheck(['bun', 'ai-context:validate']).exitCode === 0
}

/** Runs `bun type-safety-guard` and returns whether it passed. */
export function checkTypeScript(): boolean {
  return spawnCheck(['bun', 'type-safety-guard']).exitCode === 0
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  log.header('REPOSITORY STATUS', 'Read-only repository health summary reporter')
  if (isCi) {
    log.info('[repo:status] CI mode enabled')
  }
  section('Repository Status')

  const ciStatus = readCiStatus()
  const archOk = checkArchHealth()
  const aiOk = checkAiContext()
  const tsOk = checkTypeScript()

  process.stdout.write(`${pad('CI status')} : ${ciStatus}\n`)
  process.stdout.write(
    `${pad('architecture health')} : ${statusSymbol(archOk)} ${archOk ? 'pass' : 'fail'}\n`
  )
  process.stdout.write(`${pad('AI context')} : ${statusSymbol(aiOk)} ${aiOk ? 'valid' : 'stale'}\n`)
  process.stdout.write(`${pad('type safety')} : ${statusSymbol(tsOk)} ${tsOk ? 'pass' : 'fail'}\n`)

  // repo:status always exits 0
  log.result({
    total: 4,
    passed: [archOk, aiOk, tsOk].filter(Boolean).length + 1,
    failed: [archOk, aiOk, tsOk].filter((x) => !x).length,
  })
  flushAi()
  process.exit(0)
}

if (import.meta.main) {
  main()
}

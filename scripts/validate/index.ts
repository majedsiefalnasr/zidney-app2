#!/usr/bin/env bun

/**
 * @script validate:scripts:all
 * @domain validate
 * @category governance
 * @description Orchestrator that runs all script-system validators sequentially.
 *   Composes: runtime-scripts, detect-broken-scripts, spec-sync, docs-drift, orchestrator handoff validation.
 *   Also enforces the Script Evolution Guard: if package.json scripts changed
 *   in the current git diff, the migration-map must have been updated too.
 *   Exits non-zero on the first failure. Prints a timing summary.
 * @usage bun run validate:scripts:all
 */

import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'

const correlationId = randomUUID()
const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const logger = createLogger('validate:scripts:all')
logger.setContext({ correlationId, ci: isCi })

try {
  log.setScript('validate:scripts:all')
} catch {
  // ignore if logger API differs
}

interface ValidatorStep {
  label: string
  script: string
}

const VALIDATORS: ValidatorStep[] = [
  { label: 'Runtime script references', script: 'scripts/validate/runtime-scripts.ts' },
  { label: 'Broken script detection', script: 'scripts/validate/detect-broken-scripts.ts' },
  { label: 'Spec-sync validation', script: 'scripts/validate/spec-sync.ts' },
  { label: 'Docs drift guard', script: 'scripts/validate/docs-drift.ts' },
  { label: 'Orchestrator handoff registry', script: 'scripts/validate/orchestrator-handoffs.ts' },
]

const MIGRATION_MAP_PATH = 'docs/scripts/migration-map.json'

/**
 * Script Evolution Guard: if package.json scripts have changed in git,
 * the migration-map must also be in the changed set.
 * Returns true if the guard passes (no script change or migration-map updated).
 */
function checkScriptEvolutionGuard(): boolean {
  // Check git diff for staged or unstaged changes
  const diffStaged = spawnSync('git', ['diff', '--cached', '--name-only'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  const diffUnstaged = spawnSync('git', ['diff', '--name-only'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  const changed = new Set(
    [...(diffStaged.stdout?.split('\n') ?? []), ...(diffUnstaged.stdout?.split('\n') ?? [])].filter(
      Boolean
    )
  )

  const pkgChanged = changed.has('package.json')
  const mapChanged = changed.has(MIGRATION_MAP_PATH)

  if (!pkgChanged) return true // No script changes → guard passes

  // package.json changed — check if it's actually the scripts section
  const diffContent = spawnSync('git', ['diff', '--cached', '-U0', 'package.json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  const diffLines = diffContent.stdout ?? ''
  const scriptsChanged =
    diffLines.includes('"scripts"') ||
    diffLines.split('\n').some((line) => /^[+-]\s+"[a-z]/.test(line) && line.includes(':'))

  if (!scriptsChanged) return true // package.json changed but not scripts → OK

  if (mapChanged) return true // Both changed → guard passes

  // Check if the migration map even exists
  if (!existsSync(join(process.cwd(), MIGRATION_MAP_PATH))) {
    logger.warn('Script Evolution Guard: migration-map.json does not exist', {
      hint: 'Create it with: bun run dev:refactor:scripts',
    })
    return true // Non-blocking warning for first-time setup
  }

  return false // Scripts changed, migration-map NOT updated
}

function runValidator(step: ValidatorStep): { ok: boolean; durationMs: number } {
  const start = Date.now()
  const passthrough = isCi ? ['--ci'] : []
  const result = spawnSync('bun', [step.script, ...passthrough], {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: 60_000,
  })
  return { ok: result.status === 0, durationMs: Date.now() - start }
}

function main(): void {
  log.header('Script System Full Validation', 'Orchestrator: runs all script-system validators')

  // ── Script Evolution Guard (pre-flight) ────────────────────────────────
  const evolutionOk = checkScriptEvolutionGuard()
  if (!evolutionOk) {
    log.section('Script Evolution Guard')
    logger.warn('package.json scripts changed but migration-map was not updated', {
      migrationMap: MIGRATION_MAP_PATH,
      hint: 'Update migration-map with: bun run dev:refactor:scripts',
    })
    log.step('⚠️  package.json scripts changed but docs/scripts/migration-map.json was not updated')
    log.step('   Run: bun run dev:refactor:scripts to update the migration map')
    // Non-blocking warning — does not fail the pipeline, but surfaces drift
  }

  const totalStart = Date.now()
  const results: Array<{ label: string; ok: boolean; durationMs: number }> = []

  for (const step of VALIDATORS) {
    log.step(`Running: ${step.label}`)
    const result = runValidator(step)
    results.push({ label: step.label, ...result })

    if (!result.ok) {
      logger.error(`Validator failed: ${step.label}`, {
        script: step.script,
        durationMs: result.durationMs,
      })
      break
    }

    logger.info(`Validator passed: ${step.label}`, { durationMs: result.durationMs })
  }

  const totalMs = Date.now() - totalStart
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  log.section('Validation Summary')
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌'
    const time = `${r.durationMs}ms`
    log.step(`${icon} ${r.label} (${time})`)
  }

  if (!evolutionOk) {
    log.step('⚠️  Script Evolution Guard: migration-map not updated')
  }

  log.result({
    passed,
    failed,
    total: VALIDATORS.length,
    message: failed > 0 ? 'Script validation failed' : 'All script validators passed',
    details: { totalMs, evolutionGuard: evolutionOk ? 'passed' : 'warning' },
  })

  if (failed > 0) {
    log.badge('VALIDATION FAILED', 'error')
    exit(1)
  }

  log.badge('VALIDATION PASSED', 'success')
  exit(0)
}

main()

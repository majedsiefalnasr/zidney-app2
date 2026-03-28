#!/usr/bin/env bun
import { resolve } from 'node:path'
/**
 * @script arch:check:store-cycles
 * @domain arch
 * @category governance
 * @description Runs madge on each app's src/core/state/ to assert zero circular dependencies. Exits with non-zero code on any detected cycle.
 * @usage bun run arch:check:store-cycles
 *
 * scripts/check-store-cycles.ts
 *
 * Runs madge on each app's src/core/state/ directory and asserts zero circular
 * dependencies. Exits with non-zero code on any detected cycle.
 *
 * Usage:
 *   bun scripts/check-store-cycles.ts
 *
 * CI integration:
 *   Add to package.json scripts: "check:store-cycles": "bun scripts/check-store-cycles.ts"
 *   Call from CI lint/check step before tests.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 * Refs: SC-007, QA-H003, FR-033
 */
import madge from 'madge'
import { exit, log } from './utils/logger'

log.setScript('arch:check:store-cycles')

// ─── Configuration ─────────────────────────────────────────────────────────────

const WORKSPACE_ROOT = resolve(import.meta.dir, '..')

const STATE_DIRS = [
  {
    app: 'mmc',
    path: resolve(WORKSPACE_ROOT, 'apps/mmc/src/core/state'),
  },
  {
    app: 'backoffice',
    path: resolve(WORKSPACE_ROOT, 'apps/backoffice/src/core/state'),
  },
  {
    app: 'frontoffice',
    path: resolve(WORKSPACE_ROOT, 'apps/frontoffice/src/core/state'),
  },
]

// ─── Main ──────────────────────────────────────────────────────────────────────

async function checkCycles(): Promise<void> {
  log.header('STORE CYCLE CHECK', 'Validates zero circular dependencies in app state dirs')
  let totalCycles = 0
  const results: Array<{ app: string; cycles: string[][] }> = []

  for (const { app, path: stateDir } of STATE_DIRS) {
    let res: Awaited<ReturnType<typeof madge>>
    try {
      res = await madge(stateDir, {
        fileExtensions: ['ts'],
        detectiveOptions: {
          ts: {
            mixedImports: true,
          },
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error(`[check-store-cycles] ERROR: Failed to analyze ${app} — ${msg}`)
      exit(2)
    }

    const circular = res.circular()
    results.push({ app, cycles: circular })

    if (circular.length === 0) {
      log.success(`${app}: no circular dependencies`)
    } else {
      log.error(`${app}: ${circular.length} circular dependency chain(s) found:`)
      for (const chain of circular) {
        log.step(`→ ${chain.join(' → ')} → ${chain[0]}`)
      }
      totalCycles += circular.length
    }
  }

  if (totalCycles > 0) {
    log.result({
      total: STATE_DIRS.length,
      passed: STATE_DIRS.length - results.filter((r) => r.cycles.length > 0).length,
      failed: results.filter((r) => r.cycles.length > 0).length,
      message: `${totalCycles} cycle(s) detected. Fix circular imports before merging. See SC-007, FR-033.`,
    })
    exit(1)
  }

  log.result({
    total: STATE_DIRS.length,
    passed: STATE_DIRS.length,
    failed: 0,
    message: 'Zero circular dependencies in all store directories.',
  })
  exit(0)
}

checkCycles()

#!/usr/bin/env bun
import { resolve } from 'node:path'
/**
 * scripts/dev/check-store-cycles.ts
 *
 * Runs madge on each app's src/core/state/ directory and asserts zero circular
 * dependencies. Exits with non-zero code on any detected cycle.
 *
 * Usage:
 *   bun scripts/dev/check-store-cycles.ts
 *
 * CI integration:
 *   Add to package.json scripts: "check:store-cycles": "bun scripts/dev/check-store-cycles.ts"
 *   Call from CI lint/check step before tests.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 * Refs: SC-007, QA-H003, FR-033
 */
import madge from 'madge'
import { flushAi, log } from '../utils/logger'

// ─── Configuration ─────────────────────────────────────────────────────────────

const WORKSPACE_ROOT = resolve(import.meta.dir, '../..')

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
  log.header('CHECK STORE CYCLES', 'Detects circular dependencies in Pinia store directories')
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
      log.result({ total: 0, passed: 0, failed: 1 })
      flushAi()
      process.exit(2)
    }

    const circular = res.circular()
    results.push({ app, cycles: circular })

    if (circular.length === 0) {
      log.success(`[check-store-cycles]   ${app}: no circular dependencies`)
    } else {
      log.error(
        `[check-store-cycles]   ${app}: ${circular.length} circular dependency chain(s) found:`
      )
      for (const chain of circular) {
        log.error(`    → ${chain.join(' → ')} → ${chain[0]}`)
      }
      totalCycles += circular.length
    }
  }

  if (totalCycles > 0) {
    log.error(
      `[check-store-cycles] FAIL: ${totalCycles} cycle(s) detected across all store directories.`
    )
    log.error('[check-store-cycles] Fix circular imports before merging. See SC-007, FR-033.')
    log.result({ total: totalCycles, passed: 0, failed: totalCycles })
    flushAi()
    process.exit(1)
  }

  log.success('[check-store-cycles] PASS: Zero circular dependencies in all store directories.')
  log.result({ total: STATE_DIRS.length, passed: STATE_DIRS.length, failed: 0 })
  flushAi()
  process.exit(0)
}

checkCycles()

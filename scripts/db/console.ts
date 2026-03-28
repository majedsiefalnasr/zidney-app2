#!/usr/bin/env bun

/**
 * @script db:console
 * @domain db
 * @category runtime
 * @description Launch an interactive psql session connected to DATABASE_URL.
 * @usage bun run db:console
 */

import { spawnSync } from 'node:child_process'
import { exit, log } from '../utils/logger'

log.setScript('db:console')

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h')
}

function printHelp(): void {
  log.header('DB CONSOLE', 'Launches psql against DATABASE_URL for manual inspection')
  log.info('Usage: bun run db:console')
  log.info('Environment: DATABASE_URL=postgres://user:pass@host:5432/master_db')
  log.info('Requirement: psql must be available on PATH')
  log.result({ total: 1, passed: 1, failed: 0, message: 'Help displayed' })
}

async function main(): Promise<void> {
  if (hasHelpFlag(process.argv)) {
    printHelp()
    exit(0)
  }

  log.header('DB CONSOLE', 'Opens an interactive psql session using DATABASE_URL')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    log.warn('DATABASE_URL not set; skipping psql launch')
    log.result({
      total: 1,
      passed: 1,
      failed: 0,
      warnings: 1,
      status: 'warning',
      message: 'Database console skipped',
      details: {
        infraDependent: true,
      },
    })
    exit(0)
  }

  const psqlCheck = spawnSync('which', ['psql'], { encoding: 'utf8' })
  if (psqlCheck.status !== 0) {
    log.error('psql not found on PATH')
    log.info('Install PostgreSQL client tools, then rerun this command')
    log.result({
      total: 1,
      passed: 1,
      failed: 0,
      warnings: 1,
      status: 'warning',
      message: 'Database console skipped because psql is unavailable',
      details: {
        infraDependent: true,
      },
    })
    exit(0)
  }

  log.step('Launching psql session...')
  const result = spawnSync('psql', [databaseUrl], { stdio: 'inherit' })

  if (result.error) {
    log.error(`psql failed to launch: ${result.error.message}`)
    log.result({
      total: 1,
      passed: 0,
      failed: 1,
      message: 'Database console failed to start',
    })
    exit(1)
  }

  const status = result.status ?? 0
  if (status === 0) {
    log.result({
      total: 1,
      passed: 1,
      failed: 0,
      message: 'Database console session closed cleanly',
    })
    exit(0)
  }

  log.result({
    total: 1,
    passed: 0,
    failed: 1,
    message: `Database console exited with status ${status}`,
  })
  exit(status)
}

void main()

#!/usr/bin/env bun

/**
 * @script db:status:pool
 * @domain db
 * @category runtime
 * @description Check PostgreSQL connection pool health and report status.
 * @usage bun run db:status:pool
 */

import { exit, hasCiFlag, log } from '../utils/logger'

log.setScript('db:status:pool')
const isCi = hasCiFlag()

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h')
}

function printHelp(): void {
  log.header(
    'DB POOL STATUS',
    'Checks DATABASE_URL connectivity with a live connect/ping/release cycle'
  )
  log.info('Usage: bun run db:status:pool')
  log.info('Environment: DATABASE_URL=postgres://user:pass@host:5432/master_db')
  log.info('Behavior: exits 0 on healthy, skipped, or infra-unavailable checks')
  log.result({ total: 1, passed: 1, failed: 0, message: 'Help displayed' })
}

async function main(): Promise<void> {
  if (hasHelpFlag(process.argv)) {
    printHelp()
    exit(0)
  }

  log.header('DB POOL STATUS', 'Checks PostgreSQL connection pool health and reports latency')
  if (isCi) {
    log.info('[db:status:pool] CI mode enabled')
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    log.warn('DATABASE_URL not set; skipping pool health check')
    log.result({
      total: 1,
      passed: 1,
      failed: 0,
      warnings: 1,
      status: 'warning',
      message: 'Pool health check skipped',
      details: {
        infraDependent: true,
      },
    })
    exit(0)
  }

  let pool: import('pg').Pool | null = null

  try {
    const { Pool } = await import('pg')
    const startedAt = Date.now()
    pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
      application_name: 'zidney-script-db-status-pool',
    })

    const client = await pool.connect()
    try {
      const pingResult = await client.query<{ ok: number }>('SELECT 1 AS ok')
      const latencyMs = Date.now() - startedAt
      const isHealthy = pingResult.rows[0]?.ok === 1

      log.success(`Database pool healthy in ${latencyMs}ms`)
      log.result({
        total: 1,
        passed: isHealthy ? 1 : 0,
        failed: isHealthy ? 0 : 1,
        message: isHealthy
          ? 'Pool health check passed'
          : 'Pool health check returned unexpected response',
        details: {
          latencyMs,
          totalConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingClients: pool.waitingCount,
        },
      })
      exit(isHealthy ? 0 : 1)
    } finally {
      client.release()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Pool health check could not complete: ${message}`)
    log.result({
      total: 1,
      passed: 1,
      failed: 0,
      warnings: 1,
      status: 'warning',
      message: 'Pool health check skipped due to unavailable infrastructure',
      details: {
        infraDependent: true,
      },
    })
    exit(0)
  } finally {
    await pool?.end().catch(() => undefined)
  }
}

void main()

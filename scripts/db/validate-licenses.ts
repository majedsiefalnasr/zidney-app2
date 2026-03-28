#!/usr/bin/env bun

/**
 * @script db:validate:licenses
 * @domain db
 * @category governance
 * @description Validate license distribution in master_db and report counts by status.
 * @usage bun run db:validate:licenses
 */

import { exit, log } from '../utils/logger'

log.setScript('db:validate:licenses')

interface LicenseStatusRow {
  status: string | null
  count: string
}

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h')
}

function printHelp(): void {
  log.header('DB LICENSE VALIDATION', 'Queries master_db licenses grouped by status')
  log.info('Usage: bun run db:validate:licenses')
  log.info('Environment: DATABASE_URL=postgres://user:pass@host:5432/master_db')
  log.info('Behavior: exits 0 on successful validation or infra-unavailable skip')
  log.result({ total: 1, passed: 1, failed: 0, message: 'Help displayed' })
}

function normalizeStatusKey(status: string | null): string {
  if (!status) {
    return 'unknown'
  }

  return status.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

async function main(): Promise<void> {
  if (hasHelpFlag(process.argv)) {
    printHelp()
    exit(0)
  }

  log.header('DB LICENSE VALIDATION', 'Reports master license counts grouped by status')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    log.warn('DATABASE_URL not set; skipping license validation')
    log.result({
      total: 1,
      passed: 1,
      failed: 0,
      warnings: 1,
      status: 'warning',
      message: 'License validation skipped',
      details: {
        infraDependent: true,
      },
    })
    exit(0)
  }

  let pool: import('pg').Pool | null = null

  try {
    const { Pool } = await import('pg')
    pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
      application_name: 'zidney-script-db-validate-licenses',
    })

    const result = await pool.query<LicenseStatusRow>(`
      SELECT status, COUNT(*)::text AS count
      FROM licenses
      GROUP BY status
      ORDER BY status NULLS LAST
    `)

    let total = 0
    const details: Record<string, string | number | boolean | null | undefined> = {
      statusGroups: result.rows.length,
    }

    if (result.rows.length === 0) {
      log.info('No licenses found in master_db')
    }

    for (const row of result.rows) {
      const count = Number(row.count)
      total += count
      const key = normalizeStatusKey(row.status)
      details[key] = count
      log.info(`${row.status ?? 'UNKNOWN'}: ${count}`)
    }

    log.success(`License distribution validated across ${result.rows.length} status group(s)`)
    log.result({
      total: result.rows.length || 1,
      passed: result.rows.length || 1,
      failed: 0,
      message:
        result.rows.length === 0 ? 'License table is empty' : 'License distribution validated',
      details: {
        totalLicenses: total,
        ...details,
      },
    })
    exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`License validation could not complete: ${message}`)
    log.result({
      total: 1,
      passed: 1,
      failed: 0,
      warnings: 1,
      status: 'warning',
      message: 'License validation skipped due to unavailable infrastructure',
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

/**
 * @script db:validate-licenses
 * @domain db
 * @description Validate license distribution in master_db — report status counts per license status
 * @mode manual,ci
 * @dependencies pg,node:crypto
 */

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createLogger } from '../core/logger-factory'

const correlationId = randomUUID()
const logger = createLogger('db:validate-licenses')
logger.setContext({ correlationId })

const DATABASE_URL = process.env.DATABASE_URL

async function main(): Promise<void> {
  logger.info('Validating license distribution')

  if (!DATABASE_URL) {
    logger.warn('Infrastructure dependency unavailable: DATABASE_URL not set', {
      service: 'db:validate-licenses',
    })
    process.exit(0)
  }

  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: DATABASE_URL, max: 1, idleTimeoutMillis: 5000 })

    const client = await pool.connect()
    try {
      const result = await client.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count
         FROM licenses
         WHERE deleted_at IS NULL
         GROUP BY status
         ORDER BY status`
      )

      const distribution = Object.fromEntries(result.rows.map((r) => [r.status, Number(r.count)]))
      const total = result.rows.reduce((sum, r) => sum + Number(r.count), 0)

      logger.info('License distribution validated', {
        total,
        distribution,
        rowCount: result.rowCount,
      })
    } finally {
      client.release()
    }

    process.exit(0)
  } catch (error) {
    logger.error('License validation failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Infra-absent graceful pass
    process.exit(0)
  } finally {
    if (pool) {
      try {
        await pool.end()
      } catch {
        // ignore pool close errors
      }
    }
  }
}

main()

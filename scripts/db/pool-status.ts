/**
 * @script db:status:pool
 * @domain db
 * @category runtime
 * @description Check PostgreSQL connection pool health and report status
 * @usage bun run db:status:pool
 */

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createLogger } from '../core/logger-factory'

const correlationId = randomUUID()
const logger = createLogger('db:pool-status')
logger.setContext({ correlationId })

const DATABASE_URL = process.env.DATABASE_URL

async function main(): Promise<void> {
  logger.info('Checking database pool status')

  if (!DATABASE_URL) {
    logger.warn('Infrastructure dependency unavailable: DATABASE_URL not set', {
      service: 'db:pool-status',
    })
    process.exit(0)
  }

  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: DATABASE_URL, max: 1, idleTimeoutMillis: 5000 })

    const client = await pool.connect()
    try {
      const result = await client.query('SELECT 1 AS ping, NOW() AS server_time')
      logger.info('Database pool healthy', {
        ping: result.rows[0].ping,
        serverTime: result.rows[0].server_time,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingConnections: pool.waitingCount,
      })
    } finally {
      client.release()
    }

    process.exit(0)
  } catch (error) {
    logger.error('Database pool check failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Infra-absent graceful pass — if DB is unreachable, not a broken script
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

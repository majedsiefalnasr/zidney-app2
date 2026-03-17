/**
 * @script db:console
 * @domain db
 * @description Launch an interactive psql session connected to DATABASE_URL
 * @mode manual
 * @dependencies psql,node:crypto,node:child_process
 *
 * Note: Connects directly to DATABASE_URL — no --workspace= arg required.
 * Caller must set DATABASE_URL in the environment.
 * Requires psql to be available on PATH.
 */

import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createLogger } from '../core/logger-factory'

const correlationId = randomUUID()
const logger = createLogger('db:console')
logger.setContext({ correlationId })

const DATABASE_URL = process.env.DATABASE_URL

function main(): void {
  logger.info('Launching database console')

  if (!DATABASE_URL) {
    logger.warn('Infrastructure dependency unavailable: DATABASE_URL not set', {
      service: 'db:console',
    })
    process.exit(0)
  }

  // Check psql is available
  const which = spawnSync('which', ['psql'], { encoding: 'utf-8' })
  if (which.status !== 0 || !which.stdout.trim()) {
    logger.error('psql not found on PATH', {
      hint: 'Install postgresql-client (brew install postgresql or apt-get install postgresql-client)',
    })
    process.exit(0)
  }

  logger.info('Connecting to database via psql', {
    psqlPath: which.stdout.trim(),
  })

  const result = spawnSync('psql', [DATABASE_URL as string], {
    stdio: 'inherit',
    env: { ...process.env },
  })

  if (result.error) {
    logger.error('Failed to launch psql', {
      error: result.error.message,
    })
    process.exit(0)
  }

  process.exit(result.status ?? 0)
}

main()

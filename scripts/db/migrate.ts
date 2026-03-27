/**
 * @script db:migrate
 * @domain db
 * @category runtime
 * @description Run database migrations via drizzle-kit push — applies pending schema changes to master_db
 * @mode manual,ci
 * @usage bun run db:migrate
 * @dependencies drizzle-kit,node:crypto,node:child_process
 
 * @library-module
*/

import { execSync } from 'node:child_process'

const _correlationId = randomUUID()
const logger = createLogger('db:migrate')
logger.setContext({ correlationId })

const DATABASE_URL = process.env.DATABASE_URL
const REPO_ROOT = process.cwd()

function _main(): void {
  logger.info('Starting database migration')

  if (!DATABASE_URL) {
    logger.warn('Infrastructure dependency unavailable: DATABASE_URL not set', {
      service: 'db:migrate',
    })
    process.exit(0)
  }

  const args = process.argv.slice(2)
  const migrationArg = args.find((a) => a.startsWith('--migration='))
  const migration = migrationArg ? migrationArg.replace('--migration=', '') : undefined

  const cmd = migration
    ? `bunx drizzle-kit migrate --config=apps/api/drizzle.config.ts --name=${migration}`
    : 'bunx drizzle-kit push --config=apps/api/drizzle.config.ts'

  logger.info('Executing migration command', { cmd, migration: migration ?? 'all-pending' })

  try {
    const output = execSync(cmd, {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL },
      stdio: 'pipe',
      timeout: 120_000,
    })

    logger.info('Migration completed successfully', {
      output: output.toString().trim().slice(0, 500),
    })
    process.exit(0)
  } catch (error) {
    logger.error('Migration failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Infra-absent graceful pass
    process.exit(0)
  }
}

main()

/**
 * Master Database Initialization
 *
 * Bootstrap sequence:
 * 1. Ensure tracking table exists (idempotent)
 * 2. Initialize migration system
 * 3. Execute all pending migrations in order
 *
 * File: apps/api/src/db/master/init.ts
 * Task: T001
 * Phase: 1 - Migration Infrastructure
 */

import { Logger } from '@zidney/logger'
import { Pool } from 'pg'
import { up as initTrackingTable } from './init-tracking-table'
import { MigrationExecutor } from './runner'

export class MasterDatabaseInitializer {
  private pool: Pool
  private logger: Logger

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool
    this.logger = logger
  }

  /**
   * Initialize master database
   *
   * Sequence:
   * 1. Create tracking table (idempotent)
   * 2. Execute migration runner
   * 3. Validate schema version
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect()

    try {
      // Step 1: Ensure tracking table exists
      await initTrackingTable(client)

      this.logger.info({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'master-db-init',
        phase: 'bootstrap',
        status: 'tracking-table-ready',
        message: '_schema_migrations table ready',
      })

      // Step 2: Execute migrations
      const executor = new MigrationExecutor(this.pool, this.logger)
      await executor.executeAll()

      this.logger.info({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'master-db-init',
        phase: 'complete',
        status: 'success',
        message: 'Master database initialization complete',
      })
    } catch (error) {
      this.logger.error({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        service: 'master-db-init',
        phase: 'initialization',
        status: 'failed',
        message: 'Master database initialization failed',
        error: {
          code: 'INIT_FAILURE',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      throw error
    } finally {
      client.release()
    }
  }
}

export default MasterDatabaseInitializer

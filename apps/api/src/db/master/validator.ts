/**
 * Migration Validator: Validates migration structure and integrity
 *
 * Responsibilities:
 * - Validate migration has required properties
 * - Validate function signatures
 * - Catch structural errors before execution
 *
 * File: apps/api/src/db/master/validator.ts
 * Task: T004
 * Phase: 1 - Migration Infrastructure
 */

import type { PoolClient } from 'pg'

export interface Migration {
  version: string
  description: string
  up: (client: PoolClient) => Promise<void>
}

export class MigrationValidator {
  /**
   * Validate migration before execution
   *
   * Checks:
   * - version is string and matches format YYYYMMDD###
   * - description is non-empty string
   * - up is a function
   */
  async validate(migration: Migration): Promise<void> {
    // Validate version
    if (typeof migration.version !== 'string') {
      throw new Error('Migration.version must be a string')
    }

    if (!/^\d{11}$/.test(migration.version)) {
      throw new Error(
        `Migration.version must be 11-digit format (YYYYMMDD###), got: ${migration.version}`
      )
    }

    // Validate description
    if (typeof migration.description !== 'string') {
      throw new Error('Migration.description must be a string')
    }

    if (migration.description.trim().length === 0) {
      throw new Error('Migration.description cannot be empty')
    }

    // Validate up function
    if (typeof migration.up !== 'function') {
      throw new Error(`Migration.up must be a function, got: ${typeof migration.up}`)
    }

    // Validate up function signature (accepts PoolClient)
    if (migration.up.length < 1) {
      throw new Error('Migration.up() must accept at least 1 parameter (PoolClient)')
    }
  }
}

export default MigrationValidator

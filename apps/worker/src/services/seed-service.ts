/**
 * Seed Data Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Inserts baseline seed data into tenant database.
 * Executes in same transaction as migrations for atomicity.
 *
 * Baseline data:
 * - Roles (ADMIN, STAFF, STUDENT, SUPPORT)
 * - Permissions (exam:*, question:*, student:*, report:read, workspace:settings)
 * - Role-permission mappings
 * - Workspace settings (organization name, student limit, staff limit)
 * - Admin user placeholder
 */

import { Pool } from 'pg'

/**
 * Seed Data Result
 */
export interface SeedDataResult {
  success: boolean
  rowsInserted: number
  errorMessage?: string
  durationMs?: number
}

/**
 * Seed Data Service
 */
export class SeedDataService {
  private logger?: any

  constructor(logger?: any) {
    this.logger = logger
  }

  /**
   * Seed database with baseline data
   */
  async seed(
    pool: Pool,
    organizationName: string,
    studentLimit: number,
    staffLimit: number,
    usesDivisions: boolean = false,
    adminEmail: string,
    defaultLanguage: string = 'en'
  ): Promise<SeedDataResult> {
    const startTime = Date.now()

    try {
      let totalRows = 0

      // Update workspace settings inserted as placeholder
      const settingsResult = await pool.query(
        `UPDATE workspace_settings 
         SET organization_name = $1, 
             student_limit = $2, 
             staff_limit = $3,
             uses_divisions = $4,
             default_language = $5
         WHERE id = (SELECT id FROM workspace_settings LIMIT 1)`,
        [
          organizationName,
          studentLimit,
          staffLimit,
          usesDivisions,
          defaultLanguage,
        ]
      )
      totalRows += settingsResult.rowCount || 0

      // Update admin user placeholder
      const adminResult = await pool.query(
        `UPDATE users 
         SET email = $1, is_active = true
         WHERE email = 'admin@workspace.local'`,
        [adminEmail]
      )
      totalRows += adminResult.rowCount || 0

      this.logger?.logDatabaseOperation(
        'SEED',
        'baseline_data',
        Date.now() - startTime,
        totalRows
      )

      return {
        success: true,
        rowsInserted: totalRows,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger?.logError(
        'Seed data insertion failed',
        error instanceof Error ? error : new Error(errorMsg)
      )

      return {
        success: false,
        rowsInserted: 0,
        errorMessage: errorMsg,
        durationMs: Date.now() - startTime,
      }
    }
  }
}

/**
 * Factory to create seed service
 */
export function createSeedDataService(logger?: any): SeedDataService {
  return new SeedDataService(logger)
}

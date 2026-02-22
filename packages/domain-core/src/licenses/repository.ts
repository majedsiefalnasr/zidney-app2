/**
 * License Repository (Data Access Layer)
 *
 * File: packages/domain-core/src/licenses/repository.ts
 * Tasks: T016-T022
 *
 * Implements data access operations for license entity.
 * All database queries use parameterized statements to prevent SQL injection.
 */

import { Database } from 'better-sqlite3'
import { ALLOWED_STATE_TRANSITIONS } from './constants'
import {
  InvalidStateTransitionError,
  LicenseNotFoundError,
  LicenseValidationError,
} from './errors'
import { License, LicenseStatus } from './types'

export class LicenseRepository {
  constructor(private masterDb: Database) {}

  /**
   * T016: Create a new license
   *
   * Inserts license record with status = PENDING_PROVISION.
   * Workspace slug must be globally unique.
   */
  async create(data: {
    id: string
    product_id: string
    workspace_slug: string
    workspace_name: string
    student_limit: number | null
    staff_limit: number | null
    use_zidney_payment: boolean
    commission_per_user: number | null
    default_language: string
    uses_divisions: boolean
    schema_version: number
    product_version: number
  }): Promise<License> {
    try {
      const stmt = this.masterDb.prepare(`
        INSERT INTO licenses (
          id, product_id, workspace_slug, workspace_name, student_limit, staff_limit,
          use_zidney_payment, commission_per_user, default_language, uses_divisions,
          status, schema_version, product_version, provisioning_retries,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        RETURNING *
      `)

      const result = stmt.get(
        data.id,
        data.product_id,
        data.workspace_slug,
        data.workspace_name,
        data.student_limit,
        data.staff_limit,
        data.use_zidney_payment ? 1 : 0,
        data.commission_per_user,
        data.default_language,
        data.uses_divisions ? 1 : 0,
        LicenseStatus.PENDING_PROVISION,
        data.schema_version,
        data.product_version,
        0
      ) as any

      return this.mapToLicense(result)
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        throw LicenseValidationError.slugNotUnique()
      }
      throw error
    }
  }

  /**
   * T017: Get license by ID
   */
  async getById(id: string): Promise<License | null> {
    const stmt = this.masterDb.prepare(`
      SELECT * FROM licenses WHERE id = ? AND deleted_at IS NULL
    `)

    const result = stmt.get(id) as any
    return result ? this.mapToLicense(result) : null
  }

  /**
   * T018: List methods - List by status with pagination
   */
  async listByStatus(
    status: LicenseStatus,
    limit: number,
    offset: number
  ): Promise<License[]> {
    const stmt = this.masterDb.prepare(`
      SELECT * FROM licenses 
      WHERE status = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)

    const results = stmt.all(status, limit, offset) as any[]
    return results.map((r) => this.mapToLicense(r))
  }

  /**
   * T018: List by product
   */
  async listByProduct(
    product_id: string,
    limit: number,
    offset: number
  ): Promise<License[]> {
    const stmt = this.masterDb.prepare(`
      SELECT * FROM licenses 
      WHERE product_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)

    const results = stmt.all(product_id, limit, offset) as any[]
    return results.map((r) => this.mapToLicense(r))
  }

  /**
   * T018: List with comprehensive filters
   */
  async listWithFilters(
    filters: {
      status?: LicenseStatus
      product_id?: string
      search?: string
    },
    pagination: { limit: number; offset: number }
  ): Promise<{ items: License[]; total: number }> {
    let whereConditions = ['deleted_at IS NULL']
    const params: any[] = []

    if (filters.status) {
      whereConditions.push('status = ?')
      params.push(filters.status)
    }

    if (filters.product_id) {
      whereConditions.push('product_id = ?')
      params.push(filters.product_id)
    }

    if (filters.search) {
      whereConditions.push('(workspace_slug ILIKE ? OR workspace_name ILIKE ?)')
      const searchTerm = `%${filters.search}%`
      params.push(searchTerm, searchTerm)
    }

    const whereClause = whereConditions.join(' AND ')

    // Get total count
    const countStmt = this.masterDb.prepare(
      `SELECT COUNT(*) as count FROM licenses WHERE ${whereClause}`
    )
    const countResult = countStmt.get(...params) as any
    const total = countResult.count

    // Get paginated results
    params.push(pagination.limit, pagination.offset)
    const stmt = this.masterDb.prepare(`
      SELECT * FROM licenses 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)

    const results = stmt.all(...params) as any[]
    const items = results.map((r) => this.mapToLicense(r))

    return { items, total }
  }

  /**
   * T019: Update license with new data
   *
   * Validates that immutable fields are not being changed.
   */
  async update(
    id: string,
    data: Partial<Omit<License, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<License> {
    // Check for immutable field attempts
    if (
      'product_id' in data ||
      'workspace_slug' in data ||
      'schema_version' in data ||
      'product_version' in data
    ) {
      throw LicenseValidationError.invalidFieldEdit()
    }

    const updates: string[] = []
    const values: any[] = []

    // Build dynamic UPDATE statement
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        const mappedValue = typeof value === 'boolean' ? (value ? 1 : 0) : value
        updates.push(`${key} = ?`)
        values.push(mappedValue)
      }
    }

    if (updates.length === 0) {
      // No updates, return existing license
      const license = await this.getById(id)
      if (!license) throw new LicenseNotFoundError(id)
      return license
    }

    updates.push('updated_at = NOW()')
    values.push(id)

    const stmt = this.masterDb.prepare(`
      UPDATE licenses 
      SET ${updates.join(', ')}
      WHERE id = ?
      RETURNING *
    `)

    const result = stmt.get(...values) as any
    if (!result) throw new LicenseNotFoundError(id)

    return this.mapToLicense(result)
  }

  /**
   * T019: Update status
   */
  async updateStatus(id: string, status: LicenseStatus): Promise<License> {
    const stmt = this.masterDb.prepare(`
      UPDATE licenses 
      SET status = ?, updated_at = NOW()
      WHERE id = ?
      RETURNING *
    `)

    const result = stmt.get(status, id) as any
    if (!result) throw new LicenseNotFoundError(id)

    return this.mapToLicense(result)
  }

  /**
   * T020: Status transition methods - Soft Lock
   */
  async softLock(id: string, gracePeriodMs: number): Promise<License> {
    const license = await this.getById(id)
    if (!license) throw new LicenseNotFoundError(id)

    const validTransitions = ALLOWED_STATE_TRANSITIONS[license.status] || []
    if (!validTransitions.includes(LicenseStatus.SOFT_LOCKED)) {
      throw InvalidStateTransitionError.softLockFromNonActive()
    }

    const softLockUntil = new Date(Date.now() + gracePeriodMs)

    const stmt = this.masterDb.prepare(`
      UPDATE licenses 
      SET status = ?, soft_lock_until = ?, updated_at = NOW()
      WHERE id = ?
      RETURNING *
    `)

    const result = stmt.get(LicenseStatus.SOFT_LOCKED, softLockUntil, id) as any
    return this.mapToLicense(result)
  }

  /**
   * T020: Unlock (restore from soft lock)
   */
  async unlock(id: string): Promise<License> {
    const license = await this.getById(id)
    if (!license) throw new LicenseNotFoundError(id)

    if (license.status !== LicenseStatus.SOFT_LOCKED) {
      throw InvalidStateTransitionError.unlockFromNonSoftLocked()
    }

    const stmt = this.masterDb.prepare(`
      UPDATE licenses 
      SET status = ?, soft_lock_until = NULL, updated_at = NOW()
      WHERE id = ?
      RETURNING *
    `)

    const result = stmt.get(LicenseStatus.ACTIVE, id) as any
    return this.mapToLicense(result)
  }

  /**
   * T020: Archive
   */
  async archive(id: string): Promise<License> {
    const license = await this.getById(id)
    if (!license) throw new LicenseNotFoundError(id)

    if (license.status !== LicenseStatus.SOFT_LOCKED) {
      throw InvalidStateTransitionError.archiveFromNonSoftLocked()
    }

    const stmt = this.masterDb.prepare(`
      UPDATE licenses 
      SET status = ?, archived_at = NOW(), updated_at = NOW()
      WHERE id = ?
      RETURNING *
    `)

    const result = stmt.get(LicenseStatus.ARCHIVED, id) as any
    return this.mapToLicense(result)
  }

  /**
   * T020: Restore from archive
   */
  async restore(id: string): Promise<License> {
    const license = await this.getById(id)
    if (!license) throw new LicenseNotFoundError(id)

    if (license.status !== LicenseStatus.ARCHIVED) {
      throw InvalidStateTransitionError.restoreFromNonArchived()
    }

    const stmt = this.masterDb.prepare(`
      UPDATE licenses 
      SET status = ?, archived_at = NULL, updated_at = NOW()
      WHERE id = ?
      RETURNING *
    `)

    const result = stmt.get(LicenseStatus.ACTIVE, id) as any
    return this.mapToLicense(result)
  }

  /**
   * T020: Delete (terminal state)
   */
  async delete(id: string): Promise<License> {
    const license = await this.getById(id)
    if (!license) throw new LicenseNotFoundError(id)

    if (license.status !== LicenseStatus.ARCHIVED) {
      throw new Error(`License must be ARCHIVED before deletion`)
    }

    const stmt = this.masterDb.prepare(`
      UPDATE licenses 
      SET status = ?, deleted_at = NOW(), updated_at = NOW()
      WHERE id = ?
      RETURNING *
    `)

    const result = stmt.get(LicenseStatus.DELETED, id) as any
    return this.mapToLicense(result)
  }

  /**
   * T021: Get by workspace slug
   */
  async getByWorkspaceSlug(slug: string): Promise<License | null> {
    const stmt = this.masterDb.prepare(`
      SELECT * FROM licenses WHERE workspace_slug = ? AND deleted_at IS NULL
    `)

    const result = stmt.get(slug) as any
    return result ? this.mapToLicense(result) : null
  }

  /**
   * T021: Count by product
   */
  async countByProduct(product_id: string): Promise<number> {
    const stmt = this.masterDb.prepare(`
      SELECT COUNT(*) as count FROM licenses 
      WHERE product_id = ? AND deleted_at IS NULL
    `)

    const result = stmt.get(product_id) as any
    return result?.count || 0
  }

  /**
   * T021: Find expired soft locks (for cron tasks)
   */
  async findExpiredSoftLocks(): Promise<License[]> {
    const stmt = this.masterDb.prepare(`
      SELECT * FROM licenses 
      WHERE status = ? AND soft_lock_until IS NOT NULL AND soft_lock_until < NOW()
      AND deleted_at IS NULL
    `)

    const results = stmt.all(LicenseStatus.SOFT_LOCKED) as any[]
    return results.map((r) => this.mapToLicense(r))
  }

  /**
   * T022: Get platform schema version
   */
  async getPlatformSchemaVersion(): Promise<number> {
    const stmt = this.masterDb.prepare(`
      SELECT MAX(version) as version FROM schema_versions
    `)

    const result = stmt.get() as any
    const version = result?.version || 0

    if (version === 0) {
      throw new Error('No migrations executed yet')
    }

    return version
  }

  /**
   * T035: Transaction wrapper
   *
   * Wraps operations in a transaction with rollback on error.
   */
  async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    try {
      this.masterDb.exec('BEGIN TRANSACTION')
      const result = await callback()
      this.masterDb.exec('COMMIT')
      return result
    } catch (error) {
      this.masterDb.exec('ROLLBACK')
      throw error
    }
  }

  /**
   * Helper: Map database row to License object
   */
  private mapToLicense(row: any): License {
    return {
      id: row.id,
      product_id: row.product_id,
      workspace_slug: row.workspace_slug,
      workspace_name: row.workspace_name,
      student_limit: row.student_limit,
      staff_limit: row.staff_limit,
      use_zidney_payment: Boolean(row.use_zidney_payment),
      commission_per_user: row.commission_per_user,
      default_language: row.default_language,
      uses_divisions: Boolean(row.uses_divisions),
      status: row.status as LicenseStatus,
      soft_lock_until: row.soft_lock_until
        ? new Date(row.soft_lock_until)
        : null,
      archived_at: row.archived_at ? new Date(row.archived_at) : null,
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
      schema_version: row.schema_version,
      product_version: row.product_version,
      provisioning_error: row.provisioning_error,
      provisioning_retries: row.provisioning_retries,
      provisioning_last_attempt_at: row.provisioning_last_attempt_at
        ? new Date(row.provisioning_last_attempt_at)
        : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }
  }
}

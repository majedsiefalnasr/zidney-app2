/**
 * License Repository (Data Access Layer)
 *
 * File: packages/domain-core/src/licenses/repository.ts
 * Tasks: T016-T022
 *
 * Implements data access operations for license entity.
 * All database queries use parameterized statements to prevent SQL injection.
 */

import { ALLOWED_STATE_TRANSITIONS } from './constants'
import { InvalidStateTransitionError, LicenseNotFoundError, LicenseValidationError } from './errors'
import { type License, LicenseStatus } from './types'

interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
}

export interface MasterDbClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<T>>
}

export class LicenseRepository {
  constructor(private masterDb: MasterDbClient) {}

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
      const result = await this.masterDb.query(
        `
        INSERT INTO licenses (
          id, product_id, workspace_slug, workspace_name, student_limit, staff_limit,
          use_zidney_payment, commission_per_user, default_language, uses_divisions,
          status, schema_version, product_version, provisioning_retries,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING *
      `,
        [
          data.id,
          data.product_id,
          data.workspace_slug,
          data.workspace_name,
          data.student_limit,
          data.staff_limit,
          data.use_zidney_payment,
          data.commission_per_user,
          data.default_language,
          data.uses_divisions,
          LicenseStatus.PENDING_PROVISION,
          data.schema_version,
          data.product_version,
          0,
        ]
      )

      return this.mapToLicense(result.rows[0])
    } catch (error: any) {
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        throw LicenseValidationError.slugNotUnique()
      }
      throw error
    }
  }

  /**
   * T017: Get license by ID
   */
  async getById(id: string): Promise<License | null> {
    const result = await this.masterDb.query(
      `
      SELECT * FROM licenses WHERE id = $1 AND deleted_at IS NULL
    `,
      [id]
    )

    return result.rows[0] ? this.mapToLicense(result.rows[0]) : null
  }

  /**
   * T018: List methods - List by status with pagination
   */
  async listByStatus(status: LicenseStatus, limit: number, offset: number): Promise<License[]> {
    const result = await this.masterDb.query(
      `
      SELECT * FROM licenses
      WHERE status = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [status, limit, offset]
    )

    return result.rows.map((row) => this.mapToLicense(row))
  }

  /**
   * T018: List by product
   */
  async listByProduct(product_id: string, limit: number, offset: number): Promise<License[]> {
    const result = await this.masterDb.query(
      `
      SELECT * FROM licenses
      WHERE product_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [product_id, limit, offset]
    )

    return result.rows.map((row) => this.mapToLicense(row))
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
    const whereConditions: string[] = ['deleted_at IS NULL']
    const params: unknown[] = []

    if (filters.status) {
      params.push(filters.status)
      whereConditions.push(`status = $${params.length}`)
    }

    if (filters.product_id) {
      params.push(filters.product_id)
      whereConditions.push(`product_id = $${params.length}`)
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`
      params.push(searchTerm, searchTerm)
      whereConditions.push(
        `(workspace_slug ILIKE $${params.length - 1} OR workspace_name ILIKE $${params.length})`
      )
    }

    const whereClause = whereConditions.join(' AND ')

    const countResult = await this.masterDb.query<{ count: number | string }>(
      `SELECT COUNT(*)::int as count FROM licenses WHERE ${whereClause}`,
      params
    )
    const total = Number(countResult.rows[0]?.count || 0)

    const paginatedParams = [...params, pagination.limit, pagination.offset]
    const itemsResult = await this.masterDb.query(
      `
      SELECT * FROM licenses
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `,
      paginatedParams
    )

    return {
      items: itemsResult.rows.map((row) => this.mapToLicense(row)),
      total,
    }
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
    if (
      'product_id' in data ||
      'workspace_slug' in data ||
      'schema_version' in data ||
      'product_version' in data
    ) {
      throw LicenseValidationError.invalidFieldEdit()
    }

    const updates: string[] = []
    const values: unknown[] = []

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        values.push(value)
        updates.push(`${key} = $${values.length}`)
      }
    }

    if (updates.length === 0) {
      const license = await this.getById(id)
      if (!license) throw new LicenseNotFoundError(id)
      return license
    }

    updates.push('updated_at = NOW()')
    values.push(id)

    const result = await this.masterDb.query(
      `
      UPDATE licenses
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `,
      values
    )

    if (!result.rows[0]) throw new LicenseNotFoundError(id)

    return this.mapToLicense(result.rows[0])
  }

  /**
   * T019: Update status
   */
  async updateStatus(id: string, status: LicenseStatus): Promise<License> {
    const result = await this.masterDb.query(
      `
      UPDATE licenses
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [status, id]
    )

    if (!result.rows[0]) throw new LicenseNotFoundError(id)

    return this.mapToLicense(result.rows[0])
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
    const result = await this.masterDb.query(
      `
      UPDATE licenses
      SET status = $1, soft_lock_until = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
      [LicenseStatus.SOFT_LOCKED, softLockUntil, id]
    )

    return this.mapToLicense(result.rows[0])
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

    const result = await this.masterDb.query(
      `
      UPDATE licenses
      SET status = $1, soft_lock_until = NULL, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [LicenseStatus.ACTIVE, id]
    )

    return this.mapToLicense(result.rows[0])
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

    const result = await this.masterDb.query(
      `
      UPDATE licenses
      SET status = $1, archived_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [LicenseStatus.ARCHIVED, id]
    )

    return this.mapToLicense(result.rows[0])
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

    const result = await this.masterDb.query(
      `
      UPDATE licenses
      SET status = $1, archived_at = NULL, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [LicenseStatus.ACTIVE, id]
    )

    return this.mapToLicense(result.rows[0])
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

    const result = await this.masterDb.query(
      `
      UPDATE licenses
      SET status = $1, deleted_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [LicenseStatus.DELETED, id]
    )

    return this.mapToLicense(result.rows[0])
  }

  /**
   * T021: Get by workspace slug
   */
  async getByWorkspaceSlug(slug: string): Promise<License | null> {
    const result = await this.masterDb.query(
      `
      SELECT * FROM licenses WHERE workspace_slug = $1 AND deleted_at IS NULL
    `,
      [slug]
    )

    return result.rows[0] ? this.mapToLicense(result.rows[0]) : null
  }

  /**
   * T021: Count by product
   */
  async countByProduct(product_id: string): Promise<number> {
    const result = await this.masterDb.query<{ count: number | string }>(
      `
      SELECT COUNT(*)::int as count FROM licenses
      WHERE product_id = $1 AND deleted_at IS NULL
    `,
      [product_id]
    )

    return Number(result.rows[0]?.count || 0)
  }

  /**
   * T021: Find expired soft locks (for cron tasks)
   */
  async findExpiredSoftLocks(): Promise<License[]> {
    const result = await this.masterDb.query(
      `
      SELECT * FROM licenses
      WHERE status = $1 AND soft_lock_until IS NOT NULL AND soft_lock_until < NOW()
      AND deleted_at IS NULL
    `,
      [LicenseStatus.SOFT_LOCKED]
    )

    return result.rows.map((row) => this.mapToLicense(row))
  }

  /**
   * T022: Get platform schema version
   */
  async getPlatformSchemaVersion(): Promise<number> {
    const result = await this.masterDb.query<{
      version: number | string | null
    }>(
      `
      SELECT MAX(version) as version FROM schema_versions
    `
    )

    const version = Number(result.rows[0]?.version || 0)

    if (version === 0) {
      throw new Error('No migrations executed yet')
    }

    return version
  }

  /**
   * T035: Transaction wrapper
   *
   * Assumes a transaction-capable query executor (same underlying connection).
   */
  async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    try {
      await this.masterDb.query('BEGIN')
      const result = await callback()
      await this.masterDb.query('COMMIT')
      return result
    } catch (error) {
      await this.masterDb.query('ROLLBACK')
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
      soft_lock_until: row.soft_lock_until ? new Date(row.soft_lock_until) : null,
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

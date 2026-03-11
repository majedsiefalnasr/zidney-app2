/**
 * License Resolver
 *
 * File: packages/domain-core/src/license/resolver.ts
 * Task: T004 – Create License Resolver (Domain-Core)
 *
 * Queries master database for licenses.
 * Implements Redis cache with 5-minute TTL.
 * Used by license middleware and limit enforcement.
 *
 * Cache Key Format: license:{workspace_slug}
 * TTL: 300 seconds (5 minutes)
 * Fallback: On cache miss, query DB
 *
 * Query: SELECT * FROM licenses WHERE workspace_slug = $1 LIMIT 1
 * These queries are parameterized to prevent SQL injection.
 */

import type { License, LicenseStatus, ValidationResult } from './types'
import { LicenseStatus as LicenseStatusEnum } from './types'

const CACHE_TTL_SECONDS = 300

interface LicenseRow {
  id: string
  product_id: string
  workspace_id: string
  workspace_slug: string
  student_limit: number
  staff_limit: number
  status: LicenseStatus
  soft_lock_until: string | Date | null
  archived_at: string | Date | null
  deleted_at: string | Date | null
  expected_schema_version: string
  expected_product_version: string
  created_at: string | Date
  updated_at: string | Date
}

interface MasterDbLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: LicenseRow[] }>
}

interface RedisLike {
  get(key: string): Promise<string | null>
  setex(key: string, seconds: number, value: string): Promise<unknown>
  del(key: string): Promise<unknown>
}

interface LoggerLike {
  debug(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

/**
 * LicenseResolver class
 *
 * Responsibility:
 * - Query licenses from master DB
 * - Cache results in Redis (5min TTL)
 * - Validate license status and versions
 * - Return structured validation results
 *
 * All queries parameterized (no SQL injection risk).
 */
export class LicenseResolver {
  private masterDb: MasterDbLike
  private redis: RedisLike
  private logger: LoggerLike

  constructor(masterDb: MasterDbLike, redis: RedisLike, logger: LoggerLike) {
    this.masterDb = masterDb
    this.redis = redis
    this.logger = logger
  }

  /**
   * Get license by workspace slug
   *
   * @param workspace_slug - Globally unique workspace identifier
   * @returns License object or null if not found
   *
   * Flow:
   * 1. Validate input (non-empty)
   * 2. Check Redis cache
   * 3. If cache hit, return cached license
   * 4. If cache miss, query master DB
   * 5. Parse row data into License object
   * 6. Cache result for 5 minutes
   * 7. Return license
   */
  async getLicenseBySlug(workspace_slug: string): Promise<License | null> {
    if (!workspace_slug || workspace_slug.length === 0) {
      this.logger.warn('getLicenseBySlug: empty workspace_slug', {
        workspace_slug,
      })
      return null
    }

    const cacheKey = `license:${workspace_slug}`

    try {
      // Try cache first
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        this.logger.debug('License cache hit', { workspace_slug })
        return JSON.parse(cached) as License
      }

      // Cache miss: query DB (parameterized query)
      this.logger.debug('License cache miss, querying DB', { workspace_slug })
      const result = await this.masterDb.query(
        `
        SELECT
          id, product_id, workspace_id, workspace_slug, student_limit, staff_limit,
          status, soft_lock_until, archived_at, deleted_at,
          expected_schema_version, expected_product_version,
          created_at, updated_at
        FROM licenses
        WHERE workspace_slug = $1
        LIMIT 1
        `,
        [workspace_slug]
      )

      if (result.rows.length === 0) {
        this.logger.debug('License not found in DB', { workspace_slug })
        return null
      }

      const license = this.mapRowToLicense(result.rows[0]!)

      // Cache result for 5 minutes (after successful query)
      await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(license))

      return license
    } catch (error) {
      this.logger.error('getLicenseBySlug: database error', {
        workspace_slug,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Get license by workspace ID
   *
   * @param workspace_id - UUID
   * @returns License object or null
   */
  async getLicenseByWorkspaceId(workspace_id: string): Promise<License | null> {
    try {
      const result = await this.masterDb.query(
        `
        SELECT
          id, product_id, workspace_id, workspace_slug, student_limit, staff_limit,
          status, soft_lock_until, archived_at, deleted_at,
          expected_schema_version, expected_product_version,
          created_at, updated_at
        FROM licenses
        WHERE workspace_id = $1
        LIMIT 1
        `,
        [workspace_id]
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToLicense(result.rows[0]!)
    } catch (error) {
      this.logger.error('getLicenseByWorkspaceId: database error', {
        workspace_id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Validate license status
   *
   * Returns ValidationResult with:
   * - valid: boolean
   * - status: LicenseStatus
   * - error_code: string | undefined
   * - http_status: number | undefined
   *
   * @param workspace_slug - Globally unique workspace identifier
   * @returns ValidationResult
   */
  async validateLicenseStatus(workspace_slug: string): Promise<ValidationResult> {
    const license = await this.getLicenseBySlug(workspace_slug)

    if (!license) {
      return {
        valid: false,
        status: LicenseStatusEnum.DELETED,
        error_code: 'LICENSE_NOT_FOUND',
        error_message: 'License not found for workspace',
        http_status: 404,
      }
    }

    switch (license.status) {
      case LicenseStatusEnum.ACTIVE:
        return { valid: true, status: license.status }

      case LicenseStatusEnum.SOFT_LOCKED:
        // Check if soft-lock has expired
        if (license.soft_lock_until && new Date() > license.soft_lock_until) {
          return {
            valid: false,
            status: license.status,
            error_code: 'LICENSE_SOFT_LOCKED_EXPIRED',
            error_message: 'Workspace access temporarily suspended (soft-lock expired)',
            http_status: 403,
          }
        }
        return {
          valid: false,
          status: license.status,
          error_code: 'LICENSE_SOFT_LOCKED',
          error_message: 'Workspace access temporarily suspended',
          http_status: 423,
        }

      case LicenseStatusEnum.ARCHIVED:
        return {
          valid: false,
          status: license.status,
          error_code: 'LICENSE_ARCHIVED',
          error_message: 'Workspace is archived and no longer accessible',
          http_status: 403,
        }

      case LicenseStatusEnum.DELETED:
        return {
          valid: false,
          status: license.status,
          error_code: 'LICENSE_DELETED',
          error_message: 'Workspace license has been deleted',
          http_status: 404,
        }

      default:
        return {
          valid: false,
          status: license.status,
          error_code: 'LICENSE_INVALID_STATUS',
          error_message: `Workspace is in invalid state: ${license.status}`,
          http_status: 403,
        }
    }
  }

  /**
   * Validate version compatibility
   *
   * Checks if tenant schema version is compatible with license expected version.
   * Forward-compatible logic: tenant can be ahead of license.
   *
   * @param workspace_slug - Workspace identifier
   * @param tenant_schema_version - Actual tenant schema version (e.g., "1.0.0")
   * @returns true if compatible, false otherwise
   *
   * Logic: tenant_schema_version >= license.expected_schema_version
   */
  async validateVersions(workspace_slug: string, tenant_schema_version: string): Promise<boolean> {
    const license = await this.getLicenseBySlug(workspace_slug)

    if (!license) {
      this.logger.warn('validateVersions: license not found', {
        workspace_slug,
      })
      return false
    }

    // Parse semantic versions
    const tenantParts = this.parseSemVer(tenant_schema_version)
    const licenseParts = this.parseSemVer(license.expected_schema_version)

    if (!tenantParts || !licenseParts) {
      this.logger.error('validateVersions: invalid semver format', {
        tenant_schema_version,
        license_expected: license.expected_schema_version,
      })
      return false
    }

    // Forward-compatible: tenant >= license (clarification Q3)
    const compatible = this.compareVersions(tenantParts, licenseParts) >= 0

    this.logger.debug('validateVersions result', {
      workspace_slug,
      tenant_schema_version,
      license_expected: license.expected_schema_version,
      compatible,
    })

    return compatible
  }

  /**
   * Invalidate license cache
   *
   * Called after license state transitions to bust cache.
   * Ensures next lookup queries fresh from DB.
   *
   * @param workspace_slug - Workspace identifier
   */
  async invalidateCache(workspace_slug: string): Promise<void> {
    const cacheKey = `license:${workspace_slug}`
    await this.redis.del(cacheKey)
    this.logger.debug('License cache invalidated', { workspace_slug })
  }

  /**
   * Parse semantic version string into numeric components
   *
   * @param version - Version string (e.g., "1.2.3" or "1.2.3-beta.1")
   * @returns { major, minor, patch } or null if invalid
   */
  private parseSemVer(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!match) return null

    const [, majorStr, minorStr, patchStr] = match
    if (!majorStr || !minorStr || !patchStr) return null

    return {
      major: parseInt(majorStr, 10),
      minor: parseInt(minorStr, 10),
      patch: parseInt(patchStr, 10),
    }
  }

  /**
   * Compare two semantic versions
   *
   * @param v1 - Version 1 { major, minor, patch }
   * @param v2 - Version 2 { major, minor, patch }
   * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  private compareVersions(
    v1: { major: number; minor: number; patch: number },
    v2: { major: number; minor: number; patch: number }
  ): number {
    if (v1.major !== v2.major) return v1.major > v2.major ? 1 : -1
    if (v1.minor !== v2.minor) return v1.minor > v2.minor ? 1 : -1
    if (v1.patch !== v2.patch) return v1.patch > v2.patch ? 1 : -1
    return 0
  }

  /**
   * Map database row to License object
   *
   * @param row - Database row
   * @returns License object with proper types
   */
  private mapRowToLicense(row: LicenseRow): License {
    return {
      id: row.id,
      product_id: row.product_id,
      workspace_id: row.workspace_id,
      workspace_slug: row.workspace_slug,
      student_limit: row.student_limit,
      staff_limit: row.staff_limit,
      status: row.status as LicenseStatus,
      soft_lock_until: row.soft_lock_until ? new Date(row.soft_lock_until) : null,
      archived_at: row.archived_at ? new Date(row.archived_at) : null,
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
      expected_schema_version: row.expected_schema_version,
      expected_product_version: row.expected_product_version,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }
  }
}

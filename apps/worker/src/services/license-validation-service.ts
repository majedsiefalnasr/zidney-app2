/**
 * License Validation Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Validates license before provisioning.
 * Checks: existence, status, expiry, schema/product version compatibility.
 * Prevents provisioning of invalid/expired licenses.
 */

import { Pool } from 'pg'

/**
 * License validation result
 */
export interface LicenseValidationResult {
  valid: boolean
  licenseExists?: boolean
  isActive?: boolean
  isExpired?: boolean
  schemaVersion?: string
  productVersion?: string
  reason?: string
  durationMs?: number
}

/**
 * License data from database
 */
interface LicenseRecord {
  id: string
  status: string
  schema_version: string
  product_version: string
  created_at: string
  expires_at: string
}

/**
 * License Validation Service
 */
export class LicenseValidationService {
  private masterDb: Pool
  private logger?: any
  private requiredSchemaVersion: string = '1.0.0'
  private requiredProductVersion: string = '1.0.0'

  constructor(masterDb: Pool, logger?: any) {
    this.masterDb = masterDb
    this.logger = logger
  }

  /**
   * Validate license for provisioning
   */
  async validateLicense(licenseId: string): Promise<LicenseValidationResult> {
    const startTime = Date.now()

    try {
      // Query license from master database
      const result = await this.masterDb.query<LicenseRecord>(
        `SELECT id, status, schema_version, product_version, created_at, expires_at
         FROM licenses
         WHERE id = $1`,
        [licenseId]
      )

      if (result.rowCount === 0) {
        this.logger?.logValidationError('License not found', {
          license_id: licenseId,
        })

        return {
          valid: false,
          licenseExists: false,
          reason: 'License does not exist',
          durationMs: Date.now() - startTime,
        }
      }

      const license = result.rows[0]!

      // Check if license is in a valid state for provisioning
      if (license.status === 'DELETED' || license.status === 'ARCHIVED') {
        this.logger?.logValidationError('License in invalid state', {
          license_id: licenseId,
          status: license.status,
        })

        return {
          valid: false,
          licenseExists: true,
          reason: `License is ${license.status}`,
          durationMs: Date.now() - startTime,
        }
      }

      // Check expiration
      if (license.expires_at) {
        const expiresAt = new Date(license.expires_at)
        if (expiresAt < new Date()) {
          this.logger?.logValidationError('License expired', {
            license_id: licenseId,
            expires_at: license.expires_at,
          })

          return {
            valid: false,
            licenseExists: true,
            isExpired: true,
            reason: 'License has expired',
            durationMs: Date.now() - startTime,
          }
        }
      }

      // Check schema version compatibility
      if (license.schema_version) {
        const compatible = this.isSchemaVersionCompatible(
          license.schema_version,
          this.requiredSchemaVersion
        )

        if (!compatible) {
          this.logger?.logValidationError('Schema version incompatible', {
            license_id: licenseId,
            license_schema_version: license.schema_version,
            required_schema_version: this.requiredSchemaVersion,
          })

          return {
            valid: false,
            licenseExists: true,
            schemaVersion: license.schema_version,
            reason: `Schema version ${license.schema_version} incompatible with required ${this.requiredSchemaVersion}`,
            durationMs: Date.now() - startTime,
          }
        }
      }

      // Check product version compatibility
      if (license.product_version) {
        const compatible = this.isProductVersionCompatible(
          license.product_version,
          this.requiredProductVersion
        )

        if (!compatible) {
          this.logger?.logValidationError('Product version incompatible', {
            license_id: licenseId,
            license_product_version: license.product_version,
            required_product_version: this.requiredProductVersion,
          })

          return {
            valid: false,
            licenseExists: true,
            productVersion: license.product_version,
            reason: `Product version ${license.product_version} incompatible`,
            durationMs: Date.now() - startTime,
          }
        }
      }

      this.logger?.logStep(
        'license-validation-pass',
        'License validation successful',
        {
          license_id: licenseId,
          status: license.status,
          schema_version: license.schema_version,
          product_version: license.product_version,
        }
      )

      return {
        valid: true,
        licenseExists: true,
        isActive:
          license.status === 'ACTIVE' || license.status === 'PENDING_PROVISION',
        schemaVersion: license.schema_version,
        productVersion: license.product_version,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      this.logger?.logError(
        'License validation error',
        error instanceof Error ? error : new Error(String(error)),
        { license_id: licenseId }
      )

      return {
        valid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Check if schema version is compatible (major.minor.patch)
   * Accepts: same major version, equal or greater minor version
   */
  private isSchemaVersionCompatible(
    licenseVersion: string,
    requiredVersion: string
  ): boolean {
    try {
      const [licenseMajor, licenseMinor] = licenseVersion
        .split('.')
        .map(Number) as [number, number]
      const [requiredMajor, requiredMinor] = requiredVersion
        .split('.')
        .map(Number) as [number, number]

      // Same major version, license minor >= required minor
      if (licenseMajor === requiredMajor) {
        return licenseMinor >= requiredMinor
      }

      // Greater major version is compatible
      return licenseMajor > requiredMajor
    } catch {
      return false
    }
  }

  /**
   * Check if product version is compatible
   * Immutable: license product_version cannot change, so must match exactly
   */
  private isProductVersionCompatible(
    licenseVersion: string,
    requiredVersion: string
  ): boolean {
    // Product version is immutable, must match
    return licenseVersion === requiredVersion
  }

  /**
   * Set required schema version (for testing/configuration)
   */
  setRequiredSchemaVersion(version: string): void {
    this.requiredSchemaVersion = version
  }

  /**
   * Set required product version (for testing/configuration)
   */
  setRequiredProductVersion(version: string): void {
    this.requiredProductVersion = version
  }
}

/**
 * Factory to create license validation service
 */
export function createLicenseValidationService(
  masterDb: Pool,
  logger?: any
): LicenseValidationService {
  return new LicenseValidationService(masterDb, logger)
}

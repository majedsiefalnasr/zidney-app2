import { createHash } from 'crypto'
import { readFileSync } from 'fs'

/**
 * T053: Migration Validator
 * Validates migration safety and compatibility
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate migration viability
 * @param fromVersion - Current schema version
 * @param toVersion - Target schema version
 * @param backwardCompatibilityMap - Map of breaking changes per version
 * @returns Validation result
 */
export function validateMigration(
  fromVersion: string,
  toVersion: string,
  backwardCompatibilityMap?: Record<string, boolean>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check version format
  const versionRegex = /^\d+\.\d+\.\d+$/
  if (!versionRegex.test(fromVersion)) {
    errors.push(`Invalid from version format: ${fromVersion}`)
  }
  if (!versionRegex.test(toVersion)) {
    errors.push(`Invalid to version format: ${toVersion}`)
  }

  // Parse versions
  const fromParts = fromVersion.split('.').map(Number) as [
    number,
    number,
    number,
  ]
  const toParts = toVersion.split('.').map(Number) as [number, number, number]

  // Check version ordering (to > from)
  if (
    toParts[0] < fromParts[0] ||
    (toParts[0] === fromParts[0] && toParts[1] < fromParts[1]) ||
    (toParts[0] === fromParts[0] &&
      toParts[1] === fromParts[1] &&
      toParts[2] < fromParts[2])
  ) {
    errors.push(
      `Target version ${toVersion} must be greater than current version ${fromVersion}`
    )
  }

  // Check for major version incompatibility
  if (toParts[0] > fromParts[0]) {
    warnings.push(
      `Major version change detected (${fromVersion} → ${toVersion}). Rollback may not be possible.`
    )

    if (backwardCompatibilityMap?.[toVersion] === false) {
      errors.push(
        `Major version ${toParts[0]} is not backward compatible with ${fromParts[0]}`
      )
    }
  }

  // Check for skipped minor versions (potential missing migrations)
  if (toParts[0] === fromParts[0]) {
    const minorDiff = toParts[1] - fromParts[1]
    if (minorDiff > 1) {
      warnings.push(
        `Skipping ${minorDiff - 1} minor versions. Ensure intermediate migrations exist.`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate migration file exists and is readable
 */
export function validateMigrationFile(filePath: string): {
  valid: boolean
  error?: string
} {
  try {
    readFileSync(filePath, 'utf-8')
    return { valid: true }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return { valid: false, error: `Migration file not found: ${filePath}` }
    }
    if (err.code === 'EACCES') {
      return {
        valid: false,
        error: `Permission denied reading migration: ${filePath}`,
      }
    }
    return {
      valid: false,
      error: `Failed to read migration file: ${err.message}`,
    }
  }
}

/**
 * Validate migration checksum matches
 */
export function validateMigrationChecksum(
  filePath: string,
  expectedChecksum: string
): { valid: boolean; calculatedChecksum?: string; error?: string } {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const calculated = createHash('sha256').update(content).digest('hex')

    if (calculated !== expectedChecksum) {
      return {
        valid: false,
        calculatedChecksum: calculated,
        error: `Checksum mismatch. Expected ${expectedChecksum}, got ${calculated}. Migration may have been tampered with.`,
      }
    }

    return { valid: true, calculatedChecksum: calculated }
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to validate checksum: ${err.message}`,
    }
  }
}

/**
 * Validate schema_version table is ready for update
 * (ensures table exists and is accessible)
 */
export async function validateSchemaVersionTable(
  pool: any,
  _workspaceId: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    await pool.query('SELECT version FROM schema_version LIMIT 1')
    return { valid: true }
  } catch (err: any) {
    if (err.code === '42P01') {
      // Table does not exist
      return {
        valid: false,
        error: 'schema_version table does not exist. Initialize schema first.',
      }
    }
    return {
      valid: false,
      error: `Failed to access schema_version table: ${err.message}`,
    }
  }
}

/**
 * Comprehensive migration validation
 */
export async function validateMigrationPath(options: {
  pool: any
  fromVersion: string
  toVersion: string
  migrationFilePath: string
  expectedChecksum: string
}): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  const allErrors: string[] = []
  const allWarnings: string[] = []

  // 1. Validate version format and ordering
  const versionCheck = validateMigration(options.fromVersion, options.toVersion)
  allErrors.push(...versionCheck.errors)
  allWarnings.push(...versionCheck.warnings)

  // 2. Validate file exists
  const fileCheck = validateMigrationFile(options.migrationFilePath)
  if (!fileCheck.valid) {
    allErrors.push(fileCheck.error || 'Migration file validation failed')
  }

  // 3. Validate checksum
  const checksumCheck = validateMigrationChecksum(
    options.migrationFilePath,
    options.expectedChecksum
  )
  if (!checksumCheck.valid) {
    allErrors.push(checksumCheck.error || 'Checksum validation failed')
  }

  // 4. Validate schema_version table
  const tableCheck = await validateSchemaVersionTable(
    options.pool,
    'workspace_id'
  )
  if (!tableCheck.valid) {
    allErrors.push(tableCheck.error || 'Schema version table validation failed')
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  }
}

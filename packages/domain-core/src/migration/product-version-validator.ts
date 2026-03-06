/**
 * Product version validator
 * Validates migration product version requirements
 */

import type { MigrationFile } from '@zidney/types'
import { isCompatible } from '@zidney/validation'

/**
 * Validate product version compatibility before migration execution
 * @throws Error if product version incompatible
 */
export function validateProductVersionCompatibility(
  migrationFile: MigrationFile,
  currentProductVersion: string
): void {
  // If migration has no product version requirement, skip validation
  if (!migrationFile.targetProductVersion) {
    return
  }

  const requiredProductVersion = migrationFile.targetProductVersion

  // Check compatibility: current ≥ required
  if (!isCompatible(currentProductVersion, requiredProductVersion)) {
    const error = new Error(
      `Migration ${migrationFile.filename} requires product version >= ${requiredProductVersion}. Current: ${currentProductVersion}`
    )
    ;(error as any).errorCode = 'PRODUCT_VERSION_INCOMPATIBLE'
    ;(error as any).statusCode = 400
    throw error
  }
}

/**
 * Extract product version requirement from migration file header
 * Format: "-- Required Minimum Product Version: X.Y.Z"
 */
export function extractProductVersionRequirement(sqlContent: string): string | undefined {
  const match = sqlContent.match(/--\s*Required\s+Minimum\s+Product\s+Version:\s*(\d+\.\d+\.\d+)/i)
  return match ? match[1] : undefined
}

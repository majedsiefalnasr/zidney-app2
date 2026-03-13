/**
 * Master Database Utility Functions
 *
 * File: packages/types/src/master-db-utils.ts
 * Task: T016
 * Phase: 3 - TypeScript Type Definitions
 *
 * Exports:
 * - parseVersion() - Parse and validate semantic version
 * - isVersionCompatible() - Check version compatibility
 * - isLicenseActive() - Check license state
 * - compareVersions() - Compare two versions
 */

import { LicenseStatus } from './master-db'

// ========================================================================
// VERSION COMPARISON UTILITIES
// ========================================================================

export interface SemanticVersion {
  major: number
  minor: number
  patch: number
}

/**
 * Parse semantic version string to components
 *
 * Input: "1.2.3"
 * Output: { major: 1, minor: 2, patch: 3 }
 *
 * @throws Error if version format is invalid
 */
export function parseVersion(versionString: string): SemanticVersion {
  const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(
      `Invalid semantic version format: "${versionString}". Expected X.Y.Z (e.g., "1.0.0")`
    )
  }

  // Destructure matched groups to avoid non-null assertions (forbidden by lint rules)
  const [, majorStr, minorStr, patchStr] = match

  // Ensure captured groups are present (defensive check to satisfy TS narrowing)
  if (majorStr === undefined || minorStr === undefined || patchStr === undefined) {
    throw new Error(`Invalid semantic version format: "${versionString}". Expected X.Y.Z`)
  }

  return {
    major: parseInt(majorStr, 10),
    minor: parseInt(minorStr, 10),
    patch: parseInt(patchStr, 10),
  }
}

/**
 * Compare two semantic versions
 *
 * Returns:
 * - -1 if v1 < v2
 * -  0 if v1 === v2
 * -  1 if v1 > v2
 *
 * @example
 * compareVersions("1.0.0", "1.1.0") // -1 (v1 is less)
 * compareVersions("2.0.0", "1.9.9") // 1 (v1 is greater)
 */
export function compareVersions(v1: string, v2: string): -1 | 0 | 1 {
  const ver1 = parseVersion(v1)
  const ver2 = parseVersion(v2)

  // Compare major
  if (ver1.major !== ver2.major) {
    return ver1.major > ver2.major ? 1 : -1
  }

  // Compare minor
  if (ver1.minor !== ver2.minor) {
    return ver1.minor > ver2.minor ? 1 : -1
  }

  // Compare patch
  if (ver1.patch !== ver2.patch) {
    return ver1.patch > ver2.patch ? 1 : -1
  }

  return 0
}

/**
 * Check if requested version is compatible with minimum supported version
 *
 * Compatibility rule: requestedVersion >= minimumVersion
 *
 * @example
 * isVersionCompatible("1.5.0", "1.0.0") // true (1.5.0 >= 1.0.0)
 * isVersionCompatible("1.0.0", "1.5.0") // false (1.0.0 < 1.5.0)
 * isVersionCompatible("1.0.0", "1.0.0") // true (equal is compatible)
 */
export function isVersionCompatible(requestedVersion: string, minimumVersion: string): boolean {
  const comparison = compareVersions(requestedVersion, minimumVersion)
  return comparison >= 0 // equal or greater
}

// ========================================================================
// LICENSE STATUS UTILITIES
// ========================================================================

/**
 * Check if license is in ACTIVE state
 *
 * @example
 * isLicenseActive(LicenseStatus.ACTIVE) // true
 * isLicenseActive(LicenseStatus.SOFT_LOCKED) // false
 */
export function isLicenseActive(status: LicenseStatus): boolean {
  return status === LicenseStatus.ACTIVE
}

/**
 * Check if license is in SOFT_LOCKED state
 */
export function isLicenseSoftLocked(status: LicenseStatus): boolean {
  return status === LicenseStatus.SOFT_LOCKED
}

/**
 * Check if license is in ARCHIVED state
 */
export function isLicenseArchived(status: LicenseStatus): boolean {
  return status === LicenseStatus.ARCHIVED
}

/**
 * Check if license can still be used (ACTIVE state only)
 *
 * Soft-locked licenses cannot be used (just in grace period)
 */
export function canLicenseBeUsed(status: LicenseStatus): boolean {
  return isLicenseActive(status)
}

export default {
  parseVersion,
  compareVersions,
  isVersionCompatible,
  isLicenseActive,
  isLicenseSoftLocked,
  isLicenseArchived,
  canLicenseBeUsed,
}

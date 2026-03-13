/**
 * Semantic Version validator and comparison functions
 * Pure functions, no side effects, SemVer 2.0.0 compliance
 * Restricted to X.Y.Z format only (no pre-releases, no build metadata)
 */

import type { SemVer } from '@zidney/types'

/**
 * Parse version string "X.Y.Z" into SemVer object
 * @param versionString - Version string (e.g., "1.2.3")
 * @returns Parsed SemVer object
 * @throws Error if format is invalid
 *
 * Examples:
 *   parseVersion("1.0.0") → {major: 1, minor: 0, patch: 0}
 *   parseVersion("1.0.0-alpha") → throws Error (pre-release not allowed)
 *   parseVersion("1") → throws Error (incomplete version)
 */
export function parseVersion(versionString: string): SemVer {
  if (!versionString || typeof versionString !== 'string') {
    throw new Error('Version string is required and must be a string')
  }

  // Strict format check: X.Y.Z only
  const match = versionString.trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(
      `Invalid version format: "${versionString}". Expected format: X.Y.Z (e.g., "1.0.0")`
    )
  }

  return {
    major: parseInt(match[1] ?? '0', 10),
    minor: parseInt(match[2] ?? '0', 10),
    patch: parseInt(match[3] ?? '0', 10),
  }
}

/**
 * Convert SemVer object back to string "X.Y.Z"
 */
export function semVerToString(version: SemVer): string {
  return `${version.major}.${version.minor}.${version.patch}`
}

/**
 * Compare two versions
 * @param v1 - First version string
 * @param v2 - Second version string
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 *
 * Examples:
 *   compareVersions("1.0.0", "2.0.0") → -1
 *   compareVersions("2.0.0", "1.0.0") → 1
 *   compareVersions("1.0.0", "1.0.0") → 0
 *   compareVersions("1.1.0", "1.0.5") → 1 (minor bump wins over patch)
 */
export function compareVersions(v1: string, v2: string): -1 | 0 | 1 {
  const sem1 = parseVersion(v1)
  const sem2 = parseVersion(v2)

  if (sem1.major !== sem2.major) {
    return sem1.major < sem2.major ? -1 : 1
  }
  if (sem1.minor !== sem2.minor) {
    return sem1.minor < sem2.minor ? -1 : 1
  }
  if (sem1.patch !== sem2.patch) {
    return sem1.patch < sem2.patch ? -1 : 1
  }
  return 0
}

/**
 * Check if tenant version is compatible (≥ minimum required)
 * @param tenantVersion - Current tenant version (e.g., "1.5.0")
 * @param minimumRequired - Minimum required version (e.g., "1.0.0")
 * @returns true if compatible (tenant ≥ minimum)
 *
 * Examples:
 *   isCompatible("2.0.0", "1.0.0") → true
 *   isCompatible("1.0.0", "2.0.0") → false
 *   isCompatible("1.0.0", "1.0.0") → true
 */
export function isCompatible(tenantVersion: string, minimumRequired: string): boolean {
  return compareVersions(tenantVersion, minimumRequired) >= 0
}

/**
 * Check if difference is a major version bump
 * @param oldVersion - Old version (e.g., "1.0.0")
 * @param newVersion - New version (e.g., "2.0.0")
 * @returns true if major version changed (not minor/patch only)
 *
 * Examples:
 *   isMajorBump("1.0.0", "2.0.0") → true
 *   isMajorBump("1.0.0", "1.1.0") → false
 */
export function isMajorBump(oldVersion: string, newVersion: string): boolean {
  const sem1 = parseVersion(oldVersion)
  const sem2 = parseVersion(newVersion)
  return sem1.major !== sem2.major
}

/**
 * Check if difference is a minor version bump (but not major)
 * @param oldVersion - Old version (e.g., "1.0.0")
 * @param newVersion - New version (e.g., "1.1.0")
 * @returns true if minor version changed (but major stayed same)
 *
 * Examples:
 *   isMinorBump("1.0.0", "1.1.0") → true
 *   isMinorBump("1.0.0", "2.0.0") → false
 *   isMinorBump("1.1.0", "1.1.5") → false
 */
export function isMinorBump(oldVersion: string, newVersion: string): boolean {
  const sem1 = parseVersion(oldVersion)
  const sem2 = parseVersion(newVersion)
  return sem1.major === sem2.major && sem1.minor !== sem2.minor
}

/**
 * Check if difference is a patch version bump (minor & major same)
 * @param oldVersion - Old version (e.g., "1.0.0")
 * @param newVersion - New version (e.g., "1.0.5")
 * @returns true if only patch changed
 *
 * Examples:
 *   isPatchBump("1.0.0", "1.0.5") → true
 *   isPatchBump("1.0.0", "1.1.0") → false
 */
export function isPatchBump(oldVersion: string, newVersion: string): boolean {
  const sem1 = parseVersion(oldVersion)
  const sem2 = parseVersion(newVersion)
  return sem1.major === sem2.major && sem1.minor === sem2.minor && sem1.patch !== sem2.patch
}

/**
 * Validate that upgrade is permitted (target > current, no downgrade)
 * Also checks minimum_supported constraint
 * @param currentVersion - Current version (e.g., "1.0.0")
 * @param targetVersion - Target version (e.g., "2.0.0")
 * @param minimumSupported - Minimum allowed version (e.g., "1.0.0")
 * @returns null if valid, or error message if invalid
 *
 * Examples:
 *   validateUpgrade("1.0.0", "2.0.0", "1.0.0") → null (valid)
 *   validateUpgrade("2.0.0", "1.0.0", "1.0.0") → "Cannot downgrade..." (invalid)
 *   validateUpgrade("1.0.0", "1.0.0", "1.0.0") → "Target must be..." (invalid)
 *   validateUpgrade("0.5.0", "2.0.0", "1.0.0") → "Below minimum..." (invalid)
 */
export function validateUpgrade(
  currentVersion: string,
  targetVersion: string,
  minimumSupported: string
): null | string {
  // Validate formats
  try {
    parseVersion(currentVersion)
    parseVersion(targetVersion)
    parseVersion(minimumSupported)
  } catch (err: unknown) {
    return `Invalid version format: ${err instanceof Error ? err.message : String(err)}`
  }

  // Target must be > current
  if (compareVersions(targetVersion, currentVersion) <= 0) {
    return `Target version must be greater than current version (${currentVersion}). Downgrades are not permitted.`
  }

  // Target must be >= minimum_supported
  if (!isCompatible(targetVersion, minimumSupported)) {
    return `Target version (${targetVersion}) is below minimum supported version (${minimumSupported}).`
  }

  return null
}

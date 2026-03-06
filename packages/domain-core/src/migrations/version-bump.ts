/**
 * T051: Version Bumping Utilities
 * Semantic versioning helpers (ADR-0008)
 */

export type ChangeType = 'major' | 'minor' | 'patch'

/**
 * Parse semantic version string
 * @param version - Version string (e.g., "1.2.3")
 * @returns Object with major, minor, patch
 */
export function parseVersion(version: string): {
  major: number
  minor: number
  patch: number
} {
  const parts = version.split('.').map((p) => parseInt(p, 10))
  if (parts.length !== 3 || parts.some((p) => isNaN(p))) {
    throw new Error(`Invalid version format: ${version}. Expected X.Y.Z`)
  }
  return { major: parts[0]!, minor: parts[1]!, patch: parts[2]! }
}

/**
 * Bump version according to semantic versioning
 * @param currentVersion - Current version (e.g., "1.0.0")
 * @param changeType - Type of change: 'major', 'minor', or 'patch'
 * @returns New version string
 */
export function bumpVersion(currentVersion: string, changeType: ChangeType): string {
  const parsed = parseVersion(currentVersion)

  switch (changeType) {
    case 'major':
      // 1.2.3 → 2.0.0
      return `${parsed.major + 1}.0.0`
    case 'minor':
      // 1.2.3 → 1.3.0
      return `${parsed.major}.${parsed.minor + 1}.0`
    case 'patch':
      // 1.2.3 → 1.2.4
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`
    default:
      throw new Error(`Invalid change type: ${changeType}`)
  }
}

/**
 * Compare two versions
 * @param v1 - First version
 * @param v2 - Second version
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): -1 | 0 | 1 {
  const p1 = parseVersion(v1)
  const p2 = parseVersion(v2)

  if (p1.major !== p2.major) {
    return p1.major < p2.major ? -1 : 1
  }
  if (p1.minor !== p2.minor) {
    return p1.minor < p2.minor ? -1 : 1
  }
  if (p1.patch !== p2.patch) {
    return p1.patch < p2.patch ? -1 : 1
  }

  return 0
}

/**
 * Check if version is valid (exists, parse-able)
 */
export function isValidVersion(version: string): boolean {
  try {
    parseVersion(version)
    return true
  } catch {
    return false
  }
}

/**
 * Get all intermediate versions between two versions
 * Useful for validating migration path
 */
export function getVersionsBetween(fromVersion: string, toVersion: string): string[] {
  const from = parseVersion(fromVersion)
  const to = parseVersion(toVersion)

  if (from.major > to.major) {
    throw new Error(`Cannot migrate backwards: ${fromVersion} → ${toVersion}`)
  }

  if (compareVersions(fromVersion, toVersion) === 0) {
    return [fromVersion]
  }

  const versions: string[] = []
  const current = from

  // Generate versions from current to target
  while (
    current.major < to.major ||
    (current.major === to.major && current.minor < to.minor) ||
    (current.major === to.major && current.minor === to.minor && current.patch < to.patch)
  ) {
    versions.push(`${current.major}.${current.minor}.${current.patch}`)

    // Increment patch first
    if (current.patch < to.patch && current.major === to.major && current.minor === to.minor) {
      current.patch++
    } else if (current.minor < to.minor && current.major === to.major) {
      // Increment minor if we haven't reached target minor
      current.minor++
      current.patch = 0
    } else if (current.major < to.major) {
      // Increment major
      current.major++
      current.minor = 0
      current.patch = 0
    }
  }

  versions.push(`${to.major}.${to.minor}.${to.patch}`)
  return versions
}

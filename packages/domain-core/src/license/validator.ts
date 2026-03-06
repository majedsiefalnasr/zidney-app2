/**
 * Version Validator
 *
 * File: packages/domain-core/src/license/validator.ts
 * Task: T005 – Create Version Validator (Domain-Core)
 *
 * Validates schema and product version compatibility.
 * Per ADR-0008: Forward-compatible schema versioning.
 * SemVer comparison for product versions.
 *
 * Schema Version Logic: tenant >= license (forward-compatible)
 * Product Version Logic: MAJOR.MINOR matching (per ADR-0008)
 */

/**
 * VersionValidator class
 *
 * Responsibility:
 * - Validate schema version compatibility
 * - Validate product version compatibility
 * - Return boolean results
 */
export class VersionValidator {
  /**
   * Validate schema version compatibility
   *
   * Forward-compatible logic (Clarification Q3):
   * - If tenant.schema_version >= license.expected_schema_version → ALLOW (true)
   * - If tenant.schema_version < license.expected_schema_version → BLOCK (false)
   *
   * Rationale (ADR-0001):
   * - Tenant ahead of license: OK (runtime code handles old license contracts)
   * - Tenant behind license: NOT OK (runtime code assumes minimum version features)
   *
   * @param tenant_version - Actual tenant schema version (e.g., "1.2.0")
   * @param license_expected - License expected schema version (e.g., "1.0.0")
   * @returns true if compatible, false otherwise
   */
  validateSchemaVersion(tenant_version: string, license_expected: string): boolean {
    const tenant = this.parseSemVer(tenant_version)
    const license = this.parseSemVer(license_expected)

    if (!tenant || !license) {
      return false
    }

    const compare = this.compareVersions(tenant, license)
    const valid = compare >= 0

    return valid
  }

  /**
   * Validate product version compatibility
   *
   * Per ADR-0008: Semantic versioning compatibility.
   * - MAJOR version must match (breaking changes)
   * - MINOR/PATCH can differ (backward-compatible features)
   *
   * Examples:
   * - License 1.x + Runtime 1.y → COMPATIBLE
   * - License 2.x + Runtime 1.y → INCOMPATIBLE
   * - License 1.5 + Runtime 1.8 → COMPATIBLE
   *
   * @param license_version - License product version (e.g., "1.5.0")
   * @param runtime_version - Runtime product version (e.g., "1.8.2")
   * @returns true if compatible, false otherwise
   */
  validateProductVersion(license_version: string, runtime_version: string): boolean {
    const license = this.parseSemVer(license_version)
    const runtime = this.parseSemVer(runtime_version)

    if (!license || !runtime) {
      return false
    }

    // ADR-0008: MAJOR version must match
    return license.major === runtime.major
  }

  /**
   * Parse semantic version string into numeric components
   *
   * Supports:
   * - 1.0.0
   * - 1.2.3-alpha.1
   * - 1.2.3-beta.1
   * - 1.2.3-rc.1
   *
   * @param version - Version string
   * @returns { major, minor, patch } or null if invalid
   */
  private parseSemVer(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!match) {
      return null
    }

    return {
      major: parseInt(match[1]!, 10),
      minor: parseInt(match[2]!, 10),
      patch: parseInt(match[3]!, 10),
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
}

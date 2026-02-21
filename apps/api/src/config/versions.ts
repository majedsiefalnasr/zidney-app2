/**
 * Version Constants Configuration
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T011
 *
 * Centralizes version compatibility rules for:
 * - Schema versioning (tenant database schema)
 * - Product versioning (app version compatibility)
 *
 * Used by:
 * - License middleware: Validate version compatibility before DB access
 * - Attempt engine: Store version at start for deterministic grading
 * - Worker grading: Verify version compatibility before grading
 *
 * ADRs: ADR-0007 (version compatibility), ADR-0008 (semantic versioning)
 */

/**
 * Schema Version Constants
 *
 * Schema version is incremented with each database migration.
 * Attempt engine snapshots the schema version at attempt start
 * to ensure deterministic grading even through versions.
 */
export const SCHEMA_VERSION = {
  /**
   * Minimum schema version supported by current app
   *
   * Attempts created with older schema versions
   * will be marked as incompatible and scored as 0 with passed=false
   */
  MIN_SUPPORTED: 1,

  /**
   * Current production schema version
   *
   * Bumped by each forward-only migration in:
   * apps/api/src/db/tenant/migrations/v{version}/
   */
  CURRENT: 1,

  /**
   * Human-readable schema version label
   */
  LABEL: '1.0.0',
}

/**
 * Product Version Constants
 *
 * Product version tracks app version compatibility.
 * Compatible within bounds [MIN_PRODUCT, MAX_PRODUCT].
 *
 * Semantic Versioning: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes (grading logic, formula changes)
 * - MINOR: New features (backward compatible)
 * - PATCH: Bug fixes (backward compatible)
 */
export const PRODUCT_VERSION = {
  /**
   * Minimum product version supported
   *
   * Attempts created with older product versions
   * may have different grading formulas; those attempts
   * are re-graded with compatibility layer
   */
  MIN_SUPPORTED: '1.0.0',

  /**
   * Current production product version
   *
   * Bumped in package.json and must match release tag
   */
  CURRENT: '1.0.0',

  /**
   * Maximum product version (compatibility range open-ended)
   *
   * New versions automatically compatible unless breaking change
   * requires explicit version gating
   */
  MAX_SUPPORTED: undefined, // Undefined = infinite (no upper bound)
}

/**
 * Compatibility Matrix
 *
 * Defines which version combinations are valid
 */
export const COMPATIBILITY_RULES = {
  /**
   * Grading behavior changes by version
   *
   * Used when grading an attempt with old product_version
   * to apply version-specific grading logic
   */
  GRADING_BY_VERSION: {
    '1.0.0': {
      // Version 1.0.0 grading: Simple sum-based scoring
      score_computation: 'sum_based',
      pass_logic: 'percentage_based',
      version_label: '1.0.0 (GA)',
    },
  },

  /**
   * Schema compatibility by version
   *
   * Defines which schema migrations are compatible with each version
   */
  SCHEMA_BY_VERSION: {
    1: {
      // Schema v1: Attempt engine foundation (STAGE_06)
      label: '1.0.0',
      compatible_product_versions: ['1.0.0'],
    },
  },
}

/**
 * Version Validation Errors
 *
 * Error codes for version incompatibility
 */
export const VERSION_ERRORS = {
  SCHEMA_TOO_OLD: 'SCHEMA_VERSION_INCOMPATIBLE',
  SCHEMA_TOO_NEW: 'SCHEMA_VERSION_INCOMPATIBLE',
  PRODUCT_TOO_OLD: 'PRODUCT_VERSION_INCOMPATIBLE',
  PRODUCT_TOO_NEW: 'PRODUCT_VERSION_INCOMPATIBLE',
} as const

/**
 * Utility: Validate schema version compatibility
 *
 * @param schemaVersion - Version to check (from workspace schema_metadata)
 * @returns Object with validation result and reason
 */
export function validateSchemaVersion(schemaVersion: number): {
  compatible: boolean
  reason?: string
} {
  if (schemaVersion < SCHEMA_VERSION.MIN_SUPPORTED) {
    return {
      compatible: false,
      reason: `Schema version ${schemaVersion} is too old (minimum: ${SCHEMA_VERSION.MIN_SUPPORTED})`,
    }
  }

  if (schemaVersion > SCHEMA_VERSION.CURRENT) {
    return {
      compatible: false,
      reason: `Schema version ${schemaVersion} is ahead of current (current: ${SCHEMA_VERSION.CURRENT})`,
    }
  }

  return { compatible: true }
}

/**
 * Utility: Validate product version compatibility
 *
 * @param productVersion - Version string to check (e.g., "1.0.0")
 * @returns Object with validation result and reason
 */
export function validateProductVersion(productVersion: string): {
  compatible: boolean
  reason?: string
} {
  // Parse semantic version
  const versionMatch = productVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!versionMatch) {
    return {
      compatible: false,
      reason: `Invalid version format: ${productVersion} (expected MAJOR.MINOR.PATCH)`,
    }
  }

  const [, major] = versionMatch.map(Number)
  const currentMatch = PRODUCT_VERSION.CURRENT.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!currentMatch) {
    return {
      compatible: false,
      reason: 'Invalid current version format (internal error)',
    }
  }

  const [, currentMajor] = currentMatch.map(Number)

  // Version compatibility logic:
  // - Same MAJOR version: forward and backward compatible
  // - Different MAJOR version: incompatible
  if (major !== currentMajor) {
    return {
      compatible: false,
      reason: `Product version ${productVersion} (major: ${major}) incompatible with current ${PRODUCT_VERSION.CURRENT} (major: ${currentMajor})`,
    }
  }

  return { compatible: true }
}

/**
 * Utility: Get grading logic for product version
 *
 * Returns version-specific grading behavior to ensure
 * deterministic grading across version boundaries.
 *
 * @param productVersion - Product version string
 * @returns Grading configuration for this version
 */
export function getVersionGradingConfig(productVersion: string): any {
  const versionMatch = productVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!versionMatch) {
    // Default to current if unable to parse
    return COMPATIBILITY_RULES.GRADING_BY_VERSION[PRODUCT_VERSION.CURRENT]
  }

  // Look up version-specific grading config
  // For 1.x versions, all use 1.0.0 grading logic
  const majorVersion = parseInt(versionMatch[1], 10)
  if (majorVersion === 1) {
    return COMPATIBILITY_RULES.GRADING_BY_VERSION['1.0.0']
  }

  // Default to current
  return COMPATIBILITY_RULES.GRADING_BY_VERSION[PRODUCT_VERSION.CURRENT]
}

/**
 * Utility: Format version info for logging
 *
 * @returns Version information object
 */
export function getVersionInfo(): {
  app_version: string
  schema_version: number
  schema_label: string
  min_schema_version: number
  min_product_version: string
  compatibility: string
} {
  return {
    app_version: PRODUCT_VERSION.CURRENT,
    schema_version: SCHEMA_VERSION.CURRENT,
    schema_label: SCHEMA_VERSION.LABEL,
    min_schema_version: SCHEMA_VERSION.MIN_SUPPORTED,
    min_product_version: PRODUCT_VERSION.MIN_SUPPORTED,
    compatibility: 'Version 1.0.0 GA',
  }
}

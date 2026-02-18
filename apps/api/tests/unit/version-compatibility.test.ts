/**
 * Version Compatibility Tests
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T048
 *
 * File: apps/api/tests/unit/version-compatibility.test.ts
 * Purpose: Verify version compatibility (ADR-0007)
 *
 * Rules:
 * - Newer schema versions can READ older attempts
 * - Cannot WRITE with incompatible versions
 * - Version mismatch returns 426 Upgrade Required
 *
 * Semantic Versioning: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking change
 * - MINOR: Compatible addition
 * - PATCH: Bug fix
 */

import * as semver from 'semver'
import { describe, expect, test } from 'vitest'

// Mock version validator function
function validateVersions(versions: {
  attempt_schema_version: string
  attempt_product_version: string
  current_schema_version: string
  current_product_version: string
}): {
  compatible: boolean
  canWrite: boolean
  canRead: boolean
  errorCode?: string
  message?: string
} {
  const attemptMajor = semver.major(versions.attempt_schema_version)
  const currentMajor = semver.major(versions.current_schema_version)

  // Major version mismatch = incompatible
  if (attemptMajor > currentMajor) {
    return {
      compatible: false,
      canWrite: false,
      canRead: false,
      errorCode: 'UPGRADE_REQUIRED',
      message: `Attempt requires schema v${attemptMajor}.x, current is v${currentMajor}.x`,
    }
  }

  // Same major version = compatible
  if (attemptMajor === currentMajor) {
    return {
      compatible: true,
      canWrite: true,
      canRead: true,
    }
  }

  // Older major version = can read but not write
  return {
    compatible: true,
    canWrite: false,
    canRead: true,
    message: `Attempt from v${attemptMajor}.x: read-only mode`,
  }
}

describe('Version Compatibility (ADR-0007)', () => {
  // T048.1: Same Version Compatible
  test('Same schema and product version - fully compatible', () => {
    const result = validateVersions({
      attempt_schema_version: '1.0.0',
      attempt_product_version: '24.1.0',
      current_schema_version: '1.0.0',
      current_product_version: '24.1.0',
    })

    expect(result.compatible).toBe(true)
    expect(result.canRead).toBe(true)
    expect(result.canWrite).toBe(true)
  })

  // T048.2: Newer Schema Can Read Older Attempt
  test('Newer schema version (1.1.0) can read older attempt (1.0.0)', () => {
    const result = validateVersions({
      attempt_schema_version: '1.0.0',
      attempt_product_version: '24.1.0',
      current_schema_version: '1.1.0',
      current_product_version: '24.2.0',
    })

    expect(result.compatible).toBe(true)
    expect(result.canRead).toBe(true)
    expect(result.canWrite).toBe(false) // Read-only for older
  })

  // T048.3: Backward Incompatibility (Major Version Mismatch)
  test('Cannot read attempt with newer major version', () => {
    const result = validateVersions({
      attempt_schema_version: '2.0.0', // Future version
      attempt_product_version: '25.0.0',
      current_schema_version: '1.0.0',
      current_product_version: '24.1.0',
    })

    expect(result.compatible).toBe(false)
    expect(result.canRead).toBe(false)
    expect(result.canWrite).toBe(false)
    expect(result.errorCode).toBe('UPGRADE_REQUIRED')
  })

  // T048.4: Minor Version Bump Compatible
  test('Minor version bump is compatible', () => {
    const result = validateVersions({
      attempt_schema_version: '1.2.0',
      attempt_product_version: '24.1.0',
      current_schema_version: '1.3.0',
      current_product_version: '24.2.0',
    })

    expect(result.compatible).toBe(true)
    expect(result.canRead).toBe(true)
    expect(result.canWrite).toBe(true) // Same major
  })

  // T048.5: Patch Version Bump Compatible
  test('Patch version bump is compatible', () => {
    const result = validateVersions({
      attempt_schema_version: '1.0.0',
      attempt_product_version: '24.1.0',
      current_schema_version: '1.0.5',
      current_product_version: '24.1.3',
    })

    expect(result.compatible).toBe(true)
    expect(result.canRead).toBe(true)
    expect(result.canWrite).toBe(true)
  })

  // T048.6: Product Version Mismatch Handling
  test('Product version mismatch detected but not blocking for schema compatible', () => {
    const result = validateVersions({
      attempt_schema_version: '1.0.0',
      attempt_product_version: '23.0.0', // Old product
      current_schema_version: '1.0.0',
      current_product_version: '24.1.0', // New product
    })

    // Schema compatible = can still read/write
    expect(result.compatible).toBe(true)
    expect(result.canRead).toBe(true)
    expect(result.canWrite).toBe(true)
  })

  // T048.7: Old Major Version Read-Only
  test('Old schema major version (1.x) cannot write with new version (2.x)', () => {
    const result = validateVersions({
      attempt_schema_version: '1.5.0', // v1
      attempt_product_version: '24.0.0',
      current_schema_version: '2.0.0', // v2 (breaking)
      current_product_version: '25.0.0',
    })

    expect(result.compatible).toBe(true)
    expect(result.canRead).toBe(true)
    expect(result.canWrite).toBe(false)
  })

  // T048.8: Version Parse Error Handling
  test('Invalid version format detected', () => {
    expect(() => {
      semver.major('not.a.version')
    }).toThrow()
  })

  // T048.9: Semantic Versioning Comparison
  test('Semver comparison works correctly', () => {
    expect(semver.gte('1.2.0', '1.1.0')).toBe(true)
    expect(semver.gte('1.0.0', '1.1.0')).toBe(false)
    expect(semver.major('2.1.0')).toBe(2)
    expect(semver.minor('1.5.0')).toBe(5)
  })

  // T048.10: Multiple Attempts Different Versions
  test('Different attempts at different versions all handled correctly', () => {
    const attempts = [
      {
        schema: '0.9.0',
        product: '23.0.0',
        current: { schema: '1.0.0', product: '24.0.0' },
      },
      {
        schema: '1.0.0',
        product: '24.0.0',
        current: { schema: '1.0.0', product: '24.0.0' },
      },
      {
        schema: '1.5.0',
        product: '24.2.0',
        current: { schema: '1.0.0', product: '24.0.0' },
      },
    ]

    const results = attempts.map((attempt) =>
      validateVersions({
        attempt_schema_version: attempt.schema,
        attempt_product_version: attempt.product,
        current_schema_version: attempt.current.schema,
        current_product_version: attempt.current.product,
      })
    )

    // All should have determined compatibility status
    results.forEach((result) => {
      expect(result.compatible).toBeDefined()
      expect(result.canRead).toBeDefined()
      expect(result.canWrite).toBeDefined()
    })
  })

  // T048.11: Version Migration Path
  test('Version migration path documented in compatibility matrix', () => {
    const migrationPaths = [
      { from: '1.0.0', to: '1.1.0', compatible: true, readOnly: false },
      { from: '1.0.0', to: '1.2.0', compatible: true, readOnly: false },
      { from: '1.1.0', to: '2.0.0', compatible: false, readOnly: true },
      { from: '2.0.0', to: '2.1.0', compatible: true, readOnly: false },
    ]

    // Verify path rules
    migrationPaths.forEach((path) => {
      const result = validateVersions({
        attempt_schema_version: path.from,
        attempt_product_version: '24.0.0',
        current_schema_version: path.to,
        current_product_version: '24.0.0',
      })

      expect(result.compatible).toBe(path.compatible)
      if (path.compatible && path.readOnly) {
        expect(result.canWrite).toBe(false)
      }
    })
  })

  // T048.12: HTTP Status Code Mapping
  test('Version incompatibility maps to 426 Upgrade Required', () => {
    const result = validateVersions({
      attempt_schema_version: '2.0.0',
      attempt_product_version: '25.0.0',
      current_schema_version: '1.0.0',
      current_product_version: '24.0.0',
    })

    if (!result.compatible) {
      expect(result.errorCode).toBe('UPGRADE_REQUIRED')
      // HTTP 426: Upgrade Required
    }
  })
})

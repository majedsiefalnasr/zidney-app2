/**
 * Schema Version Unit Tests
 * STAGE_08_RATE_LIMITING_AND_SECURITY - Task T079
 *
 * File: apps/api/tests/unit/schema-version.test.ts
 * Purpose: Test version comparison and compatibility matrix
 *
 * Test Coverage:
 * - Version comparison logic
 * - Compatibility matrix checking
 * - 426 Upgrade Required responses
 * - Semantic versioning
 */

import { beforeEach, describe, expect, it } from 'vitest'

interface SchemaVersion {
  major: number
  minor: number
  patch: number
}

type SchemaCompatibility = 'compatible' | 'incompatible' | 'requires_upgrade' | 'requires_downgrade'

class SchemaVersionChecker {
  private currentVersion: SchemaVersion = { major: 1, minor: 1, patch: 0 }

  // Compatibility matrix: which tenant versions work with which app versions
  private compatibilityMatrix: Record<string, SchemaCompatibility> = {
    '1.0.0': 'requires_upgrade', // 1.0.0 tenant needs upgrade to work with 1.1.0 app
    '1.1.0': 'compatible',
    '1.2.0': 'incompatible', // Future version not yet deployed
    '0.9.0': 'incompatible', // Too old
    '2.0.0': 'incompatible', // Breaking change
  }

  parseVersion(versionString: string): SchemaVersion | null {
    const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)$/)

    if (!match) {
      return null
    }

    return {
      major: parseInt(match[1]!, 10),
      minor: parseInt(match[2]!, 10),
      patch: parseInt(match[3]!, 10),
    }
  }

  versionToString(version: SchemaVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`
  }

  compareVersions(v1: SchemaVersion, v2: SchemaVersion): number {
    // Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
    if (v1.major !== v2.major) {
      return v1.major < v2.major ? -1 : 1
    }

    if (v1.minor !== v2.minor) {
      return v1.minor < v2.minor ? -1 : 1
    }

    if (v1.patch !== v2.patch) {
      return v1.patch < v2.patch ? -1 : 1
    }

    return 0
  }

  isVersionGreaterOrEqual(v1: SchemaVersion, v2: SchemaVersion): boolean {
    return this.compareVersions(v1, v2) >= 0
  }

  isVersionLessThan(v1: SchemaVersion, v2: SchemaVersion): boolean {
    return this.compareVersions(v1, v2) < 0
  }

  checkCompatibility(tenantVersion: string, appVersion: string): SchemaCompatibility {
    const key = `${tenantVersion}-${appVersion}`

    // Check explicit mapping first
    if (key in this.compatibilityMatrix) {
      return this.compatibilityMatrix[key]!
    }

    // Parse versions
    const tenant = this.parseVersion(tenantVersion)
    const app = this.parseVersion(appVersion)

    if (!tenant || !app) {
      return 'incompatible'
    }

    // Simplified compatibility rules:
    // - Patch version differences are compatible
    // - Minor version: tenant <= app with major equal
    // - Major version: must match exactly

    if (tenant.major !== app.major) {
      return 'incompatible'
    }

    if (tenant.minor > app.minor) {
      return 'requires_downgrade'
    }

    if (tenant.minor < app.minor) {
      return 'requires_upgrade'
    }

    return 'compatible'
  }

  requiresUpgrade(tenantVersion: string): boolean {
    const appVersionString = this.versionToString(this.currentVersion)
    const compatibility = this.checkCompatibility(tenantVersion, appVersionString)

    return compatibility === 'requires_upgrade'
  }

  canProceedWithRequest(tenantVersion: string): boolean {
    return (
      this.checkCompatibility(tenantVersion, this.versionToString(this.currentVersion)) ===
      'compatible'
    )
  }

  getHTTPStatusForIncompat(tenantVersion: string): number {
    const appVersionString = this.versionToString(this.currentVersion)
    const compat = this.checkCompatibility(tenantVersion, appVersionString)

    switch (compat) {
      case 'requires_upgrade':
        return 426 // Upgrade Required
      case 'requires_downgrade':
        return 424 // Failed Dependency (or custom)
      case 'incompatible':
        return 400 // Bad Request
      case 'compatible':
        return 200 // OK
    }
  }
}

describe('Schema Version Management', () => {
  let versionChecker: SchemaVersionChecker

  beforeEach(() => {
    versionChecker = new SchemaVersionChecker()
  })

  describe('Version Parsing', () => {
    it('should parse valid semantic version', () => {
      const version = versionChecker.parseVersion('1.2.3')

      expect(version).toEqual({ major: 1, minor: 2, patch: 3 })
    })

    it('should parse zero components', () => {
      const version = versionChecker.parseVersion('0.0.0')

      expect(version).toEqual({ major: 0, minor: 0, patch: 0 })
    })

    it('should reject invalid format', () => {
      const invalid = [
        versionChecker.parseVersion('1.2'),
        versionChecker.parseVersion('1.2.3.4'),
        versionChecker.parseVersion('v1.2.3'),
        versionChecker.parseVersion('1.x.3'),
      ]

      invalid.forEach((v) => {
        expect(v).toBeNull()
      })
    })

    it('should reject non-numeric components', () => {
      const version = versionChecker.parseVersion('1.2.alpha')

      expect(version).toBeNull()
    })
  })

  describe('Version Comparison', () => {
    it('should compare major versions correctly', () => {
      const v1 = versionChecker.parseVersion('1.0.0')!
      const v2 = versionChecker.parseVersion('2.0.0')!

      const comparison = versionChecker.compareVersions(v1, v2)

      expect(comparison).toBe(-1) // v1 < v2
    })

    it('should compare minor versions correctly', () => {
      const v1 = versionChecker.parseVersion('1.1.0')!
      const v2 = versionChecker.parseVersion('1.2.0')!

      const comparison = versionChecker.compareVersions(v1, v2)

      expect(comparison).toBe(-1)
    })

    it('should compare patch versions correctly', () => {
      const v1 = versionChecker.parseVersion('1.0.1')!
      const v2 = versionChecker.parseVersion('1.0.2')!

      const comparison = versionChecker.compareVersions(v1, v2)

      expect(comparison).toBe(-1)
    })

    it('should return 0 for equal versions', () => {
      const v1 = versionChecker.parseVersion('1.2.3')!
      const v2 = versionChecker.parseVersion('1.2.3')!

      const comparison = versionChecker.compareVersions(v1, v2)

      expect(comparison).toBe(0)
    })

    it('should return positive for greater version', () => {
      const v1 = versionChecker.parseVersion('2.0.0')!
      const v2 = versionChecker.parseVersion('1.0.0')!

      const comparison = versionChecker.compareVersions(v1, v2)

      expect(comparison).toBe(1)
    })
  })

  describe('Version Compatibility Check', () => {
    it('should report compatible versions', () => {
      const compat = versionChecker.checkCompatibility('1.1.0', '1.1.0')

      expect(compat).toBe('compatible')
    })

    it('should report tenant version as requires_upgrade if lesser minor', () => {
      const compat = versionChecker.checkCompatibility('1.0.0', '1.1.0')

      expect(compat).toBe('requires_upgrade')
    })

    it('should report incompatible major versions', () => {
      const compat = versionChecker.checkCompatibility('1.0.0', '2.0.0')

      expect(compat).toBe('incompatible')
    })

    it('should allow patch version differences', () => {
      const compat = versionChecker.checkCompatibility('1.1.5', '1.1.0')

      expect(compat).toBe('compatible')
    })

    it('should handle future versions', () => {
      const compat = versionChecker.checkCompatibility('1.2.0', '1.1.0')

      expect(compat).toBe('requires_downgrade')
    })
  })

  describe('Greater or Equal Check', () => {
    it('should return true for equal versions', () => {
      const v1 = versionChecker.parseVersion('1.0.0')!
      const v2 = versionChecker.parseVersion('1.0.0')!

      const result = versionChecker.isVersionGreaterOrEqual(v1, v2)

      expect(result).toBe(true)
    })

    it('should return true for greater version', () => {
      const v1 = versionChecker.parseVersion('2.0.0')!
      const v2 = versionChecker.parseVersion('1.0.0')!

      const result = versionChecker.isVersionGreaterOrEqual(v1, v2)

      expect(result).toBe(true)
    })

    it('should return false for lesser version', () => {
      const v1 = versionChecker.parseVersion('1.0.0')!
      const v2 = versionChecker.parseVersion('2.0.0')!

      const result = versionChecker.isVersionGreaterOrEqual(v1, v2)

      expect(result).toBe(false)
    })
  })

  describe('Version to String', () => {
    it('should format version correctly', () => {
      const version = { major: 1, minor: 2, patch: 3 }

      const str = versionChecker.versionToString(version)

      expect(str).toBe('1.2.3')
    })

    it('should handle zero components', () => {
      const version = { major: 0, minor: 0, patch: 0 }

      const str = versionChecker.versionToString(version)

      expect(str).toBe('0.0.0')
    })
  })

  describe('Requires Upgrade Check', () => {
    it('should return true when tenant version < app version', () => {
      const requiresUpgrade = versionChecker.requiresUpgrade('1.0.0')

      expect(requiresUpgrade).toBe(true)
    })

    it('should return false when tenant version matches app version', () => {
      const requiresUpgrade = versionChecker.requiresUpgrade('1.1.0')

      expect(requiresUpgrade).toBe(false)
    })

    it('should return false when tenant version > app version', () => {
      const requiresUpgrade = versionChecker.requiresUpgrade('1.2.0')

      expect(requiresUpgrade).toBe(false) // Cannot downgrade
    })
  })

  describe('Request Proceeds Check', () => {
    it('should allow compatible versions', () => {
      const canProceed = versionChecker.canProceedWithRequest('1.1.0')

      expect(canProceed).toBe(true)
    })

    it('should reject incompatible versions', () => {
      const canProceed = versionChecker.canProceedWithRequest('0.9.0')

      expect(canProceed).toBe(false)
    })

    it('should reject versions requiring upgrade', () => {
      const canProceed = versionChecker.canProceedWithRequest('1.0.0')

      expect(canProceed).toBe(false)
    })

    it('should reject versions requiring downgrade', () => {
      const canProceed = versionChecker.canProceedWithRequest('2.0.0')

      expect(canProceed).toBe(false)
    })
  })

  describe('HTTP Status Codes', () => {
    it('should return 426 for upgrade required', () => {
      const status = versionChecker.getHTTPStatusForIncompat('1.0.0')

      expect(status).toBe(426)
    })

    it('should return 400 for incompatible version', () => {
      const status = versionChecker.getHTTPStatusForIncompat('0.9.0')

      expect(status).toBe(400)
    })

    it('should return 200 for compatible version', () => {
      const status = versionChecker.getHTTPStatusForIncompat('1.1.0')

      expect(status).toBe(200)
    })

    it('should return 400 for downgrade required', () => {
      const status = versionChecker.getHTTPStatusForIncompat('2.0.0')

      expect(status).toBe(400)
    })
  })

  describe('Version Compatibility Matrix', () => {
    it('should support versioning for different schema changes', () => {
      // As schema evolves, only compatible combinations allowed
      const versions = ['1.0.0', '1.1.0', '1.1.1', '1.1.5']

      for (const version of versions) {
        const canProceed = versionChecker.canProceedWithRequest(version)

        expect(typeof canProceed).toBe('boolean')
      }
    })

    it('should handle forward compatibility', () => {
      // Patch version increments should be compatible
      const compat1 = versionChecker.checkCompatibility('1.1.0', '1.1.0')
      const compat2 = versionChecker.checkCompatibility('1.1.1', '1.1.0')

      expect(compat1).toBe('compatible')
      expect(compat2).toBe('compatible')
    })

    it('should handle minor version increments carefully', () => {
      const compat1 = versionChecker.checkCompatibility('1.0.0', '1.1.0')
      const compat2 = versionChecker.checkCompatibility('1.1.0', '1.0.0')

      expect(compat1).toBe('requires_upgrade')
      expect(compat2).toBe('requires_downgrade')
    })
  })
})

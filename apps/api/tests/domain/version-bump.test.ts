import { describe, expect, it } from 'vitest'
import {
  bumpVersion,
  compareVersions,
  getVersionsBetween,
  parseVersion,
} from '~/migrations/version-bump'

/**
 * T058: Version Bumping Unit Tests
 * Validates semantic versioning functions (ADR-0008)
 */

describe('Version Bumping Utilities', () => {
  describe('parseVersion', () => {
    it('T058-1: Parse valid version string', () => {
      const result = parseVersion('1.2.3')
      expect(result).toEqual({ major: 1, minor: 2, patch: 3 })
    })

    it('T058-2: Reject invalid version format', () => {
      expect(() => parseVersion('1.2')).toThrow()
      expect(() => parseVersion('abc')).toThrow()
      expect(() => parseVersion('1.2.3.4')).toThrow()
    })
  })

  describe('bumpVersion', () => {
    it('T058-3: Bump patch version: 1.0.0 → 1.0.1', () => {
      const result = bumpVersion('1.0.0', 'patch')
      expect(result).toBe('1.0.1')
    })

    it('T058-4: Bump minor version: 1.0.0 → 1.1.0', () => {
      const result = bumpVersion('1.0.0', 'minor')
      expect(result).toBe('1.1.0')
    })

    it('T058-5: Bump major version: 1.0.0 → 2.0.0', () => {
      const result = bumpVersion('1.0.0', 'major')
      expect(result).toBe('2.0.0')
    })

    it('T058-6: Complex version bumping chain', () => {
      let version = '1.2.3'
      version = bumpVersion(version, 'patch')
      expect(version).toBe('1.2.4')
      version = bumpVersion(version, 'minor')
      expect(version).toBe('1.3.0')
      version = bumpVersion(version, 'major')
      expect(version).toBe('2.0.0')
    })
  })

  describe('compareVersions', () => {
    it('T058-7: Compare equal versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    })

    it('T058-8: Compare v1 < v2', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1)
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
    })

    it('T058-9: Compare v1 > v2', () => {
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
    })
  })

  describe('getVersionsBetween', () => {
    it('T058-10: Get intermediate versions for patch bump', () => {
      const versions = getVersionsBetween('1.0.0', '1.0.3')
      expect(versions).toContain('1.0.0')
      expect(versions).toContain('1.0.3')
      expect(versions.length).toBeGreaterThanOrEqual(2)
    })

    it('T058-11: Get intermediate versions for minor bump', () => {
      const versions = getVersionsBetween('1.0.0', '1.2.0')
      expect(versions).toContain('1.0.0')
      expect(versions).toContain('1.1.0')
      expect(versions).toContain('1.2.0')
    })

    it('T058-12: Reject backward migration', () => {
      expect(() => getVersionsBetween('1.0.1', '1.0.0')).toThrow()
    })
  })
})

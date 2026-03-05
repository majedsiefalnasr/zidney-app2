/**
 * Unit tests for SemVer validator (Task 40)
 * Tests schema-version-validator functions
 */

import {
  compareVersions,
  isCompatible,
  parseVersion,
  validateUpgrade,
} from '@zidney/validation'

describe('SemVerValidator', () => {
  describe('parseVersion', () => {
    it('parses valid X.Y.Z format', () => {
      const result = parseVersion('1.2.3')
      expect(result).toEqual({ major: 1, minor: 2, patch: 3 })
    })

    it('rejects prerelease formats', () => {
      expect(() => parseVersion('1.0.0-alpha')).toThrow()
      expect(() => parseVersion('1.0.0-beta.1')).toThrow()
    })

    it('rejects incomplete versions', () => {
      expect(() => parseVersion('1.0')).toThrow()
      expect(() => parseVersion('1')).toThrow()
    })

    it('rejects empty/null strings', () => {
      expect(() => parseVersion('')).toThrow()
      expect(() => parseVersion(null as any)).toThrow()
    })
  })

  describe('compareVersions', () => {
    it('returns -1 for v1 < v2', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1)
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    })

    it('returns 1 for v1 > v2', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    })

    it('returns 0 for equal versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
      expect(compareVersions('2.1.5', '2.1.5')).toBe(0)
    })
  })

  describe('isCompatible', () => {
    it('returns true if tenant >= minimum', () => {
      expect(isCompatible('2.0.0', '1.0.0')).toBe(true)
      expect(isCompatible('1.0.0', '1.0.0')).toBe(true)
      expect(isCompatible('1.5.0', '1.0.0')).toBe(true)
    })

    it('returns false if tenant < minimum', () => {
      expect(isCompatible('1.0.0', '2.0.0')).toBe(false)
      expect(isCompatible('0.9.9', '1.0.0')).toBe(false)
    })
  })

  describe('validateUpgrade', () => {
    it('accepts valid upgrade path', () => {
      const result = validateUpgrade('1.0.0', '1.1.0', '1.0.0')
      expect(result).toBeNull()
    })

    it('rejects downgrade', () => {
      const result = validateUpgrade('1.1.0', '1.0.0', '1.0.0')
      expect(result).toContain(
        'Target version must be greater than current version'
      )
    })

    it('rejects target below minimum', () => {
      const result = validateUpgrade('1.0.0', '0.5.0', '1.0.0')
      expect(result).toContain('Downgrades are not permitted')
    })

    it('rejects same version', () => {
      const result = validateUpgrade('1.0.0', '1.0.0', '1.0.0')
      expect(result).toContain('must be greater')
    })
  })
})

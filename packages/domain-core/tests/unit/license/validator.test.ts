import { beforeEach, describe, expect, it } from 'vitest'
import { VersionValidator } from '../../src/license/validator'

/**
 * Test: Version Validator (T034)
 *
 * Unit tests for version compatibility checking.
 * Covers: schema matching, forward compatibility, product validation, mismatches.
 */

describe('VersionValidator', () => {
  let validator: VersionValidator

  beforeEach(() => {
    validator = new VersionValidator()
  })

  // From TEST_INDEX.md: 8 tests for validator
  it('T034.1: Should validate exact schema match', () => {
    const result = validator.validateSchemaVersion('1.0.0', '1.0.0')
    expect(result).toBe(true)
  })

  it('T034.2: Should validate forward-compatible schema (tenant >= license)', () => {
    const result = validator.validateSchemaVersion('1.1.0', '1.0.0')
    expect(result).toBe(true)
  })

  it('T034.3: Should reject backward-incompatible schema (tenant < license)', () => {
    const result = validator.validateSchemaVersion('0.9.0', '1.0.0')
    expect(result).toBe(false)
  })

  it('T034.4: Should validate product version match', () => {
    const result = validator.validateProductVersion('1.0.0', '1.0.0')
    expect(result).toBe(true)
  })

  it('T034.5: Should accept forward-compatible product version', () => {
    const result = validator.validateProductVersion('1.0.0', '1.1.0')
    expect(result).toBe(true) // Runtime is newer
  })

  it('T034.6: Should reject incompatible product version', () => {
    const result = validator.validateProductVersion('1.0.0', '2.0.0')
    expect(result).toBe(false) // Major version mismatch
  })

  it('T034.7: Should handle semver minor version bumps', () => {
    const result1 = validator.validateSchemaVersion('1.10.0', '1.9.0')
    expect(result1).toBe(true)

    const result2 = validator.validateSchemaVersion('1.9.0', '1.10.0')
    expect(result2).toBe(false)
  })

  it('T034.8: Should handle major version differences', () => {
    const result = validator.validateSchemaVersion('2.0.0', '1.9.9')
    expect(result).toBe(true)
  })
})

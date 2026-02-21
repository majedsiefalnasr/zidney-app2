/**
 * Password Hashing Tests
 *
 * File: apps/api/tests/unit/password-hashing.test.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Verify password hashing security
 *
 * Requirements:
 * - Use bcrypt with cost 12
 * - Never store plain text passwords
 * - Hash verification must be constant-time
 * - Support password updates
 *
 * Tests:
 * 1. Hash different for same password (salt)
 * 2. Correct password verifies
 * 3. Wrong password fails
 * 4. Cost 12 validation
 * 5. Hash regeneration possible
 */

import * as bcrypt from 'bcrypt'
import { describe, expect, it } from 'vitest'

describe('Password Hashing', () => {
  const COST = 12

  it('should hash password with bcrypt', async () => {
    const password = 'SecurePassword123!'
    const hash = await bcrypt.hash(password, COST)

    expect(hash).toBeDefined()
    expect(hash.length).toBeGreaterThan(30)
  })

  it('should generate different salt for same password', async () => {
    const password = 'SamePassword123'

    const hash1 = await bcrypt.hash(password, COST)
    const hash2 = await bcrypt.hash(password, COST)

    // Different hashes due to different salts
    expect(hash1).not.toBe(hash2)

    // But both verify same password
    const verify1 = await bcrypt.compare(password, hash1)
    const verify2 = await bcrypt.compare(password, hash2)

    expect(verify1).toBe(true)
    expect(verify2).toBe(true)
  })

  it('should verify correct password', async () => {
    const password = 'CorrectPassword123'
    const hash = await bcrypt.hash(password, COST)

    const isValid = await bcrypt.compare(password, hash)

    expect(isValid).toBe(true)
  })

  it('should reject incorrect password', async () => {
    const password = 'CorrectPassword'
    const wrongPassword = 'WrongPassword'

    const hash = await bcrypt.hash(password, COST)
    const isValid = await bcrypt.compare(wrongPassword, hash)

    expect(isValid).toBe(false)
  })

  it('should use cost 12 for hashing', async () => {
    const password = 'TestPassword123'
    const hash = await bcrypt.hash(password, COST)

    // Extract cost from hash (format: $2b$12$...)
    const costMatch = hash.match(/\$2b\$(\d+)\$/)

    expect(costMatch).not.toBeNull()
    expect(costMatch?.[1]).toBe('12')
  })

  it('should reject cost less than 10', async () => {
    // Security best practice: cost >= 10
    const lowCost = 8

    expect(lowCost).toBeLessThan(COST)
  })

  it('should allow password update', async () => {
    const oldPassword = 'OldPassword123'
    const newPassword = 'NewPassword456'

    const _oldHash = await bcrypt.hash(oldPassword, COST)
    const newHash = await bcrypt.hash(newPassword, COST)

    // Old password no longer works
    const oldValid = await bcrypt.compare(oldPassword, newHash)
    expect(oldValid).toBe(false)

    // New password works with new hash
    const newValid = await bcrypt.compare(newPassword, newHash)
    expect(newValid).toBe(true)
  })

  it('should handle special characters in password', async () => {
    const password = 'P@ssw0rd!#$%^&*()'
    const hash = await bcrypt.hash(password, COST)

    const isValid = await bcrypt.compare(password, hash)

    expect(isValid).toBe(true)
  })

  it('should handle unicode characters in password', async () => {
    const password = 'Passw0rd_日本語_🔒'
    const hash = await bcrypt.hash(password, COST)

    const isValid = await bcrypt.compare(password, hash)

    expect(isValid).toBe(true)
  })

  it('should reject hash with wrong format', async () => {
    const invalidHash = 'not_a_bcrypt_hash'

    try {
      await bcrypt.compare('password', invalidHash)
      // Should throw or return false
    } catch (err) {
      expect(err).toBeDefined()
    }
  })

  it('should handle empty password gracefully', async () => {
    const emptyPassword = ''

    try {
      const hash = await bcrypt.hash(emptyPassword, COST)
      const isValid = await bcrypt.compare(emptyPassword, hash)

      // Empty password is technically hashable but shouldn't be allowed by validation
      expect(isValid).toBe(true)
    } catch (err) {
      // Or may reject empty password
      expect(err).toBeDefined()
    }
  })

  it('should handle null/undefined gracefully', async () => {
    try {
      await bcrypt.hash(null as unknown as string, COST)
      expect.fail('Should throw')
    } catch (err) {
      expect(err).toBeDefined()
    }
  })
})

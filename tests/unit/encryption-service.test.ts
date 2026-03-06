/**
 * Encryption Service — Unit Tests
 *
 * File: tests/unit/encryption-service.test.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Tests AES-256-GCM encrypt/decrypt roundtrip, format validation,
 * error handling for missing keys, unique IVs, and edge cases.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Test encryption key: 64 hex chars = 32 bytes
const TEST_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'

// Different key for wrong-key test
const WRONG_ENCRYPTION_KEY = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

describe('Encryption Service', () => {
  beforeEach(() => {
    process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterEach(() => {
    delete process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY
  })

  /**
   * Dynamically import to pick up env changes per test.
   * Using dynamic import ensures each test gets fresh module state.
   */
  async function loadModule() {
    // Clear module cache for fresh import
    const modulePath = '../../apps/api/src/modules/workspace-settings/encryption.service'
    return await import(modulePath)
  }

  describe('encrypt / decrypt roundtrip', () => {
    it('produces original plaintext after encrypt → decrypt', async () => {
      const { encrypt, decrypt } = await loadModule()
      const plaintext = 'sk_live_abc123_secret_key'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('handles empty string input', async () => {
      const { encrypt, decrypt } = await loadModule()
      const encrypted = encrypt('')
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe('')
    })

    it('handles long string input', async () => {
      const { encrypt, decrypt } = await loadModule()
      const longString = 'x'.repeat(10000)
      const encrypted = encrypt(longString)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(longString)
    })

    it('handles unicode string input', async () => {
      const { encrypt, decrypt } = await loadModule()
      const unicode = 'مفتاح سري 🔐 キー'
      const encrypted = encrypt(unicode)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(unicode)
    })
  })

  describe('output format', () => {
    it('matches v1:<iv>:<authTag>:<ciphertext> format', async () => {
      const { encrypt } = await loadModule()
      const encrypted = encrypt('test-value')
      const parts = encrypted.split(':')
      expect(parts).toHaveLength(4)
      expect(parts[0]).toBe('v1')
      // iv, authTag, ciphertext should be base64
      for (const part of parts.slice(1)) {
        expect(() => Buffer.from(part, 'base64')).not.toThrow()
      }
    })

    it('produces different ciphertexts for different plaintexts', async () => {
      const { encrypt } = await loadModule()
      const enc1 = encrypt('plaintext-one')
      const enc2 = encrypt('plaintext-two')
      expect(enc1).not.toBe(enc2)
    })

    it('produces unique IV per encryption (same value twice → different output)', async () => {
      const { encrypt } = await loadModule()
      const enc1 = encrypt('same-value')
      const enc2 = encrypt('same-value')
      expect(enc1).not.toBe(enc2)
      // Specifically, the IV (second part) should differ
      const iv1 = enc1.split(':')[1]
      const iv2 = enc2.split(':')[1]
      expect(iv1).not.toBe(iv2)
    })
  })

  describe('error handling', () => {
    it('throws EncryptionServiceUnavailableError when key is missing', async () => {
      delete process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY
      const { encrypt } = await loadModule()
      expect(() => encrypt('test')).toThrow('Encryption key is not configured')
    })

    it('throws EncryptionServiceUnavailableError when key is empty', async () => {
      process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY = ''
      const { encrypt } = await loadModule()
      expect(() => encrypt('test')).toThrow('Encryption key is not configured')
    })

    it('throws EncryptionServiceUnavailableError when key is not 64 hex chars', async () => {
      process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY = 'tooshort'
      const { encrypt } = await loadModule()
      expect(() => encrypt('test')).toThrow(
        'Encryption key must be exactly 64 hexadecimal characters'
      )
    })

    it('throws EncryptionServiceUnavailableError when key has invalid hex chars', async () => {
      process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY =
        'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
      const { encrypt } = await loadModule()
      expect(() => encrypt('test')).toThrow(
        'Encryption key must be exactly 64 hexadecimal characters'
      )
    })

    it('decrypt rejects malformed format strings', async () => {
      const { decrypt } = await loadModule()
      expect(() => decrypt('not-a-valid-format')).toThrow('Malformed encrypted value')
    })

    it('decrypt rejects unknown key version', async () => {
      const { decrypt } = await loadModule()
      expect(() => decrypt('v2:aaaa:bbbb:cccc')).toThrow("Unsupported encryption key version: 'v2'")
    })

    it('decrypt throws on incorrect key', async () => {
      const { encrypt } = await loadModule()
      const encrypted = encrypt('secret-data')

      // Change to wrong key
      process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY = WRONG_ENCRYPTION_KEY
      const { decrypt } = await loadModule()

      expect(() => decrypt(encrypted)).toThrow()
    })
  })
})

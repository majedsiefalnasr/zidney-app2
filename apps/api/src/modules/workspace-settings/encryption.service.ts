/**
 * Encryption Service — AES-256-GCM
 *
 * File: apps/api/src/modules/workspace-settings/encryption.service.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Provides encrypt/decrypt for payment credentials at rest.
 * Uses Node.js/Bun built-in `crypto` module — no third-party dependencies.
 *
 * Key format: 64 hex chars → 32 bytes → AES-256
 * Output format: v1:<base64_iv>:<base64_authTag>:<base64_ciphertext>
 * Key identifier `v1` prefix per CL-005 for future rotation support.
 *
 * Guardian Audit Conditions:
 * ✓ Validate encryption key is exactly 64 hex chars at module init
 * ✓ 12-byte random IV per encryption (never reused)
 *
 * Constitutional Compliance:
 * ✓ Key loaded from environment only — never stored in DB
 * ✓ No third-party dependencies
 * ✓ Throws EncryptionServiceUnavailableError if key missing
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { EncryptionServiceUnavailableError } from './workspace-settings.errors'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 12 bytes for GCM (recommended by NIST)
const AUTH_TAG_LENGTH = 16 // 16 bytes (128-bit)
const KEY_VERSION = 'v1'
const KEY_ENV_VAR = 'WORKSPACE_SETTINGS_ENCRYPTION_KEY'

/**
 * Validate and load the encryption key from environment.
 * Key must be exactly 64 hex characters (32 bytes).
 */
function loadEncryptionKey(): Buffer {
  const keyHex = process.env[KEY_ENV_VAR]

  if (!keyHex || keyHex.trim().length === 0) {
    throw new EncryptionServiceUnavailableError(
      'Encryption key is not configured. Set WORKSPACE_SETTINGS_ENCRYPTION_KEY environment variable.'
    )
  }

  const trimmed = keyHex.trim()

  // Guardian audit: validate exactly 64 hex chars
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new EncryptionServiceUnavailableError(
      'Encryption key must be exactly 64 hexadecimal characters (32 bytes).'
    )
  }

  return Buffer.from(trimmed, 'hex')
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: v1:<base64_iv>:<base64_authTag>:<base64_ciphertext>
 * @throws EncryptionServiceUnavailableError if key is missing or invalid
 */
export function encrypt(plaintext: string): string {
  const key = loadEncryptionKey()

  // Generate unique 12-byte IV per encryption (never reused)
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

  const authTag = cipher.getAuthTag()

  // Format: v1:<base64_iv>:<base64_authTag>:<base64_ciphertext>
  return [
    KEY_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypt an encrypted string using AES-256-GCM.
 *
 * @param encryptedValue - Encrypted string in format: v1:<base64_iv>:<base64_authTag>:<base64_ciphertext>
 * @returns Decrypted plaintext string
 * @throws EncryptionServiceUnavailableError if key is missing or invalid
 * @throws Error if encrypted value format is malformed
 */
export function decrypt(encryptedValue: string): string {
  const key = loadEncryptionKey()

  const parts = encryptedValue.split(':')
  if (parts.length !== 4) {
    throw new Error(
      `Malformed encrypted value: expected 4 parts separated by ':', got ${parts.length}.`
    )
  }

  const [version, ivBase64, authTagBase64, ciphertextBase64] = parts

  if (version !== KEY_VERSION) {
    throw new Error(
      `Unsupported encryption key version: '${version}'. Only '${KEY_VERSION}' is supported.`
    )
  }

  const iv = Buffer.from(ivBase64 as string, 'base64')
  const authTag = Buffer.from(authTagBase64 as string, 'base64')
  const ciphertext = Buffer.from(ciphertextBase64 as string, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  return decrypted.toString('utf8')
}

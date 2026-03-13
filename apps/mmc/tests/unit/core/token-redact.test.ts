/**
 * Unit tests for token-redact utility (apps/mmc).
 *
 * Test coverage:
 * - redactSensitiveFields(): redacts all SENSITIVE_KEYS, preserves others, shallow copy
 * - looksLikeToken(): true for long base64url strings, false for short/non-strings
 *
 * This file has zero runtime imports (pure utility). No mocking required.
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — Additional unit coverage
 * Refs: token-redact.ts, logging security rules (no tokens in logs)
 */

import { looksLikeToken, redactSensitiveFields } from '@/core/auth/token-redact'
import { describe, expect, it } from 'vitest'

describe('redactSensitiveFields', () => {
  describe('redacts all SENSITIVE_KEYS', () => {
    it('redacts token and accessToken and access_token', () => {
      const result = redactSensitiveFields({
        token: 'secret-token',
        accessToken: 'secret-access',
        access_token: 'secret-access-underscore',
      })

      expect(result.token).toBe('[REDACTED]')
      expect(result.accessToken).toBe('[REDACTED]')
      expect(result.access_token).toBe('[REDACTED]')
    })

    it('redacts refreshToken and refresh_token', () => {
      const result = redactSensitiveFields({
        refreshToken: 'rt-value',
        refresh_token: 'rt-underscore',
      })

      expect(result.refreshToken).toBe('[REDACTED]')
      expect(result.refresh_token).toBe('[REDACTED]')
    })

    it('redacts password', () => {
      const result = redactSensitiveFields({ password: 'my-password' })

      expect(result.password).toBe('[REDACTED]')
    })

    it('redacts credential', () => {
      const result = redactSensitiveFields({ credential: 'secret-cred' })

      expect(result.credential).toBe('[REDACTED]')
    })

    it('redacts authorization (lowercase) and Authorization (capitalized)', () => {
      const result = redactSensitiveFields({
        authorization: 'Bearer token1',
        Authorization: 'Bearer token2',
      })

      expect(result.authorization).toBe('[REDACTED]')
      expect(result.Authorization).toBe('[REDACTED]')
    })

    it('redacts csrfToken and csrf_token', () => {
      const result = redactSensitiveFields({
        csrfToken: 'csrf-1',
        csrf_token: 'csrf-2',
      })

      expect(result.csrfToken).toBe('[REDACTED]')
      expect(result.csrf_token).toBe('[REDACTED]')
    })
  })

  describe('preserves non-sensitive keys', () => {
    it('leaves all non-sensitive keys unchanged', () => {
      const input = {
        userId: 'u123',
        action: 'login',
        timestamp: 1_700_000_000,
        success: true,
        meta: { count: 5 },
      }

      const result = redactSensitiveFields(input)

      expect(result.userId).toBe('u123')
      expect(result.action).toBe('login')
      expect(result.timestamp).toBe(1_700_000_000)
      expect(result.success).toBe(true)
      expect(result.meta).toEqual({ count: 5 })
    })

    it('handles mixed sensitive and non-sensitive keys', () => {
      const result = redactSensitiveFields({
        token: 'secret',
        userId: 'u1',
        action: 'refresh',
      })

      expect(result.token).toBe('[REDACTED]')
      expect(result.userId).toBe('u1')
      expect(result.action).toBe('refresh')
    })
  })

  describe('shallow copy / immutability', () => {
    it('returns a new object (does not mutate original)', () => {
      const input = { token: 'original-secret', userId: 'u1' }
      const result = redactSensitiveFields(input)

      // Original must be untouched
      expect(input.token).toBe('original-secret')

      // Result is redacted
      expect(result.token).toBe('[REDACTED]')
    })

    it('does not deep-redact nested objects (shallow only)', () => {
      const nested = { token: 'nested-secret' }
      const input = { meta: nested, userId: 'u1' }
      const result = redactSensitiveFields(input)

      // Nested object should NOT be redacted (shallow copy)
      expect(result.meta).toBe(nested)
    })
  })

  describe('empty input', () => {
    it('returns empty object for empty input', () => {
      expect(redactSensitiveFields({})).toEqual({})
    })
  })
})

describe('looksLikeToken', () => {
  describe('returns true for tokens', () => {
    it('recognises a long base64url string (JWT header segment)', () => {
      // 36-char base64url string — real JWT header
      expect(looksLikeToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(true)
    })

    it('recognises a long alphanumeric opaque token (> 20 chars)', () => {
      expect(looksLikeToken('a1b2c3d4e5f6g7h8i9j0k1')).toBe(true)
    })

    it('treats any string longer than 20 chars matching base64url pattern as a token', () => {
      const longBase64Url = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklm'

      expect(looksLikeToken(longBase64Url)).toBe(true)
    })
  })

  describe('returns false for non-tokens', () => {
    it('returns false for short strings (<= 20 chars)', () => {
      expect(looksLikeToken('short')).toBe(false)
      expect(looksLikeToken('exactly20charslong!!')).toBe(false)
    })

    it('returns false for null', () => {
      expect(looksLikeToken(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(looksLikeToken(undefined)).toBe(false)
    })

    it('returns false for numbers', () => {
      expect(looksLikeToken(42)).toBe(false)
      expect(looksLikeToken(Number('1234567890123456789'))).toBe(false)
    })

    it('returns false for booleans', () => {
      expect(looksLikeToken(true)).toBe(false)
      expect(looksLikeToken(false)).toBe(false)
    })

    it('returns false for objects', () => {
      expect(looksLikeToken({ token: 'value' })).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(looksLikeToken('')).toBe(false)
    })
  })
})

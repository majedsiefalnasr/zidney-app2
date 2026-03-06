/**
 * Unit tests for apps/backoffice/src/core/auth/token-redact.ts
 * Covers FR-SEC-03: Zero-tolerance token exposure policy.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T027
 */
import { describe, expect, it } from 'vitest'
import {
  looksLikeToken,
  redactSensitiveFields,
} from '../../../../../apps/backoffice/src/core/auth/token-redact'

// ── Helper: assertNoTokenInLogArgs ──────────────────────────────────────────
function assertNoTokenInLogArgs(value: unknown, path = 'root'): void {
  if (typeof value === 'string') {
    if (looksLikeToken(value)) {
      throw new Error(`Token-like value found at ${path}: ${value.substring(0, 10)}...`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoTokenInLogArgs(item, `${path}[${i}]`))
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, val] of Object.entries(value)) {
      assertNoTokenInLogArgs(val, `${path}.${key}`)
    }
  }
}

const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0'

describe('redactSensitiveFields (backoffice)', () => {
  const SENSITIVE_KEY_CASES: Array<[string, string]> = [
    ['token', FAKE_TOKEN],
    ['accessToken', FAKE_TOKEN],
    ['access_token', FAKE_TOKEN],
    ['refreshToken', FAKE_TOKEN],
    ['refresh_token', FAKE_TOKEN],
    ['authorization', `Bearer ${FAKE_TOKEN}`],
    ['Authorization', `Bearer ${FAKE_TOKEN}`],
    ['password', 'supersecretpassword'],
    ['credential', 'some-credential-value'],
    ['csrfToken', 'csrf-token-value-1234567890'],
    ['csrf_token', 'csrf-token-value-1234567890'],
    ['x-csrf-token', 'csrf-token-value-1234567890'],
    ['X-CSRF-Token', 'csrf-token-value-1234567890'],
  ]

  it.each(SENSITIVE_KEY_CASES)('redacts sensitive field "%s"', (key, value) => {
    const input = { [key]: value } as Record<string, unknown>
    const result = redactSensitiveFields(input)
    expect(result[key]).toBe('[REDACTED]')
  })

  it('does not modify safe fields', () => {
    const input = { userId: '123', email: 'user@example.com', role: 'admin' }
    const result = redactSensitiveFields(input)
    expect(result).toEqual(input)
    expect(result).not.toBe(input)
  })

  it('returns a shallow copy (original not mutated)', () => {
    const original = { token: FAKE_TOKEN, userId: 'abc' }
    const result = redactSensitiveFields(original)
    expect(result.token).toBe('[REDACTED]')
    expect(original.token).toBe(FAKE_TOKEN)
  })

  it('handles empty object', () => {
    expect(redactSensitiveFields({})).toEqual({})
  })

  it('redacts all 13 known SENSITIVE_KEYS', () => {
    const allSensitiveKeys = SENSITIVE_KEY_CASES.reduce(
      (acc, [key, value]) => {
        acc[key] = value
        return acc
      },
      {} as Record<string, unknown>
    )
    const result = redactSensitiveFields(allSensitiveKeys)
    for (const [key] of SENSITIVE_KEY_CASES) {
      expect(result[key]).toBe('[REDACTED]')
    }
  })
})

describe('looksLikeToken (backoffice)', () => {
  it('returns true for long base64url JWT', () => {
    expect(looksLikeToken(FAKE_TOKEN)).toBe(true)
  })
  it('returns false for short string', () => {
    expect(looksLikeToken('short')).toBe(false)
  })
  it('returns false for non-string', () => {
    expect(looksLikeToken(42)).toBe(false)
    expect(looksLikeToken(null)).toBe(false)
    expect(looksLikeToken(undefined)).toBe(false)
  })
})

describe('assertNoTokenInLogArgs helper (backoffice)', () => {
  it('passes when no token-like values present', () => {
    expect(() => assertNoTokenInLogArgs({ userId: '123' })).not.toThrow()
  })
  it('throws for top-level token-like value', () => {
    expect(() => assertNoTokenInLogArgs({ token: FAKE_TOKEN })).toThrow()
  })
  it('throws for nested token-like value', () => {
    expect(() => assertNoTokenInLogArgs({ nested: { deepToken: FAKE_TOKEN } })).toThrow()
  })
  it('passes after redaction', () => {
    const redacted = redactSensitiveFields({ token: FAKE_TOKEN })
    expect(() => assertNoTokenInLogArgs(redacted)).not.toThrow()
  })
})

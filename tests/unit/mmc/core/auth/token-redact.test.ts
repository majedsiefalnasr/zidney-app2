/**
 * Unit tests for apps/mmc/src/core/auth/token-redact.ts
 * Covers FR-SEC-03: Zero-tolerance token exposure policy.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T026
 */
import { describe, expect, it } from 'vitest'
import {
  looksLikeToken,
  redactSensitiveFields,
} from '../../../../../apps/mmc/src/core/auth/token-redact'

// ── Helper: assertNoTokenInLogArgs ──────────────────────────────────────────
/**
 * Recursively inspects all values in an object/array to assert no token-like
 * value exists at any nesting depth. Satisfies H2 test pattern.
 */
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

// ── SENSITIVE_KEYS coverage ──────────────────────────────────────────────────
const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0'

describe('redactSensitiveFields', () => {
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
    const input = {
      userId: '123',
      email: 'user@example.com',
      role: 'admin',
      timestamp: 1234567890,
    }
    const result = redactSensitiveFields(input)
    expect(result).toEqual(input)
    expect(result).not.toBe(input) // shallow copy
  })

  it('returns a shallow copy (original object is not mutated)', () => {
    const original = { token: FAKE_TOKEN, userId: 'abc' }
    const result = redactSensitiveFields(original)
    expect(result.token).toBe('[REDACTED]')
    expect(original.token).toBe(FAKE_TOKEN) // original unchanged
  })

  it('handles empty object', () => {
    const result = redactSensitiveFields({})
    expect(result).toEqual({})
  })

  it('handles mixed safe and sensitive fields', () => {
    const input = {
      userId: 'user-123',
      token: FAKE_TOKEN,
      email: 'test@example.com',
      Authorization: `Bearer ${FAKE_TOKEN}`,
    }
    const result = redactSensitiveFields(input)
    expect(result.userId).toBe('user-123')
    expect(result.email).toBe('test@example.com')
    expect(result.token).toBe('[REDACTED]')
    expect(result.Authorization).toBe('[REDACTED]')
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

// ── looksLikeToken ───────────────────────────────────────────────────────────

describe('looksLikeToken', () => {
  it('returns true for a long base64url JWT string', () => {
    expect(looksLikeToken(FAKE_TOKEN)).toBe(true)
  })

  it('returns true for a long opaque access token string', () => {
    expect(looksLikeToken('abcdefghijklmnopqrstuvwxyz1234567890ABCD')).toBe(true)
  })

  it('returns false for a short string', () => {
    expect(looksLikeToken('hello')).toBe(false)
    expect(looksLikeToken('short')).toBe(false)
    expect(looksLikeToken('12345678901234567890')).toBe(false) // exactly 20 chars — not >20
  })

  it('returns false for a non-string number', () => {
    expect(looksLikeToken(42)).toBe(false)
  })

  it('returns false for null', () => {
    expect(looksLikeToken(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(looksLikeToken(undefined)).toBe(false)
  })

  it('returns false for an object', () => {
    expect(looksLikeToken({ token: 'value' })).toBe(false)
  })

  it('returns false for strings with special characters (not base64url)', () => {
    expect(looksLikeToken('hello world this is a long string with spaces!')).toBe(false)
  })
})

// ── assertNoTokenInLogArgs helper ────────────────────────────────────────────

describe('assertNoTokenInLogArgs helper', () => {
  it('passes when no token-like values are present', () => {
    expect(() =>
      assertNoTokenInLogArgs({
        userId: '123',
        action: 'login',
        timestamp: 'now',
      })
    ).not.toThrow()
  })

  it('throws when a token-like value is at the top level', () => {
    expect(() => assertNoTokenInLogArgs({ token: FAKE_TOKEN })).toThrow()
  })

  it('throws when a token-like value is nested', () => {
    expect(() => assertNoTokenInLogArgs({ nested: { deepToken: FAKE_TOKEN } })).toThrow()
  })

  it('throws when a token-like value is in an array', () => {
    expect(() => assertNoTokenInLogArgs([{ token: FAKE_TOKEN }])).toThrow()
  })

  it('passes after redaction — redacted value does not look like a token', () => {
    const redacted = redactSensitiveFields({ token: FAKE_TOKEN })
    expect(() => assertNoTokenInLogArgs(redacted)).not.toThrow()
  })
})

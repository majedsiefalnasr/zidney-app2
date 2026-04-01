import { describe, expect, it } from 'vitest'
import { looksLikeToken, redactSensitiveFields } from '@/core/auth/token-redact'

describe('token-redact (Backoffice)', () => {
  it('redacts sensitive fields without mutating the input object', () => {
    const input = {
      token: 'secret-token',
      password: 'super-secret',
      userId: 'user-1',
    }

    const result = redactSensitiveFields(input)

    expect(result).toEqual({
      token: '[REDACTED]',
      password: '[REDACTED]',
      userId: 'user-1',
    })
    expect(input).toEqual({
      token: 'secret-token',
      password: 'super-secret',
      userId: 'user-1',
    })
  })

  it('preserves nested objects because redaction is shallow', () => {
    const nested = { token: 'nested-secret' }
    const result = redactSensitiveFields({ meta: nested, action: 'login' })

    expect(result.meta).toBe(nested)
    expect(result.action).toBe('login')
  })

  it('detects long token-like strings', () => {
    expect(looksLikeToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(true)
  })

  it('rejects short or non-string values', () => {
    expect(looksLikeToken('short-token')).toBe(false)
    expect(looksLikeToken(null)).toBe(false)
    expect(looksLikeToken({ token: 'value' })).toBe(false)
  })
})

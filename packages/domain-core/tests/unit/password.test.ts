import { describe, expect, it } from 'vitest'
import { validatePasswordComplexity } from '../../src/auth/password'

describe('validatePasswordComplexity', () => {
  it('flags short passwords as weak and returns suggestions', () => {
    const r = validatePasswordComplexity('abc')
    expect(r.valid).toBe(true)
    expect(r.strength).toBe('weak')
    expect(r.suggestions.length).toBeGreaterThan(0)
  })

  it('rates a strong password as strong', () => {
    const r = validatePasswordComplexity('Very$trongPassw0rd!')
    expect(r.valid).toBe(true)
    expect(r.strength).toBe('strong')
    expect(r.suggestions.length).toBeGreaterThanOrEqual(0)
  })
})

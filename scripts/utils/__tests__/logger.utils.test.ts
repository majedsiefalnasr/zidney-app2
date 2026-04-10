import { describe, expect, it } from 'vitest'
import { getPassthroughFlags, hasCiFlag, serializeError } from '../logger'

describe('logger utilities', () => {
  it('serializeError extracts fields from Error', () => {
    const err = new Error('boom')
    const out = serializeError(err)
    expect(out).toHaveProperty('name')
    expect(out).toHaveProperty('message')
    expect(out.message).toBe('boom')
  })

  it('serializeError stringifies non-error values', () => {
    const out = serializeError('oops')
    expect(out).toHaveProperty('error')
    expect(out.error).toBe('oops')
  })

  it('hasCiFlag recognizes --ci in args and env', () => {
    expect(hasCiFlag(['--ci'])).toBe(true)
    expect(hasCiFlag(['--other'])).toBe(false)
  })

  it('getPassthroughFlags returns the expected flags', () => {
    const flags = getPassthroughFlags(['--ai', '--json', '--ci'])
    expect(flags).toContain('--ai')
    expect(flags).toContain('--json')
    expect(flags).toContain('--ci')
  })
})

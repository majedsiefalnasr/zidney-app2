import { describe, expect, it } from 'vitest'
import { parseBooleanFlag } from '../../../src/core/config/env'
import { createFeatureFlags } from '../../../src/core/config/feature-flags'

describe('createFeatureFlags', () => {
  it('returns frozen flags object', () => {
    const flags = createFeatureFlags({ enableDebugPanel: false })
    expect(Object.isFrozen(flags)).toBe(true)
  })

  it('mutation throws on frozen flags', () => {
    const flags = createFeatureFlags({ enableDebugPanel: true })
    expect(() => {
      ;(flags as Record<string, unknown>)['enableDebugPanel'] = false
    }).toThrow()
    expect(flags.enableDebugPanel).toBe(true)
  })

  it('applies overrides for testing', () => {
    const flags = createFeatureFlags({ enableDebugPanel: true })
    expect(flags.enableDebugPanel).toBe(true)

    const flagsOff = createFeatureFlags({ enableDebugPanel: false })
    expect(flagsOff.enableDebugPanel).toBe(false)
  })

  it('defaults enableDebugPanel to false when no override', () => {
    // When called without overrides in a test env (no VITE_ vars set),
    // parseBooleanFlag(undefined) returns false
    const flags = createFeatureFlags()
    expect(flags.enableDebugPanel).toBe(false)
  })
})

describe('parseBooleanFlag', () => {
  it('parses "true" → true', () => {
    expect(parseBooleanFlag('true')).toBe(true)
  })

  it('parses "1" → true', () => {
    expect(parseBooleanFlag('1')).toBe(true)
  })

  it('parses "yes" → true', () => {
    expect(parseBooleanFlag('yes')).toBe(true)
  })

  it('parses "false" → false', () => {
    expect(parseBooleanFlag('false')).toBe(false)
  })

  it('parses undefined → false', () => {
    expect(parseBooleanFlag(undefined)).toBe(false)
  })

  it('parses "TRUE" (case insensitive) → true', () => {
    expect(parseBooleanFlag('TRUE')).toBe(true)
  })

  it('parses "Yes" (case insensitive) → true', () => {
    expect(parseBooleanFlag('Yes')).toBe(true)
  })
})

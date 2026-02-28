import { describe, expect, it } from 'vitest'
import { parseBooleanFlag } from '../../../src/core/config/env'
import { createFeatureFlags } from '../../../src/core/config/feature-flags'

describe('createFeatureFlags (Frontoffice)', () => {
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
    const flags = createFeatureFlags()
    expect(flags.enableDebugPanel).toBe(false)
  })
})

describe('parseBooleanFlag', () => {
  it('parses truthy strings', () => {
    expect(parseBooleanFlag('true')).toBe(true)
    expect(parseBooleanFlag('1')).toBe(true)
    expect(parseBooleanFlag('yes')).toBe(true)
  })

  it('parses falsy strings and undefined', () => {
    expect(parseBooleanFlag('false')).toBe(false)
    expect(parseBooleanFlag(undefined)).toBe(false)
  })
})

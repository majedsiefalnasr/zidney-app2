import { describe, expect, it } from 'vitest'
import { createEnvConfig, normalizeAppEnv, parseBooleanFlag } from '../../../src/core/config/env'

describe('createEnvConfig', () => {
  const validOverrides = {
    apiBaseUrl: 'https://api.example.com',
    appEnv: 'development',
    appName: 'mmc',
    debugMode: false,
  }

  it('returns valid config with all vars set via overrides', () => {
    const config = createEnvConfig(validOverrides)

    expect(config.apiBaseUrl).toBe('https://api.example.com')
    expect(config.appEnv).toBe('development')
    expect(config.appName).toBe('mmc')
    expect(config.debugMode).toBe(false)
  })

  it('throws when VITE_API_BASE_URL is missing', () => {
    expect(() => createEnvConfig({ ...validOverrides, apiBaseUrl: '' })).toThrow(
      'VITE_API_BASE_URL'
    )
  })

  it('normalizes appEnv to known values', () => {
    const staging = createEnvConfig({ ...validOverrides, appEnv: 'staging' })
    expect(staging.appEnv).toBe('staging')

    const prod = createEnvConfig({ ...validOverrides, appEnv: 'production' })
    expect(prod.appEnv).toBe('production')

    const dev = createEnvConfig({ ...validOverrides, appEnv: 'development' })
    expect(dev.appEnv).toBe('development')
  })

  it('preserves unrecognized appEnv values (GUARDIAN FIX)', () => {
    const custom = createEnvConfig({ ...validOverrides, appEnv: 'custom' })
    expect(custom.appEnv).toBe('custom')
  })

  it('applies overrides for testing', () => {
    const config = createEnvConfig({
      apiBaseUrl: 'http://test.local',
      appEnv: 'staging',
      appName: 'test-mmc',
      debugMode: true,
    })

    expect(config.apiBaseUrl).toBe('http://test.local')
    expect(config.appEnv).toBe('staging')
    expect(config.appName).toBe('test-mmc')
    expect(config.debugMode).toBe(true)
  })

  it('returns a frozen object', () => {
    const config = createEnvConfig(validOverrides)
    expect(Object.isFrozen(config)).toBe(true)
  })

  it('mutation has no effect on frozen config', () => {
    const config = createEnvConfig(validOverrides)
    expect(() => {
      ;(config as Record<string, unknown>).apiBaseUrl = 'http://hacked.local'
    }).toThrow()
    expect(config.apiBaseUrl).toBe('https://api.example.com')
  })
})

describe('normalizeAppEnv', () => {
  it('returns "development" for "development"', () => {
    expect(normalizeAppEnv('development')).toBe('development')
  })

  it('returns "staging" for "staging"', () => {
    expect(normalizeAppEnv('staging')).toBe('staging')
  })

  it('returns "production" for "production"', () => {
    expect(normalizeAppEnv('production')).toBe('production')
  })

  it('returns the raw value for unrecognized env (GUARDIAN FIX)', () => {
    expect(normalizeAppEnv('custom')).toBe('custom')
  })

  it('defaults empty/undefined to "development"', () => {
    expect(normalizeAppEnv(undefined)).toBe('development')
    expect(normalizeAppEnv('')).toBe('development')
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
})

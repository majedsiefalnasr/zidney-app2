import { describe, expect, it } from 'vitest'
import { createEnvConfig, normalizeAppEnv, parseBooleanFlag } from '../../../src/core/config/env'

describe('createEnvConfig (Backoffice)', () => {
  const validOverrides = {
    apiBaseUrl: 'https://api.example.com',
    appEnv: 'development',
    appName: 'backoffice',
    debugMode: false,
  }

  it('returns valid config with all vars set via overrides', () => {
    const config = createEnvConfig(validOverrides)

    expect(config.apiBaseUrl).toBe('https://api.example.com')
    expect(config.appEnv).toBe('development')
    expect(config.appName).toBe('backoffice')
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
  })

  it('preserves unrecognized appEnv values (GUARDIAN FIX)', () => {
    const custom = createEnvConfig({ ...validOverrides, appEnv: 'custom' })
    expect(custom.appEnv).toBe('custom')
  })

  it('supports workspaceSlug override', () => {
    const config = createEnvConfig({
      ...validOverrides,
      workspaceSlug: 'my-org',
    })
    expect(config.workspaceSlug).toBe('my-org')
  })

  it('workspaceSlug is undefined when not provided', () => {
    const config = createEnvConfig(validOverrides)
    expect(config.workspaceSlug).toBeUndefined()
  })

  it('applies overrides for testing', () => {
    const config = createEnvConfig({
      apiBaseUrl: 'http://test.local',
      appEnv: 'staging',
      appName: 'test-backoffice',
      debugMode: true,
      workspaceSlug: 'test-org',
    })

    expect(config.apiBaseUrl).toBe('http://test.local')
    expect(config.appEnv).toBe('staging')
    expect(config.appName).toBe('test-backoffice')
    expect(config.debugMode).toBe(true)
    expect(config.workspaceSlug).toBe('test-org')
  })

  it('returns a frozen object', () => {
    const config = createEnvConfig(validOverrides)
    expect(Object.isFrozen(config)).toBe(true)
  })

  it('mutation throws on frozen config', () => {
    const config = createEnvConfig(validOverrides)
    expect(() => {
      ;(config as Record<string, unknown>).apiBaseUrl = 'http://hacked.local'
    }).toThrow()
    expect(config.apiBaseUrl).toBe('https://api.example.com')
  })
})

describe('normalizeAppEnv', () => {
  it('returns known values unchanged', () => {
    expect(normalizeAppEnv('development')).toBe('development')
    expect(normalizeAppEnv('staging')).toBe('staging')
    expect(normalizeAppEnv('production')).toBe('production')
  })

  it('returns raw value for unrecognized env', () => {
    expect(normalizeAppEnv('custom')).toBe('custom')
  })

  it('defaults empty/undefined to "development"', () => {
    expect(normalizeAppEnv(undefined)).toBe('development')
    expect(normalizeAppEnv('')).toBe('development')
  })
})

describe('parseBooleanFlag', () => {
  it('parses truthy strings', () => {
    expect(parseBooleanFlag('true')).toBe(true)
    expect(parseBooleanFlag('1')).toBe(true)
    expect(parseBooleanFlag('yes')).toBe(true)
  })

  it('parses falsy strings', () => {
    expect(parseBooleanFlag('false')).toBe(false)
    expect(parseBooleanFlag(undefined)).toBe(false)
  })
})

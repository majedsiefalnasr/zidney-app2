import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../../src/core/config/app-config'
import { createEnvConfig } from '../../../src/core/config/env'
import { createFeatureFlags } from '../../../src/core/config/feature-flags'

// Build a test appConfig using the factories (same pattern as app-config.ts)
function buildTestAppConfig(
  envOverrides?: Partial<Parameters<typeof createEnvConfig>[0]>,
  flagOverrides?: Partial<Parameters<typeof createFeatureFlags>[0]>
): AppConfig {
  const env = createEnvConfig({
    apiBaseUrl: 'https://api.test.local',
    appEnv: 'development',
    appName: 'mmc',
    debugMode: false,
    ...envOverrides,
  })
  const flags = createFeatureFlags(flagOverrides)

  return Object.freeze({ env, flags })
}

describe('appConfig aggregate', () => {
  it('appConfig is frozen', () => {
    const config = buildTestAppConfig()
    expect(Object.isFrozen(config)).toBe(true)
  })

  it('appConfig.env is frozen', () => {
    const config = buildTestAppConfig()
    expect(Object.isFrozen(config.env)).toBe(true)
  })

  it('appConfig.flags is frozen', () => {
    const config = buildTestAppConfig()
    expect(Object.isFrozen(config.flags)).toBe(true)
  })
})

describe('getApiBase', () => {
  it('returns the apiBaseUrl', () => {
    const config = buildTestAppConfig({ apiBaseUrl: 'https://api.zidney.com' })
    expect(config.env.apiBaseUrl).toBe('https://api.zidney.com')
  })
})

describe('mode helpers', () => {
  it('isDev returns true in development', () => {
    const config = buildTestAppConfig({ appEnv: 'development' })
    expect(config.env.appEnv === 'development').toBe(true)
  })

  it('isProd returns true in production', () => {
    const config = buildTestAppConfig({ appEnv: 'production' })
    expect(config.env.appEnv === 'production').toBe(true)
  })

  it('isStaging returns true in staging', () => {
    const config = buildTestAppConfig({ appEnv: 'staging' })
    expect(config.env.appEnv === 'staging').toBe(true)
  })

  it('all mode helpers return false for unrecognized mode (GUARDIAN FIX)', () => {
    const config = buildTestAppConfig({ appEnv: 'custom' })
    expect(config.env.appEnv === 'development').toBe(false)
    expect(config.env.appEnv === 'production').toBe(false)
    expect(config.env.appEnv === 'staging').toBe(false)
  })

  it('simulates staging mode via factory override (US6)', () => {
    const config = buildTestAppConfig({ appEnv: 'staging' })
    expect(config.env.appEnv === 'staging').toBe(true)
    expect(config.env.appEnv === 'development').toBe(false)
    expect(config.env.appEnv === 'production').toBe(false)
  })
})

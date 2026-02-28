import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.resetAllMocks())

describe('resolveConfig', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('resolves config with valid VITE_API_BASE_URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    vi.stubEnv('MODE', 'development')

    const { resolveConfig } = await import('../../../src/core/config/env')
    const config = resolveConfig()

    expect(config.apiBaseUrl).toBe('https://api.example.com')
    vi.unstubAllEnvs()
  })

  it('throws when VITE_API_BASE_URL is missing', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')

    await expect(import('../../../src/core/config/env')).rejects.toThrow(
      'VITE_API_BASE_URL'
    )
    vi.unstubAllEnvs()
  })

  it('derives buildEnv from MODE', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    vi.stubEnv('MODE', 'production')

    const { resolveConfig } = await import('../../../src/core/config/env')
    const config = resolveConfig()

    expect(config.buildEnv).toBe('production')
    vi.unstubAllEnvs()
  })

  it('sets debugMode true when VITE_DEBUG_MODE is "true"', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    vi.stubEnv('VITE_DEBUG_MODE', 'true')

    const { resolveConfig } = await import('../../../src/core/config/env')
    const config = resolveConfig()

    expect(config.debugMode).toBe(true)
    vi.unstubAllEnvs()
  })

  it('sets debugMode false when VITE_DEBUG_MODE is not "true"', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    vi.stubEnv('VITE_DEBUG_MODE', 'false')

    const { resolveConfig } = await import('../../../src/core/config/env')
    const config = resolveConfig()

    expect(config.debugMode).toBe(false)
    vi.unstubAllEnvs()
  })

  it('reads optional VITE_WORKSPACE_SLUG when provided', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    vi.stubEnv('VITE_WORKSPACE_SLUG', 'my-org')

    const { resolveConfig } = await import('../../../src/core/config/env')
    const config = resolveConfig()

    expect((config as Record<string, unknown>)['workspaceSlug']).toBe('my-org')
    vi.unstubAllEnvs()
  })

  it('appConfig singleton returns same object on second call', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')

    const { appConfig } = await import('../../../src/core/config/env')
    const first = appConfig
    const { appConfig: second } = await import('../../../src/core/config/env')

    expect(first).toBe(second)
    vi.unstubAllEnvs()
  })
})

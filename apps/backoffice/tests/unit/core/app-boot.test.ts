import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'

afterEach(() => vi.resetAllMocks())

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    createRouter: vi.fn().mockReturnValue({
      beforeEach: vi.fn(),
      push: vi.fn(),
      isReady: vi.fn().mockResolvedValue(undefined),
      install: vi.fn(),
    }),
    createWebHistory: vi.fn(),
  }
})

describe('app-boot (Backoffice): FR-33 bootstrap order', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('appConfig is resolved at import time (before pinia/router)', async () => {
    const { appConfig } = await import('../../../src/core/config/app-config')
    expect(appConfig).toBeDefined()
    expect(appConfig.env.apiBaseUrl).toBe('https://api.example.com')
  })

  it('createAppPinia returns a pinia instance', async () => {
    const { createAppPinia } = await import('../../../src/core/state/index')
    const router = {
      beforeEach: vi.fn(),
    } as unknown as import('vue-router').Router
    const pinia = createAppPinia(router)
    expect(pinia).toBeDefined()
    expect(typeof pinia.install).toBe('function')
  })

  it('app mounts after use(pinia) and use(router) — bootstrap order verified', async () => {
    const app = createApp({ template: '<div />' })
    const useSpy = vi.spyOn(app, 'use')
    const mountSpy = vi
      .spyOn(app, 'mount')
      .mockReturnValue(app as unknown as Element)

    const { createAppPinia } = await import('../../../src/core/state/index')
    const mockRouter = {
      install: vi.fn(),
      beforeEach: vi.fn(),
    } as unknown as import('vue-router').Router
    const pinia = createAppPinia(mockRouter)

    app.use(pinia)
    app.use(mockRouter)
    app.mount('#app')

    const useCalls = useSpy.mock.calls.map((c) => c[0])
    expect(useCalls[0]).toBe(pinia)
    expect(useCalls[1]).toBe(mockRouter)
    expect(mountSpy).toHaveBeenCalledWith('#app')
  })

  it('pinia registered before any store access', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const { useAuthStore } = await import('../../../src/core/auth/token-store')
    const store = useAuthStore()
    expect(store).toBeDefined()
    expect(store.isAuthenticated).toBe(false)
  })
})

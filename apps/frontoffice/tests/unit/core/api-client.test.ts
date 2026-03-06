import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/core/config/app-config', () => ({
  appConfig: {
    env: {
      apiBaseUrl: 'https://api.example.com',
      appEnv: 'development',
      appName: 'frontoffice',
      debugMode: false,
    },
    flags: {
      enableDebugPanel: false,
    },
  },
  getApiBase: vi.fn().mockReturnValue('https://api.example.com'),
}))

import { createApiClient } from '../../../src/core/api/client'
import type { TokenStore } from '../../../src/core/auth/token-store'
import type { AppConfig } from '../../../src/core/config/app-config'

afterEach(() => vi.resetAllMocks())

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<AppConfig['env']>): AppConfig {
  return {
    env: {
      apiBaseUrl: 'https://api.example.com',
      appEnv: 'development',
      appName: 'frontoffice',
      debugMode: false,
      ...overrides,
    },
    flags: {
      enableDebugPanel: false,
    },
  }
}

function makeTokenStore(overrides?: Partial<TokenStore>): TokenStore {
  return {
    accessToken: null,
    user: null,
    isAuthenticated: false,
    getAccessToken: vi.fn().mockReturnValue(null),
    setAccessToken: vi.fn(),
    clearAccessToken: vi.fn(),
    setUser: vi.fn(),
    $id: 'auth',
    $patch: vi.fn(),
    $reset: vi.fn(),
    $subscribe: vi.fn(),
    $onAction: vi.fn(),
    $dispose: vi.fn(),
    router: { push: vi.fn() },
    ...overrides,
  } as unknown as TokenStore
}

function makeSuccessResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ success: true, data }),
    headers: new Headers(),
  } as unknown as Response
}

function makeErrorResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
  } as unknown as Response
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createApiClient', () => {
  describe('Authorization header', () => {
    it('attaches Authorization header when access token is set', async () => {
      const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse({ ok: true }))
      const tokenStore = makeTokenStore({
        getAccessToken: vi.fn().mockReturnValue('test-token-123'),
      })
      const client = createApiClient(makeConfig(), tokenStore, mockFetch)

      await client.get('/test')

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer test-token-123')
    })

    it('omits Authorization header when no access token', async () => {
      const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse({}))
      const tokenStore = makeTokenStore({
        getAccessToken: vi.fn().mockReturnValue(null),
      })
      const client = createApiClient(makeConfig(), tokenStore, mockFetch)

      await client.get('/test')

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBeUndefined()
    })
  })

  describe('credentials: include', () => {
    it('sends credentials: include on every request', async () => {
      const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse({}))
      const client = createApiClient(makeConfig(), makeTokenStore(), mockFetch)

      await client.get('/endpoint')

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(init.credentials).toBe('include')
    })

    it('sends credentials: include on POST requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse({}))
      const client = createApiClient(makeConfig(), makeTokenStore(), mockFetch)

      await client.post('/endpoint', { data: 'test' })

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(init.credentials).toBe('include')
    })
  })

  describe('Idempotency-Key header', () => {
    it('attaches Idempotency-Key header when idempotencyKey provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse({}))
      const client = createApiClient(makeConfig(), makeTokenStore(), mockFetch)

      await client.post('/orders', { item: 'test' }, 'idem-key-abc123')

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      const headers = init.headers as Record<string, string>
      expect(headers['Idempotency-Key']).toBe('idem-key-abc123')
    })
  })

  describe('X-Correlation-ID header', () => {
    it('attaches X-Correlation-ID on every request', async () => {
      const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse({}))
      const client = createApiClient(makeConfig(), makeTokenStore(), mockFetch)

      await client.get('/test')

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      const headers = init.headers as Record<string, string>
      expect(headers['X-Correlation-ID']).toBeDefined()
      expect(typeof headers['X-Correlation-ID']).toBe('string')
      expect(headers['X-Correlation-ID'].length).toBeGreaterThan(0)
    })
  })

  describe('Error normalization on 4xx/5xx', () => {
    it('normalizes error response on 4xx', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeErrorResponse(404, {
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Resource not found' },
        })
      )
      const client = createApiClient(makeConfig(), makeTokenStore(), mockFetch)

      await expect(client.get('/missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        httpStatus: 404,
      })
    })

    it('normalizes error response on 5xx', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeErrorResponse(500, {
          success: false,
          data: null,
          error: { code: 'INTERNAL_ERROR', message: 'Server error' },
        })
      )
      const client = createApiClient(makeConfig(), makeTokenStore(), mockFetch)

      await expect(client.get('/broken')).rejects.toMatchObject({
        httpStatus: 500,
      })
    })
  })

  describe('Single-flight token refresh on 401', () => {
    it('triggers single-flight refresh on 401', async () => {
      let callCount = 0
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(makeSuccessResponse({ accessToken: 'new-token' }))
        }
        callCount++
        if (callCount === 1) {
          return Promise.resolve(
            makeErrorResponse(401, {
              success: false,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
            })
          )
        }
        return Promise.resolve(makeSuccessResponse({ retried: true }))
      })

      const tokenStore = makeTokenStore({
        getAccessToken: vi.fn().mockReturnValue('old-token'),
      })

      const client = createApiClient(makeConfig(), tokenStore, mockFetch)
      await client.get('/protected')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh'),
        expect.anything()
      )
    })

    it('rejects all queued requests with AUTH_REFRESH_FAILED when refresh fails', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(
            makeErrorResponse(401, {
              success: false,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Session expired' },
            })
          )
        }
        return Promise.resolve(
          makeErrorResponse(401, {
            success: false,
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          })
        )
      })

      const mockRouter = { push: vi.fn() }
      const tokenStore = makeTokenStore()
      ;(tokenStore as unknown as { router: unknown }).router = mockRouter

      const client = createApiClient(makeConfig(), tokenStore, mockFetch)

      const result = await client.get('/protected').catch((err: unknown) => err)
      expect((result as { code: string }).code).toBe('AUTH_REFRESH_FAILED')
    })

    it('clears auth store on AUTH_REFRESH_FAILED', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(
            makeErrorResponse(401, {
              success: false,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Session expired' },
            })
          )
        }
        return Promise.resolve(
          makeErrorResponse(401, {
            success: false,
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          })
        )
      })

      const mockRouter = { push: vi.fn() }
      const clearFn = vi.fn()
      const tokenStore = makeTokenStore({ clearAccessToken: clearFn })
      ;(tokenStore as unknown as { router: unknown }).router = mockRouter

      const client = createApiClient(makeConfig(), tokenStore, mockFetch)

      await client.get('/protected').catch(() => {})

      expect(clearFn).toHaveBeenCalled()
    })

    it('calls router.push("/login") when refresh fails (AUTH_REFRESH_FAILED redirect)', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(
            makeErrorResponse(401, {
              success: false,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Session expired' },
            })
          )
        }
        return Promise.resolve(
          makeErrorResponse(401, {
            success: false,
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          })
        )
      })

      const mockRouter = { push: vi.fn() }
      const tokenStore = makeTokenStore()
      ;(tokenStore as unknown as { router: unknown }).router = mockRouter

      const client = createApiClient(makeConfig(), tokenStore, mockFetch)

      await client.get('/protected').catch(() => {})

      expect(mockRouter.push).toHaveBeenCalledWith('/login')
    })
  })
})

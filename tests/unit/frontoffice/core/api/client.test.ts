/**
 * Unit tests for apps/frontoffice/src/core/api/client.ts (createAppApiClient)
 * Verifies: 423/426 interception, onAuthFailure wiring, token passthrough.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T045
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Hoist mock stubs so they are available in vi.mock() factory ───────────────
const { mockAdapterExecute, mockCreateClient } = vi.hoisted(() => {
  const mockAdapterExecute = vi.fn()
  const mockCreateClient = vi.fn().mockReturnValue({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  })
  return { mockAdapterExecute, mockCreateClient }
})

vi.mock('@zidney/api-client', () => ({
  createApiClient: mockCreateClient,
  createFetchAdapter: vi.fn(() => ({ execute: mockAdapterExecute })),
  isAppError: vi.fn(),
}))

vi.mock('@/core/config/app-config', () => ({
  appConfig: { env: { apiBaseUrl: 'https://api.test.local' } },
}))

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

import type { AdapterRequest } from '@zidney/api-client'
import { createAppApiClient } from '../../../../../apps/frontoffice/src/core/api/client'
import type { IErrorInterceptor } from '../../../../../apps/frontoffice/src/core/api/interceptors/error.interceptor'
import type { IRefreshManager } from '../../../../../apps/frontoffice/src/core/auth/refresh-manager'
import type { ITokenManager } from '../../../../../apps/frontoffice/src/core/auth/token-manager'

function makeTokenManager(token: string | null = null): ITokenManager {
  return {
    getToken: vi.fn(() => token),
    setToken: vi.fn(),
    clearToken: vi.fn(),
  }
}

function makeRefreshManager(): IRefreshManager {
  return { refresh: vi.fn() } as unknown as IRefreshManager
}

function makeErrorInterceptor(): IErrorInterceptor {
  return {
    get isHandling401() {
      return false
    },
    handleAuthFailure: vi.fn().mockResolvedValue(undefined),
    handleLicenseError: vi.fn(),
  }
}

describe('createAppApiClient (frontoffice)', () => {
  let tokenManager: ITokenManager
  let refreshManager: IRefreshManager
  let errorInterceptor: IErrorInterceptor

  beforeEach(() => {
    vi.clearAllMocks()
    tokenManager = makeTokenManager('test-bearer-token-xxxxxxxxxxx')
    refreshManager = makeRefreshManager()
    errorInterceptor = makeErrorInterceptor()
  })

  it('returns an ApiClient instance (truthy object)', () => {
    const client = createAppApiClient(tokenManager, refreshManager, errorInterceptor)
    expect(client).toBeTruthy()
  })

  it('wires getAccessToken to tokenManager.getToken()', () => {
    createAppApiClient(tokenManager, refreshManager, errorInterceptor)
    const options = mockCreateClient.mock.calls[0][0] as {
      getAccessToken: () => string | null
    }
    const token = options.getAccessToken()
    expect(tokenManager.getToken).toHaveBeenCalled()
    expect(token).toBe('test-bearer-token-xxxxxxxxxxx')
  })

  it('calls handleLicenseError(423) when adapter returns 423', async () => {
    createAppApiClient(tokenManager, refreshManager, errorInterceptor)
    const options = mockCreateClient.mock.calls[0][0] as {
      adapter: {
        execute: (r: AdapterRequest) => Promise<{
          status: number
          body: unknown
          headers: Record<string, string>
        }>
      }
    }
    const adapter = options.adapter
    mockAdapterExecute.mockResolvedValueOnce({
      status: 423,
      body: null,
      headers: {},
    })
    await adapter.execute({
      method: 'GET',
      url: '/test',
      headers: {},
    } as AdapterRequest)
    expect(errorInterceptor.handleLicenseError).toHaveBeenCalledWith(423)
  })

  it('calls handleLicenseError(426) when adapter returns 426', async () => {
    createAppApiClient(tokenManager, refreshManager, errorInterceptor)
    const options = mockCreateClient.mock.calls[0][0] as {
      adapter: {
        execute: (r: AdapterRequest) => Promise<{
          status: number
          body: unknown
          headers: Record<string, string>
        }>
      }
    }
    const adapter = options.adapter
    mockAdapterExecute.mockResolvedValueOnce({
      status: 426,
      body: null,
      headers: {},
    })
    await adapter.execute({
      method: 'GET',
      url: '/test',
      headers: {},
    } as AdapterRequest)
    expect(errorInterceptor.handleLicenseError).toHaveBeenCalledWith(426)
  })

  it('does NOT call handleLicenseError on 200 response', async () => {
    createAppApiClient(tokenManager, refreshManager, errorInterceptor)
    const options = mockCreateClient.mock.calls[0][0] as {
      adapter: {
        execute: (r: AdapterRequest) => Promise<{
          status: number
          body: unknown
          headers: Record<string, string>
        }>
      }
    }
    const adapter = options.adapter
    mockAdapterExecute.mockResolvedValueOnce({
      status: 200,
      body: {},
      headers: {},
    })
    await adapter.execute({
      method: 'GET',
      url: '/test',
      headers: {},
    } as AdapterRequest)
    expect(errorInterceptor.handleLicenseError).not.toHaveBeenCalled()
  })

  it('wires onAuthFailure to errorInterceptor.handleAuthFailure()', () => {
    createAppApiClient(tokenManager, refreshManager, errorInterceptor)
    const options = mockCreateClient.mock.calls[0][0] as {
      onAuthFailure: () => void
    }
    options.onAuthFailure()
    expect(errorInterceptor.handleAuthFailure).toHaveBeenCalledTimes(1)
  })
})

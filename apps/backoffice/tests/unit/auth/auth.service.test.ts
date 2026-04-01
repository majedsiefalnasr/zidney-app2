/**
 * Unit tests for createAuthService().
 * Mirrors MMC coverage for the Backoffice auth service implementation.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthServiceApiClient, IAuthService } from '../../../src/core/auth/auth.service'
import { createAuthService } from '../../../src/core/auth/auth.service'
import type { AuthUser } from '../../../src/core/auth/types'

vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const TEST_USER: AuthUser = {
  id: '42',
  email: 'admin@zidney.com',
  name: 'Admin',
  role: 'admin',
}

function makeMockApiClient(overrides: Partial<AuthServiceApiClient> = {}): AuthServiceApiClient {
  return {
    get: vi.fn().mockResolvedValue({ success: true, data: TEST_USER }),
    post: vi.fn().mockResolvedValue({
      success: true,
      data: { accessToken: 'tok', user: TEST_USER },
    }),
    ...overrides,
  }
}

describe('createAuthService', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('login()', () => {
    it('calls POST /auth/login with credentials', async () => {
      const apiClient = makeMockApiClient()
      const service = createAuthService(apiClient)

      const creds = { email: 'user@test.com', password: 'pass123' }
      await service.login(creds)

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', creds)
    })

    it('returns the login response data', async () => {
      const loginResponse = { accessToken: 'access-tok', user: TEST_USER }
      const apiClient = makeMockApiClient({
        post: vi.fn().mockResolvedValue({ success: true, data: loginResponse }),
      })
      const service = createAuthService(apiClient)

      const result = await service.login({
        email: 'u@test.com',
        password: 'pw',
      })
      expect(result.accessToken).toBe('access-tok')
      expect(result.user).toEqual(TEST_USER)
    })

    it('propagates errors from apiClient.post', async () => {
      const apiClient = makeMockApiClient({
        post: vi.fn().mockRejectedValue(new Error('network error')),
      })
      const service = createAuthService(apiClient)

      await expect(service.login({ email: 'u@test.com', password: 'pw' })).rejects.toThrow()
    })
  })

  describe('logout()', () => {
    it('resolves when apiClient.post succeeds', async () => {
      const apiClient = makeMockApiClient({
        post: vi.fn().mockResolvedValue({ success: true, data: null }),
      })
      const service = createAuthService(apiClient)

      await expect(service.logout()).resolves.toBeUndefined()
    })

    it('resolves even when apiClient.post rejects', async () => {
      const apiClient = makeMockApiClient({
        post: vi.fn().mockRejectedValue(new Error('500 Internal Server Error')),
      })
      const service = createAuthService(apiClient)

      await expect(service.logout()).resolves.toBeUndefined()
    })

    it('calls POST /auth/logout', async () => {
      const apiClient = makeMockApiClient({
        post: vi.fn().mockResolvedValue({ success: true, data: null }),
      })
      const service = createAuthService(apiClient)

      await service.logout()
      expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', {})
    })
  })

  describe('refreshToken()', () => {
    it('calls POST /auth/refresh', async () => {
      const apiClient = makeMockApiClient({
        post: vi.fn().mockResolvedValue({
          success: true,
          data: { accessToken: 'refreshed' },
        }),
      })
      const service = createAuthService(apiClient)

      await service.refreshToken()
      expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh', {})
    })

    it('returns { accessToken: string }', async () => {
      const apiClient = makeMockApiClient({
        post: vi.fn().mockResolvedValue({ success: true, data: { accessToken: 'r-tok' } }),
      })
      const service = createAuthService(apiClient)

      const result = await service.refreshToken()
      expect(result).toEqual({ accessToken: 'r-tok' })
    })

    it('propagates errors from apiClient.post', async () => {
      const apiClient = makeMockApiClient({
        post: vi.fn().mockRejectedValue(new Error('refresh failed')),
      })
      const service = createAuthService(apiClient)

      await expect(service.refreshToken()).rejects.toThrow()
    })
  })

  describe('fetchProfile()', () => {
    it('calls GET /auth/me', async () => {
      const apiClient = makeMockApiClient()
      const service = createAuthService(apiClient)

      await service.fetchProfile()
      expect(apiClient.get).toHaveBeenCalledWith('/auth/me')
    })

    it('returns typed AuthUser', async () => {
      const apiClient = makeMockApiClient({
        get: vi.fn().mockResolvedValue({ success: true, data: TEST_USER }),
      })
      const service = createAuthService(apiClient)

      const user = await service.fetchProfile()
      expect(user.id).toBe('42')
      expect(user.email).toBe('admin@zidney.com')
      expect(user.role).toBeDefined()
    })

    it('propagates errors from apiClient.get', async () => {
      const apiClient = makeMockApiClient({
        get: vi.fn().mockRejectedValue(new Error('not found')),
      })
      const service = createAuthService(apiClient)

      await expect(service.fetchProfile()).rejects.toThrow()
    })
  })

  describe('type safety', () => {
    it('createAuthService returns a valid IAuthService', () => {
      const apiClient = makeMockApiClient()
      const service: IAuthService = createAuthService(apiClient)
      expect(typeof service.login).toBe('function')
      expect(typeof service.logout).toBe('function')
      expect(typeof service.refreshToken).toBe('function')
      expect(typeof service.fetchProfile).toBe('function')
    })
  })
})

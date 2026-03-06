/**
 * Auth service for Backoffice — all backend HTTP interactions for the auth flow.
 * Implements IAuthService. Created via factory to enable test injection.
 *
 * INVARIANTS:
 * - logout() always resolves — backend errors are non-fatal (FR-30).
 * - login() logs receipt but NEVER logs the accessToken value.
 * - All HTTP calls go through injected apiClient — no direct fetch().
 * - No permission checks or role comparisons.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import type { ClientResponse, RequestConfig } from '@zidney/api-client'
import { createLogger } from '@zidney/logger'
import type { AuthUser, LoginCredentials, LoginResponse } from './types'

const logger = createLogger('auth:auth-service')

// ─── Minimal API Client Type ─────────────────────────────────────────────────
// Subset of ApiClient needed by auth service — enables forward-reference proxy in main.ts
export interface AuthServiceApiClient {
  get<T>(url: string, config?: RequestConfig): Promise<ClientResponse<T>>
  post<T>(url: string, data: unknown, config?: RequestConfig): Promise<ClientResponse<T>>
}

// ─── Interface ───────────────────────────────────────────────────────────────
export interface IAuthService {
  /**
   * Sends login credentials to the backend.
   * Returns access token + user profile on success.
   * Throws on failure.
   */
  login(credentials: LoginCredentials): Promise<LoginResponse>

  /**
   * Calls the backend logout endpoint.
   * Always resolves — never rejects (FR-30).
   * Frontend state cleanup must not depend on this call's success.
   */
  logout(): Promise<void>

  /**
   * Calls POST /auth/refresh.
   * Returns the new access token string on success.
   * Throws on failure (used by refresh-manager's refreshFn).
   */
  refreshToken(): Promise<{ accessToken: string }>

  /**
   * Fetches the authenticated user's profile from GET /auth/me.
   * Returns typed AuthUser.
   * Throws on failure.
   */
  fetchProfile(): Promise<AuthUser>
}

// ─── Factory ─────────────────────────────────────────────────────────────────
/**
 * Creates an auth service instance with the injected api client.
 * Pass a mock AuthServiceApiClient in tests to avoid real HTTP calls.
 * Accepts the minimal subset of ApiClient needed (enabling forward-reference in main.ts).
 */
export function createAuthService(apiClient: AuthServiceApiClient): IAuthService {
  return {
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
      const result = await apiClient.post<LoginResponse>('/auth/login', credentials)
      // NEVER log accessToken — only log presence
      logger.info('Login response received', {
        hasToken: true,
        hasUser: result.data.user != null,
      })
      return result.data
    },

    async logout(): Promise<void> {
      try {
        await apiClient.post('/auth/logout', {})
        logger.info('Backend logout completed')
      } catch (err: unknown) {
        // FR-30: logout always resolves — backend error is non-fatal
        logger.warn('Backend logout failed — proceeding with local state teardown', {
          error: err instanceof Error ? err.message : 'unknown',
        })
        // Intentionally swallowed — do not rethrow
      }
    },

    async refreshToken(): Promise<{ accessToken: string }> {
      const result = await apiClient.post<{ accessToken: string }>('/auth/refresh', {})
      return result.data
    },

    async fetchProfile(): Promise<AuthUser> {
      const result = await apiClient.get<AuthUser>('/auth/me')
      return result.data
    },
  }
}

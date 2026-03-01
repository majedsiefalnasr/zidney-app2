import type { IRefreshManager } from '@/core/auth/refresh-manager'
import type { ITokenManager } from '@/core/auth/token-manager'
import { appConfig } from '@/core/config/app-config'
import type { ApiClient } from '@zidney/api-client'
import {
  createApiClient as createClient,
  createFetchAdapter,
} from '@zidney/api-client'
import { createLogger } from '@zidney/logger'

const logger = createLogger('auth:api-client')

// ─── Re-exports for convenience ─────────────────────────────────────────────
export type {
  ApiClient,
  AppError,
  ClientResponse,
  RequestConfig,
} from '@zidney/api-client'

export { ErrorCodes, isAppError } from '@zidney/api-client'

// ─── Factory ─────────────────────────────────────────────────────────────────
/**
 * Creates the application API client with properly wired auth interceptors.
 * Called once in main.ts after tokenManager and refreshManager are created.
 *
 * @param tokenManager - In-memory access token holder
 * @param refreshManager - Single-flight refresh orchestrator
 * @param onAuthFailure - Callback invoked when auth fails after retry (calls authStore.logout())
 */
export function createAppApiClient(
  tokenManager: ITokenManager,
  refreshManager: IRefreshManager,
  onAuthFailure: () => void
): ApiClient {
  return createClient({
    baseUrl: appConfig.env.apiBaseUrl,
    credentials: 'include',
    getAccessToken: () => tokenManager.getToken(),
    onRefreshToken: async (): Promise<string> => {
      await refreshManager.refresh()
      const token = tokenManager.getToken()
      if (!token) {
        logger.error('No token available after refresh')
        throw new Error('No token after refresh')
      }
      return token
    },
    onAuthFailure: () => {
      logger.warn('Auth failure callback triggered — initiating logout')
      onAuthFailure()
    },
    adapter: createFetchAdapter(),
  })
}

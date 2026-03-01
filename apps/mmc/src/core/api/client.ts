import { useAuthStore } from '@/core/auth/token-store'
import { appConfig } from '@/core/config/app-config'
import type { ApiClient } from '@zidney/api-client'
import {
  createApiClient as createClient,
  createFetchAdapter,
} from '@zidney/api-client'

// ─── Re-exports for convenience ─────────────────────────────────────────────
export type {
  ApiClient,
  AppError,
  ClientResponse,
  RequestConfig,
} from '@zidney/api-client'

export { ErrorCodes, isAppError } from '@zidney/api-client'

// ─── Lazy singleton ────────────────────────────────────────────────────────
// Defers useAuthStore() until first call — eliminates Pinia activation race.

let _apiClient: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (!_apiClient) {
    const auth = useAuthStore()
    _apiClient = createClient({
      baseUrl: appConfig.env.apiBaseUrl,
      getAccessToken: () => auth.getAccessToken(),
      onRefreshToken: async () => {
        // eslint-disable-next-line no-restricted-globals
        const response = await fetch(
          `${appConfig.env.apiBaseUrl}/auth/refresh`,
          {
            method: 'POST',
            credentials: 'include',
          }
        )
        if (!response.ok) {
          throw new Error('Token refresh failed')
        }
        const data = (await response.json()) as {
          data: { accessToken: string }
        }
        auth.setAccessToken(data.data.accessToken)
        return data.data.accessToken
      },
      onAuthFailure: () => {
        auth.clearAccessToken()
        const storeWithRouter = auth as unknown as {
          router?: { push: (path: string) => void }
        }
        storeWithRouter.router?.push('/login')
      },
      adapter: createFetchAdapter(),
    })
  }
  return _apiClient
}

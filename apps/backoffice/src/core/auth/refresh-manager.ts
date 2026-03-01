/**
 * Single-flight token refresh orchestration for Backoffice.
 * Guarantees at most one in-flight refresh HTTP call regardless of concurrent 401s.
 *
 * INVARIANTS:
 * - `inFlight` check + assignment is atomic within the current microtask tick (JS cooperative concurrency).
 * - All concurrent callers receive the same Promise<void> reference.
 * - `finally` clears the lock after completion (success or failure).
 * - `onLogout` is called exactly once inside `catch` per failed refresh cycle.
 * - Zero imports from Pinia or auth.store — onLogout is injected by main.ts.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { createLogger } from '@zidney/logger'
import type { ITokenManager } from './token-manager'

const logger = createLogger('auth:refresh-manager')

// ─── Interface ───────────────────────────────────────────────────────────────
export interface IRefreshManager {
  /**
   * Initiates a token refresh or joins an in-flight refresh.
   * Resolves when the new token is available in TokenManager.
   * Rejects when refresh fails — onLogout callback is automatically triggered.
   */
  refresh(): Promise<void>
  /** Returns true if a refresh request is currently in flight */
  isRefreshing(): boolean
}

/** Factory type for dependency-injection purposes */
export type RefreshManagerFactory = (
  refreshFn: () => Promise<string>,
  onLogout: () => void,
  tokenManager: ITokenManager
) => IRefreshManager

// ─── Factory ─────────────────────────────────────────────────────────────────
/**
 * Creates a refresh manager with single-flight guarantee.
 *
 * @param refreshFn - Calls POST /auth/refresh; returns new access token string.
 * @param onLogout - Calls authStore.logout(); zero compile-time dep on Pinia.
 * @param tokenManager - Stores the new token after successful refresh.
 */
export function createRefreshManager(
  refreshFn: () => Promise<string>,
  onLogout: () => void,
  tokenManager: ITokenManager
): IRefreshManager {
  let inFlight: Promise<void> | null = null

  function refresh(): Promise<void> {
    // Single-flight: if a refresh is already in progress, return same promise
    if (inFlight !== null) {
      logger.debug('Refresh already in flight — joining existing promise')
      return inFlight
    }

    logger.debug('Initiating new token refresh')

    inFlight = refreshFn()
      .then((newToken: string) => {
        tokenManager.setToken(newToken)
        logger.info('Token refresh succeeded')
      })
      .catch((err: unknown) => {
        logger.error('Token refresh failed — triggering logout', {
          error: err instanceof Error ? err.message : 'unknown',
        })
        onLogout()
        return Promise.reject(err)
      })
      .finally(() => {
        inFlight = null
      })

    return inFlight
  }

  function isRefreshing(): boolean {
    return inFlight !== null
  }

  return { refresh, isRefreshing }
}

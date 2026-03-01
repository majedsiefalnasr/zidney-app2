/**
 * In-memory access token holder for Backoffice.
 * Single source of truth for the runtime access token.
 *
 * SECURITY INVARIANTS:
 * - Token lives in reactive Vue ref — no browser storage of any kind.
 * - Token value is NEVER logged — only metadata is logged.
 * - The internal ref is NOT exported — access only via the interface.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { createLogger } from '@zidney/logger'
import { ref } from 'vue'

const logger = createLogger('auth:token-manager')

// ─── Interface ───────────────────────────────────────────────────────────────
export interface ITokenManager {
  /** Returns the current in-memory access token or null if not set */
  getToken(): string | null
  /** Stores the access token in reactive memory — no browser storage side effects */
  setToken(token: string): void
  /** Destroys the access token from reactive memory */
  clearToken(): void
  /** Returns true if a token is currently held in memory */
  hasToken(): boolean
}

// ─── Factory ─────────────────────────────────────────────────────────────────
/**
 * Creates a new token manager instance.
 * Created once in main.ts and passed to createRefreshManager + createAppApiClient.
 * NOT a module-level singleton — prevents import-time side effects and aids test isolation.
 */
export function createTokenManager(): ITokenManager {
  const _token = ref<string | null>(null)

  return {
    getToken(): string | null {
      return _token.value
    },

    setToken(token: string): void {
      // NEVER log token value — only log metadata
      logger.debug('Access token stored in memory')
      _token.value = token
    },

    clearToken(): void {
      logger.debug('Access token cleared from memory')
      _token.value = null
    },

    hasToken(): boolean {
      return _token.value !== null
    },
  }
}

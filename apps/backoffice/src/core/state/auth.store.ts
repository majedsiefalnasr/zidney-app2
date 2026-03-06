/**
 * Pinia reactive auth state store for Backoffice.
 * Single source of truth for isAuthenticated, user, isLoading, authError.
 * Delegates all network operations to injected IAuthService.
 *
 * INVARIANTS:
 * - FR-07: Token is NEVER exposed as a getter — tokenManager is injected but not returned.
 * - FR-05: No direct HTTP calls — all delegated to authService.
 * - FR-06: No permission checks or role comparisons.
 * - FR-36: logout() is idempotent — no-op if not authenticated or already loading.
 * - MEDIUM-02: isLoading is set to false AFTER router.push() resolves — NOT inside resetState().
 * - CL-02: No circular module import — getRefreshManager is a lazy runtime callback.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { createLogger } from '@zidney/logger'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Router } from 'vue-router'
import type { IAuthService } from '../auth/auth.service'
import type { IRefreshManager } from '../auth/refresh-manager'
import type { ITokenManager } from '../auth/token-manager'
import type { AuthError, AuthUser } from '../auth/types'

const logger = createLogger('auth:auth-store')

const AUTH_STORE_ID = 'backoffice-auth' as const

// ─── Factory ──────────────────────────────────────────────────────────────────
/**
 * Returns a Pinia store definition with all dependencies injected.
 * Creates a new store factory; call the returned function with a Pinia instance.
 *
 * @param authService - HTTP auth operations (login, logout, refreshToken, fetchProfile)
 * @param tokenManager - In-memory access token holder
 * @param router - Vue Router instance for post-logout redirect
 * @param loginRouteName - App-specific login route name (e.g. 'bo-login')
 * @param getRefreshManager - Lazy accessor to avoid creation-order circular dep (CL-02)
 */
export function defineAuthStore(
  authService: IAuthService,
  tokenManager: ITokenManager,
  router: Router,
  loginRouteName: string,
  getRefreshManager: () => IRefreshManager | null
) {
  return defineStore(AUTH_STORE_ID, () => {
    // ── State ──────────────────────────────────────────────────────────────
    const isAuthenticated = ref<boolean>(false)
    const user = ref<AuthUser | null>(null)
    const isLoading = ref<boolean>(false)
    const authError = ref<AuthError | null>(null)
    const resolvedPermissions = ref<Record<string, boolean>>({})

    // ── Helpers ────────────────────────────────────────────────────────────

    /**
     * Resets auth state to initial values.
     * NOTE (MEDIUM-02): isLoading is intentionally NOT reset here.
     * Each action manages its own isLoading lifecycle explicitly.
     */
    function resetState(): void {
      isAuthenticated.value = false
      user.value = null
      authError.value = null
      resolvedPermissions.value = {} // clear stale permissions on logout/expire
      // isLoading is managed per-action — NOT reset here (MEDIUM-02)
    }

    function buildResolvedPermissions(profile: AuthUser): Record<string, boolean> {
      const perms = (profile as any).permissions
      if (!perms) return {}
      if (Array.isArray(perms)) {
        return Object.fromEntries(perms.map((p: string) => [p, true]))
      }
      return perms as Record<string, boolean>
    }

    function setError(code: AuthError['code'], message: string): void {
      authError.value = { code, message }
    }

    // ── Actions ────────────────────────────────────────────────────────────

    /**
     * FR-32/FR-33: Called at bootstrap in main.ts before router resolves.
     * Silently attempts to refresh the session via httpOnly cookie.
     * Does NOT redirect on failure — user was not previously logged in.
     */
    async function initSession(): Promise<void> {
      isLoading.value = true
      authError.value = null

      try {
        const { accessToken } = await authService.refreshToken()
        tokenManager.setToken(accessToken)
        const profile = await authService.fetchProfile()
        user.value = profile
        isAuthenticated.value = true
        resolvedPermissions.value = buildResolvedPermissions(profile)
        logger.info('Session initialized', { userId: profile.id })
      } catch (err: unknown) {
        logger.info('Session initialization failed — treating as unauthenticated', {
          error: err instanceof Error ? err.message : 'unknown',
        })
        // FR-33: failure sets unauthenticated state — no redirect at this point
        resetState()
        setError('AUTH_INIT_FAILED', 'Session initialization failed')
      } finally {
        isLoading.value = false
      }
    }

    /**
     * FR-04: Called after successful login — receives token + profile from login response.
     */
    function setSession(accessToken: string, profile: AuthUser): void {
      tokenManager.setToken(accessToken)
      user.value = profile
      isAuthenticated.value = true
      isLoading.value = false
      authError.value = null
      resolvedPermissions.value = buildResolvedPermissions(profile)
      logger.info('Session established', { userId: profile.id })
    }

    /**
     * Delegates to refresh-manager (single-flight protected).
     * Called by API client's onRefreshToken handler or directly by feature modules.
     * Returns true on successful refresh, false on failure (never throws).
     */
    async function refresh(): Promise<boolean> {
      const rm = getRefreshManager()
      if (!rm) {
        logger.warn('refresh() called before refreshManager was initialized')
        return false
      }
      try {
        await rm.refresh()
        logger.debug('Token refreshed via store action')
        return true
      } catch (err: unknown) {
        logger.error('Token refresh failed via store action', {
          error: err instanceof Error ? err.message : 'unknown',
        })
        return false
      }
    }

    /**
     * FR-35: Coordinated logout — backend invalidation + unconditional state teardown.
     * FR-36: Idempotent — no effect if already logged out or logout in progress.
     * MEDIUM-02: isLoading is set to false AFTER router.push() resolves.
     */
    async function logout(): Promise<void> {
      // MEDIUM-02: isLoading guard prevents concurrent/duplicate logout calls
      if (isLoading.value) {
        logger.debug('logout() called while already loading — no-op')
        return
      }

      // FR-36: idempotency — no-op if already logged out
      if (!isAuthenticated.value) {
        logger.debug('logout() called when already logged out — no-op')
        return
      }

      isLoading.value = true

      try {
        // FR-30: fire-and-forget — backend logout is non-fatal
        await authService.logout()
      } catch {
        // Ignored — logout is unconditional (FR-30)
      } finally {
        // Step 1: Clear token from memory
        tokenManager.clearToken()

        // Step 2: Reset auth state (NOT isLoading — MEDIUM-02)
        resetState()

        // Step 3: Navigate to login
        await router.push({ name: loginRouteName })

        // MEDIUM-02: Set isLoading false AFTER navigation resolves
        isLoading.value = false

        logger.info('User logged out')
      }
    }

    /**
     * FR-04: Clears the authError field.
     */
    function clearAuthError(): void {
      authError.value = null
    }

    /**
     * FR-SEC-07/FR-SEC-08: Session expiry triggered by a 401 on an authenticated session.
     * Called from error.interceptor.ts → onSessionExpired callback in main.ts.
     *
     * INVARIANTS:
     * - Idempotency guard: no-op if already unauthenticated (isAuthenticated === false)
     * - Does NOT call authService.logout() — the server already invalidated the session
     * - Sets authError AFTER navigation so it is not cleared by navigation-triggered reactions
     * - Does NOT call clearUserSpecificStores() — that is the responsibility of the
     *   onSessionExpired callback in main.ts (C2/PF-02 architectural decision)
     *
     * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
     */
    async function expireSession(): Promise<void> {
      // Idempotency: skip if already handling expiry (not authenticated)
      if (!isAuthenticated.value) {
        logger.debug('expireSession() called when already unauthenticated — no-op')
        return
      }

      // Step 1: Clear token from memory immediately
      tokenManager.clearToken()

      // Step 2: Reset auth state (isAuthenticated, user, authError, resolvedPermissions)
      isAuthenticated.value = false
      user.value = null
      authError.value = null
      resolvedPermissions.value = {} // stale permissions must not persist past expiry

      // Step 3: Navigate to login
      await router.push({ name: loginRouteName })

      // Step 4: Set session-expired error AFTER navigation so it is not cleared
      // by any navigation-triggered store reaction.
      authError.value = {
        code: 'AUTH_SESSION_EXPIRED',
        message: 'Session expired. Please sign in again.',
      }

      logger.info('Session expired — user redirected to login')
    }

    return {
      // State (reactive refs — readonly to components)
      isAuthenticated,
      user,
      isLoading,
      authError,
      resolvedPermissions,
      // Actions
      initSession,
      setSession,
      refresh,
      logout,
      clearAuthError,
      expireSession,
    }
  })
}

/**
 * Component accessor composable for the Backoffice auth store.
 * Requires the store to be registered by main.ts (via defineAuthStore) before use.
 * In tests, createTestingPinia overrides this automatically.
 */
export const useBackofficeAuthStore = defineStore(AUTH_STORE_ID, () => ({
  isAuthenticated: ref(false),
  user: ref<AuthUser | null>(null),
  isLoading: ref(false),
  authError: ref<AuthError | null>(null),
  resolvedPermissions: ref<Record<string, boolean>>({}),
  initSession: async (): Promise<void> => {},
  setSession: (_accessToken: string, _profile: AuthUser): void => {},
  refresh: async (): Promise<boolean> => false,
  logout: async (): Promise<void> => {},
  clearAuthError: (): void => {},
  expireSession: async (): Promise<void> => {},
}))

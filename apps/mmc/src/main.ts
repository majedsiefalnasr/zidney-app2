/**
 * MMC Application Bootstrap
 * Implements the 9-step auth module wiring sequence (CL-01).
 *
 * Bootstrap order is critical — dependencies must be wired in the correct sequence:
 *   Step 1: Pinia
 *   Step 2: Router factory — createAppRouter() (guards registered below, NOT in router/index.ts)
 *   Step 3: Token Manager
 *   Step 4: Auth Service (via forward-reference proxy to apiClient)
 *   Step 5: Auth Store (defineAuthStore factory + instantiate)
 *   Step 6: Refresh Manager + wire lazy accessor
 *   Step 7: API Client (wires tokenManager + refreshManager)
 *   Step 8:   registerGuards() — guard pipeline with sessionInitialized gate (CL-01)
 *   Step 8.5: Register global error handlers (appLogger + window listeners)
 *   Step 9:   Mount
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */

// Step 0: Validate environment config at import time — throws early if misconfigured
import '@/core/config/app-config'

import { createLogger } from '@zidney/logger'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
// Auth module imports
import type { ApiClient } from '@/core/api/client'
import { createAppApiClient } from '@/core/api/client'
import { createErrorInterceptor } from '@/core/api/interceptors/error.interceptor'
import type { AuthServiceApiClient } from '@/core/auth/auth.service'
import { createAuthService } from '@/core/auth/auth.service'
import type { IRefreshManager } from '@/core/auth/refresh-manager'
import { createRefreshManager } from '@/core/auth/refresh-manager'
import { createTokenManager } from '@/core/auth/token-manager'
// ── Step 2: Router factory (guards NOT registered here — registered via registerGuards)
import {
  registerGlobalErrorHandlers,
  unregisterGlobalErrorHandlers,
} from '@/core/errors/global-error-handler'
import { registerGuards } from '@/core/guards'
import { createAppRouter } from '@/core/router'
import { defineAuthStore } from '@/core/state/auth.store'
import { useLicenseStatusStore } from '@/core/state/license-status.store'
import App from './App.vue'

// App-specific route name constants — NOT shared in core/auth/
const LOGIN_ROUTE = 'mmc-login'
const DASHBOARD_ROUTE = 'mmc-dashboard'

// ── Step 1: Create Pinia ───────────────────────────────────────────────────────
const pinia = createPinia()
pinia.use(createPersistedState()) // FR-021, FR-034: register before any store instantiation

// ── Step 2: Create Router ──────────────────────────────────────────────────────
const router = createAppRouter()

// ── Step 3: Create Token Manager ───────────────────────────────────────────────
const tokenManager = createTokenManager()

// ── Step 4: Create Auth Service (forward-reference to apiClient via closure) ────
// apiClient is created in Step 7; authService delegates through a proxy
// so that by the time auth methods are called, apiClient will be populated.
// eslint-disable-next-line prefer-const
let apiClient!: ApiClient

const apiClientProxy: AuthServiceApiClient = {
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
}

const authService = createAuthService(apiClientProxy)

// ── Step 5: Create Auth Store ───────────────────────────────────────────────────
// refreshManager lazy accessor: avoids creation-order circular dep (CL-02)
let refreshManagerInstance: IRefreshManager | null = null

const useAuthStore = defineAuthStore(
  authService,
  tokenManager,
  router,
  LOGIN_ROUTE,
  () => refreshManagerInstance
)
const authStore = useAuthStore(pinia)

// ── Step 5b: Create License Status Store ───────────────────────────────────────
const licenseStatusStore = useLicenseStatusStore(pinia)

// ── Step 5c: Create Error Interceptor ─────────────────────────────────────────
// C2/PF-02: clearUserSpecificStores() is called here in the main.ts callback,
// NOT inside auth.store.ts:expireSession(). This keeps expireSession() a pure
// auth-state teardown and allows session-bound stores to be enumerated here as
// feature stages add them.
function clearUserSpecificStores(): void {
  // Feature stores registered here as stages land.
  // Example: dashboardStore.$reset()
}

const errorInterceptor = createErrorInterceptor({
  getIsAuthenticated: () => authStore.isAuthenticated,
  onSessionExpired: async () => {
    await authStore.expireSession() // clears auth state only
    clearUserSpecificStores() // clears all session-bound UI stores
  },
  onLicenseError: (status) => {
    if (status === 423) licenseStatusStore.setWorkspaceLocked(true)
    if (status === 426) licenseStatusStore.setUpgradeRequired(true)
  },
})

// ── Step 6: Create Refresh Manager + wire lazy accessor ────────────────────────
const refreshManager = createRefreshManager(
  () => authService.refreshToken().then((r) => r.accessToken),
  () => void authStore.logout(),
  tokenManager
)
refreshManagerInstance = refreshManager // wire lazy accessor

// ── Step 7: Create API Client ───────────────────────────────────────────────────
apiClient = createAppApiClient(tokenManager, refreshManager, errorInterceptor)

// ── Step 8: Register guard pipeline (CL-01) ────────────────────────────────────
// registerGuards handles sessionInitialized gate, AuthGuard, RoleGuard, FeatureFlagGuard
// pipeline and router.onError → mmc-error (OBS-02).
registerGuards(router, {
  isAuthenticated: () => authStore.isAuthenticated,
  getUserRole: () => authStore.user?.role,
  loginRouteName: LOGIN_ROUTE,
  dashboardRouteName: DASHBOARD_ROUTE,
  unauthorizedRouteName: 'mmc-unauthorized',
  errorRouteName: 'mmc-error',
  initSession: () => authStore.initSession(),
})

// ── Step 9: Mount ──────────────────────────────────────────────────────────────
const app = createApp(App)
app.use(pinia)
app.use(router)

// ── Step 9.1: Register global error handlers ──────────────────────────────────
const appLogger = createLogger('[MMC]')
app.provide('appLogger', appLogger)
const IS_PROD = import.meta.env.PROD
app.provide('isProduction', IS_PROD)
// Defensive: unregister previous handlers before registering new ones
unregisterGlobalErrorHandlers()
registerGlobalErrorHandlers({
  onError: (err) => {
    appLogger.error('unhandled error', { code: err.code, httpStatus: err.httpStatus })
  },
  logger: appLogger,
  isProduction: IS_PROD,
})

app.mount('#app')

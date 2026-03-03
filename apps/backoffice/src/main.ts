/**
 * Backoffice Application Bootstrap
 * Implements the 9-step auth module wiring sequence (CL-01).
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */

// Step 0: Validate environment config at import time — throws early if misconfigured
import '@/core/config/app-config'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'

// ── Step 2: Router factory (guards NOT registered here — registered via registerGuards)
// Use relative imports to avoid root tsconfig @/* path alias resolving to MMC first
import { useContextStore } from '@/stores/context'
import { registerGuards } from './core/guards'
import { createAppRouter } from './core/router'

// Auth module imports
import type { ApiClient } from '@/core/api/client'
import { createAppApiClient } from '@/core/api/client'
import { createErrorInterceptor } from '@/core/api/interceptors/error.interceptor'
import type { AuthServiceApiClient } from '@/core/auth/auth.service'
import { createAuthService } from '@/core/auth/auth.service'
import type { IRefreshManager } from '@/core/auth/refresh-manager'
import { createRefreshManager } from '@/core/auth/refresh-manager'
import { createTokenManager } from '@/core/auth/token-manager'
import { defineAuthStore } from '@/core/state/auth.store'
import { useLicenseStatusStore } from '@/core/state/license-status.store'

// App-specific route name constants — NOT shared in core/auth/
const LOGIN_ROUTE = 'bo-login'
const DASHBOARD_ROUTE = 'bo-dashboard'

// ── Step 1: Create Pinia ───────────────────────────────────────────
const pinia = createPinia()

// ── Step 2: Create Router ───────────────────────────────────────────
const router = createAppRouter()

// ── Step 2b: Create Context Store (Pinia must exist first) ──────────
const contextStore = useContextStore(pinia)

// ── Step 3: Create Token Manager ─────────────────────────────────────────
const tokenManager = createTokenManager()

// ── Step 4: Create Auth Service (forward-reference to apiClient via closure) ────
// eslint-disable-next-line prefer-const
let apiClient!: ApiClient

const apiClientProxy: AuthServiceApiClient = {
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
}

const authService = createAuthService(apiClientProxy)

// ── Step 5: Create Auth Store ───────────────────────────────────────────
let refreshManagerInstance: IRefreshManager | null = null

const useAuthStore = defineAuthStore(
  authService,
  tokenManager,
  router,
  LOGIN_ROUTE,
  () => refreshManagerInstance
)
const authStore = useAuthStore(pinia)
// ── Step 5b: Create License Status Store ───────────────────────
const licenseStatusStore = useLicenseStatusStore(pinia)

// ── Step 5c: Create Error Interceptor ─────────────────────────
// C2/PF-02: clearUserSpecificStores() is called here in the main.ts callback,
// NOT inside auth.store.ts:expireSession().
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
// ── Step 6: Create Refresh Manager + wire lazy accessor ───────────────────
const refreshManager = createRefreshManager(
  () => authService.refreshToken().then((r) => r.accessToken),
  () => void authStore.logout(),
  tokenManager
)
refreshManagerInstance = refreshManager

// ── Step 7: Create API Client ───────────────────────────────────────────
apiClient = createAppApiClient(tokenManager, refreshManager, errorInterceptor)

// ── Step 8: Register guard pipeline (CL-01) ────────────────────────────
// registerGuards handles sessionInitialized gate, AuthGuard, WorkspaceGuard,
// RoleGuard, FeatureFlagGuard pipeline and router.onError → bo-error (OBS-02).
registerGuards(router, {
  isAuthenticated: () => authStore.isAuthenticated,
  getUserRole: () => authStore.user?.role,
  loginRouteName: LOGIN_ROUTE,
  dashboardRouteName: DASHBOARD_ROUTE,
  unauthorizedRouteName: 'bo-unauthorized',
  errorRouteName: 'bo-error',
  initSession: () => authStore.initSession(),
  isWorkspaceResolved: () => contextStore.context !== null,
  workspaceSelectorRouteName: 'bo-workspace-selector',
})

// ── Step 9: Mount ───────────────────────────────────────────────────────────
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')

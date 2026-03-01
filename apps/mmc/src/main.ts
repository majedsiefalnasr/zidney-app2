/**
 * MMC Application Bootstrap
 * Implements the 9-step auth module wiring sequence (CL-01).
 *
 * Bootstrap order is critical — dependencies must be wired in the correct sequence:
 *   Step 1: Pinia
 *   Step 2: Router (imported — guards registered below, NOT in router/index.ts)
 *   Step 3: Token Manager
 *   Step 4: Auth Service (via forward-reference proxy to apiClient)
 *   Step 5: Auth Store (defineAuthStore factory + instantiate)
 *   Step 6: Refresh Manager + wire lazy accessor
 *   Step 7: API Client (wires tokenManager + refreshManager)
 *   Step 8: Auth Guard + sessionInitialized gate (CL-01)
 *   Step 9: Mount
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */

// Step 0: Validate environment config at import time — throws early if misconfigured
import '@/core/config/app-config'

import { createPinia } from 'pinia'
import { createApp, ref } from 'vue'
import App from './App.vue'

// ── Step 2: Import pre-created router (guards NOT yet registered) ─────────────
import { router } from '@/core/router'

// Auth module imports
import type { ApiClient } from '@/core/api/client'
import { createAppApiClient } from '@/core/api/client'
import type { AuthServiceApiClient } from '@/core/auth/auth.service'
import { createAuthService } from '@/core/auth/auth.service'
import type { IRefreshManager } from '@/core/auth/refresh-manager'
import { createRefreshManager } from '@/core/auth/refresh-manager'
import { createTokenManager } from '@/core/auth/token-manager'
import { createAuthGuard } from '@/core/router/guards/auth.guard'
import { defineAuthStore } from '@/core/state/auth.store'

// App-specific route name constants — NOT shared in core/auth/
const LOGIN_ROUTE = 'mmc-login'
const DASHBOARD_ROUTE = 'mmc-dashboard'

// ── Step 1: Create Pinia ───────────────────────────────────────────────────────
const pinia = createPinia()

// ── Step 3: Create Token Manager ───────────────────────────────────────────────
const tokenManager = createTokenManager()

// ── Step 4: Create Auth Service (forward-reference to apiClient via closure) ────
// apiClient is created in Step 7; authService delegates through a proxy
// so that by the time auth methods are called, apiClient will be populated.
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

// ── Step 6: Create Refresh Manager + wire lazy accessor ────────────────────────
const refreshManager = createRefreshManager(
  () => authService.refreshToken().then((r) => r.accessToken),
  () => void authStore.logout(),
  tokenManager
)
refreshManagerInstance = refreshManager // wire lazy accessor

// ── Step 7: Create API Client ───────────────────────────────────────────────────
apiClient = createAppApiClient(
  tokenManager,
  refreshManager,
  () => void authStore.logout()
)

// ── Step 8: Register Auth Guard with sessionInitialized gate (CL-01) ──────────
// The sessionInitialized gate ensures initSession() is called exactly once —
// on the first navigation — before any guard evaluation.
const sessionInitialized = ref(false)

const authGuard = createAuthGuard(() => authStore.isAuthenticated, {
  loginRouteName: LOGIN_ROUTE,
  dashboardRouteName: DASHBOARD_ROUTE,
})

router.beforeEach(async (to, from) => {
  if (!sessionInitialized.value) {
    await authStore.initSession()
    sessionInitialized.value = true
  }
  return authGuard(to, from, () => {})
})

// ── Step 9: Mount ──────────────────────────────────────────────────────────────
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')

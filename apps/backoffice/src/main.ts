/**
 * Backoffice Application Bootstrap
 * Implements the 9-step auth module wiring sequence (CL-01).
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */

// Step 0: Validate environment config at import time — throws early if misconfigured
import '@/core/config/app-config'

import { createApp, ref } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// ── Step 2: Import pre-created router (guards NOT yet registered) ──────────
import { router } from '@/core/router'

// Auth module imports
import { createTokenManager } from '@/core/auth/token-manager'
import { createRefreshManager } from '@/core/auth/refresh-manager'
import type { IRefreshManager } from '@/core/auth/refresh-manager'
import { createAuthService } from '@/core/auth/auth.service'
import type { AuthServiceApiClient } from '@/core/auth/auth.service'
import { createAppApiClient } from '@/core/api/client'
import type { ApiClient } from '@/core/api/client'
import { defineAuthStore } from '@/core/state/auth.store'
import { createAuthGuard } from '@/core/router/guards/auth.guard'

// App-specific route name constants — NOT shared in core/auth/
const LOGIN_ROUTE = 'bo-login'
const DASHBOARD_ROUTE = 'bo-dashboard'

// ── Step 1: Create Pinia ───────────────────────────────────────────
const pinia = createPinia()

// ── Step 3: Create Token Manager ─────────────────────────────────────────
const tokenManager = createTokenManager()

// ── Step 4: Create Auth Service (forward-reference to apiClient via closure) ────
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

// ── Step 6: Create Refresh Manager + wire lazy accessor ───────────────────
const refreshManager = createRefreshManager(
  () => authService.refreshToken().then((r) => r.accessToken),
  () => void authStore.logout(),
  tokenManager
)
refreshManagerInstance = refreshManager

// ── Step 7: Create API Client ───────────────────────────────────────────
apiClient = createAppApiClient(
  tokenManager,
  refreshManager,
  () => void authStore.logout()
)

// ── Step 8: Register Auth Guard with sessionInitialized gate (CL-01) ───────
const sessionInitialized = ref(false)

const authGuard = createAuthGuard(
  () => authStore.isAuthenticated,
  { loginRouteName: LOGIN_ROUTE, dashboardRouteName: DASHBOARD_ROUTE }
)

router.beforeEach(async (to, from) => {
  if (!sessionInitialized.value) {
    await authStore.initSession()
    sessionInitialized.value = true
  }
  return authGuard(to, from, () => {})
})

// ── Step 9: Mount ───────────────────────────────────────────────────────────
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')

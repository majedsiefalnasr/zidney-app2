/**
 * Shared test helpers for auth module unit tests.
 * All factories are pure — no module-level side effects.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { IAuthService } from '../../../src/core/auth/auth.service'
import type { ITokenManager } from '../../../src/core/auth/token-manager'
import type { AuthUser } from '../../../src/core/auth/types'

// ─── Mock Auth Service ────────────────────────────────────────────────────────

const DEFAULT_USER: AuthUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
}

export function createMockAuthService(): IAuthService {
  return {
    login: vi.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      user: DEFAULT_USER,
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshToken: vi.fn().mockResolvedValue({ accessToken: 'refreshed-token' }),
    fetchProfile: vi.fn().mockResolvedValue(DEFAULT_USER),
  }
}

// ─── Mock Token Manager ───────────────────────────────────────────────────────

export function createMockTokenManager(): ITokenManager {
  let _token: string | null = null
  return {
    getToken: vi.fn(() => _token),
    setToken: vi.fn((t: string) => {
      _token = t
    }),
    clearToken: vi.fn(() => {
      _token = null
    }),
    hasToken: vi.fn(() => _token !== null),
  }
}

// ─── Test Router ──────────────────────────────────────────────────────────────

export function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: {} },
      {
        path: '/login',
        name: 'mmc-login',
        meta: { guestOnly: true },
        component: {},
      },
      {
        path: '/dashboard',
        name: 'mmc-dashboard',
        meta: { requiresAuth: true },
        component: {},
      },
      {
        path: '/admin',
        name: 'mmc-admin',
        meta: { requiresAuth: true, requiredRole: 'admin' },
        component: {},
      },
    ],
  })
}

// ─── Pinia Setup ──────────────────────────────────────────────────────────────

export function setupTestPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

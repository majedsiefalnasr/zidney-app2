/**
 * Unit tests for Frontoffice defineAuthStore factory.
 *
 * Test coverage:
 * - Default state: isAuthenticated: false, user: null, isLoading: false, authError: null
 * - isAuthenticated computed reactivity via setSession
 * - logout() clears auth state (user, isAuthenticated, authError)
 * - storeToRefs() output has no token field (FR-07)
 * - authError is AuthError | null (not AppError — auth module has its own type)
 * - clearAuthError() zeroes authError
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 * Refs: QA-H001, FR-026, FR-027, SC-003
 */
import type { AuthUser } from '@/core/auth/types'
import { defineAuthStore } from '@/core/state/auth.store'
import { storeToRefs } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsolatedPinia } from '../store-test-helper'

// ─── Stubs ─────────────────────────────────────────────────────────────────────

function createStubAuthService() {
  return {
    login: vi.fn().mockResolvedValue({ accessToken: 'tok', user: null }),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshToken: vi.fn().mockResolvedValue({ accessToken: 'new-tok' }),
    fetchProfile: vi.fn().mockResolvedValue({
      id: 'fo-u1',
      email: 'fo@example.com',
      name: 'FO User',
    } satisfies AuthUser),
  }
}

function createStubTokenManager() {
  return {
    getToken: vi.fn().mockReturnValue(null),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    hasToken: vi.fn().mockReturnValue(false),
  }
}

function createStubRouter() {
  return {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    currentRoute: { value: { name: 'fo-home' } },
  } as any
}

const sampleUser: AuthUser = {
  id: 'fo-u1',
  email: 'student@example.com',
  name: 'Student User',
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Frontoffice: defineAuthStore (frontoffice-auth)', () => {
  useIsolatedPinia()

  let useAuthStore: ReturnType<typeof defineAuthStore>

  beforeEach(() => {
    const authService = createStubAuthService()
    const tokenManager = createStubTokenManager()
    const router = createStubRouter()

    useAuthStore = defineAuthStore(
      authService,
      tokenManager,
      router,
      'fo-login',
      () => null
    )
  })

  it('default state: isAuthenticated false, user null, isLoading false, authError null (FR-026)', () => {
    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(store.authError).toBeNull()
  })

  it('store id is "frontoffice-auth" (FR-032)', () => {
    const store = useAuthStore()
    expect(store.$id).toBe('frontoffice-auth')
  })

  it('isAuthenticated becomes true after setSession (computed reactivity)', () => {
    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(false)
    store.setSession('access-token-123', sampleUser)

    expect(store.isAuthenticated).toBe(true)
    expect(store.user).toEqual(sampleUser)
    expect(store.isLoading).toBe(false)
    expect(store.authError).toBeNull()
  })

  it('logout() clears isAuthenticated, user, and authError (FR-036)', async () => {
    const store = useAuthStore()

    // Set authenticated state
    store.setSession('access-token-123', sampleUser)
    expect(store.isAuthenticated).toBe(true)

    // Logout — triggers state teardown
    await store.logout()

    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
    expect(store.authError).toBeNull()
  })

  it('storeToRefs() has no token field (FR-07 — token never exposed)', () => {
    const store = useAuthStore()
    const refs = storeToRefs(store)

    // Token must NOT be exposed as a reactive ref
    expect('token' in refs).toBe(false)
    expect('accessToken' in refs).toBe(false)

    // Only valid reactive state fields
    expect('isAuthenticated' in refs).toBe(true)
    expect('user' in refs).toBe(true)
    expect('isLoading' in refs).toBe(true)
    expect('authError' in refs).toBe(true)
  })

  it('authError is typed as AuthError | null (not generic Error)', () => {
    const store = useAuthStore()

    // Initially null
    expect(store.authError).toBeNull()

    // After a failed initSession, authError has code + message shape
    store.$patch({
      authError: {
        code: 'AUTH_INIT_FAILED',
        message: 'Session initialization failed',
      },
    })

    expect(store.authError).not.toBeNull()
    expect(store.authError).toHaveProperty('code', 'AUTH_INIT_FAILED')
    expect(store.authError).toHaveProperty(
      'message',
      'Session initialization failed'
    )
    expect(typeof store.authError!.code).toBe('string')
    expect(typeof store.authError!.message).toBe('string')
  })

  it('clearAuthError() zeroes authError (FR-04)', () => {
    const store = useAuthStore()

    store.$patch({
      authError: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Bad credentials',
      },
    })
    expect(store.authError).not.toBeNull()

    store.clearAuthError()
    expect(store.authError).toBeNull()
  })

  it('state is isolated between tests (SC-005)', () => {
    // Each test gets a fresh pinia via useIsolatedPinia() in beforeEach
    const store = useAuthStore()

    // This test should see clean state regardless of prior tests
    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('logout() is idempotent when already logged out (FR-036)', async () => {
    const store = useAuthStore()

    // Already unauthenticated — second logout should be no-op
    await store.logout()
    await store.logout()

    // Still in clean state, no throws
    expect(store.isAuthenticated).toBe(false)
  })
})

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../src/core/auth/index'
import { useAuthStore } from '../../../src/core/auth/token-store'

afterEach(() => vi.resetAllMocks())

const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('../../../src/core/api/client', () => ({
  getApiClient: () => ({
    delete: vi.fn().mockResolvedValue({ success: true, data: null }),
  }),
}))

describe('useAuth (Backoffice)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('isAuthenticated is false when no token', () => {
    const { isAuthenticated } = useAuth()
    expect(isAuthenticated.value).toBe(false)
  })

  it('isAuthenticated is true when token is set', () => {
    const store = useAuthStore()
    store.setAccessToken('bo-token')
    const { isAuthenticated } = useAuth()
    expect(isAuthenticated.value).toBe(true)
  })

  it('currentUser is null when not logged in', () => {
    const { currentUser } = useAuth()
    expect(currentUser.value).toBeNull()
  })

  it('currentUser reflects token store user with workspaceSlug', () => {
    const store = useAuthStore()
    const user = {
      id: '1',
      email: 'instructor@org.com',
      role: 'instructor',
      workspaceSlug: 'acme',
    }
    store.setUser(user)
    const { currentUser } = useAuth()
    expect(currentUser.value).toEqual(user)
  })

  it('logout: clears access token from store', async () => {
    const store = useAuthStore()
    store.setAccessToken('bo-token')

    const { logout } = useAuth()
    await logout()

    expect(store.accessToken).toBeNull()
  })

  it('logout: calls router.push("/login")', async () => {
    const { logout } = useAuth()
    await logout()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('logout: does NOT write to localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const { logout } = useAuth()
    await logout()
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})

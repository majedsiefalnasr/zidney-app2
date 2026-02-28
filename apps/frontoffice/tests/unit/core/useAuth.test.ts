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

describe('useAuth (Frontoffice)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('isAuthenticated is false when no token (student context)', () => {
    const { isAuthenticated } = useAuth()
    expect(isAuthenticated.value).toBe(false)
  })

  it('isAuthenticated is true when student token is set', () => {
    const store = useAuthStore()
    store.setAccessToken('student-token')
    const { isAuthenticated } = useAuth()
    expect(isAuthenticated.value).toBe(true)
  })

  it('currentUser is null when student not logged in', () => {
    const { currentUser } = useAuth()
    expect(currentUser.value).toBeNull()
  })

  it('currentUser reflects student token store user (no workspaceSlug)', () => {
    const store = useAuthStore()
    const user = { id: '1', email: 'student@school.com', role: 'student' }
    store.setUser(user)
    const { currentUser } = useAuth()
    expect(currentUser.value).toEqual(user)
  })

  it('logout: clears student access token from store', async () => {
    const store = useAuthStore()
    store.setAccessToken('student-token')

    const { logout } = useAuth()
    await logout()

    expect(store.accessToken).toBeNull()
  })

  it('logout: calls router.push("/login") for student', async () => {
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

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../src/core/auth/token-store'

afterEach(() => vi.resetAllMocks())

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('starts with null accessToken', () => {
      const store = useAuthStore()
      expect(store.accessToken).toBeNull()
    })

    it('starts with null user', () => {
      const store = useAuthStore()
      expect(store.user).toBeNull()
    })

    it('starts as not authenticated', () => {
      const store = useAuthStore()
      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('setAccessToken', () => {
    it('stores access token in memory', () => {
      const store = useAuthStore()
      store.setAccessToken('my-token')
      expect(store.accessToken).toBe('my-token')
    })

    it('does NOT write to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      const store = useAuthStore()
      store.setAccessToken('my-token')
      expect(setItemSpy).not.toHaveBeenCalled()
    })

    it('does NOT write to sessionStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      const store = useAuthStore()
      store.setAccessToken('my-token')
      expect(setItemSpy).not.toHaveBeenCalled()
    })

    it('sets isAuthenticated to true when token is set', () => {
      const store = useAuthStore()
      store.setAccessToken('my-token')
      expect(store.isAuthenticated).toBe(true)
    })
  })

  describe('getAccessToken', () => {
    it('returns null when no token set', () => {
      const store = useAuthStore()
      expect(store.getAccessToken()).toBeNull()
    })

    it('returns token when token is set', () => {
      const store = useAuthStore()
      store.setAccessToken('abc-token')
      expect(store.getAccessToken()).toBe('abc-token')
    })
  })

  describe('clearAccessToken', () => {
    it('clears the access token', () => {
      const store = useAuthStore()
      store.setAccessToken('my-token')
      store.clearAccessToken()
      expect(store.accessToken).toBeNull()
    })

    it('sets isAuthenticated to false after clear', () => {
      const store = useAuthStore()
      store.setAccessToken('my-token')
      store.clearAccessToken()
      expect(store.isAuthenticated).toBe(false)
    })

    it('clears the user after clearAccessToken', () => {
      const store = useAuthStore()
      store.setUser({
        id: '1',
        email: 'test@example.com',
        role: 'instructor',
        workspaceSlug: 'acme',
      })
      store.clearAccessToken()
      expect(store.user).toBeNull()
    })
  })

  describe('setUser', () => {
    it('stores user in memory with workspaceSlug', () => {
      const store = useAuthStore()
      const user = {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        workspaceSlug: 'acme-corp',
      }
      store.setUser(user)
      expect(store.user).toEqual(user)
    })

    it('does NOT write user to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      const store = useAuthStore()
      store.setUser({ id: '1', email: 'admin@example.com', role: 'admin' })
      expect(setItemSpy).not.toHaveBeenCalled()
    })
  })
})

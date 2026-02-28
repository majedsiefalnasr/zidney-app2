import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface AuthUser {
  id: string
  email: string
  role: string
  workspaceSlug?: undefined
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)

  const isAuthenticated = computed(() => accessToken.value !== null)

  function setAccessToken(token: string): void {
    accessToken.value = token
  }

  function clearAccessToken(): void {
    accessToken.value = null
    user.value = null
  }

  function getAccessToken(): string | null {
    return accessToken.value
  }

  function setUser(authUser: AuthUser): void {
    user.value = authUser
  }

  return {
    accessToken,
    user,
    isAuthenticated,
    setAccessToken,
    clearAccessToken,
    getAccessToken,
    setUser,
  }
})

export type TokenStore = ReturnType<typeof useAuthStore>

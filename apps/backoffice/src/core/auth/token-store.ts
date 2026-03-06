import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface TokenUser {
  id?: string
  email?: string
  role?: string
  workspaceSlug?: string
  name?: string
}

export const useAuthStore = defineStore('backoffice-token-store', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<TokenUser | null>(null)
  const isAuthenticated = computed(() => accessToken.value !== null)

  function setAccessToken(token: string): void {
    accessToken.value = token
  }

  function getAccessToken(): string | null {
    return accessToken.value
  }

  function clearAccessToken(): void {
    accessToken.value = null
    user.value = null
  }

  function setUser(u: TokenUser): void {
    user.value = u
  }

  return {
    accessToken,
    user,
    isAuthenticated,
    setAccessToken,
    getAccessToken,
    clearAccessToken,
    setUser,
  }
})

// ─── Type ────────────────────────────────────────────────────────────────────

export interface TokenStore {
  accessToken: string | null
  user: TokenUser | null
  isAuthenticated: boolean
  getAccessToken(): string | null
  setAccessToken(token: string): void
  clearAccessToken(): void
  setUser(u: TokenUser): void
  $id: string
  $patch(...args: unknown[]): void
  $reset(): void
  $subscribe(...args: unknown[]): void
  $onAction(...args: unknown[]): void
  $dispose(): void
  router?: { push(to: unknown): Promise<void> | void }
}

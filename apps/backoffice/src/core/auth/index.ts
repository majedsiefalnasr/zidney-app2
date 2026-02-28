import { getApiClient } from '@/core/api/client'
import type { AuthUser } from '@/core/auth/token-store'
import { useAuthStore } from '@/core/auth/token-store'
import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

export interface UseAuthReturn {
  isAuthenticated: ComputedRef<boolean>
  currentUser: ComputedRef<AuthUser | null>
  logout(): Promise<void>
}

export function useAuth(): UseAuthReturn {
  const tokenStore = useAuthStore()
  const router = useRouter()

  const isAuthenticated = computed(() => tokenStore.isAuthenticated)
  const currentUser = computed(() => tokenStore.user)

  async function logout(): Promise<void> {
    try {
      await getApiClient().delete('/auth/logout')
    } catch {
      // Best-effort — discard error
    }
    tokenStore.clearAccessToken()
    await router.push('/login')
  }

  return { isAuthenticated, currentUser, logout }
}

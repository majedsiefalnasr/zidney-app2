import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { getApiClient } from '../api/client'
import { useAuthStore } from './token-store'

/**
 * Backoffice auth composable.
 * Provides reactive isAuthenticated, currentUser, and logout.
 */
export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()

  const isAuthenticated = computed(() => store.isAuthenticated)
  const currentUser = computed(() => store.user)

  async function logout(): Promise<void> {
    try {
      await getApiClient().delete('/auth/logout')
    } catch {
      // ignore errors — always clear and redirect
    }
    store.clearAccessToken()
    await router.push('/login')
  }

  return { isAuthenticated, currentUser, logout }
}

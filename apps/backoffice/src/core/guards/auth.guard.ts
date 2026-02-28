import type { useAuthStore } from '@/core/auth/token-store'
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

export type GuardResult = true | RouteLocationRaw

export interface GuardContext {
  to: RouteLocationNormalized
  from: RouteLocationNormalized
  authStore: ReturnType<typeof useAuthStore>
}

export type Guard = (
  context: GuardContext
) => GuardResult | Promise<GuardResult>

export const authGuard: Guard = ({ to, authStore }): GuardResult => {
  if (!to.meta['requiresAuth']) return true
  if (authStore.isAuthenticated) return true
  return { name: 'login' }
}

import { useAuthStore } from '@/core/auth/token-store'
import { authGuard } from '@/core/guards/auth.guard'
import { roleGuard } from '@/core/guards/role.guard'
import type { Router, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiredRole?: string
  }
}

const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'not-found',
  component: () => import('@/shared/views/NotFound.vue'),
}

export const router: Router = createRouter({
  history: createWebHistory(),
  routes: [notFoundRoute],
})

router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()

  const authResult = await authGuard({ to, from, authStore })
  if (authResult !== true) return authResult

  const roleResult = await roleGuard({ to, from, authStore })
  if (roleResult !== true) return roleResult

  return true
})

export default router

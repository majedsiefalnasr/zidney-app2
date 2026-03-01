/**
 * MMC router factory.
 * Guards are NOT registered here — they are registered in main.ts only (CL-01).
 * This separation ensures the bootstrap sequence is respected.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { dashboardRoutes } from '@/modules/dashboard/routes'
import { licensesRoutes } from '@/modules/licenses/routes'
import type { Router, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

// Apply RouteMeta augmentation for this app
import '@/core/router/types'

const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'not-found',
  component: () => import('@/shared/views/NotFound.vue'),
}

// All application routes (guards registered in main.ts, not here)
export const routes: RouteRecordRaw[] = [
  ...dashboardRoutes,
  ...licensesRoutes,
  notFoundRoute,
]

/**
 * Creates the MMC router instance.
 * Guards must be registered by the caller (main.ts) after this returns.
 */
export function createAppRouter(): Router {
  return createRouter({
    history: createWebHistory(),
    routes,
  })
}

// Legacy export for backward compatibility — same as createAppRouter()
export const router: Router = createAppRouter()

export default router

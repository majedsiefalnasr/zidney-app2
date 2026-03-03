/**
 * Backoffice router factory.
 * Guards are NOT registered here — they are registered in main.ts only (CL-01).
 * This separation ensures the bootstrap sequence is respected.
 *
 * Factory accepts optional history for testability (createMemoryHistory in tests).
 * No singleton export — caller (main.ts) owns the router instance.
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import type { Router, RouteRecordRaw, RouterHistory } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

// Apply RouteMeta augmentation for this app
import '@/core/router/types'

const loginRoute: RouteRecordRaw = {
  path: '/login',
  name: 'bo-login',
  component: () => import('@/shared/views/NotFoundView.vue'), // TODO(STAGE_UI_01): replace with real LoginPage when auth module is ready
  meta: { public: true },
}

const dashboardRoute: RouteRecordRaw = {
  path: '/',
  name: 'bo-dashboard',
  component: () => import('@/views/Dashboard.vue'),
  meta: { requiresAuth: true, requiresWorkspace: true },
}

const workspaceSelectorRoute: RouteRecordRaw = {
  path: '/select-workspace',
  name: 'bo-workspace-selector',
  component: () => import('@/shared/views/NotFoundView.vue'), // placeholder — replaced by workspace module
  meta: { requiresAuth: true },
}

const workspaceUnavailableRoute: RouteRecordRaw = {
  path: '/unavailable',
  name: 'bo-workspace-unavailable',
  component: () => import('@/views/WorkspaceLocked.vue'),
  meta: { requiresAuth: true },
}

const unauthorizedRoute: RouteRecordRaw = {
  path: '/unauthorized',
  name: 'bo-unauthorized',
  component: () => import('@/shared/views/UnauthorizedView.vue'),
  meta: { public: true },
}

const errorRoute: RouteRecordRaw = {
  path: '/error',
  name: 'bo-error',
  component: () => import('@/shared/views/GlobalErrorView.vue'),
  meta: { public: true },
}

const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'bo-not-found',
  component: () => import('@/shared/views/NotFoundView.vue'),
  meta: { public: true },
}

// All application routes (guards registered in main.ts, not here)
export const routes: RouteRecordRaw[] = [
  loginRoute,
  dashboardRoute,
  workspaceSelectorRoute,
  workspaceUnavailableRoute,
  unauthorizedRoute,
  errorRoute,
  notFoundRoute,
]

/**
 * Creates the Backoffice router instance.
 * Guards must be registered by the caller (main.ts) after this returns.
 *
 * @param history - Optional router history (defaults to createWebHistory).
 *                  Pass createMemoryHistory() in tests.
 */
export function createAppRouter(history?: RouterHistory): Router {
  return createRouter({
    history: history ?? createWebHistory(),
    routes,
  })
}

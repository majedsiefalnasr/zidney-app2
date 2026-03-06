/**
 * Frontoffice router factory.
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
  name: 'fo-login',
  component: () => import('@/shared/views/NotFoundView.vue'), // TODO(STAGE_UI_01): replace with real LoginPage when auth module is ready
  meta: { public: true, standaloneLayout: true },
}

const homeRoute: RouteRecordRaw = {
  path: '/',
  name: 'fo-home',
  component: () => import('@/shared/views/NotFoundView.vue'), // TODO(STAGE_UI_04): replace with real home page when exam runtime is ready
  meta: { requiresAuth: true },
}

const unauthorizedRoute: RouteRecordRaw = {
  path: '/unauthorized',
  name: 'fo-unauthorized',
  component: () => import('@/shared/views/UnauthorizedView.vue'),
  meta: { public: true, standaloneLayout: true },
}

const errorRoute: RouteRecordRaw = {
  path: '/error',
  name: 'fo-error',
  component: () => import('@/shared/views/GlobalErrorView.vue'),
  meta: { public: true, standaloneLayout: true },
}

const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'fo-not-found',
  component: () => import('@/shared/views/NotFoundView.vue'),
  meta: { public: true, standaloneLayout: true },
}

// All application routes (guards registered in main.ts, not here)
export const routes: RouteRecordRaw[] = [
  loginRoute,
  homeRoute,
  unauthorizedRoute,
  errorRoute,
  notFoundRoute,
]

/**
 * Creates the Frontoffice router instance.
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

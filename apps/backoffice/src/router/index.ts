/**
 * Backoffice Vue Router — STAGE_17
 *
 * File: apps/backoffice/src/router/index.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Creates Vue Router v4 with navigation guards for:
 * 1. License gate — redirects to /unavailable when workspace is not ACTIVE
 * 2. Module gate — redirects to dashboard when required module is not licensed
 *
 * Context is loaded lazily on first navigation if not already present.
 * Guards do NOT fire if the route is workspace-unavailable (to prevent redirect loops).
 *
 * Constitutional Compliance:
 * ✓ No hardcoded workspace identity — slug comes from context store
 * ✓ License error code from store (not HTTP status) — FR-02.8
 * ✓ Module gate uses hasModule() from contextStore
 */

import type { Module } from '@zidney/types'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/unavailable',
    name: 'workspace-unavailable',
    component: () => import('../views/WorkspaceLocked.vue'),
    meta: { requiresAuth: false },
  },
  // Future module routes — register here with requiredModule meta:
  // {
  //   path: '/mcq',
  //   name: 'mcq',
  //   component: () => import('../views/mcq/McqList.vue'),
  //   meta: { requiresAuth: true, requiredModule: Module.MCQ },
  // },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

let contextLoaded = false

router.beforeEach(async (to, _from, next) => {
  // Lazy import to avoid circular dep
  const { useContextStore } = await import('../stores/context')
  const contextStore = useContextStore()

  // Allow non-auth routes (workspace-unavailable) through without loading context
  if (to.meta.requiresAuth === false) {
    return next()
  }

  // Load context if not loaded yet
  if (!contextLoaded && !contextStore.context && !contextStore.loading) {
    await contextStore.loadContext()
    contextLoaded = true
  }

  // License gate — redirect on non-ACTIVE workspace
  if (!contextStore.isActive) {
    if (to.name === 'workspace-unavailable') {
      return next()
    }
    return next({
      name: 'workspace-unavailable',
      query: { code: contextStore.licenseErrorCode ?? 'UNKNOWN' },
    })
  }

  // Module gate — redirect to dashboard if required module is not enabled
  const requiredModule = to.meta.requiredModule as Module | undefined
  if (requiredModule && !contextStore.hasModule(requiredModule)) {
    return next({ name: 'dashboard' })
  }

  next()
})

export default router

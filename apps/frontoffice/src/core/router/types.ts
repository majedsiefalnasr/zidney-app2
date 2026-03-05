/**
 * Vue Router RouteMeta augmentation for Frontoffice.
 * Defines canonical meta fields for the guard pipeline.
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import type { RouteMeta as VueRouteMeta } from 'vue-router'

// Extend Vue Router's RouteMeta interface with canonical fields
declare module 'vue-router' {
  interface RouteMeta {
    /** Route requires authentication. Default: false */
    requiresAuth?: boolean
    /** Accessible without authentication. MUST be explicit. */
    public?: boolean
    /** UI-level role hints (non-authoritative). Backend is the final authority. */
    roles?: string[]
    /** Backoffice only: requires workspace context to be resolved. */
    requiresWorkspace?: boolean
    /** Layout bypass: route renders directly without AppLayout shell */
    standaloneLayout?: boolean
    /** Frontoffice only: hides AppSidebar for this route (AppLayout still renders) */
    hideSidebar?: boolean
  }
}

/**
 * Canonical RouteMeta interface extending Vue Router's RouteMeta.
 * Use this type in route definitions and guard implementations.
 *
 * Replaces legacy: guestOnly, requiredRole, requiredModule
 */
export interface RouteMeta extends VueRouteMeta {
  /** Route requires authentication. Default: false */
  requiresAuth?: boolean
  /** Accessible without authentication. MUST be explicit. */
  public?: boolean
  /** UI-level role hints (non-authoritative). Backend is the final authority. */
  roles?: string[]
  /** Backoffice only: requires workspace context to be resolved. */
  requiresWorkspace?: boolean
  /** Layout bypass: route renders directly without AppLayout shell */
  standaloneLayout?: boolean
  /** Frontoffice only: hides AppSidebar for this route (AppLayout still renders) */
  hideSidebar?: boolean
}

/**
 * Convenience alias for canonical RouteMeta.
 * Replaces the legacy AuthRouteMeta alias.
 */
export type AppRouteMeta = RouteMeta

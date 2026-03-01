/**
 * Vue Router RouteMeta augmentation for Backoffice.
 * Adds auth-specific fields to the global RouteMeta type.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */

// Extend Vue Router's RouteMeta interface with auth fields
declare module 'vue-router' {
  interface RouteMeta {
    /** When true: unauthenticated users are redirected to the login route */
    requiresAuth?: boolean
    /** When true: authenticated users are redirected to the dashboard route */
    guestOnly?: boolean
    /** Required role string — for use by role guard (not auth guard) */
    requiredRole?: string
    /** When true: workspace context must be established */
    requiresWorkspace?: boolean
  }
}

// Convenience type alias for use in guards and route definitions
export interface AuthRouteMeta {
  requiresAuth?: boolean
  guestOnly?: boolean
}

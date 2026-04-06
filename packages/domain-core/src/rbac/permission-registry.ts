/**
 * Permission Registry — STAGE_21
 *
 * File: packages/domain-core/src/rbac/permission-registry.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * SINGLE SOURCE OF TRUTH for the route → (module, action) permission mapping.
 *
 * The API-layer shim at apps/api/src/middleware/route-permission-registry.ts
 * re-exports everything from this file. Adding or removing routes requires
 * updating THIS file only.
 *
 * Fail-closed: lookupPermission returns null for unregistered non-public routes.
 * The guard treats null → 403. A route that is not registered AND not public
 * will always result in access denied.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure data and utility function
 * ✓ No framework dependencies
 * ✓ All module keys map to PermissionModule enum values
 * ✓ Public routes are explicitly listed — not derived from absence in registry
 */

import { type PermissionAction, PermissionModule } from './rbac.types'

// ---------------------------------------------------------------------------
// Route permission entry shape
// ---------------------------------------------------------------------------

export interface RoutePermissionEntry {
  module: PermissionModule
  action: PermissionAction
}

// ---------------------------------------------------------------------------
// ROUTE_PERMISSION_REGISTRY
//
// Maps "METHOD /path/pattern" → { module, action }
//
// Rules:
// - Every protected backoffice route MUST appear here.
// - Routes absent from registry AND not in PUBLIC_ROUTES → 403 (fail-closed).
// - Must stay in sync with the 9 role route handlers in roles.ts.
// - module values MUST match PermissionModule enum (enforced by TypeScript type).
// ---------------------------------------------------------------------------

export const ROUTE_PERMISSION_REGISTRY: Record<string, RoutePermissionEntry> = {
  // -------------------------------------------------------------------------
  // Role management routes (all require `settings` module access)
  // -------------------------------------------------------------------------

  /** GET /api/v1/backoffice/workspace/roles — list roles (paginated) */
  'GET /api/v1/backoffice/workspace/roles': {
    module: PermissionModule.SETTINGS,
    action: 'can_view',
  },

  /** POST /api/v1/backoffice/workspace/roles — create a role */
  'POST /api/v1/backoffice/workspace/roles': {
    module: PermissionModule.SETTINGS,
    action: 'can_create',
  },

  /** GET /api/v1/backoffice/workspace/roles/:id — fetch role + permissions */
  'GET /api/v1/backoffice/workspace/roles/:id': {
    module: PermissionModule.SETTINGS,
    action: 'can_view',
  },

  /** PATCH /api/v1/backoffice/workspace/roles/:id — update name/description/status */
  'PATCH /api/v1/backoffice/workspace/roles/:id': {
    module: PermissionModule.SETTINGS,
    action: 'can_edit',
  },

  /** PUT /api/v1/backoffice/workspace/roles/:id/permissions — full-replace permissions */
  'PUT /api/v1/backoffice/workspace/roles/:id/permissions': {
    module: PermissionModule.SETTINGS,
    action: 'can_edit',
  },

  /** DELETE /api/v1/backoffice/workspace/roles/:id — delete a role */
  'DELETE /api/v1/backoffice/workspace/roles/:id': {
    module: PermissionModule.SETTINGS,
    action: 'can_delete',
  },

  /** GET /api/v1/backoffice/workspace/roles/:id/users — users with this role */
  'GET /api/v1/backoffice/workspace/roles/:id/users': {
    module: PermissionModule.SETTINGS,
    action: 'can_view',
  },

  /** PATCH /api/v1/backoffice/workspace/staff/:userId/role — assign role to staff user */
  'PATCH /api/v1/backoffice/workspace/staff/:userId/role': {
    module: PermissionModule.USERS,
    action: 'can_edit',
  },

  /** GET /api/v1/backoffice/workspace/role-permission-modules — static module list */
  'GET /api/v1/backoffice/workspace/role-permission-modules': {
    module: PermissionModule.SETTINGS,
    action: 'can_view',
  },

  // -------------------------------------------------------------------------
  // Promocode routes (Stage 045)
  // -------------------------------------------------------------------------

  /** GET /api/v1/backoffice/workspace/promocodes — list promocodes */
  'GET /api/v1/backoffice/workspace/promocodes': {
    module: PermissionModule.PROMOCODES,
    action: 'can_view',
  },

  /** POST /api/v1/backoffice/workspace/promocodes — create a promocode */
  'POST /api/v1/backoffice/workspace/promocodes': {
    module: PermissionModule.PROMOCODES,
    action: 'can_create',
  },

  /** GET /api/v1/backoffice/workspace/promocodes/analytics — aggregate analytics */
  'GET /api/v1/backoffice/workspace/promocodes/analytics': {
    module: PermissionModule.PROMOCODES,
    action: 'can_view',
  },

  /** POST /api/v1/backoffice/workspace/promocodes/validate — validate a code for a student */
  'POST /api/v1/backoffice/workspace/promocodes/validate': {
    module: PermissionModule.PROMOCODES,
    action: 'can_view',
  },

  /** GET /api/v1/backoffice/workspace/promocodes/:id — fetch single promocode */
  'GET /api/v1/backoffice/workspace/promocodes/:id': {
    module: PermissionModule.PROMOCODES,
    action: 'can_view',
  },

  /** POST /api/v1/backoffice/workspace/promocodes/:id/deactivate — deactivate */
  'POST /api/v1/backoffice/workspace/promocodes/:id/deactivate': {
    module: PermissionModule.PROMOCODES,
    action: 'can_edit',
  },
} as const

// ---------------------------------------------------------------------------
// PUBLIC_ROUTES
//
// Routes that do NOT require a module permission check.
// Authentication (JWT) may still be required — guards merely skip the
// permission evaluation step for these paths.
// -------------------------------------------------------------------------
export const PUBLIC_ROUTES = new Set<string>([
  'GET /api/v1/backoffice/health',
  'GET /api/v1/backoffice/context', // auth required but no module permission check
])

// ---------------------------------------------------------------------------
// lookupPermission
//
// Returns the RoutePermissionEntry for the given method + path, or null if:
//   1. The route is in PUBLIC_ROUTES (no permission check needed)
//   2. The route is not registered (fail-closed — caller should treat as 403)
// ---------------------------------------------------------------------------

/**
 * Look up the required permission for a route.
 *
 * @param method - HTTP method (e.g. 'GET', 'POST')
 * @param path   - Route path pattern (e.g. '/api/v1/backoffice/workspace/roles')
 * @returns RoutePermissionEntry if route is protected and registered;
 *          null if route is public or unregistered (fail-closed).
 */
export function lookupPermission(method: string, path: string): RoutePermissionEntry | null {
  const key = `${method.toUpperCase()} ${path}`

  if (PUBLIC_ROUTES.has(key)) return null

  return ROUTE_PERMISSION_REGISTRY[key] ?? null
}

/**
 * Route Permission Registry — API Layer Shim
 *
 * File: apps/api/src/middleware/route-permission-registry.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * THIS FILE IS A THIN RE-EXPORT SHIM over the domain package.
 * The single source of truth for the route → (module, action) registry lives at:
 *   packages/domain-core/src/rbac/permission-registry.ts
 *
 * Do NOT add route entries here. To add or modify routes:
 *   → Edit packages/domain-core/src/rbac/permission-registry.ts
 *
 * Fail-closed: unregistered non-public routes resolve to null.
 * Permission guard treats null → 403.
 *
 * Constitutional Compliance:
 * ✓ No business logic
 * ✓ Imports from domain package (apps/* → packages/* is allowed)
 * ✓ No circular dependencies
 */

export {
  PUBLIC_ROUTES,
  ROUTE_PERMISSION_REGISTRY,
  lookupPermission,
  type RoutePermissionEntry,
} from '@zidney/domain-core/rbac'

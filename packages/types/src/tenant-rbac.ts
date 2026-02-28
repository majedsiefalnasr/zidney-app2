/**
 * Tenant RBAC Types — STAGE_17
 *
 * File: packages/types/src/tenant-rbac.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 * Date: 2026-02-28
 *
 * Defines types for Backoffice RBAC within the tenant DB.
 * Separate from MMC-layer RBAC (rbac.ts / MasterDBPermission).
 *
 * Constitutional Compliance:
 * ✓ Tenant-scoped types only — no master_db references
 * ✓ No HTTP logic, no framework dependencies
 * ✓ ADR-0001: database-per-tenant isolation enforced at type layer
 */

import type { Module as ModuleType } from './enums/Module'

// Re-export Module enum and labels so consumers can import from @zidney/types
export { ALL_MODULES, Module, MODULE_LABELS } from './enums/Module'

/**
 * Actions that can be performed on a module.
 * Maps to the `action` column CHECK constraint in role_permissions.
 */
export enum ActionEnum {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
}

/**
 * A single permission entry: the ability to perform `action` on `module`.
 */
export interface TenantRBACPermission {
  module: ModuleType
  action: ActionEnum
}

/**
 * The runtime context object injected into every Backoffice request.
 * Produced by the License Enforcement middleware, consumed read-only by Backoffice.
 * Never recomputed inside Backoffice; always treated as authoritative for the request lifetime.
 */
export interface BackofficeContext {
  workspace_id: string
  workspace_slug: string
  license_status: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED'
  enabled_modules: ModuleType[]
  student_limit: number | null // null = unlimited
  staff_limit: number | null // null = unlimited
  product_version: string // semver, e.g. "2.1.0"
  schema_version: number // integer version counter
  request_id: string // correlation ID
}

/**
 * Staff user context as set in Hono `c.set('staff_user', ...)` by Authentication middleware.
 * Contains all fields needed for RBAC enforcement and audit logging.
 */
export interface StaffUserContext {
  user_id: string
  workspace_id: string
  email: string
  role_id: string
  permissions: TenantRBACPermission[]
  token_version: number
}

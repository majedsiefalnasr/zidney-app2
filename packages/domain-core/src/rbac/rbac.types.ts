/**
 * RBAC Domain Types — STAGE_21
 *
 * File: packages/domain-core/src/rbac/rbac.types.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * Pure TypeScript type definitions for the RBAC permission system.
 * No HTTP logic. No framework dependencies.
 *
 * Constitutional Compliance:
 * ✓ Pure types — no runtime logic
 * ✓ No framework imports
 * ✓ Single source of truth for RBAC domain types
 */

// ---------------------------------------------------------------------------
// Audit action allowlist (single source of truth for domain layer)
// ---------------------------------------------------------------------------

/**
 * Valid action values for rbac_audit_logs.action.
 * Mirrored in the Drizzle schema CHECK constraint (apps/api).
 * The domain layer owns this list; the schema file re-exports it.
 */
export const RBAC_AUDIT_ACTIONS = [
  'CREATE_ROLE',
  'UPDATE_ROLE',
  'DISABLE_ROLE',
  'DELETE_ROLE',
  'UPDATE_PERMISSIONS',
  'ASSIGN_ROLE',
] as const

export type RbacAuditAction = (typeof RBAC_AUDIT_ACTIONS)[number]

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Role lifecycle status.
 * ACTIVE  → role operational; a staff user with this role can access protected routes.
 * DISABLED → role inactive; guard returns 403 even if the user has role_id set.
 */
export enum RoleStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

/**
 * Permission module keys — the 12 functional areas of the Backoffice.
 * Stored as varchar in DB; validated against this enum at application layer.
 * No DB enum is used — extensible without a migration.
 */
export enum PermissionModule {
  ACADEMIC_STRUCTURE = 'academic_structure',
  CONTENT_CLASSIFICATION = 'content_classification',
  EXAM_ENGINE = 'exam_engine',
  USERS = 'users',
  COMMERCIAL = 'commercial',
  MEDIA_ASSETS = 'media_assets',
  COMMUNICATION = 'communication',
  ADS = 'ads',
  DASHBOARD = 'dashboard',
  SETTINGS = 'settings',
  PLANS = 'plans',
  SUBSCRIPTIONS = 'subscriptions',
  PROMOCODES = 'promocodes',
  INVOICES = 'invoices',
}

/**
 * Per-row permission action flags.
 * Map to the four boolean columns on backoffice_role_module_permissions.
 */
export type PermissionAction = 'can_view' | 'can_create' | 'can_edit' | 'can_delete'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * The four boolean permission flags for a single (role, module) pair.
 * Absent row in DB evaluated as all-false (FR-018 deny-by-default).
 */
export interface PermissionFlags {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

/**
 * Full role object with all permission module rows hydrated.
 * Used by service functions that return complete role data.
 */
export interface RoleWithPermissions {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: RoleStatus
  created_at: Date
  updated_at: Date
  permissions: Record<string, PermissionFlags>
}

/**
 * Context object passed to permission evaluation logic.
 * Constructed by the permission guard middleware from DB + JWT data.
 */
export interface PermissionGuardContext {
  /** JWT subject — the staff user's UUID. */
  user_id: string
  /** Workspace UUID from tenant resolver. */
  workspace_id: string
  /** Workspace slug from tenant resolver (for logging). */
  workspace_slug: string
  /** Correlation/request ID for tracing. */
  correlation_id: string
  /** Permission module being checked. */
  module: PermissionModule
  /** Permission action being checked. */
  action: PermissionAction
}

/**
 * Audit entry written to rbac_audit_logs within a DB transaction.
 * All fields are required except metadata.
 */
export interface RbacAuditEntry {
  user_id: string | null
  role_id: string | null
  module: string | null
  action: string
  request_id: string
  workspace_slug: string
  metadata?: Record<string, unknown> | null
}

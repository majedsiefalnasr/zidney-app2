/**
 * Role-Based Access Control (RBAC) Permissions Matrix
 *
 * File: packages/types/src/rbac.ts
 * Task: T020
 * Phase: 4 - Validation and Utility Functions
 *
 * Defines permissions for each MMC user role:
 * - admin: Full access to all operations
 * - operator: Limited management (create, read, update)
 * - read_only: Read-only access to resources
 */

import { MMCUserRole } from './master-db'

// ========================================================================
// PERMISSION DEFINITIONS
// ========================================================================

export enum MasterDBPermission {
  // Product operations
  CREATE_PRODUCT = 'create_product',
  READ_PRODUCT = 'read_product',
  UPDATE_PRODUCT = 'update_product',
  DELETE_PRODUCT = 'delete_product',
  LIST_PRODUCTS = 'list_products',

  // License operations
  CREATE_LICENSE = 'create_license',
  READ_LICENSE = 'read_license',
  UPDATE_LICENSE = 'update_license',
  DELETE_LICENSE = 'delete_license',
  LIST_LICENSES = 'list_licenses',
  MANAGE_LICENSE_STATE = 'manage_license_state', // Transition ACTIVE → SOFT_LOCKED → ARCHIVED

  // Tenant registry operations
  CREATE_TENANT = 'create_tenant',
  READ_TENANT = 'read_tenant',
  UPDATE_TENANT = 'update_tenant',
  DELETE_TENANT = 'delete_tenant',
  LIST_TENANTS = 'list_tenants',

  // MMC user management
  CREATE_MMC_USER = 'create_mmc_user',
  READ_MMC_USER = 'read_mmc_user',
  UPDATE_MMC_USER = 'update_mmc_user',
  DELETE_MMC_USER = 'delete_mmc_user',
  LIST_MMC_USERS = 'list_mmc_users',

  // Platform administration
  MANAGE_SCHEMA_VERSION = 'manage_schema_version',
  VIEW_AUDIT_LOG = 'view_audit_log',
}

// ========================================================================
// ROLE PERMISSION MAPPING
// ========================================================================

/**
 * Permission matrix for each role
 *
 * Role hierarchy:
 * - admin: Full privileges
 * - operator: Can create and manage licenses/tenants (no product/user management, no version control)
 * - read_only: Read and list only
 */
export const RolePermissions: Record<MMCUserRole, MasterDBPermission[]> = {
  [MMCUserRole.ADMIN]: [
    // Product: Full CRUD
    MasterDBPermission.CREATE_PRODUCT,
    MasterDBPermission.READ_PRODUCT,
    MasterDBPermission.UPDATE_PRODUCT,
    MasterDBPermission.DELETE_PRODUCT,
    MasterDBPermission.LIST_PRODUCTS,

    // License: Full CRUD + state management
    MasterDBPermission.CREATE_LICENSE,
    MasterDBPermission.READ_LICENSE,
    MasterDBPermission.UPDATE_LICENSE,
    MasterDBPermission.DELETE_LICENSE,
    MasterDBPermission.LIST_LICENSES,
    MasterDBPermission.MANAGE_LICENSE_STATE,

    // Tenant: Full CRUD
    MasterDBPermission.CREATE_TENANT,
    MasterDBPermission.READ_TENANT,
    MasterDBPermission.UPDATE_TENANT,
    MasterDBPermission.DELETE_TENANT,
    MasterDBPermission.LIST_TENANTS,

    // MMC User: Full CRUD
    MasterDBPermission.CREATE_MMC_USER,
    MasterDBPermission.READ_MMC_USER,
    MasterDBPermission.UPDATE_MMC_USER,
    MasterDBPermission.DELETE_MMC_USER,
    MasterDBPermission.LIST_MMC_USERS,

    // Platform: Full access
    MasterDBPermission.MANAGE_SCHEMA_VERSION,
    MasterDBPermission.VIEW_AUDIT_LOG,
  ],

  [MMCUserRole.OPERATOR]: [
    // Product: Read-only
    MasterDBPermission.READ_PRODUCT,
    MasterDBPermission.LIST_PRODUCTS,

    // License: Create, read, update, manage state (no delete)
    MasterDBPermission.CREATE_LICENSE,
    MasterDBPermission.READ_LICENSE,
    MasterDBPermission.UPDATE_LICENSE,
    MasterDBPermission.LIST_LICENSES,
    MasterDBPermission.MANAGE_LICENSE_STATE,

    // Tenant: Create, read, update (no delete)
    MasterDBPermission.CREATE_TENANT,
    MasterDBPermission.READ_TENANT,
    MasterDBPermission.UPDATE_TENANT,
    MasterDBPermission.LIST_TENANTS,

    // MMC User: Read only
    MasterDBPermission.READ_MMC_USER,
    MasterDBPermission.LIST_MMC_USERS,

    // Platform: View audit log only
    MasterDBPermission.VIEW_AUDIT_LOG,
  ],

  [MMCUserRole.READ_ONLY]: [
    // Product: Read-only
    MasterDBPermission.READ_PRODUCT,
    MasterDBPermission.LIST_PRODUCTS,

    // License: Read-only
    MasterDBPermission.READ_LICENSE,
    MasterDBPermission.LIST_LICENSES,

    // Tenant: Read-only
    MasterDBPermission.READ_TENANT,
    MasterDBPermission.LIST_TENANTS,

    // MMC User: Read-only
    MasterDBPermission.READ_MMC_USER,
    MasterDBPermission.LIST_MMC_USERS,

    // Platform: View audit log only
    MasterDBPermission.VIEW_AUDIT_LOG,
  ],
}

// ========================================================================
// PERMISSION CHECKING FUNCTIONS
// ========================================================================

/**
 * Check if a role has a specific permission
 *
 * @example
 * hasPermission(MMCUserRole.OPERATOR, MasterDBPermission.CREATE_LICENSE) // true
 * hasPermission(MMCUserRole.READ_ONLY, MasterDBPermission.CREATE_LICENSE) // false
 */
export function hasPermission(role: MMCUserRole, permission: MasterDBPermission): boolean {
  return RolePermissions[role].includes(permission)
}

/**
 * Check if a role has any of the specified permissions
 *
 * @example
 * hasAnyPermission(MMCUserRole.OPERATOR, [
 *   MasterDBPermission.CREATE_LICENSE,
 *   MasterDBPermission.DELETE_LICENSE
 * ]) // true (operator has CREATE but not DELETE)
 */
export function hasAnyPermission(role: MMCUserRole, permissions: MasterDBPermission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

/**
 * Check if a role has all specified permissions
 *
 * @example
 * hasAllPermissions(MMCUserRole.ADMIN, [
 *   MasterDBPermission.CREATE_LICENSE,
 *   MasterDBPermission.DELETE_LICENSE
 * ]) // true (admin has all)
 */
export function hasAllPermissions(role: MMCUserRole, permissions: MasterDBPermission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

/**
 * Get all permissions for a role
 *
 * @example
 * getPermissions(MMCUserRole.OPERATOR)
 */
export function getPermissions(role: MMCUserRole): MasterDBPermission[] {
  return [...RolePermissions[role]]
}

export default {
  MasterDBPermission,
  RolePermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissions,
}

/**
 * Permission Service
 *
 * File: packages/domain-core/src/services/permission.service.ts
 * Task: T022
 * Phase: 4 - Role & Permission Management
 *
 * Core business logic for permission checking and resolution:
 * - checkPermission: Check if a member can perform an action
 * - resolvePermissions: Get all permissions for a member
 * - getPermissionsForRole: Get all permissions for a role
 *
 * Properties:
 * - Pure function permission evaluation (no side effects)
 * - Explicit deny (missing permission = no access)
 * - Fail-safe by design
 * - No HTTP logic
 */

import { PermissionDomain, RolePermission } from '@zidney/types/mmc.types'
// @ts-ignore: postgres not declared as dependency of domain-core [INFRA-001-DEPS-05]
import { Database } from 'postgres'

/**
 * Permission Service
 */
export class PermissionService {
  constructor(private db: Database) {}

  /**
   * Check if member has permission for domain + action
   *
   * Returns:
   * - true: permission found and bit is true
   * - false: permission missing or bit is false (explicit deny)
   */
  async checkPermission(
    memberId: string,
    domain: PermissionDomain,
    action: 'view' | 'create' | 'edit' | 'delete'
  ): Promise<boolean> {
    // Get member's role
    const memberResult = await this.db.query(
      `SELECT role_id FROM mmc_members WHERE id = $1`,
      [memberId]
    )

    if (memberResult.rowCount === 0) {
      return false // Member not found
    }

    const roleId = memberResult.rows[0].role_id

    // Query permission
    const result = await this.db.query(
      `SELECT can_view, can_create, can_edit, can_delete
       FROM role_permissions
       WHERE role_id = $1 AND domain = $2`,
      [roleId, domain]
    )

    if (result.rowCount === 0) {
      return false // Permission row not found = implicit deny
    }

    const permission = result.rows[0]
    const permissionKey = `can_${action}`
    return permission[permissionKey] === true
  }

  /**
   * Resolve all permissions for a member
   *
   * Returns permission matrix for member's role
   */
  async resolvePermissions(memberId: string): Promise<RolePermission[] | null> {
    // Get member's role
    const memberResult = await this.db.query(
      `SELECT role_id FROM mmc_members WHERE id = $1`,
      [memberId]
    )

    if (memberResult.rowCount === 0) {
      return null // Member not found
    }

    const roleId = memberResult.rows[0].role_id

    // Get all permissions for role
    const result = await this.db.query(
      `SELECT * FROM role_permissions WHERE role_id = $1 ORDER BY domain`,
      [roleId]
    )

    return result.rows.map((r: any) => ({
      id: r.id,
      role_id: r.role_id,
      domain: r.domain,
      can_view: r.can_view,
      can_create: r.can_create,
      can_edit: r.can_edit,
      can_delete: r.can_delete,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))
  }

  /**
   * Get all permissions for a role
   */
  async getPermissionsForRole(
    roleId: string
  ): Promise<RolePermission[] | null> {
    // Check if role exists
    const roleResult = await this.db.query(
      `SELECT id FROM roles WHERE id = $1`,
      [roleId]
    )

    if (roleResult.rowCount === 0) {
      return null // Role not found
    }

    // Get permissions
    const result = await this.db.query(
      `SELECT * FROM role_permissions WHERE role_id = $1 ORDER BY domain`,
      [roleId]
    )

    return result.rows.map((r: any) => ({
      id: r.id,
      role_id: r.role_id,
      domain: r.domain,
      can_view: r.can_view,
      can_create: r.can_create,
      can_edit: r.can_edit,
      can_delete: r.can_delete,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))
  }

  /**
   * Get all permissions for specific domains for a member
   *
   * Used by permission check endpoint
   */
  async getPermissionsForDomains(
    memberId: string,
    domains: PermissionDomain[]
  ): Promise<RolePermission[]> {
    if (domains.length === 0) {
      return []
    }

    // Get member's role
    const memberResult = await this.db.query(
      `SELECT role_id FROM mmc_members WHERE id = $1`,
      [memberId]
    )

    if (memberResult.rowCount === 0) {
      return [] // Member not found
    }

    const roleId = memberResult.rows[0].role_id

    // Build query with domain list
    const placeholders = domains.map((_, i) => `$${i + 2}`).join(',')
    const query = `
      SELECT * FROM role_permissions
      WHERE role_id = $1 AND domain IN (${placeholders})
      ORDER BY domain
    `

    const result = await this.db.query(query, [roleId, ...domains])

    return result.rows.map((r: any) => ({
      id: r.id,
      role_id: r.role_id,
      domain: r.domain,
      can_view: r.can_view,
      can_create: r.can_create,
      can_edit: r.can_edit,
      can_delete: r.can_delete,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))
  }
}

/**
 * Create permission service instance
 */
export function createPermissionService(db: Database): PermissionService {
  return new PermissionService(db)
}

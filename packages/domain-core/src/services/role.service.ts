/**
 * Role Service
 *
 * File: packages/domain-core/src/services/role.service.ts
 * Task: T021
 * Phase: 4 - Role & Permission Management
 *
 * Core business logic for MMC role management:
 * - getRoles: List roles with member count
 * - getRole: Get single role
 * - getPermissions: Get permission matrix for role (7 domains)
 * - updatePermissions: Update role permissions with member token_version cascade
 * - cascadeTokenVersion: Atomic increment of all members' token_version for a role
 *
 * Properties:
 * - Permission updates cascade to all members atomically
 * - Token version increment invalidates all sessions for affected members
 * - Transactions prevent race conditions
 * - No business logic leakage to HTTP layer
 */

import { AppError, ErrorCode } from '@zidney/domain-core/errors'
import type { MMCRole, PermissionDomain, RolePermissionsMatrix } from '@zidney/types/mmc.types'
// @ts-expect-error: postgres not declared as dependency of domain-core [INFRA-001-DEPS-05]
import type { Database } from 'postgres'

export interface UpdatePermissionsRequest {
  domain: PermissionDomain
  can_view?: boolean
  can_create?: boolean
  can_edit?: boolean
  can_delete?: boolean
}

/**
 * Role Service
 */
export class RoleService {
  constructor(private db: Database) {}

  /**
   * Get all roles (optionally filtered by status)
   */
  async getRoles(status?: 'ACTIVE' | 'INACTIVE'): Promise<MMCRole[]> {
    let query = `
      SELECT r.*, COUNT(m.id) as member_count
      FROM roles r
      LEFT JOIN mmc_members m ON r.id = m.role_id
    `
    const params: unknown[] = []
    const conditions: string[] = []

    if (status) {
      conditions.push(`r.status = $${conditions.length + 1}`)
      params.push(status)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ` GROUP BY r.id ORDER BY r.name`

    const result = await this.db.query(query, params)

    return result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      member_count: parseInt(r.member_count, 10),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))
  }

  /**
   * Get single role by ID
   */
  async getRole(roleId: string): Promise<MMCRole | null> {
    const result = await this.db.query(
      `SELECT r.*, COUNT(m.id) as member_count
       FROM roles r
       LEFT JOIN mmc_members m ON r.id = m.role_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [roleId]
    )

    if (result.rowCount === 0) {
      return null
    }

    const r = result.rows[0]
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      member_count: parseInt(r.member_count, 10),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }
  }

  /**
   * Get all permissions for a role (permission matrix)
   */
  async getPermissions(roleId: string): Promise<RolePermissionsMatrix | null> {
    // Verify role exists
    const roleExists = await this.db.query(`SELECT id FROM roles WHERE id = $1`, [roleId])

    if (roleExists.rowCount === 0) {
      return null
    }

    const result = await this.db.query(
      `SELECT * FROM role_permissions WHERE role_id = $1 ORDER BY domain`,
      [roleId]
    )

    return {
      role_id: roleId,
      permissions: result.rows.map((r: any) => ({
        id: r.id,
        role_id: r.role_id,
        domain: r.domain,
        can_view: r.can_view,
        can_create: r.can_create,
        can_edit: r.can_edit,
        can_delete: r.can_delete,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    }
  }

  /**
   * Update role permissions
   *
   * Can update single domain or batch update multiple domains.
   * Atomically increments token_version for all members with this role.
   */
  async updatePermissions(
    roleId: string,
    updates: UpdatePermissionsRequest | UpdatePermissionsRequest[],
    updatedBy: string,
    correlationId: string,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<{ permissions: RolePermissionsMatrix; affected_members: number }> {
    const updateArray = Array.isArray(updates) ? updates : [updates]

    // Validate role exists
    const roleResult = await this.db.query(`SELECT id FROM roles WHERE id = $1`, [roleId])

    if (roleResult.rowCount === 0) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Role not found', 404)
    }

    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      // Store previous permissions for audit
      const previousResult = await client.query(
        `SELECT * FROM role_permissions WHERE role_id = $1`,
        [roleId]
      )
      const previousPermissions = previousResult.rows

      // Update permissions
      for (const update of updateArray) {
        await client.query(
          `INSERT INTO role_permissions (role_id, domain, can_view, can_create, can_edit, can_delete)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (role_id, domain)
           DO UPDATE SET
             can_view = COALESCE($3, role_permissions.can_view),
             can_create = COALESCE($4, role_permissions.can_create),
             can_edit = COALESCE($5, role_permissions.can_edit),
             can_delete = COALESCE($6, role_permissions.can_delete),
             updated_at = NOW()`,
          [
            roleId,
            update.domain,
            update.can_view !== undefined ? update.can_view : null,
            update.can_create !== undefined ? update.can_create : null,
            update.can_edit !== undefined ? update.can_edit : null,
            update.can_delete !== undefined ? update.can_delete : null,
          ]
        )
      }

      // Cascade token version to all members with this role
      const cascadeResult = await client.query(
        `UPDATE mmc_members
         SET token_version = token_version + 1, updated_at = NOW(), updated_by = $1
         WHERE role_id = $2 AND status = 'ACTIVE'
         RETURNING id`,
        [updatedBy, roleId]
      )

      const affectedMembers = cascadeResult.rowCount

      // Get updated permissions for response
      const updatedResult = await client.query(
        `SELECT * FROM role_permissions WHERE role_id = $1 ORDER BY domain`,
        [roleId]
      )

      const updatedPermissions = updatedResult.rows

      // Audit log
      await client.query(
        `INSERT INTO mmc_audit_log (
          actor_user_id, action_type, entity_type, entity_id,
          previous_state, new_state, correlation_id, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          updatedBy,
          'PERMISSION_BATCH_UPDATED',
          'PERMISSION',
          roleId,
          JSON.stringify({ permissions: previousPermissions }),
          JSON.stringify({
            permissions: updatedPermissions,
            affected_members: affectedMembers,
          }),
          correlationId,
          ipAddress,
          userAgent,
        ]
      )

      await client.query('COMMIT')

      const permissionsMatrix: RolePermissionsMatrix = {
        role_id: roleId,
        permissions: updatedPermissions.map((r: any) => ({
          id: r.id,
          role_id: r.role_id,
          domain: r.domain,
          can_view: r.can_view,
          can_create: r.can_create,
          can_edit: r.can_edit,
          can_delete: r.can_delete,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      }

      return {
        permissions: permissionsMatrix,
        affected_members: affectedMembers,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Check if role can be deleted
   *
   * Returns true if no members assigned
   */
  async canDelete(roleId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM mmc_members WHERE role_id = $1`,
      [roleId]
    )

    const count = parseInt(result.rows[0].count, 10)
    return count === 0
  }

  /**
   * Soft-delete role (set status to INACTIVE)
   */
  async delete(
    roleId: string,
    deletedBy: string,
    correlationId: string,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<void> {
    const canDelete = await this.canDelete(roleId)
    if (!canDelete) {
      throw new AppError(
        ErrorCode.ROLE_HAS_MEMBERS,
        'Cannot delete role with members assigned',
        409
      )
    }

    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      const result = await client.query(
        `UPDATE roles SET status = 'INACTIVE', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [roleId]
      )

      if (result.rowCount === 0) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Role not found', 404)
      }

      const role = result.rows[0]

      // Audit log
      await client.query(
        `INSERT INTO mmc_audit_log (
          actor_user_id, action_type, entity_type, entity_id,
          previous_state, new_state, correlation_id, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          deletedBy,
          'ROLE_DELETED',
          'ROLE',
          roleId,
          JSON.stringify({ name: role.name, status: 'ACTIVE' }),
          JSON.stringify({ name: role.name, status: 'INACTIVE' }),
          correlationId,
          ipAddress,
          userAgent,
        ]
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

/**
 * Create role service instance
 */
export function createRoleService(db: Database): RoleService {
  return new RoleService(db)
}

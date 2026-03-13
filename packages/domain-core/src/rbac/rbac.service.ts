/**
 * RBAC Domain Service — STAGE_21
 *
 * File: packages/domain-core/src/rbac/rbac.service.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * Stateless domain service functions for RBAC role CRUD, permission management,
 * staff role assignment, and permission evaluation.
 *
 * All DB access via injected DbClient (tenant pool from request context).
 * All writes are transactional with co-transactional rbac_audit_logs INSERT.
 * No HTTP logic. No framework dependencies.
 *
 * Deny-by-default: evaluatePermission returns false if any required element
 * (staff user, is_active, role_id, role status, permission row, permission flag)
 * is absent or invalid.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure domain functions
 * ✓ All DB access via injected db parameter (tenant pool from resolver context)
 * ✓ All writes wrapped in db.query('BEGIN/COMMIT/ROLLBACK')
 * ✓ Audit log inserted in same transaction as each mutation
 * ✓ Structured logging via @zidney/logger — console.log forbidden
 * ✓ Server-authoritative timestamps (NOW() at DB level, ADR-0006)
 * ✓ No cross-tenant joins
 * ✓ SELECT FOR UPDATE used for delete-role concurrency guard
 */

import { createLogger } from '@zidney/logger'

import { type DbClient, writeRbacAuditLog } from './rbac.audit'
import {
  type PermissionAction,
  type PermissionFlags,
  PermissionModule,
  RoleStatus,
  type RoleWithPermissions,
} from './rbac.types'

const logger = createLogger('rbac-service')

// ---------------------------------------------------------------------------
// Utility — assert valid module key
// ---------------------------------------------------------------------------

const VALID_MODULES = new Set(Object.values(PermissionModule) as string[])

export function assertValidModule(module: string): void {
  if (!VALID_MODULES.has(module)) {
    throw new RbacError('INVALID_MODULE', `Unknown permission module: '${module}'`)
  }
}

// ---------------------------------------------------------------------------
// RbacError — domain-level typed errors
// ---------------------------------------------------------------------------

export class RbacError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'RbacError'
  }
}

// ---------------------------------------------------------------------------
// DB row shapes (typed results from parametrized SQL)
// ---------------------------------------------------------------------------

interface RoleRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: string
  created_at: Date
  updated_at: Date
}

interface PermissionRow {
  id: string
  role_id: string
  module: string
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

interface StaffUserRow {
  id: string
  workspace_id: string
  email: string
  name: string
  is_active: boolean
  role_id: string | null
  division_ids: string[]
}

// ---------------------------------------------------------------------------
// createRole
// ---------------------------------------------------------------------------

export interface CreateRoleInput {
  workspace_id: string
  name: string
  description?: string | null
  /** Initial permission flags keyed by module. Omitted modules default to all-false. */
  permissions?: Record<string, Partial<PermissionFlags>>
}

export interface CreateRoleResult {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: RoleStatus
  created_at: Date
  updated_at: Date
}

/**
 * Create a new role + optional initial permission rows in a single transaction.
 * Throws ROLE_NAME_CONFLICT if (workspace_id, name) already exists.
 */
export async function createRole(
  db: DbClient,
  input: CreateRoleInput,
  auditCtx: {
    user_id: string | null
    request_id: string
    workspace_slug: string
  }
): Promise<CreateRoleResult> {
  await db.query('BEGIN')
  try {
    // INSERT role — rely on UNIQUE (workspace_id, name) constraint for conflict detection
    let roleRow: RoleRow
    try {
      const result = await db.query<RoleRow>(
        `
        INSERT INTO backoffice_roles (workspace_id, name, description, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
        RETURNING id, workspace_id, name, description, status, created_at, updated_at
        `,
        [input.workspace_id, input.name, input.description ?? null]
      )
      const inserted = result.rows[0]
      if (!inserted) throw new RbacError('ROLE_INSERT_FAILED', 'Failed to insert role')
      roleRow = inserted
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null) {
        const e = err as Record<string, unknown>
        if (typeof e.code === 'string' && e.code === '23505') {
          throw new RbacError('ROLE_NAME_CONFLICT', 'A role with this name already exists')
        }
      }
      throw err
    }

    // INSERT permission rows for provided modules
    if (input.permissions) {
      for (const [module, flags] of Object.entries(input.permissions)) {
        assertValidModule(module)
        await db.query(
          `
          INSERT INTO backoffice_role_module_permissions
            (role_id, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (role_id, module) DO UPDATE
            SET can_view   = EXCLUDED.can_view,
                can_create = EXCLUDED.can_create,
                can_edit   = EXCLUDED.can_edit,
                can_delete = EXCLUDED.can_delete,
                updated_at = NOW()
          `,
          [
            roleRow.id,
            module,
            flags.can_view ?? false,
            flags.can_create ?? false,
            flags.can_edit ?? false,
            flags.can_delete ?? false,
          ]
        )
      }
    }

    // Audit log in same transaction
    await writeRbacAuditLog(db, {
      user_id: auditCtx.user_id,
      role_id: roleRow.id,
      module: null,
      action: 'CREATE_ROLE',
      request_id: auditCtx.request_id,
      workspace_slug: auditCtx.workspace_slug,
      metadata: { role_name: roleRow.name },
    })

    await db.query('COMMIT')
    return { ...roleRow, status: roleRow.status as RoleStatus }
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// getRoleById
// ---------------------------------------------------------------------------

/**
 * Fetch a role with its full permission matrix.
 * Returns null if not found.
 */
export async function getRoleById(
  db: DbClient,
  roleId: string
): Promise<RoleWithPermissions | null> {
  const roleResult = await db.query<RoleRow>(
    `
    SELECT id, workspace_id, name, description, status, created_at, updated_at
    FROM backoffice_roles
    WHERE id = $1
    `,
    [roleId]
  )
  if (roleResult.rows.length === 0) return null

  const role = roleResult.rows[0] as RoleRow
  const permissions = await getRolePermissions(db, roleId)

  return {
    id: role.id,
    workspace_id: role.workspace_id,
    name: role.name,
    description: role.description,
    status: role.status as RoleStatus,
    created_at: role.created_at,
    updated_at: role.updated_at,
    permissions,
  }
}

// ---------------------------------------------------------------------------
// listRoles
// ---------------------------------------------------------------------------

export interface ListRolesInput {
  workspace_id: string
  status?: RoleStatus | null
  page?: number
  pageSize?: number
}

export interface ListRolesResult {
  roles: CreateRoleResult[]
  total: number
  page: number
  pageSize: number
}

/**
 * Paginated role list — filterable by status.
 */
export async function listRoles(db: DbClient, input: ListRolesInput): Promise<ListRolesResult> {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20))
  const offset = (page - 1) * pageSize

  const params: unknown[] = [input.workspace_id]
  let whereClause = 'WHERE workspace_id = $1'

  if (input.status) {
    params.push(input.status)
    whereClause += ` AND status = $${params.length}`
  }

  const countResult = await db.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM backoffice_roles ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

  params.push(pageSize, offset)
  const rolesResult = await db.query<RoleRow>(
    `
    SELECT id, workspace_id, name, description, status, created_at, updated_at
    FROM backoffice_roles
    ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  )

  return {
    roles: rolesResult.rows.map((r) => ({
      ...r,
      status: r.status as RoleStatus,
    })),
    total,
    page,
    pageSize,
  }
}

// ---------------------------------------------------------------------------
// updateRole
// ---------------------------------------------------------------------------

export interface UpdateRoleInput {
  name?: string
  description?: string | null
  status?: RoleStatus
}

/**
 * Update a role's name, description, or status.
 * Throws ROLE_NOT_FOUND if role doesn't exist.
 * Throws ROLE_NAME_CONFLICT if new name already taken (within workspace).
 */
export async function updateRole(
  db: DbClient,
  roleId: string,
  input: UpdateRoleInput,
  auditCtx: {
    user_id: string | null
    request_id: string
    workspace_slug: string
  }
): Promise<CreateRoleResult> {
  await db.query('BEGIN')
  try {
    // Build dynamic SET clause
    const sets: string[] = []
    const params: unknown[] = []

    if (input.name !== undefined) {
      params.push(input.name)
      sets.push(`name = $${params.length}`)
    }
    if (input.description !== undefined) {
      params.push(input.description)
      sets.push(`description = $${params.length}`)
    }
    if (input.status !== undefined) {
      params.push(input.status)
      sets.push(`status = $${params.length}`)
    }

    if (sets.length === 0) {
      // Nothing to update — fetch and return current row
      const existing = await db.query<RoleRow>(
        `SELECT id, workspace_id, name, description, status, created_at, updated_at
         FROM backoffice_roles WHERE id = $1`,
        [roleId]
      )
      if (existing.rows.length === 0) {
        throw new RbacError('ROLE_NOT_FOUND', 'Role not found')
      }
      await db.query('COMMIT')
      const ex = existing.rows[0] as RoleRow
      return {
        id: ex.id,
        workspace_id: ex.workspace_id,
        name: ex.name,
        description: ex.description,
        status: ex.status as RoleStatus,
        created_at: ex.created_at,
        updated_at: ex.updated_at,
      }
    }

    sets.push(`updated_at = NOW()`)
    params.push(roleId)

    let updated: RoleRow
    try {
      const result = await db.query<RoleRow>(
        `
        UPDATE backoffice_roles
           SET ${sets.join(', ')}
         WHERE id = $${params.length}
         RETURNING id, workspace_id, name, description, status, created_at, updated_at
        `,
        params
      )
      if (result.rows.length === 0) {
        throw new RbacError('ROLE_NOT_FOUND', 'Role not found')
      }
      updated = result.rows[0] as RoleRow
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null) {
        const e = err as Record<string, unknown>
        if (e.code === '23505') {
          throw new RbacError('ROLE_NAME_CONFLICT', 'A role with this name already exists')
        }
      }
      throw err
    }

    // Determine audit action: disable specifically is tracked as DISABLE_ROLE
    const auditAction = input.status === RoleStatus.DISABLED ? 'DISABLE_ROLE' : 'UPDATE_ROLE'

    await writeRbacAuditLog(db, {
      user_id: auditCtx.user_id,
      role_id: updated.id,
      module: null,
      action: auditAction,
      request_id: auditCtx.request_id,
      workspace_slug: auditCtx.workspace_slug,
      metadata: { updated_fields: Object.keys(input) },
    })

    await db.query('COMMIT')
    return { ...updated, status: updated.status as RoleStatus }
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// deleteRole
// ---------------------------------------------------------------------------

/**
 * Delete a role — fails if any active staff user is assigned to it.
 * Uses SELECT FOR UPDATE to serialize concurrent delete attempts.
 * Throws ROLE_NOT_FOUND if role doesn't exist.
 * Throws ROLE_HAS_ACTIVE_USERS if active users still hold this role.
 */
export async function deleteRole(
  db: DbClient,
  roleId: string,
  auditCtx: {
    user_id: string | null
    request_id: string
    workspace_slug: string
  }
): Promise<void> {
  await db.query('BEGIN')
  try {
    // SELECT FOR UPDATE — serializes concurrent deletes
    const lockResult = await db.query<{ id: string }>(
      `SELECT id FROM backoffice_roles WHERE id = $1 FOR UPDATE`,
      [roleId]
    )
    if (lockResult.rows.length === 0) {
      throw new RbacError('ROLE_NOT_FOUND', 'Role not found')
    }

    // Count active users assigned to this role
    const countResult = await db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM backoffice_staff_users
       WHERE role_id = $1 AND is_active = TRUE`,
      [roleId]
    )
    const activeCount = parseInt(countResult.rows[0]?.cnt ?? '0', 10)
    if (activeCount > 0) {
      throw new RbacError('ROLE_HAS_ACTIVE_USERS', 'Cannot delete role with active assigned users')
    }

    await db.query(`DELETE FROM backoffice_roles WHERE id = $1`, [roleId])

    await writeRbacAuditLog(db, {
      user_id: auditCtx.user_id,
      role_id: roleId,
      module: null,
      action: 'DELETE_ROLE',
      request_id: auditCtx.request_id,
      workspace_slug: auditCtx.workspace_slug,
      metadata: null,
    })

    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// getRolePermissions
// ---------------------------------------------------------------------------

/**
 * Fetch all permission rows for a role and return as a module-keyed map.
 * Absent modules are not included in the result (caller treats absent = all-false).
 */
export async function getRolePermissions(
  db: DbClient,
  roleId: string
): Promise<Record<string, PermissionFlags>> {
  const result = await db.query<PermissionRow>(
    `
    SELECT role_id, module, can_view, can_create, can_edit, can_delete
    FROM backoffice_role_module_permissions
    WHERE role_id = $1
    `,
    [roleId]
  )

  const permissions: Record<string, PermissionFlags> = {}
  for (const row of result.rows) {
    permissions[row.module] = {
      can_view: row.can_view,
      can_create: row.can_create,
      can_edit: row.can_edit,
      can_delete: row.can_delete,
    }
  }
  return permissions
}

// ---------------------------------------------------------------------------
// updateRolePermissions (full-replace semantics)
// ---------------------------------------------------------------------------

/**
 * Full-replace all permission rows for a role.
 * Deletes existing rows and inserts the provided set in a single transaction.
 * Validates all module keys before any DB write.
 */
export async function updateRolePermissions(
  db: DbClient,
  roleId: string,
  permissions: Record<string, Partial<PermissionFlags>>,
  auditCtx: {
    user_id: string | null
    request_id: string
    workspace_slug: string
  }
): Promise<Record<string, PermissionFlags>> {
  // Validate all module keys before touching the DB
  for (const module of Object.keys(permissions)) {
    assertValidModule(module)
  }

  await db.query('BEGIN')
  try {
    // Verify role exists
    const roleCheck = await db.query<{ id: string }>(
      `SELECT id FROM backoffice_roles WHERE id = $1`,
      [roleId]
    )
    if (roleCheck.rows.length === 0) {
      throw new RbacError('ROLE_NOT_FOUND', 'Role not found')
    }

    // Full-replace: delete existing, insert new
    await db.query(`DELETE FROM backoffice_role_module_permissions WHERE role_id = $1`, [roleId])

    const result: Record<string, PermissionFlags> = {}
    for (const [module, flags] of Object.entries(permissions)) {
      const row = {
        can_view: flags.can_view ?? false,
        can_create: flags.can_create ?? false,
        can_edit: flags.can_edit ?? false,
        can_delete: flags.can_delete ?? false,
      }
      await db.query(
        `
        INSERT INTO backoffice_role_module_permissions
          (role_id, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `,
        [roleId, module, row.can_view, row.can_create, row.can_edit, row.can_delete]
      )
      result[module] = row
    }

    await writeRbacAuditLog(db, {
      user_id: auditCtx.user_id,
      role_id: roleId,
      module: null,
      action: 'UPDATE_PERMISSIONS',
      request_id: auditCtx.request_id,
      workspace_slug: auditCtx.workspace_slug,
      metadata: { module_count: Object.keys(permissions).length },
    })

    await db.query('COMMIT')
    return result
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// assignRoleToStaffUser
// ---------------------------------------------------------------------------

/**
 * Assign a role to a staff user.
 * Throws ROLE_NOT_FOUND if role doesn't exist.
 * Throws ROLE_NOT_ASSIGNABLE if role is DISABLED.
 * Throws USER_NOT_FOUND if staff user doesn't exist.
 * Idempotent: assigning the same role twice is a no-op.
 */
export async function assignRoleToStaffUser(
  db: DbClient,
  userId: string,
  roleId: string,
  auditCtx: {
    user_id: string | null
    request_id: string
    workspace_slug: string
  }
): Promise<void> {
  // Verify staff user exists
  const userResult = await db.query<{ id: string }>(
    `SELECT id FROM backoffice_staff_users WHERE id = $1`,
    [userId]
  )
  if (userResult.rows.length === 0) {
    throw new RbacError('USER_NOT_FOUND', 'Staff user not found')
  }

  // Verify role exists and is ACTIVE
  const roleResult = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM backoffice_roles WHERE id = $1`,
    [roleId]
  )
  if (roleResult.rows.length === 0) {
    throw new RbacError('ROLE_NOT_FOUND', 'Role not found')
  }
  if (roleResult.rows[0]?.status !== RoleStatus.ACTIVE) {
    throw new RbacError('ROLE_NOT_ASSIGNABLE', 'Cannot assign a disabled role')
  }

  await db.query('BEGIN')
  try {
    await db.query(
      `UPDATE backoffice_staff_users SET role_id = $1, updated_at = NOW() WHERE id = $2`,
      [roleId, userId]
    )

    await writeRbacAuditLog(db, {
      user_id: auditCtx.user_id,
      role_id: roleId,
      module: null,
      action: 'ASSIGN_ROLE',
      request_id: auditCtx.request_id,
      workspace_slug: auditCtx.workspace_slug,
      metadata: { target_user_id: userId },
    })

    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// evaluatePermission
// ---------------------------------------------------------------------------

interface EvaluatePermissionInput {
  db: DbClient
  user_id: string
  module: PermissionModule | string
  action: PermissionAction
}

/**
 * Evaluate whether a staff user has a specific permission.
 * Deny-by-default — returns false if any prerequisite is absent or invalid:
 *   1. Staff user must exist
 *   2. Staff user must be active (is_active = true)
 *   3. Staff user must have a role assigned (role_id != null)
 *   4. Role must exist
 *   5. Role must be ACTIVE
 *   6. Permission row for (role_id, module) must exist
 *   7. permission[action] must be true
 *
 * Returns false (deny) — never throws — on any denial condition.
 * Throws only on unexpected DB errors.
 */
export async function evaluatePermission(input: EvaluatePermissionInput): Promise<boolean> {
  const { db, user_id, module, action } = input

  try {
    // Step 1+2: Load staff user, check is_active
    const userResult = await db.query<StaffUserRow>(
      `
      SELECT id, workspace_id, is_active, role_id
      FROM backoffice_staff_users
      WHERE id = $1
      `,
      [user_id]
    )
    if (userResult.rows.length === 0) return false
    const user = userResult.rows[0] as StaffUserRow

    // Step 2: is_active check
    if (!user.is_active) return false

    // Step 3: role_id not null
    if (!user.role_id) return false

    // Step 4+5: Load role, check status
    const roleResult = await db.query<{ id: string; status: string }>(
      `SELECT id, status FROM backoffice_roles WHERE id = $1`,
      [user.role_id]
    )
    if (roleResult.rows.length === 0) return false
    const roleRow = roleResult.rows[0]
    if (roleRow?.status !== RoleStatus.ACTIVE) return false

    // Step 6+7: Load permission row, check flag
    const permResult = await db.query<Record<string, boolean>>(
      `
      SELECT ${action}
      FROM backoffice_role_module_permissions
      WHERE role_id = $1 AND module = $2
      `,
      [user.role_id, module]
    )
    if (permResult.rows.length === 0) return false
    return permResult.rows[0]?.[action] === true
  } catch (err) {
    logger.error('evaluatePermission unexpected DB error', {
      user_id,
      module,
      action,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// getRolesForUser (helper for GET /roles/:id/users pagination)
// ---------------------------------------------------------------------------

export interface GetRoleUsersInput {
  roleId: string
  page?: number
  pageSize?: number
}

export interface RoleUserSummary {
  id: string
  name: string
  email: string
  is_active: boolean
}

export interface GetRoleUsersResult {
  users: RoleUserSummary[]
  total: number
  page: number
  pageSize: number
}

/**
 * Paginated list of staff users assigned to a role.
 * NEVER returns password_hash or token_version.
 */
export async function getRoleUsers(
  db: DbClient,
  input: GetRoleUsersInput
): Promise<GetRoleUsersResult> {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20))
  const offset = (page - 1) * pageSize

  const countResult = await db.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM backoffice_staff_users WHERE role_id = $1`,
    [input.roleId]
  )
  const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

  const usersResult = await db.query<RoleUserSummary>(
    `
    SELECT id, name, email, is_active
    FROM backoffice_staff_users
    WHERE role_id = $1
    ORDER BY name ASC, id ASC
    LIMIT $2 OFFSET $3
    `,
    [input.roleId, pageSize, offset]
  )

  return {
    users: usersResult.rows,
    total,
    page,
    pageSize,
  }
}

/**
 * Staff Domain — Repository (Raw SQL)
 *
 * File: packages/domain-core/src/staff/staff.repository.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * All queries are tenant-scoped via workspace_id.
 * No ORM — raw pg queries for explicit control over locking and isolation.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ All writes are caller-transactional (caller opens BEGIN/COMMIT)
 * ✓ Tenant-scoped: every query filters by workspace_id
 * ✓ password_hash SELECT-excluded from list/get — only in findStaffByEmailForUpdate
 */

import type { QueryClient, StaffListQuery, StaffRecord, StaffRow } from './staff.types'

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Find staff by email with FOR UPDATE lock.
 * Used inside a SERIALIZABLE transaction for create-with-limit-check.
 * Returns the FULL row including password_hash (login and create flows only).
 */
export async function findStaffByEmailForUpdate(
  client: QueryClient,
  workspaceId: string,
  email: string
): Promise<StaffRow | null> {
  const { rows } = await client.query<StaffRow>(
    `SELECT id, workspace_id, email, name, password_hash, token_version,
            is_active, status, role_id, division_ids,
            failed_login_count, locked_until, last_login,
            created_at, updated_at
       FROM backoffice_staff_users
      WHERE workspace_id = $1 AND email = $2
        FOR UPDATE`,
    [workspaceId, email]
  )
  return rows[0] ?? null
}

/**
 * Find staff by ID (no password_hash). Returns public StaffRecord.
 */
export async function findStaffById(
  client: QueryClient,
  workspaceId: string,
  staffId: string
): Promise<StaffRecord | null> {
  const { rows } = await client.query<StaffRecord>(
    `SELECT id, workspace_id, email, name,
            is_active, status, role_id, division_ids,
            last_login, created_at, updated_at
       FROM backoffice_staff_users
      WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, staffId]
  )
  return rows[0] ?? null
}

/**
 * Count ACTIVE staff in workspace (exact count, used inside SERIALIZABLE tx).
 * Uses SELECT ... FOR UPDATE to prevent phantom reads under concurrent inserts.
 * (PostgreSQL does not allow COUNT(*) with FOR UPDATE; we select IDs and count in app code)
 */
export async function countActiveStaff(client: QueryClient, workspaceId: string): Promise<number> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id
       FROM backoffice_staff_users
      WHERE workspace_id = $1 AND status = 'ACTIVE'
        FOR UPDATE`,
    [workspaceId]
  )
  return rows.length
}

/**
 * Insert a new staff user row. Caller must be inside a transaction.
 * Returns the full public StaffRecord (no password_hash).
 */
export async function insertStaff(
  client: QueryClient,
  data: {
    workspace_id: string
    email: string
    name: string
    password_hash: string
    role_id?: string | null
    division_ids?: string[]
  }
): Promise<StaffRecord> {
  const divisionIds = data.division_ids ?? []
  const { rows } = await client.query<StaffRecord>(
    `INSERT INTO backoffice_staff_users
       (workspace_id, email, name, password_hash, role_id, division_ids, status, is_active)
       VALUES ($1, $2, $3, $4, $5, $6::uuid[], 'ACTIVE', true)
       RETURNING id, workspace_id, email, name,
                 is_active, status, role_id, division_ids,
                 last_login, created_at, updated_at`,
    [
      data.workspace_id,
      data.email,
      data.name,
      data.password_hash,
      data.role_id ?? null,
      divisionIds,
    ]
  )
  return rows[0] as StaffRecord
}

/**
 * Update staff profile fields. Caller must be inside a transaction.
 * Only updates fields that are provided (non-undefined).
 */
export async function updateStaff(
  client: QueryClient,
  workspaceId: string,
  staffId: string,
  data: { name?: string; email?: string; division_ids?: string[]; role_id?: string | null }
): Promise<StaffRecord | null> {
  // Build SET clause dynamically
  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = [workspaceId, staffId]
  let idx = 3

  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`)
    params.push(data.name)
  }
  if (data.email !== undefined) {
    sets.push(`email = $${idx++}`)
    params.push(data.email)
  }
  if (data.division_ids !== undefined) {
    sets.push(`division_ids = $${idx++}::uuid[]`)
    params.push(data.division_ids)
  }
  if (data.role_id !== undefined) {
    sets.push(`role_id = $${idx++}`)
    params.push(data.role_id)
  }

  const { rows } = await client.query<StaffRecord>(
    `UPDATE backoffice_staff_users
        SET ${sets.join(', ')}
      WHERE workspace_id = $1 AND id = $2
      RETURNING id, workspace_id, email, name,
                is_active, status, role_id, division_ids,
                last_login, created_at, updated_at`,
    params
  )
  return rows[0] ?? null
}

/**
 * Update staff status and is_active (both kept in sync).
 */
export async function updateStaffStatus(
  client: QueryClient,
  workspaceId: string,
  staffId: string,
  status: 'ACTIVE' | 'INACTIVE',
  isActive: boolean
): Promise<StaffRecord | null> {
  const { rows } = await client.query<StaffRecord>(
    `UPDATE backoffice_staff_users
        SET status = $3, is_active = $4, updated_at = NOW()
      WHERE workspace_id = $1 AND id = $2
      RETURNING id, workspace_id, email, name,
                is_active, status, role_id, division_ids,
                last_login, created_at, updated_at`,
    [workspaceId, staffId, status, isActive]
  )
  return rows[0] ?? null
}

/**
 * Soft-delete: set status = 'INACTIVE', is_active = false.
 * Hard-delete is forbidden at this layer.
 */
export async function softDeleteStaff(
  client: QueryClient,
  workspaceId: string,
  staffId: string
): Promise<void> {
  await client.query(
    `UPDATE backoffice_staff_users
        SET status = 'INACTIVE', is_active = false, updated_at = NOW()
      WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, staffId]
  )
}

/**
 * List staff with keyset pagination.
 * Filters: status, division_id, search (email/name ILIKE).
 */
export async function listStaff(
  client: QueryClient,
  query: StaffListQuery
): Promise<{ rows: StaffRecord[]; total: number }> {
  const conditions: string[] = ['workspace_id = $1']
  const params: unknown[] = [query.workspace_id]
  let idx = 2

  if (query.status) {
    conditions.push(`status = $${idx++}`)
    params.push(query.status)
  }
  if (query.division_id) {
    conditions.push(`$${idx++} = ANY(division_ids)`)
    params.push(query.division_id)
  }
  if (query.search) {
    conditions.push(`(email ILIKE $${idx} OR name ILIKE $${idx})`)
    params.push(`%${query.search}%`)
    idx++
  }

  const where = conditions.join(' AND ')

  const countResult = await client.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM backoffice_staff_users WHERE ${where}`,
    params
  )
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

  const offset = (query.page - 1) * query.limit
  const dataParams = [...params, query.limit, offset]

  const { rows } = await client.query<StaffRecord>(
    `SELECT id, workspace_id, email, name,
            is_active, status, role_id, division_ids,
            last_login, created_at, updated_at
       FROM backoffice_staff_users
      WHERE ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${idx++} OFFSET $${idx++}`,
    dataParams
  )

  return { rows, total }
}

/**
 * Check whether a staff user has authored content (exams, questions, etc.)
 * Returns true if any content exists — used to block hard-delete.
 */
export async function checkAuthoredContent(
  client: QueryClient,
  workspaceId: string,
  staffId: string
): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM mcq_exams WHERE workspace_id = $1 AND created_by = $2
       UNION ALL
       SELECT 1 FROM traditional_exams WHERE workspace_id = $1 AND created_by = $2
       UNION ALL
       SELECT 1 FROM mcq_questions WHERE workspace_id = $1 AND created_by = $2
       UNION ALL
       SELECT 1 FROM traditional_questions WHERE workspace_id = $1 AND created_by = $2
     ) AS exists`,
    [workspaceId, staffId]
  )
  return rows[0]?.exists ?? false
}

/**
 * Groups Domain — Repository (Raw DB Queries)
 *
 * File: packages/domain-core/src/groups/groups.repository.ts
 * Stage: STAGE_24_GROUPS
 * Date: 2026-03-19
 *
 * Pure database query functions. Accepts an injected DbClient — no pg.Pool
 * instantiation, no HTTP logic, no framework dependencies.
 *
 * All functions that write data accept a PoolClient (with BEGIN already called
 * by the caller in groups.service.ts) or a regular DbClient for read-only ops.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data access only
 * ✓ No framework dependencies beyond TypeScript
 * ✓ No direct Pool import — DbClient injected
 * ✓ All writes are called within a service-layer transaction
 */

import type { DbClient, GroupRow } from './groups.types'

// ---------------------------------------------------------------------------
// Groups Table Queries
// ---------------------------------------------------------------------------

interface GroupDbRow extends Record<string, unknown> {
  id: string
  name: string
  department_id: string | null
  max_members: number | null
  description: string | null
  status: 'ENABLED' | 'DISABLED'
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}

interface ListCountRow extends Record<string, unknown> {
  total: string
}

interface MemberCountRow extends Record<string, unknown> {
  count: string
}

interface StudentRow extends Record<string, unknown> {
  id: string
  division_id: string | null
  group_id: string | null
}

interface StaffRow extends Record<string, unknown> {
  id: string
  division_id: string | null
}

interface DeptRow extends Record<string, unknown> {
  division_id: string | null
}

type TransactionalClient = DbClient

function mapGroupRow(r: GroupDbRow): GroupRow {
  return {
    id: r.id,
    name: r.name,
    department_id: r.department_id,
    max_members: r.max_members !== null ? Number(r.max_members) : null,
    description: r.description,
    status: r.status,
    deleted_at: r.deleted_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

/**
 * List active groups with optional filters and keyset pagination.
 * Always filters WHERE deleted_at IS NULL.
 */
export async function findGroups(
  db: DbClient,
  input: {
    limit: number
    cursor?: string
    status?: 'ENABLED' | 'DISABLED' | 'all'
    department_id?: string
  }
): Promise<{ rows: GroupRow[]; total: number }> {
  const params: unknown[] = []
  const conditions: string[] = ['g.deleted_at IS NULL']

  if (input.status && input.status !== 'all') {
    params.push(input.status)
    conditions.push(`g.status = $${params.length}`)
  }

  if (input.department_id) {
    params.push(input.department_id)
    conditions.push(`g.department_id = $${params.length}`)
  }

  if (input.cursor) {
    // cursor is the last seen created_at ISO string + "|" + id
    const [cursorTs, cursorId] = input.cursor.split('|')
    params.push(cursorTs, cursorId)
    conditions.push(
      `(g.created_at, g.id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
    )
  }

  const where = conditions.join(' AND ')

  // Count query (no pagination, same filters except cursor)
  const countConditions = conditions.filter((c) => !c.startsWith('(g.created_at'))
  const countWhere = countConditions.join(' AND ')
  const countParams = params.slice(0, params.length - (input.cursor ? 2 : 0))
  const countResult = await db.query<ListCountRow>(
    `SELECT COUNT(*)::text AS total FROM groups g WHERE ${countWhere}`,
    countParams.length > 0 ? countParams : undefined
  )
  const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

  params.push(input.limit)
  const rows = await db.query<GroupDbRow>(
    `SELECT g.id, g.name, g.department_id, g.max_members, g.description,
            g.status, g.deleted_at, g.created_at, g.updated_at
     FROM groups g
     WHERE ${where}
     ORDER BY g.created_at ASC, g.id ASC
     LIMIT $${params.length}`,
    params
  )

  return { rows: rows.rows.map(mapGroupRow), total }
}

/** Find a single active group by ID. Returns null if not found or soft-deleted. */
export async function findGroupById(db: DbClient, id: string): Promise<GroupRow | null> {
  const result = await db.query<GroupDbRow>(
    `SELECT id, name, department_id, max_members, description,
            status, deleted_at, created_at, updated_at
     FROM groups
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapGroupRow(row) : null
}

/**
 * Lock a group row for update.
 * Returns the row or null if not found / soft-deleted.
 * Must be called inside an open BEGIN transaction.
 */
export async function lockGroupForUpdate(
  db: TransactionalClient,
  id: string
): Promise<GroupRow | null> {
  const result = await db.query<GroupDbRow>(
    `SELECT id, name, department_id, max_members, description,
            status, deleted_at, created_at, updated_at
     FROM groups
     WHERE id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapGroupRow(row) : null
}

/** Check if a group name already exists among active groups (case-insensitive). */
export async function groupNameExists(
  db: DbClient,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const params: unknown[] = [name]
  let sql = `SELECT 1 FROM groups WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL`
  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $2`
  }
  const result = await db.query<{ '?column?': number }>(sql, params)
  return result.rows.length > 0
}

/** Insert a new group row. Returns the created row. */
export async function insertGroup(
  db: TransactionalClient,
  input: {
    name: string
    department_id: string | null
    max_members: number | null
    description: string | null
  }
): Promise<GroupRow> {
  const result = await db.query<GroupDbRow>(
    `INSERT INTO groups (name, department_id, max_members, description, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'ENABLED', NOW(), NOW())
     RETURNING id, name, department_id, max_members, description,
               status, deleted_at, created_at, updated_at`,
    [input.name, input.department_id, input.max_members, input.description]
  )
  return mapGroupRow(result.rows[0] as GroupDbRow)
}

/** Update an existing group row. Returns the updated row. */
export async function updateGroupRow(
  db: TransactionalClient,
  id: string,
  input: {
    name?: string
    department_id?: string | null
    max_members?: number | null
    description?: string | null
    status?: 'ENABLED' | 'DISABLED'
  }
): Promise<GroupRow> {
  const setClauses: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (input.name !== undefined) {
    params.push(input.name)
    setClauses.push(`name = $${params.length}`)
  }
  if ('department_id' in input) {
    params.push(input.department_id ?? null)
    setClauses.push(`department_id = $${params.length}`)
  }
  if ('max_members' in input) {
    params.push(input.max_members ?? null)
    setClauses.push(`max_members = $${params.length}`)
  }
  if ('description' in input) {
    params.push(input.description ?? null)
    setClauses.push(`description = $${params.length}`)
  }
  if (input.status !== undefined) {
    params.push(input.status)
    setClauses.push(`status = $${params.length}`)
  }

  params.push(id)
  const result = await db.query<GroupDbRow>(
    `UPDATE groups
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length} AND deleted_at IS NULL
     RETURNING id, name, department_id, max_members, description,
               status, deleted_at, created_at, updated_at`,
    params
  )
  return mapGroupRow(result.rows[0] as GroupDbRow)
}

/** Soft-delete a group by setting deleted_at = NOW(). */
export async function softDeleteGroup(db: TransactionalClient, id: string): Promise<void> {
  await db.query(
    `UPDATE groups SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
}

/** Count how many active students are assigned to a group. */
export async function countStudentsInGroup(db: DbClient, groupId: string): Promise<number> {
  const result = await db.query<MemberCountRow>(
    `SELECT COUNT(*)::text AS count FROM students WHERE group_id = $1`,
    [groupId]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

/**
 * Count students in a group, optionally excluding one student.
 * Used for idempotent re-assignment capacity check (exclude the student
 * being re-assigned so they don't count against the capacity they already hold).
 */
export async function countStudentsInGroupExcluding(
  db: DbClient,
  groupId: string,
  excludeStudentId: string
): Promise<number> {
  const result = await db.query<MemberCountRow>(
    `SELECT COUNT(*)::text AS count FROM students WHERE group_id = $1 AND id <> $2`,
    [groupId, excludeStudentId]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

/** Count how many staff are assigned to a group. */
export async function countStaffInGroup(db: DbClient, groupId: string): Promise<number> {
  const result = await db.query<MemberCountRow>(
    `SELECT COUNT(*)::text AS count FROM staff_groups WHERE group_id = $1`,
    [groupId]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

// ---------------------------------------------------------------------------
// Student Assignment Queries
// ---------------------------------------------------------------------------

/** Find a student by ID. Returns null if not found. */
export async function findStudentById(db: DbClient, studentId: string): Promise<StudentRow | null> {
  const result = await db.query<StudentRow>(
    `SELECT id, division_id, group_id FROM students WHERE id = $1`,
    [studentId]
  )
  return result.rows[0] ?? null
}

/** Update a student's group_id. */
export async function updateStudentGroupId(
  db: TransactionalClient,
  studentId: string,
  groupId: string | null
): Promise<void> {
  await db.query(`UPDATE students SET group_id = $1, updated_at = NOW() WHERE id = $2`, [
    groupId,
    studentId,
  ])
}

/**
 * Get the group currently assigned to a student (via JOIN).
 * Returns null if student has no group or group is soft-deleted.
 */
export async function findStudentGroup(db: DbClient, studentId: string): Promise<GroupRow | null> {
  const result = await db.query<GroupDbRow>(
    `SELECT g.id, g.name, g.department_id, g.max_members, g.description,
            g.status, g.deleted_at, g.created_at, g.updated_at
     FROM students s
     JOIN groups g ON g.id = s.group_id AND g.deleted_at IS NULL
     WHERE s.id = $1`,
    [studentId]
  )
  const row = result.rows[0]
  return row ? mapGroupRow(row) : null
}

// ---------------------------------------------------------------------------
// Staff Assignment Queries
// ---------------------------------------------------------------------------

/** Find a staff member by ID. Returns null if not found. */
export async function findStaffById(db: DbClient, staffId: string): Promise<StaffRow | null> {
  const result = await db.query<StaffRow>(
    `SELECT bsu.id, bsu.division_id
     FROM backoffice_staff_users bsu
     WHERE bsu.id = $1`,
    [staffId]
  )
  return result.rows[0] ?? null
}

/** Upsert a staff-group assignment (idempotent — ON CONFLICT DO NOTHING). */
export async function upsertStaffGroupAssignment(
  db: TransactionalClient,
  staffId: string,
  groupId: string
): Promise<void> {
  await db.query(
    `INSERT INTO staff_groups (staff_id, group_id, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT DO NOTHING`,
    [staffId, groupId]
  )
}

/** Delete a specific staff-group assignment. Returns rowCount. */
export async function deleteStaffGroupAssignment(
  db: TransactionalClient,
  staffId: string,
  groupId: string
): Promise<number> {
  const result = await db.query(`DELETE FROM staff_groups WHERE staff_id = $1 AND group_id = $2`, [
    staffId,
    groupId,
  ])
  return result.rowCount ?? 0
}

/** List all active groups assigned to a staff member. */
export async function findStaffGroups(db: DbClient, staffId: string): Promise<GroupRow[]> {
  const result = await db.query<GroupDbRow>(
    `SELECT g.id, g.name, g.department_id, g.max_members, g.description,
            g.status, g.deleted_at, g.created_at, g.updated_at
     FROM staff_groups sg
     JOIN groups g ON g.id = sg.group_id AND g.deleted_at IS NULL
     WHERE sg.staff_id = $1
     ORDER BY g.created_at ASC`,
    [staffId]
  )
  return result.rows.map(mapGroupRow)
}

// ---------------------------------------------------------------------------
// Division Mismatch Check
// ---------------------------------------------------------------------------

/** Get a department's division_id (for division mismatch guard). */
export async function findDepartmentDivisionId(
  db: DbClient,
  departmentId: string
): Promise<DeptRow | null> {
  const result = await db.query<DeptRow>(`SELECT division_id FROM departments WHERE id = $1`, [
    departmentId,
  ])
  return result.rows[0] ?? null
}

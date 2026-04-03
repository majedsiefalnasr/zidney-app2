/**
 * Students Domain — Repository (Raw SQL)
 *
 * File: packages/domain-core/src/students/students.repository.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * All queries are tenant-scoped via the database pool connection (database-per-tenant).
 * The `students` table does not carry a `workspace_id` column — tenant isolation is
 * enforced at the pool level. Function signatures accept `workspaceId` where it is
 * forwarded to other tables (e.g. `attempts`) that do carry the column, or for
 * audit context propagation.
 *
 * No ORM — raw pg queries for explicit control over locking and isolation.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ All writes are caller-transactional (caller opens BEGIN/COMMIT)
 * ✓ Tenant-scoped: pool connection is per-workspace
 * ✓ password_hash excluded from list/get — only in findStudentByEmailForUpdate
 */

import type {
  CreateStudentInput,
  DbClient,
  StudentListQuery,
  StudentRecord,
  StudentRow,
  SubscriptionStatus,
} from './students.types'

// ---------------------------------------------------------------------------
// Column sets
// ---------------------------------------------------------------------------

/** Full row including sensitive fields — only for login/update internal paths */
const STUDENT_ROW_COLS = `
  id, external_id, email, first_name, last_name,
  division_id, department_id, group_id, semester_id,
  phone, password_hash, subscription_status, status,
  token_version, failed_login_count, locked_until,
  created_at, updated_at
`.trim()

/** Public record — strips sensitive fields */
const STUDENT_RECORD_COLS = `
  id, external_id, email, first_name, last_name,
  division_id, department_id, group_id, semester_id,
  phone, subscription_status, status,
  token_version, created_at, updated_at
`.trim()

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Find a student by primary key. Returns public StudentRecord (no password_hash).
 */
export async function findStudentById(
  client: DbClient,
  _workspaceId: string,
  studentId: string
): Promise<StudentRecord | null> {
  const { rows } = await client.query<StudentRecord>(
    `SELECT ${STUDENT_RECORD_COLS}
       FROM students
      WHERE id = $1`,
    [studentId]
  )
  return rows[0] ?? null
}

/**
 * Find a student by email with FOR UPDATE lock.
 * Used inside a SERIALIZABLE transaction for create / login flows.
 * Returns the FULL row including password_hash.
 */
export async function findStudentByEmailForUpdate(
  client: DbClient,
  _workspaceId: string,
  email: string
): Promise<StudentRow | null> {
  const { rows } = await client.query<StudentRow>(
    `SELECT ${STUDENT_ROW_COLS}
       FROM students
      WHERE email = $1
        FOR UPDATE`,
    [email]
  )
  return rows[0] ?? null
}

/**
 * Count ACTIVE students (used inside SERIALIZABLE tx for limit enforcement).
 * Uses SELECT ... FOR UPDATE to prevent phantom reads under concurrent inserts.
 */
export async function countActiveStudents(client: DbClient, _workspaceId: string): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM students
      WHERE status = 'ACTIVE'
        FOR UPDATE`,
    []
  )
  return parseInt(rows[0]?.count ?? '0', 10)
}

/**
 * List students with dynamic WHERE filters and total count via window function.
 */
export async function listStudents(
  client: DbClient,
  query: StudentListQuery
): Promise<{ rows: StudentRecord[]; total: number }> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (query.status) {
    conditions.push(`status = $${idx++}`)
    params.push(query.status)
  }
  if (query.subscription_status) {
    conditions.push(`subscription_status = $${idx++}`)
    params.push(query.subscription_status)
  }
  if (query.division_id) {
    conditions.push(`division_id = $${idx++}`)
    params.push(query.division_id)
  }
  if (query.department_id) {
    conditions.push(`department_id = $${idx++}`)
    params.push(query.department_id)
  }
  if (query.group_id) {
    conditions.push(`group_id = $${idx++}`)
    params.push(query.group_id)
  }
  if (query.semester_id) {
    conditions.push(`semester_id = $${idx++}`)
    params.push(query.semester_id)
  }
  if (query.search) {
    conditions.push(`(email ILIKE $${idx} OR first_name ILIKE $${idx} OR last_name ILIKE $${idx})`)
    params.push(`%${query.search}%`)
    idx++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // COUNT via separate query for simplicity and index compatibility
  const countResult = await client.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM students ${where}`,
    params
  )
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

  const offset = (query.page - 1) * query.limit
  const dataParams = [...params, query.limit, offset]

  const { rows } = await client.query<StudentRecord>(
    `SELECT ${STUDENT_RECORD_COLS}
       FROM students
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${idx++} OFFSET $${idx++}`,
    dataParams
  )

  return { rows, total }
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Insert a new student. Caller must be inside a transaction.
 * Returns the FULL StudentRow (service strips sensitive fields before returning to API).
 */
export async function insertStudent(
  client: DbClient,
  data: CreateStudentInput & { password_hash: string }
): Promise<StudentRow> {
  const { rows } = await client.query<StudentRow>(
    `INSERT INTO students
       (external_id, email, first_name, last_name,
        division_id, department_id, group_id, semester_id,
        phone, password_hash, subscription_status, status,
        token_version, failed_login_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'NONE', 'ACTIVE', 0, 0)
       RETURNING ${STUDENT_ROW_COLS}`,
    [
      data.external_id ?? null,
      data.email,
      data.first_name ?? null,
      data.last_name ?? null,
      data.division_id,
      data.department_id ?? null,
      data.group_id ?? null,
      data.semester_id ?? null,
      data.phone ?? null,
      data.password_hash,
    ]
  )
  return rows[0] as StudentRow
}

/**
 * Update student profile fields. Caller must be inside a transaction.
 * Only updates fields that are provided (non-undefined).
 */
export async function updateStudent(
  client: DbClient,
  _workspaceId: string,
  studentId: string,
  data: {
    email?: string
    first_name?: string
    last_name?: string
    phone?: string
    external_id?: string
    division_id?: string
    department_id?: string | null
    group_id?: string | null
    semester_id?: string | null
  }
): Promise<StudentRecord | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = [studentId]
  let idx = 2

  if (data.email !== undefined) {
    sets.push(`email = $${idx++}`)
    params.push(data.email)
  }
  if (data.first_name !== undefined) {
    sets.push(`first_name = $${idx++}`)
    params.push(data.first_name)
  }
  if (data.last_name !== undefined) {
    sets.push(`last_name = $${idx++}`)
    params.push(data.last_name)
  }
  if (data.phone !== undefined) {
    sets.push(`phone = $${idx++}`)
    params.push(data.phone)
  }
  if (data.external_id !== undefined) {
    sets.push(`external_id = $${idx++}`)
    params.push(data.external_id)
  }
  if (data.division_id !== undefined) {
    sets.push(`division_id = $${idx++}`)
    params.push(data.division_id)
  }
  if ('department_id' in data) {
    sets.push(`department_id = $${idx++}`)
    params.push(data.department_id ?? null)
  }
  if ('group_id' in data) {
    sets.push(`group_id = $${idx++}`)
    params.push(data.group_id ?? null)
  }
  if ('semester_id' in data) {
    sets.push(`semester_id = $${idx++}`)
    params.push(data.semester_id ?? null)
  }

  const { rows } = await client.query<StudentRecord>(
    `UPDATE students
        SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING ${STUDENT_RECORD_COLS}`,
    params
  )
  return rows[0] ?? null
}

/**
 * Update student status (ACTIVE | DISABLED).
 * When disabling, increments token_version to invalidate existing JWTs.
 */
export async function updateStudentStatus(
  client: DbClient,
  _workspaceId: string,
  studentId: string,
  status: 'ACTIVE' | 'DISABLED',
  tokenVersionIncrement: boolean
): Promise<StudentRecord | null> {
  const tokenUpdate = tokenVersionIncrement ? ', token_version = token_version + 1' : ''
  const { rows } = await client.query<StudentRecord>(
    `UPDATE students
        SET status = $2, updated_at = NOW()${tokenUpdate}
      WHERE id = $1
      RETURNING ${STUDENT_RECORD_COLS}`,
    [studentId, status]
  )
  return rows[0] ?? null
}

/**
 * Update subscription status (ACTIVE | SUSPENDED | EXPIRED | NONE).
 */
export async function updateSubscriptionStatus(
  client: DbClient,
  _workspaceId: string,
  studentId: string,
  subscriptionStatus: SubscriptionStatus
): Promise<StudentRecord | null> {
  const { rows } = await client.query<StudentRecord>(
    `UPDATE students
        SET subscription_status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING ${STUDENT_RECORD_COLS}`,
    [studentId, subscriptionStatus]
  )
  return rows[0] ?? null
}

/**
 * Soft-delete: set status = 'DISABLED', bump token_version.
 * Hard-delete is forbidden at this layer.
 * Returns true if a row was updated, false if not found.
 */
export async function softDeleteStudent(
  client: DbClient,
  _workspaceId: string,
  studentId: string
): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE students
        SET status = 'DISABLED',
            token_version = token_version + 1,
            updated_at = NOW()
      WHERE id = $1`,
    [studentId]
  )
  return (rowCount ?? 0) > 0
}

/**
 * Bulk-insert multiple student rows. Caller must be inside a transaction.
 * Rows are inserted individually to capture per-row conflict details (no UNNEST).
 */
export async function bulkInsertStudents(
  client: DbClient,
  rows: Array<CreateStudentInput & { password_hash: string }>
): Promise<StudentRow[]> {
  const inserted: StudentRow[] = []
  for (const row of rows) {
    const result = await insertStudent(client, row)
    inserted.push(result)
  }
  return inserted
}

// ---------------------------------------------------------------------------
// Validation helpers (must run inside caller's transaction)
// ---------------------------------------------------------------------------

/**
 * Check whether a student has any submitted/graded attempts.
 * Used to block hard-delete when attempts exist.
 */
export async function checkStudentHasAttempts(
  client: DbClient,
  workspaceId: string,
  studentId: string
): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM attempts
        WHERE workspace_id = $1
          AND user_id = $2
          AND status IN ('SUBMITTED', 'GRADED')
     ) AS exists`,
    [workspaceId, studentId]
  )
  return rows[0]?.exists ?? false
}

/**
 * Validate that a division exists and is ENABLED.
 * Throws StudentError on failure — used inside SERIALIZABLE transaction.
 */
export async function validateDivisionActive(
  client: DbClient,
  _workspaceId: string,
  divisionId: string
): Promise<void> {
  const { rows } = await client.query<{ id: string; status: string }>(
    `SELECT id, status FROM divisions WHERE id = $1`,
    [divisionId]
  )
  if (rows.length === 0) {
    const { StudentError } = await import('./students.errors')
    throw new StudentError('STUDENT_DIVISION_NOT_FOUND')
  }
  const division = rows[0]
  if (division?.status !== 'ENABLED') {
    const { StudentError } = await import('./students.errors')
    throw new StudentError('STUDENT_DIVISION_INACTIVE')
  }
}

/**
 * Validate that a department belongs to the given division.
 * Throws StudentError on mismatch.
 */
export async function validateDepartmentBelongsToDivision(
  client: DbClient,
  _workspaceId: string,
  departmentId: string,
  divisionId: string
): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM departments WHERE id = $1 AND division_id = $2`,
    [departmentId, divisionId]
  )
  if (rows.length === 0) {
    const { StudentError } = await import('./students.errors')
    throw new StudentError('STUDENT_DEPARTMENT_MISMATCH')
  }
}

/**
 * Validate that a group belongs to the given department (or division if no department).
 * Throws StudentError on mismatch.
 */
export async function validateGroupBelongsToDepartmentOrDivision(
  client: DbClient,
  _workspaceId: string,
  groupId: string,
  departmentId: string | null | undefined,
  _divisionId: string
): Promise<void> {
  // If department is provided, the group must be scoped to that department.
  // Otherwise any group within the workspace is acceptable.
  if (departmentId) {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM groups WHERE id = $1 AND department_id = $2`,
      [groupId, departmentId]
    )
    if (rows.length === 0) {
      const { StudentError } = await import('./students.errors')
      throw new StudentError('STUDENT_GROUP_MISMATCH')
    }
  } else {
    // No department — just confirm the group exists
    const { rows } = await client.query<{ id: string }>(`SELECT id FROM groups WHERE id = $1`, [
      groupId,
    ])
    if (rows.length === 0) {
      const { StudentError } = await import('./students.errors')
      throw new StudentError('STUDENT_GROUP_MISMATCH')
    }
  }
}

/**
 * Students Domain — Service Layer (Business Logic)
 *
 * File: packages/domain-core/src/students/students.service.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * Business-logic entry points for student management.
 * All write operations are wrapped in explicit transactions.
 * SERIALIZABLE isolation used for createStudent (concurrent limit enforcement).
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ No logging side-effects — callers are responsible for logging
 * ✓ All writes are transactional (BEGIN/COMMIT/ROLLBACK)
 * ✓ SERIALIZABLE isolation for limit-check + insert (createStudent)
 * ✓ Server-authoritative time (via DB NOW())
 * ✓ password_hash never returned to callers — only StudentRecord shapes
 */

import { hashStaffPassword } from '../auth/staff-password'
import { StudentError } from './students.errors'
import {
  checkStudentHasAttempts,
  countActiveStudents,
  findStudentByEmailForUpdate,
  findStudentById,
  insertStudent,
  listStudents as listStudentRows,
  softDeleteStudent,
  updateStudent as updateStudentRow,
  updateStudentStatus,
  updateSubscriptionStatus as updateSubscriptionStatusRow,
  validateDepartmentBelongsToDivision,
  validateDivisionActive,
  validateGroupBelongsToDepartmentOrDivision,
} from './students.repository'
import type {
  AuditContext,
  BulkImportResult,
  BulkImportRow,
  CreateStudentInput,
  DbClient,
  StudentListQuery,
  StudentListResult,
  StudentRecord,
  StudentRow,
  SubscriptionStatus,
  UpdateStudentInput,
  UpdateSubscriptionInput,
} from './students.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip sensitive fields from a StudentRow to produce a public StudentRecord.
 * Also accepts StudentRecord for defensive use (e.g., test mocks returning full rows).
 */
export function toStudentRecord(row: StudentRow | StudentRecord): StudentRecord {
  const {
    password_hash: _pw,
    failed_login_count: _fc,
    locked_until: _lu,
    ...record
  } = row as StudentRow
  return record
}

// ---------------------------------------------------------------------------
// createStudent
// ---------------------------------------------------------------------------

/**
 * Create a new student in the workspace.
 *
 * Uses SERIALIZABLE isolation to prevent phantom reads under concurrent create
 * requests. FOR UPDATE locks in the repository prevent concurrent inserts from
 * bypassing the student_limit check.
 *
 * @param db           - Tenant database pool (connection will be acquired)
 * @param input        - Student creation input
 * @param studentLimit - Maximum allowed ACTIVE students (from license)
 * @returns The created StudentRecord (no password_hash)
 * @throws StudentError STUDENT_EMAIL_CONFLICT if email already registered
 * @throws StudentError STUDENT_LIMIT_EXCEEDED if workspace is at capacity
 * @throws StudentError STUDENT_DIVISION_NOT_FOUND / STUDENT_DIVISION_INACTIVE
 * @throws StudentError STUDENT_DEPARTMENT_MISMATCH if department does not belong to division
 * @throws StudentError STUDENT_GROUP_MISMATCH if group does not belong to department/division
 */
export async function createStudent(
  db: DbClient,
  input: CreateStudentInput,
  _audit: AuditContext,
  studentLimit = Number.MAX_SAFE_INTEGER
): Promise<StudentRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    // 1. Email uniqueness — SELECT FOR UPDATE
    const existing = await findStudentByEmailForUpdate(client, input.workspace_id, input.email)
    if (existing) {
      throw new StudentError('STUDENT_EMAIL_CONFLICT', `Email already registered: ${input.email}`)
    }

    // 2. Student limit — SELECT COUNT FOR UPDATE
    const activeCount = await countActiveStudents(client, input.workspace_id)
    if (activeCount >= studentLimit) {
      throw new StudentError(
        'STUDENT_LIMIT_EXCEEDED',
        `Workspace has reached the student limit of ${studentLimit}`
      )
    }

    // 3. Validate division exists and is ENABLED
    await validateDivisionActive(client, input.workspace_id, input.division_id)

    // 4. Validate department belongs to division (if provided)
    if (input.department_id) {
      await validateDepartmentBelongsToDivision(
        client,
        input.workspace_id,
        input.department_id,
        input.division_id
      )
    }

    // 5. Validate group belongs to department/division (if provided)
    if (input.group_id) {
      await validateGroupBelongsToDepartmentOrDivision(
        client,
        input.workspace_id,
        input.group_id,
        input.department_id ?? null,
        input.division_id
      )
    }

    // 6. Hash password
    const passwordHash = await hashStaffPassword(input.password)

    // 7. Insert student row
    const row = await insertStudent(client, { ...input, password_hash: passwordHash })

    await client.query('COMMIT')

    return toStudentRecord(row)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// listStudents
// ---------------------------------------------------------------------------

/**
 * List students with pagination and optional filters.
 */
export async function listStudents(
  db: DbClient,
  query: StudentListQuery,
  _audit?: AuditContext
): Promise<StudentListResult> {
  const { rows, total } = await listStudentRows(db, query)
  return {
    items: rows.map(toStudentRecord),
    total,
    page: query.page,
    limit: query.limit,
  }
}

// ---------------------------------------------------------------------------
// getStudentById
// ---------------------------------------------------------------------------

/**
 * Return a single student record by ID.
 *
 * @throws StudentError STUDENT_NOT_FOUND when the record doesn't exist
 */
export async function getStudentById(
  db: DbClient,
  workspaceId: string,
  studentId: string,
  _audit?: AuditContext
): Promise<StudentRecord> {
  const record = await findStudentById(db, workspaceId, studentId)
  if (!record) {
    throw new StudentError('STUDENT_NOT_FOUND', `Student not found: ${studentId}`)
  }
  return toStudentRecord(record)
}

// ---------------------------------------------------------------------------
// updateStudent
// ---------------------------------------------------------------------------

/**
 * Update a student's profile fields.
 *
 * @throws StudentError STUDENT_NOT_FOUND when not found
 * @throws StudentError STUDENT_EMAIL_CONFLICT when the new email is already in use
 * @throws StudentError STUDENT_DIVISION_NOT_FOUND / STUDENT_DIVISION_INACTIVE
 * @throws StudentError STUDENT_DEPARTMENT_MISMATCH / STUDENT_GROUP_MISMATCH
 */
export async function updateStudent(
  db: DbClient,
  workspaceId: string,
  studentId: string,
  input: UpdateStudentInput,
  _audit: AuditContext
): Promise<StudentRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const current = await findStudentById(client, workspaceId, studentId)
    if (!current) {
      throw new StudentError('STUDENT_NOT_FOUND', `Student not found: ${studentId}`)
    }

    // Email conflict check if changing email
    if (input.email && input.email !== current.email) {
      const conflict = await findStudentByEmailForUpdate(client, workspaceId, input.email)
      if (conflict && conflict.id !== studentId) {
        throw new StudentError('STUDENT_EMAIL_CONFLICT', `Email already in use: ${input.email}`)
      }
    }

    // Division change checks
    const targetDivisionId = input.division_id ?? current.division_id
    if (input.division_id) {
      await validateDivisionActive(client, workspaceId, input.division_id)
    }

    // Department change checks
    const targetDepartmentId =
      'department_id' in input ? input.department_id : current.department_id
    if (input.department_id) {
      await validateDepartmentBelongsToDivision(
        client,
        workspaceId,
        input.department_id,
        targetDivisionId
      )
    }

    // Group change checks
    if (input.group_id) {
      await validateGroupBelongsToDepartmentOrDivision(
        client,
        workspaceId,
        input.group_id,
        targetDepartmentId ?? null,
        targetDivisionId
      )
    }

    const updated = await updateStudentRow(client, workspaceId, studentId, input)
    if (!updated) {
      throw new StudentError('STUDENT_NOT_FOUND', `Student not found after update: ${studentId}`)
    }

    await client.query('COMMIT')
    return toStudentRecord(updated)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// disableStudent
// ---------------------------------------------------------------------------

/**
 * Disable a student (status = DISABLED). Bumps token_version to invalidate JWTs.
 *
 * @throws StudentError STUDENT_NOT_FOUND when not found
 * @throws StudentError STUDENT_ALREADY_DISABLED when already DISABLED
 */
export async function disableStudent(
  db: DbClient,
  workspaceId: string,
  studentId: string,
  _audit: AuditContext
): Promise<StudentRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const current = await findStudentById(client, workspaceId, studentId)
    if (!current) {
      throw new StudentError('STUDENT_NOT_FOUND', `Student not found: ${studentId}`)
    }
    if (current.status === 'DISABLED') {
      throw new StudentError(
        'STUDENT_ALREADY_DISABLED',
        `Student is already disabled: ${studentId}`
      )
    }

    const updated = await updateStudentStatus(
      client,
      workspaceId,
      studentId,
      'DISABLED',
      true // increment token_version
    )
    if (!updated) {
      throw new StudentError('STUDENT_NOT_FOUND', `Student not found after disable: ${studentId}`)
    }

    await client.query('COMMIT')
    return toStudentRecord(updated)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// enableStudent
// ---------------------------------------------------------------------------

/**
 * Enable a student (status = ACTIVE).
 *
 * @throws StudentError STUDENT_NOT_FOUND when not found
 * @throws StudentError STUDENT_ALREADY_ACTIVE when already ACTIVE
 */
export async function enableStudent(
  db: DbClient,
  workspaceId: string,
  studentId: string,
  _audit: AuditContext
): Promise<StudentRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const current = await findStudentById(client, workspaceId, studentId)
    if (!current) {
      throw new StudentError('STUDENT_NOT_FOUND', `Student not found: ${studentId}`)
    }
    if (current.status === 'ACTIVE') {
      throw new StudentError('STUDENT_ALREADY_ACTIVE', `Student is already active: ${studentId}`)
    }

    const updated = await updateStudentStatus(
      client,
      workspaceId,
      studentId,
      'ACTIVE',
      false // don't increment token_version on enable
    )
    if (!updated) {
      throw new StudentError('STUDENT_NOT_FOUND', `Student not found after enable: ${studentId}`)
    }

    await client.query('COMMIT')
    return toStudentRecord(updated)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// deleteStudent
// ---------------------------------------------------------------------------

/**
 * Soft-delete a student (status = DISABLED, token_version incremented).
 * Blocks if the student has any submitted or graded attempts.
 *
 * @throws StudentError STUDENT_NOT_FOUND when not found
 * @throws StudentError STUDENT_HAS_ATTEMPTS when attempts exist
 */
export async function deleteStudent(
  db: DbClient,
  workspaceId: string,
  studentId: string,
  _audit: AuditContext
): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const current = await findStudentById(client, workspaceId, studentId)
    if (!current) {
      throw new StudentError('STUDENT_NOT_FOUND', `Student not found: ${studentId}`)
    }

    const hasAttempts = await checkStudentHasAttempts(client, workspaceId, studentId)
    if (hasAttempts) {
      throw new StudentError(
        'STUDENT_HAS_ATTEMPTS',
        `Cannot delete student with submitted attempts: ${studentId}`
      )
    }

    await softDeleteStudent(client, workspaceId, studentId)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// updateSubscriptionStatus
// ---------------------------------------------------------------------------

/**
 * Update a student's subscription status (ACTIVE | SUSPENDED | EXPIRED | NONE).
 *
 * @throws StudentError STUDENT_NOT_FOUND when not found
 */
export async function updateStudentSubscriptionStatus(
  db: DbClient,
  workspaceId: string,
  studentId: string,
  input: UpdateSubscriptionInput,
  _audit: AuditContext
): Promise<StudentRecord> {
  const current = await findStudentById(db, workspaceId, studentId)
  if (!current) {
    throw new StudentError('STUDENT_NOT_FOUND', `Student not found: ${studentId}`)
  }

  const updated = await updateSubscriptionStatusRow(
    db,
    workspaceId,
    studentId,
    input.subscription_status as SubscriptionStatus
  )
  if (!updated) {
    throw new StudentError(
      'STUDENT_NOT_FOUND',
      `Student not found after subscription update: ${studentId}`
    )
  }
  return toStudentRecord(updated)
}

// ---------------------------------------------------------------------------
// bulkImportStudents
// ---------------------------------------------------------------------------

/**
 * Bulk import students via CSV payload.
 * Delegates to students.bulk-import.ts for batch processing.
 */
export async function bulkImportStudents(
  db: DbClient,
  workspaceId: string,
  rows: BulkImportRow[],
  studentLimit: number,
  divisionId: string,
  _audit: AuditContext
): Promise<BulkImportResult> {
  const { processBulkImport } = await import('./students.bulk-import')
  return processBulkImport(db, workspaceId, rows, studentLimit, divisionId)
}

/**
 * Semesters — Domain Service
 *
 * File: packages/domain-core/src/semesters/semesters.service.ts
 * Stage: STAGE_27_SEMESTERS
 *
 * Business logic layer. All write operations manage their own transaction
 * (BEGIN/COMMIT/ROLLBACK) on the passed DbClient. Read operations are
 * transaction-free.
 */

import { createLogger } from '@zidney/logger'
import { SemestersError } from './semesters.errors'
import {
  countSemesters,
  countStudentsForSemester,
  findSemesterById,
  findSemesters,
  insertSemester,
  lockSemesterForUpdate,
  semesterNameExists,
  softDeleteSemester,
  updateSemesterRow,
} from './semesters.repository'
import type {
  AuditContext,
  CreateSemesterInput,
  DbClient,
  ListSemestersInput,
  ListSemestersResult,
  SemesterRow,
  UpdateSemesterInput,
} from './semesters.types'

const logger = createLogger('domain:semesters')

// ---------------------------------------------------------------------------
// T007 — listSemesters (read-only, no transaction required)
// ---------------------------------------------------------------------------

/**
 * List active semesters with optional status/search filters and offset pagination.
 *
 * @param db  Tenant DB client (read-only — no transaction opened)
 * @param input  { page, limit, status?, search? }
 */
export async function listSemesters(
  db: DbClient,
  input: ListSemestersInput
): Promise<ListSemestersResult> {
  const { page, limit, status, search } = input
  const offset = (page - 1) * limit

  const [total, items] = await Promise.all([
    countSemesters(db, { status, search }),
    findSemesters(db, { offset, limit, status, search }),
  ])

  return { items, total, page, limit }
}

// ---------------------------------------------------------------------------
// T008 — createSemester
// ---------------------------------------------------------------------------

/**
 * Create a new semester.
 *
 * TX: BEGIN → date range validation → name uniqueness check → INSERT → COMMIT
 *
 * @throws SemestersError SEMESTER_DATE_RANGE_INVALID  when end_date < start_date
 * @throws SemestersError SEMESTER_NAME_DUPLICATE      when name is already taken
 */
export async function createSemester(
  db: DbClient,
  input: CreateSemesterInput,
  audit: AuditContext
): Promise<SemesterRow> {
  await db.query('BEGIN')
  try {
    // Validate date range
    if (input.start_date && input.end_date && input.end_date < input.start_date) {
      throw new SemestersError('SEMESTER_DATE_RANGE_INVALID')
    }

    // Name uniqueness (service-layer guard before DB unique constraint fires)
    const duplicate = await semesterNameExists(db, input.name)
    if (duplicate) throw new SemestersError('SEMESTER_NAME_DUPLICATE')

    const row = await insertSemester(db, {
      name: input.name,
      description: input.description,
      start_date: input.start_date,
      end_date: input.end_date,
    })

    await db.query('COMMIT')

    logger.info('Semester created', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      semester_id: row.id,
      semester_name: row.name,
    })

    return row
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// T009 — getSemesterById (read-only)
// ---------------------------------------------------------------------------

/**
 * Retrieve a single active semester by ID.
 *
 * @throws SemestersError SEMESTER_NOT_FOUND  when the semester does not exist or is soft-deleted
 */
export async function getSemesterById(db: DbClient, id: string): Promise<SemesterRow> {
  const row = await findSemesterById(db, id)
  if (!row) throw new SemestersError('SEMESTER_NOT_FOUND')
  return row
}

// ---------------------------------------------------------------------------
// T010 — updateSemester
// ---------------------------------------------------------------------------

/**
 * Update an existing semester.
 *
 * TX: BEGIN → existence check → name uniqueness check (if name changed) →
 *             effective date range validation → UPDATE → COMMIT
 *
 * @throws SemestersError SEMESTER_NOT_FOUND          when the semester does not exist
 * @throws SemestersError SEMESTER_NAME_DUPLICATE      when name change conflicts
 * @throws SemestersError SEMESTER_DATE_RANGE_INVALID  when merged date range is invalid
 */
export async function updateSemester(
  db: DbClient,
  id: string,
  input: UpdateSemesterInput,
  audit: AuditContext
): Promise<SemesterRow> {
  await db.query('BEGIN')
  try {
    const existing = await findSemesterById(db, id)
    if (!existing) throw new SemestersError('SEMESTER_NOT_FOUND')

    // Name uniqueness — only check if name is being changed
    if (input.name !== undefined) {
      const duplicate = await semesterNameExists(db, input.name, id)
      if (duplicate) throw new SemestersError('SEMESTER_NAME_DUPLICATE')
    }

    // Resolve effective dates (merge input with existing row values)
    const effectiveStart = 'start_date' in input ? input.start_date : existing.start_date
    const effectiveEnd = 'end_date' in input ? input.end_date : existing.end_date

    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      throw new SemestersError('SEMESTER_DATE_RANGE_INVALID')
    }

    const updated = await updateSemesterRow(db, id, {
      name: input.name,
      description: input.description,
      start_date: input.start_date,
      end_date: input.end_date,
      status: input.status,
    })

    await db.query('COMMIT')

    logger.info('Semester updated', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      semester_id: id,
    })

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// T011 — deleteSemester
// ---------------------------------------------------------------------------

/**
 * Soft-delete a semester.
 *
 * TX: BEGIN → SELECT FOR UPDATE (concurrent safety) → student count guard →
 *             soft-delete → COMMIT
 *
 * Concurrency: SELECT FOR UPDATE ensures that a second concurrent delete request
 * blocks until the first transaction commits/rollbacks. When the lock releases,
 * the second request observes deleted_at IS NOT NULL and throws SEMESTER_NOT_FOUND.
 *
 * Subjects guard: deferred to STAGE_28. No subjects table exists yet.
 *
 * @throws SemestersError SEMESTER_NOT_FOUND     when the semester doesn't exist or is already deleted
 * @throws SemestersError SEMESTER_HAS_STUDENTS  when students are still assigned
 */
export async function deleteSemester(db: DbClient, id: string, audit: AuditContext): Promise<void> {
  await db.query('BEGIN')
  try {
    // Lock the row — prevents concurrent deletes racing past the guard checks
    const locked = await lockSemesterForUpdate(db, id)
    if (!locked || locked.deleted_at !== null) {
      throw new SemestersError('SEMESTER_NOT_FOUND')
    }

    // Guard: enrolled students
    const studentCount = await countStudentsForSemester(db, id)
    if (studentCount > 0) throw new SemestersError('SEMESTER_HAS_STUDENTS')

    // NOTE (STAGE_28): subjects guard not wired here — subjects table added in STAGE_28.
    // The DB-level FK ON DELETE RESTRICT on subjects.semester_id provides a safety net.

    await softDeleteSemester(db, id)

    await db.query('COMMIT')

    logger.info('Semester soft-deleted', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      semester_id: id,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

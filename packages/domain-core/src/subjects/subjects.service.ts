/**
 * Subjects — Domain Service
 *
 * File: packages/domain-core/src/subjects/subjects.service.ts
 * Stage: STAGE_28_SUBJECTS
 *
 * Business logic layer. All write operations manage their own transaction
 * (BEGIN/COMMIT/ROLLBACK) on the passed DbClient. Read operations are
 * transaction-free.
 */

import { createLogger } from '@zidney/logger'
import { checkSubjectDependencies } from './subjects.dependency-registry'
import { SubjectsError } from './subjects.errors'
import {
  casTransitionSubject,
  countSubjects,
  divisionExists,
  findSubjectById,
  findSubjects,
  insertSubject,
  lockSubjectForUpdate,
  semesterBelongsToDivision,
  semesterExists,
  softDeleteSubject,
  subjectCodeExists,
  subjectNameExists,
  updateSubjectRow,
} from './subjects.repository'
import type {
  AuditContext,
  CreateSubjectInput,
  DbClient,
  ListSubjectsInput,
  ListSubjectsResult,
  SubjectRow,
  SubjectStatus,
  TransitionSubjectInput,
  UpdateSubjectInput,
} from './subjects.types'

const logger = createLogger('domain:subjects')

// ---------------------------------------------------------------------------
// Allowed status transitions (state machine)
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: [SubjectStatus, SubjectStatus][] = [
  ['DRAFT', 'ACTIVE'],
  ['ACTIVE', 'ARCHIVED'],
]

// ---------------------------------------------------------------------------
// T007 — listSubjects (read-only, no transaction required)
// ---------------------------------------------------------------------------

/**
 * List active subjects with optional filters and offset pagination.
 *
 * @param db    Tenant DB client (read-only — no transaction opened)
 * @param input { page, limit, status?, search?, division_id?, semester_id? }
 */
export async function listSubjects(
  db: DbClient,
  input: ListSubjectsInput
): Promise<ListSubjectsResult> {
  const { page, limit, status, search, division_id, semester_id } = input
  const offset = (page - 1) * limit

  const [total, items] = await Promise.all([
    countSubjects(db, { status, search, division_id, semester_id }),
    findSubjects(db, { offset, limit, status, search, division_id, semester_id }),
  ])

  return { items, total, page, limit }
}

// ---------------------------------------------------------------------------
// T008 — createSubject
// ---------------------------------------------------------------------------

/**
 * Create a new subject.
 *
 * TX: BEGIN
 *   → division FK validation (if provided)
 *   → semester FK validation (if provided)
 *   → semester-division mismatch check (if both provided)
 *   → name uniqueness check
 *   → code uniqueness check (if provided)
 *   → INSERT → COMMIT
 *
 * @throws SubjectsError SUBJECT_DIVISION_NOT_FOUND   when division_id references no active row
 * @throws SubjectsError SUBJECT_SEMESTER_NOT_FOUND   when semester_id references no active row
 * @throws SubjectsError SUBJECT_NAME_DUPLICATE       when name is already taken
 * @throws SubjectsError SUBJECT_CODE_DUPLICATE       when code is already taken
 */
export async function createSubject(
  db: DbClient,
  input: CreateSubjectInput,
  audit: AuditContext
): Promise<SubjectRow> {
  await db.query('BEGIN')
  try {
    if (input.division_id) {
      const divExists = await divisionExists(db, input.division_id)
      if (!divExists) throw new SubjectsError('SUBJECT_DIVISION_NOT_FOUND')
    }

    if (input.semester_id) {
      const semExists = await semesterExists(db, input.semester_id)
      if (!semExists) throw new SubjectsError('SUBJECT_SEMESTER_NOT_FOUND')
    }

    if (input.division_id && input.semester_id) {
      const belongs = await semesterBelongsToDivision(db, input.semester_id, input.division_id)
      if (!belongs) throw new SubjectsError('SUBJECT_SEMESTER_DIVISION_MISMATCH')
    }

    const nameConflict = await subjectNameExists(db, input.name)
    if (nameConflict) throw new SubjectsError('SUBJECT_NAME_DUPLICATE')

    if (input.code) {
      const codeConflict = await subjectCodeExists(db, input.code)
      if (codeConflict) throw new SubjectsError('SUBJECT_CODE_DUPLICATE')
    }

    const row = await insertSubject(db, {
      name: input.name,
      code: input.code ?? null,
      division_id: input.division_id ?? null,
      semester_id: input.semester_id ?? null,
      is_multilanguage: input.is_multilanguage ?? false,
      default_language: input.default_language,
      description: input.description ?? null,
    })

    await db.query('COMMIT')

    logger.info('Subject created', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      subject_id: row.id,
      subject_name: row.name,
    })

    return row
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// T009 — getSubjectById (read-only)
// ---------------------------------------------------------------------------

/**
 * Retrieve a single active subject by ID.
 *
 * @throws SubjectsError SUBJECT_NOT_FOUND when not found or soft-deleted
 */
export async function getSubjectById(db: DbClient, id: string): Promise<SubjectRow> {
  const row = await findSubjectById(db, id)
  if (!row) throw new SubjectsError('SUBJECT_NOT_FOUND')
  return row
}

// ---------------------------------------------------------------------------
// T010 — updateSubject
// ---------------------------------------------------------------------------

/**
 * Update an existing active subject.
 *
 * TX: BEGIN
 *   → lockForUpdate (NOWAIT)
 *   → ARCHIVED guard
 *   → name uniqueness (if changed)
 *   → code uniqueness (if changed)
 *   → division FK validation (if changed)
 *   → semester FK validation (if changed)
 *   → semester-division mismatch check (if both present after update)
 *   → UPDATE → COMMIT
 *
 * @throws SubjectsError SUBJECT_NOT_FOUND          when not found (row absent or deleted_at set)
 * @throws SubjectsError SUBJECT_ARCHIVED           when the subject is ARCHIVED
 * @throws SubjectsError SUBJECT_NAME_DUPLICATE     when name conflicts
 * @throws SubjectsError SUBJECT_CODE_DUPLICATE     when code conflicts
 * @throws SubjectsError SUBJECT_DIVISION_NOT_FOUND when division_id references no active row
 * @throws SubjectsError SUBJECT_SEMESTER_NOT_FOUND when semester_id references no active row
 */
export async function updateSubject(
  db: DbClient,
  input: UpdateSubjectInput,
  audit: AuditContext
): Promise<SubjectRow> {
  await db.query('BEGIN')
  try {
    const locked = await lockSubjectForUpdate(db, input.id)
    if (!locked || locked.deleted_at !== null) throw new SubjectsError('SUBJECT_NOT_FOUND')
    if (locked.status === 'ARCHIVED') throw new SubjectsError('SUBJECT_ARCHIVED')

    if (input.name !== undefined) {
      const nameConflict = await subjectNameExists(db, input.name, input.id)
      if (nameConflict) throw new SubjectsError('SUBJECT_NAME_DUPLICATE')
    }
    if (input.code !== undefined && input.code !== null) {
      const codeConflict = await subjectCodeExists(db, input.code, input.id)
      if (codeConflict) throw new SubjectsError('SUBJECT_CODE_DUPLICATE')
    }
    if (input.division_id !== undefined && input.division_id !== null) {
      const divExists = await divisionExists(db, input.division_id)
      if (!divExists) throw new SubjectsError('SUBJECT_DIVISION_NOT_FOUND')
    }
    if (input.semester_id !== undefined && input.semester_id !== null) {
      const semExists = await semesterExists(db, input.semester_id)
      if (!semExists) throw new SubjectsError('SUBJECT_SEMESTER_NOT_FOUND')
    }

    // Resolve the effective division_id and semester_id after the update for mismatch check
    const effectiveDivisionId = input.division_id !== undefined ? input.division_id : undefined
    const effectiveSemesterId = input.semester_id !== undefined ? input.semester_id : undefined

    if (effectiveDivisionId && effectiveSemesterId) {
      const belongs = await semesterBelongsToDivision(db, effectiveSemesterId, effectiveDivisionId)
      if (!belongs) throw new SubjectsError('SUBJECT_SEMESTER_DIVISION_MISMATCH')
    }

    const updated = await updateSubjectRow(db, input.id, {
      name: input.name,
      code: input.code,
      division_id: input.division_id,
      semester_id: input.semester_id,
      is_multilanguage: input.is_multilanguage,
      default_language: input.default_language,
      description: input.description,
    })

    await db.query('COMMIT')

    logger.info('Subject updated', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      subject_id: updated.id,
    })

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// T011 — transitionSubjectStatus
// ---------------------------------------------------------------------------

/**
 * Transition a subject's status to a new state using Compare-And-Swap.
 *
 * TX: BEGIN
 *   → lockForUpdate (NOWAIT)
 *   → state machine validation
 *   → CAS UPDATE → rowCount 0 → SUBJECT_TRANSITION_CONFLICT
 *   → COMMIT
 *
 * @throws SubjectsError SUBJECT_NOT_FOUND          when not found
 * @throws SubjectsError SUBJECT_INVALID_TRANSITION when transition is not in allowed table
 * @throws SubjectsError SUBJECT_TRANSITION_CONFLICT when CAS fails (concurrent write)
 */
export async function transitionSubjectStatus(
  db: DbClient,
  input: TransitionSubjectInput,
  audit: AuditContext
): Promise<SubjectRow> {
  await db.query('BEGIN')
  try {
    const locked = await lockSubjectForUpdate(db, input.id)
    if (!locked || locked.deleted_at !== null) throw new SubjectsError('SUBJECT_NOT_FOUND')

    const currentStatus = locked.status as SubjectStatus

    const isAllowed = ALLOWED_TRANSITIONS.some(
      ([from, to]) => from === currentStatus && to === input.target_status
    )
    if (!isAllowed) throw new SubjectsError('SUBJECT_INVALID_TRANSITION')

    const { rowCount } = await casTransitionSubject(
      db,
      input.id,
      input.target_status,
      currentStatus
    )
    if (rowCount === 0) throw new SubjectsError('SUBJECT_TRANSITION_CONFLICT')

    await db.query('COMMIT')

    logger.info('Subject status transitioned', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      subject_id: input.id,
      from_status: currentStatus,
      to_status: input.target_status,
    })

    const updated = await findSubjectById(db, input.id)
    return updated as SubjectRow
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// T012 — deleteSubject
// ---------------------------------------------------------------------------

/**
 * Soft-delete a subject.
 *
 * TX: BEGIN
 *   → lockForUpdate (NOWAIT)
 *   → deleted_at guard
 *   → dependency check
 *   → softDelete → COMMIT
 *
 * @throws SubjectsError SUBJECT_NOT_FOUND           when not found or already deleted
 * @throws SubjectsError SUBJECT_HAS_DEPENDENT_CONTENT when dependency check fails
 */
export async function deleteSubject(db: DbClient, id: string, audit: AuditContext): Promise<void> {
  await db.query('BEGIN')
  try {
    const locked = await lockSubjectForUpdate(db, id)
    if (!locked || locked.deleted_at !== null) throw new SubjectsError('SUBJECT_NOT_FOUND')

    const hasDeps = await checkSubjectDependencies(db, id)
    if (hasDeps) throw new SubjectsError('SUBJECT_HAS_DEPENDENT_CONTENT')

    await softDeleteSubject(db, id)

    await db.query('COMMIT')

    logger.info('Subject deleted', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      subject_id: id,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

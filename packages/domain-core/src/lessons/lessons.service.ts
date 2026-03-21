/**
 * Lessons — Domain Service
 *
 * File: packages/domain-core/src/lessons/lessons.service.ts
 * Stage: STAGE_29_LESSONS
 *
 * Business logic layer. All write operations manage their own transaction
 * (BEGIN/COMMIT/ROLLBACK) on the passed DbClient. Read operations are
 * transaction-free.
 *
 * deleteLesson soft-deletes by setting status = 'DISABLED'.
 * LESSON_HAS_DEPENDENT_CONTENT is reserved for a future hard-delete surface
 * (dependency registry is not invoked here — Clarification Q8).
 */

import { createLogger } from '@zidney/logger'
import { LessonError } from './lessons.errors'
import {
  countLessons,
  findActiveLessonsForSubject,
  findLessonById,
  findLessons,
  insertLesson,
  lessonNameExistsInSubject,
  subjectExists,
  updateLessonRow,
} from './lessons.repository'
import type {
  ActiveLessonItem,
  AuditContext,
  CreateLessonInput,
  DbClient,
  LessonRow,
  ListLessonsInput,
  ListLessonsResult,
  UpdateLessonInput,
} from './lessons.types'

const logger = createLogger('domain:lessons')

// ---------------------------------------------------------------------------
// T006 — listLessons (read-only, no transaction required)
// ---------------------------------------------------------------------------

/**
 * List lessons with optional filters and offset pagination.
 *
 * @param db    Tenant DB client (read-only — no transaction opened)
 * @param input { page, limit, subject_id?, status?, search? }
 */
export async function listLessons(
  db: DbClient,
  input: ListLessonsInput
): Promise<ListLessonsResult> {
  const { page, limit, subject_id, status, search } = input
  const offset = (page - 1) * limit

  const [total, items] = await Promise.all([
    countLessons(db, { subject_id, status, search }),
    findLessons(db, { offset, limit, subject_id, status, search }),
  ])

  return { items, total, page, limit }
}

// ---------------------------------------------------------------------------
// T007 — getLesson (read-only)
// ---------------------------------------------------------------------------

/**
 * Retrieve a single lesson by ID.
 *
 * @throws LessonError LESSON_NOT_FOUND when not found
 */
export async function getLesson(db: DbClient, id: string): Promise<LessonRow> {
  const row = await findLessonById(db, id)
  if (!row) throw new LessonError('LESSON_NOT_FOUND')
  return row
}

// ---------------------------------------------------------------------------
// T008 — getActiveLessons (read-only, license-only endpoint)
// ---------------------------------------------------------------------------

/**
 * Retrieve all ENABLED lessons for a subject, ordered by name ASC.
 * Used by the runtime endpoint (/lessons/runtime) — license-only, no auth token.
 *
 * @throws LessonError LESSON_SUBJECT_NOT_FOUND when subject_id references no valid subject
 */
export async function getActiveLessons(
  db: DbClient,
  subject_id: string
): Promise<ActiveLessonItem[]> {
  const exists = await subjectExists(db, subject_id)
  if (!exists) throw new LessonError('LESSON_SUBJECT_NOT_FOUND')
  return findActiveLessonsForSubject(db, subject_id)
}

// ---------------------------------------------------------------------------
// T009 — createLesson
// ---------------------------------------------------------------------------

/**
 * Create a new lesson.
 *
 * TX: BEGIN
 *   → subject FK validation
 *   → name uniqueness check (optimistic fast-path)
 *   → INSERT → catch PG 23505 as race guard → COMMIT
 *
 * @throws LessonError LESSON_SUBJECT_NOT_FOUND  when subject_id references no valid subject
 * @throws LessonError LESSON_NAME_DUPLICATE     when name already exists in subject (or race)
 */
export async function createLesson(
  db: DbClient,
  input: CreateLessonInput,
  audit: AuditContext
): Promise<LessonRow> {
  await db.query('BEGIN')
  try {
    const subjExists = await subjectExists(db, input.subject_id)
    if (!subjExists) throw new LessonError('LESSON_SUBJECT_NOT_FOUND')

    const nameConflict = await lessonNameExistsInSubject(db, input.subject_id, input.name)
    if (nameConflict) throw new LessonError('LESSON_NAME_DUPLICATE')

    const row = await insertLesson(db, input, audit)

    await db.query('COMMIT')

    logger.info('Lesson created', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      lesson_id: row.id,
      lesson_name: row.name,
      subject_id: row.subject_id,
    })

    return row
  } catch (err: unknown) {
    await db.query('ROLLBACK')
    // Race condition: unique constraint violation on (subject_id, LOWER(name))
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as Record<string, unknown>).code === '23505'
    ) {
      throw new LessonError('LESSON_NAME_DUPLICATE')
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// T010 — updateLesson
// ---------------------------------------------------------------------------

/**
 * Update an existing lesson.
 *
 * Clarification Q7: if any non-status field is present AND the lesson is DISABLED,
 * throw LESSON_DISABLED — even if `status: 'ENABLED'` is also in the same payload.
 *
 * TX: BEGIN
 *   → findLessonById (lock row in same TX)
 *   → LESSON_NOT_FOUND guard
 *   → hasNonStatusFields + DISABLED guard (Q7)
 *   → status idempotency guards (ALREADY_ENABLED, ALREADY_DISABLED)
 *   → name uniqueness check (if name provided)
 *   → updateLessonRow → catch PG 23505 → COMMIT
 *
 * @throws LessonError LESSON_NOT_FOUND      when lesson not found
 * @throws LessonError LESSON_DISABLED       when DISABLED + non-status fields in payload
 * @throws LessonError LESSON_ALREADY_ENABLED  when already ENABLED + status: ENABLED
 * @throws LessonError LESSON_ALREADY_DISABLED when already DISABLED + status: DISABLED
 * @throws LessonError LESSON_NAME_DUPLICATE when name conflicts
 */
export async function updateLesson(
  db: DbClient,
  id: string,
  input: UpdateLessonInput,
  audit: AuditContext
): Promise<LessonRow> {
  await db.query('BEGIN')
  try {
    const lesson = await findLessonById(db, id)
    if (!lesson) throw new LessonError('LESSON_NOT_FOUND')

    const hasNonStatusFields = input.name !== undefined || 'code' in input || 'description' in input

    // Q7: non-status fields on a DISABLED lesson → LESSON_DISABLED
    if (hasNonStatusFields && lesson.status === 'DISABLED') {
      throw new LessonError('LESSON_DISABLED')
    }

    // Status idempotency
    if (!hasNonStatusFields && input.status !== undefined) {
      if (input.status === 'ENABLED' && lesson.status === 'ENABLED') {
        throw new LessonError('LESSON_ALREADY_ENABLED')
      }
      if (input.status === 'DISABLED' && lesson.status === 'DISABLED') {
        throw new LessonError('LESSON_ALREADY_DISABLED')
      }
    }

    if (input.name !== undefined) {
      const nameConflict = await lessonNameExistsInSubject(db, lesson.subject_id, input.name, id)
      if (nameConflict) throw new LessonError('LESSON_NAME_DUPLICATE')
    }

    const updated = await updateLessonRow(db, id, input, audit.user_id)

    await db.query('COMMIT')

    logger.info('Lesson updated', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      lesson_id: updated.id,
    })

    return updated
  } catch (err: unknown) {
    await db.query('ROLLBACK')
    // Race condition: unique constraint violation on (subject_id, LOWER(name))
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as Record<string, unknown>).code === '23505'
    ) {
      throw new LessonError('LESSON_NAME_DUPLICATE')
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// T011 — deleteLesson (soft-delete via status = 'DISABLED')
// ---------------------------------------------------------------------------

/**
 * Soft-delete a lesson by setting status to DISABLED.
 *
 * TX: BEGIN
 *   → findLessonById
 *   → LESSON_NOT_FOUND guard
 *   → LESSON_ALREADY_DISABLED guard (idempotency)
 *   → updateLessonRow(tx, id, { status: 'DISABLED' }, audit.user_id)
 *   → COMMIT
 *
 * Note: dependency registry is NOT invoked — LESSON_HAS_DEPENDENT_CONTENT
 * is reserved for a future hard-delete surface (Q8).
 *
 * @throws LessonError LESSON_NOT_FOUND      when lesson not found
 * @throws LessonError LESSON_ALREADY_DISABLED when lesson is already disabled
 */
export async function deleteLesson(
  db: DbClient,
  id: string,
  audit: AuditContext
): Promise<{ deleted: true }> {
  await db.query('BEGIN')
  try {
    const lesson = await findLessonById(db, id)
    if (!lesson) throw new LessonError('LESSON_NOT_FOUND')
    if (lesson.status === 'DISABLED') throw new LessonError('LESSON_ALREADY_DISABLED')

    await updateLessonRow(db, id, { status: 'DISABLED' }, audit.user_id)

    await db.query('COMMIT')

    logger.info('Lesson deleted (soft)', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      lesson_id: id,
    })

    return { deleted: true as const }
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

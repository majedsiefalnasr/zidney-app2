/**
 * Lessons — Repository (pure SQL query functions)
 *
 * File: packages/domain-core/src/lessons/lessons.repository.ts
 * Stage: STAGE_29_LESSONS
 *
 * All functions receive a DbClient. No transactions are opened here —
 * transaction boundaries are managed by the service layer.
 *
 * updateLessonRow always includes `updated_at = NOW()` in the SET clause
 * (server-authoritative time — ADR-0006).
 */

import type {
  ActiveLessonItem,
  AuditContext,
  DbClient,
  LessonRow,
  LessonStatus,
  ListLessonsInput,
} from './lessons.types'

// ---------------------------------------------------------------------------
// Internal Row Types
// ---------------------------------------------------------------------------

interface LessonDbRow extends Record<string, unknown> {
  id: string
  subject_id: string
  name: string
  code: string | null
  description: string | null
  status: string
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

interface CountRow extends Record<string, unknown> {
  total: string
}

interface ExistsRow extends Record<string, unknown> {
  exists: boolean
}

interface ActiveLessonDbRow extends Record<string, unknown> {
  id: string
  name: string
  code: string | null
}

// TransactionalClient — same shape as DbClient; alias for clarity at call sites
type TransactionalClient = DbClient

// ---------------------------------------------------------------------------
// Row Mapper
// ---------------------------------------------------------------------------

function mapLessonRow(r: LessonDbRow): LessonRow {
  return {
    id: r.id,
    subject_id: r.subject_id,
    name: r.name,
    code: r.code,
    description: r.description,
    status: r.status as LessonStatus,
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
    created_by: r.created_by,
    updated_by: r.updated_by,
  }
}

// ---------------------------------------------------------------------------
// Query Functions — Read
// ---------------------------------------------------------------------------

/** Find a single lesson by ID. Returns null if not found. */
export async function findLessonById(db: DbClient, id: string): Promise<LessonRow | null> {
  const result = await db.query<LessonDbRow>(
    `SELECT id, subject_id, name, code, description, status,
            created_at, updated_at, created_by, updated_by
     FROM lessons
     WHERE id = $1::uuid`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapLessonRow(row) : null
}

/** Lock a lesson row for update (NOWAIT — detects concurrent modification). */
export async function lockLessonForUpdate(
  db: TransactionalClient,
  id: string
): Promise<{ id: string; status: string } | null> {
  const result = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM lessons WHERE id = $1::uuid FOR UPDATE NOWAIT`,
    [id]
  )
  return result.rows[0] ?? null
}

/** Count lessons matching optional filters. */
export async function countLessons(
  db: DbClient,
  opts: Pick<ListLessonsInput, 'status' | 'subject_id' | 'search'>
): Promise<number> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.subject_id) {
    params.push(opts.subject_id)
    conditions.push(`subject_id = $${params.length}::uuid`)
  }
  if (opts.status) {
    params.push(opts.status)
    conditions.push(`status = $${params.length}`)
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`)
    conditions.push(
      `(LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(code, '')) LIKE $${params.length})`
    )
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS total FROM lessons ${where}`,
    params.length > 0 ? params : undefined
  )
  return parseInt(result.rows[0]?.total ?? '0', 10)
}

/** Find lessons with optional filters, ordered by created_at DESC. */
export async function findLessons(
  db: DbClient,
  opts: {
    offset: number
    limit: number
    subject_id?: string
    status?: LessonStatus
    search?: string
  }
): Promise<LessonRow[]> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.subject_id) {
    params.push(opts.subject_id)
    conditions.push(`subject_id = $${params.length}::uuid`)
  }
  if (opts.status) {
    params.push(opts.status)
    conditions.push(`status = $${params.length}`)
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`)
    conditions.push(
      `(LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(code, '')) LIKE $${params.length})`
    )
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(opts.offset)
  params.push(opts.limit)

  const result = await db.query<LessonDbRow>(
    `SELECT id, subject_id, name, code, description, status,
            created_at, updated_at, created_by, updated_by
     FROM lessons
     ${where}
     ORDER BY created_at DESC
     OFFSET $${params.length - 1}
     LIMIT $${params.length}`,
    params
  )
  return result.rows.map(mapLessonRow)
}

/** Check if a lesson name already exists in a subject (case-insensitive, unique per subject). */
export async function lessonNameExistsInSubject(
  db: DbClient,
  subjectId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const params: unknown[] = [subjectId, name]
  let sql = `SELECT EXISTS (
    SELECT 1 FROM lessons
    WHERE subject_id = $1::uuid AND LOWER(name) = LOWER($2)`
  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $${params.length}::uuid`
  }
  sql += `) AS exists`
  const result = await db.query<ExistsRow>(sql, params)
  return result.rows[0]?.exists === true
}

/** Check if a subject exists. */
export async function subjectExists(db: DbClient, subjectId: string): Promise<boolean> {
  const result = await db.query<ExistsRow>(
    `SELECT EXISTS (
       SELECT 1 FROM subjects WHERE id = $1::uuid
     ) AS exists`,
    [subjectId]
  )
  return result.rows[0]?.exists === true
}

/** Get all ENABLED lessons for a subject, ordered by name ASC. */
export async function findActiveLessonsForSubject(
  db: DbClient,
  subjectId: string
): Promise<ActiveLessonItem[]> {
  const result = await db.query<ActiveLessonDbRow>(
    `SELECT id, name, code
     FROM lessons
     WHERE subject_id = $1::uuid AND status = 'ENABLED'
     ORDER BY name ASC`,
    [subjectId]
  )
  return result.rows.map((r) => ({ id: r.id, name: r.name, code: r.code }))
}

// ---------------------------------------------------------------------------
// Query Functions — Write (service layer only — called inside transactions)
// ---------------------------------------------------------------------------

/** Insert a new lesson row. Returns the created row. */
export async function insertLesson(
  db: TransactionalClient,
  input: {
    subject_id: string
    name: string
    code?: string | null
    description?: string | null
  },
  audit: AuditContext
): Promise<LessonRow> {
  const result = await db.query<LessonDbRow>(
    `INSERT INTO lessons
       (subject_id, name, code, description, status, created_at, updated_at, created_by, updated_by)
     VALUES ($1::uuid, $2, $3, $4, 'ENABLED', NOW(), NOW(), $5, $5)
     RETURNING id, subject_id, name, code, description, status,
               created_at, updated_at, created_by, updated_by`,
    [
      input.subject_id,
      input.name,
      input.code ?? null,
      input.description ?? null,
      audit.user_id ?? null,
    ]
  )
  return mapLessonRow(result.rows[0] as LessonDbRow)
}

/**
 * Update an existing lesson row with a dynamic SET clause.
 * Always sets `updated_at = NOW()` (server-authoritative time — ADR-0006).
 * Returns the updated row.
 */
export async function updateLessonRow(
  db: TransactionalClient,
  id: string,
  input: {
    name?: string
    code?: string | null
    description?: string | null
    status?: LessonStatus
  },
  updatedBy: string | null
): Promise<LessonRow> {
  const setClauses: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (input.name !== undefined) {
    params.push(input.name)
    setClauses.push(`name = $${params.length}`)
  }
  if ('code' in input) {
    params.push(input.code ?? null)
    setClauses.push(`code = $${params.length}`)
  }
  if ('description' in input) {
    params.push(input.description ?? null)
    setClauses.push(`description = $${params.length}`)
  }
  if (input.status !== undefined) {
    params.push(input.status)
    setClauses.push(`status = $${params.length}`)
  }

  params.push(updatedBy ?? null)
  setClauses.push(`updated_by = $${params.length}`)

  params.push(id)
  const result = await db.query<LessonDbRow>(
    `UPDATE lessons
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}::uuid
     RETURNING id, subject_id, name, code, description, status,
               created_at, updated_at, created_by, updated_by`,
    params
  )
  return mapLessonRow(result.rows[0] as LessonDbRow)
}

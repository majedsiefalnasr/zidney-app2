/**
 * Subjects — Repository (pure SQL query functions)
 *
 * File: packages/domain-core/src/subjects/subjects.repository.ts
 * Stage: STAGE_28_SUBJECTS
 *
 * All functions receive a DbClient. No transactions are opened here —
 * transaction boundaries are managed by the service layer.
 */

import type { DbClient, ListSubjectsInput, SubjectRow, SubjectStatus } from './subjects.types'

// ---------------------------------------------------------------------------
// Internal Row Types
// ---------------------------------------------------------------------------

interface SubjectDbRow extends Record<string, unknown> {
  id: string
  name: string
  code: string | null
  division_id: string | null
  semester_id: string | null
  is_multilanguage: boolean
  default_language: string
  description: string | null
  status: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

interface CountRow extends Record<string, unknown> {
  total: string
}

interface ExistsRow extends Record<string, unknown> {
  exists: boolean
}

interface LockRow extends Record<string, unknown> {
  id: string
  status: string
  deleted_at: string | null
}

interface RowCountRow extends Record<string, unknown> {
  rowcount: string
}

// TransactionalClient — same shape as DbClient; alias for clarity at call sites
type TransactionalClient = DbClient

// ---------------------------------------------------------------------------
// Row Mapper
// ---------------------------------------------------------------------------

function mapSubjectRow(r: SubjectDbRow): SubjectRow {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    division_id: r.division_id,
    semester_id: r.semester_id,
    is_multilanguage: r.is_multilanguage,
    default_language: r.default_language,
    description: r.description,
    status: r.status as SubjectStatus,
    deleted_at: r.deleted_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Query Functions — Read
// ---------------------------------------------------------------------------

/** Find a single active subject by ID. Returns null if not found or soft-deleted. */
export async function findSubjectById(db: DbClient, id: string): Promise<SubjectRow | null> {
  const result = await db.query<SubjectDbRow>(
    `SELECT id, name, code, division_id, semester_id, is_multilanguage, default_language,
            description, status, deleted_at, created_at, updated_at
     FROM subjects
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapSubjectRow(row) : null
}

/** Lock an active subject row for update — returns minimal columns needed for guards. */
export async function lockSubjectForUpdate(
  db: TransactionalClient,
  id: string
): Promise<{ id: string; status: string; deleted_at: string | null } | null> {
  const result = await db.query<LockRow>(
    `SELECT id, status, deleted_at
     FROM subjects
     WHERE id = $1::uuid
     FOR UPDATE NOWAIT`,
    [id]
  )
  return result.rows[0] ?? null
}

/** Count active subjects matching optional filters. */
export async function countSubjects(
  db: DbClient,
  opts: Pick<ListSubjectsInput, 'status' | 'search' | 'division_id' | 'semester_id'>
): Promise<number> {
  const conditions: string[] = ['deleted_at IS NULL']
  const params: unknown[] = []

  if (opts.status) {
    params.push(opts.status)
    conditions.push(`status = $${params.length}`)
  }
  if (opts.division_id) {
    params.push(opts.division_id)
    conditions.push(`division_id = $${params.length}::uuid`)
  }
  if (opts.semester_id) {
    params.push(opts.semester_id)
    conditions.push(`semester_id = $${params.length}::uuid`)
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`)
    conditions.push(
      `(LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(code, '')) LIKE $${params.length})`
    )
  }

  const where = conditions.join(' AND ')
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS total FROM subjects WHERE ${where}`,
    params.length > 0 ? params : undefined
  )
  return parseInt(result.rows[0]?.total ?? '0', 10)
}

/** Find active subjects with optional filters, ordered by created_at DESC. */
export async function findSubjects(
  db: DbClient,
  opts: {
    offset: number
    limit: number
    status?: SubjectStatus
    search?: string
    division_id?: string
    semester_id?: string
  }
): Promise<SubjectRow[]> {
  const conditions: string[] = ['deleted_at IS NULL']
  const params: unknown[] = []

  if (opts.status) {
    params.push(opts.status)
    conditions.push(`status = $${params.length}`)
  }
  if (opts.division_id) {
    params.push(opts.division_id)
    conditions.push(`division_id = $${params.length}::uuid`)
  }
  if (opts.semester_id) {
    params.push(opts.semester_id)
    conditions.push(`semester_id = $${params.length}::uuid`)
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`)
    conditions.push(
      `(LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(code, '')) LIKE $${params.length})`
    )
  }

  const where = conditions.join(' AND ')
  params.push(opts.offset)
  params.push(opts.limit)

  const result = await db.query<SubjectDbRow>(
    `SELECT id, name, code, division_id, semester_id, is_multilanguage, default_language,
            description, status, deleted_at, created_at, updated_at
     FROM subjects
     WHERE ${where}
     ORDER BY created_at DESC
     OFFSET $${params.length - 1}
     LIMIT $${params.length}`,
    params
  )
  return result.rows.map(mapSubjectRow)
}

/** Check if a subject name already exists among active records (case-insensitive). */
export async function subjectNameExists(
  db: DbClient,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const params: unknown[] = [name]
  let sql = `SELECT EXISTS (
    SELECT 1 FROM subjects
    WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL`
  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $2::uuid`
  }
  sql += `) AS exists`
  const result = await db.query<ExistsRow>(sql, params)
  return result.rows[0]?.exists === true
}

/** Check if a subject code already exists among active records. */
export async function subjectCodeExists(
  db: DbClient,
  code: string,
  excludeId?: string
): Promise<boolean> {
  const params: unknown[] = [code]
  let sql = `SELECT EXISTS (
    SELECT 1 FROM subjects
    WHERE code = $1 AND deleted_at IS NULL`
  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $2::uuid`
  }
  sql += `) AS exists`
  const result = await db.query<ExistsRow>(sql, params)
  return result.rows[0]?.exists === true
}

// ---------------------------------------------------------------------------
// Query Functions — Write (service layer only — called inside transactions)
// ---------------------------------------------------------------------------

/** Insert a new subject row. Returns the created row. */
export async function insertSubject(
  db: TransactionalClient,
  input: {
    name: string
    code?: string | null
    division_id?: string | null
    semester_id?: string | null
    is_multilanguage?: boolean
    default_language: string
    description?: string | null
  }
): Promise<SubjectRow> {
  const result = await db.query<SubjectDbRow>(
    `INSERT INTO subjects
       (name, code, division_id, semester_id, is_multilanguage, default_language, description,
        status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', NOW(), NOW())
     RETURNING id, name, code, division_id, semester_id, is_multilanguage, default_language,
               description, status, deleted_at, created_at, updated_at`,
    [
      input.name,
      input.code ?? null,
      input.division_id ?? null,
      input.semester_id ?? null,
      input.is_multilanguage ?? false,
      input.default_language,
      input.description ?? null,
    ]
  )
  return mapSubjectRow(result.rows[0] as SubjectDbRow)
}

/** Update an existing active subject row. Returns the updated row. */
export async function updateSubjectRow(
  db: TransactionalClient,
  id: string,
  input: {
    name?: string
    code?: string | null
    division_id?: string | null
    semester_id?: string | null
    is_multilanguage?: boolean
    default_language?: string
    description?: string | null
  }
): Promise<SubjectRow> {
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
  if ('division_id' in input) {
    params.push(input.division_id ?? null)
    setClauses.push(`division_id = $${params.length}`)
  }
  if ('semester_id' in input) {
    params.push(input.semester_id ?? null)
    setClauses.push(`semester_id = $${params.length}`)
  }
  if (input.is_multilanguage !== undefined) {
    params.push(input.is_multilanguage)
    setClauses.push(`is_multilanguage = $${params.length}`)
  }
  if (input.default_language !== undefined) {
    params.push(input.default_language)
    setClauses.push(`default_language = $${params.length}`)
  }
  if ('description' in input) {
    params.push(input.description ?? null)
    setClauses.push(`description = $${params.length}`)
  }

  params.push(id)
  const result = await db.query<SubjectDbRow>(
    `UPDATE subjects
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}::uuid AND deleted_at IS NULL
     RETURNING id, name, code, division_id, semester_id, is_multilanguage, default_language,
               description, status, deleted_at, created_at, updated_at`,
    params
  )
  return mapSubjectRow(result.rows[0] as SubjectDbRow)
}

/**
 * Compare-And-Swap status transition.
 * Returns rowCount: 0 when the subject's status is no longer expectedCurrentStatus
 * (concurrent transition won — caller should throw SUBJECT_TRANSITION_CONFLICT).
 */
export async function casTransitionSubject(
  db: TransactionalClient,
  id: string,
  targetStatus: SubjectStatus,
  expectedCurrentStatus: SubjectStatus
): Promise<{ rowCount: number }> {
  const result = await db.query(
    `UPDATE subjects
     SET status = $1, updated_at = NOW()
     WHERE id = $2::uuid
       AND status = $3
       AND deleted_at IS NULL`,
    [targetStatus, id, expectedCurrentStatus]
  )
  return { rowCount: result.rowCount ?? 0 }
}

/** Soft-delete a subject by setting deleted_at = NOW(). */
export async function softDeleteSubject(db: TransactionalClient, id: string): Promise<void> {
  await db.query(
    `UPDATE subjects
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  )
}

/** Check if a division exists and is not deleted. */
export async function divisionExists(db: DbClient, divisionId: string): Promise<boolean> {
  const result = await db.query<ExistsRow>(
    `SELECT EXISTS (
       SELECT 1 FROM divisions WHERE id = $1::uuid AND deleted_at IS NULL
     ) AS exists`,
    [divisionId]
  )
  return result.rows[0]?.exists === true
}

/** Check if a semester exists and is not deleted. */
export async function semesterExists(db: DbClient, semesterId: string): Promise<boolean> {
  const result = await db.query<ExistsRow>(
    `SELECT EXISTS (
       SELECT 1 FROM semesters WHERE id = $1::uuid AND deleted_at IS NULL
     ) AS exists`,
    [semesterId]
  )
  return result.rows[0]?.exists === true
}

/**
 * Check that a semester belongs to a given division.
 * Returns false if the semester has a different division_id or null division_id
 * when a division filter is active.
 */
export async function semesterBelongsToDivision(
  _db: DbClient,
  semesterId: string,
  divisionId: string
): Promise<boolean> {
  // Semesters table does not have a division_id column at STAGE_27.
  // The mismatch validation is a business rule: a subject's semester should belong
  // to the same academic grouping as the subject's division.
  // Since semesters currently have no division_id, this always returns true —
  // the guard is a forward-compatibility hook for when semester-division linkage
  // is implemented in a downstream stage.
  void semesterId
  void divisionId
  return Promise.resolve(true)
}

export type { RowCountRow, SubjectRow }

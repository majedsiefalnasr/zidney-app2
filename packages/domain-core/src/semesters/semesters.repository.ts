/**
 * Semesters — Repository (pure SQL query functions)
 *
 * File: packages/domain-core/src/semesters/semesters.repository.ts
 * Stage: STAGE_27_SEMESTERS
 *
 * All functions receive a DbClient/TransactionalClient. No transactions are
 * opened here — the service layer is responsible for transaction boundaries.
 */

import type { AuditContext, DbClient, SemesterRow } from './semesters.types'

// ---------------------------------------------------------------------------
// Internal Row Types
// ---------------------------------------------------------------------------

interface SemesterDbRow extends Record<string, unknown> {
  id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
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

// TransactionalClient — same shape as DbClient; alias for clarity at call sites
type TransactionalClient = DbClient

// ---------------------------------------------------------------------------
// Row Mapper
// ---------------------------------------------------------------------------

function mapSemesterRow(r: SemesterDbRow): SemesterRow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    start_date: r.start_date,
    end_date: r.end_date,
    status: r.status as 'ENABLED' | 'DISABLED',
    deleted_at: r.deleted_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Query Functions — Read
// ---------------------------------------------------------------------------

/** Find a single active semester by ID. Returns null if not found or soft-deleted. */
export async function findSemesterById(db: DbClient, id: string): Promise<SemesterRow | null> {
  const result = await db.query<SemesterDbRow>(
    `SELECT id, name, description, start_date, end_date, status, deleted_at, created_at, updated_at
     FROM semesters
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapSemesterRow(row) : null
}

/** Lock an active semester row for update — returns minimal columns needed by service guards. */
export async function lockSemesterForUpdate(
  db: TransactionalClient,
  id: string
): Promise<{ id: string; status: string; deleted_at: string | null } | null> {
  const result = await db.query<
    {
      id: string
      status: string
      deleted_at: string | null
    } & Record<string, unknown>
  >(
    `SELECT id, status, deleted_at
     FROM semesters
     WHERE id = $1::uuid
     FOR UPDATE`,
    [id]
  )
  return result.rows[0] ?? null
}

/** Check if a semester name already exists among active records (case-insensitive). */
export async function semesterNameExists(
  db: DbClient,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const params: unknown[] = [name]
  let sql = `SELECT EXISTS (
    SELECT 1 FROM semesters WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL`
  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $2::uuid`
  }
  sql += `) AS exists`
  const result = await db.query<ExistsRow>(sql, params)
  return result.rows[0]?.exists === true
}

/**
 * Count active semesters matching optional filters.
 * Used for the total count in paginated list responses.
 */
export async function countSemesters(
  db: DbClient,
  opts: { status?: 'ENABLED' | 'DISABLED'; search?: string }
): Promise<number> {
  const conditions: string[] = ['deleted_at IS NULL']
  const params: unknown[] = []

  if (opts.status) {
    params.push(opts.status)
    conditions.push(`status = $${params.length}`)
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`)
    conditions.push(`LOWER(name) LIKE $${params.length}`)
  }

  const where = conditions.join(' AND ')
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS total FROM semesters WHERE ${where}`,
    params.length > 0 ? params : undefined
  )
  return parseInt(result.rows[0]?.total ?? '0', 10)
}

/**
 * Find active semesters with optional filters, ordered by name, OFFSET/LIMIT pagination.
 */
export async function findSemesters(
  db: DbClient,
  opts: {
    offset: number
    limit: number
    status?: 'ENABLED' | 'DISABLED'
    search?: string
  }
): Promise<SemesterRow[]> {
  const conditions: string[] = ['deleted_at IS NULL']
  const params: unknown[] = []

  if (opts.status) {
    params.push(opts.status)
    conditions.push(`status = $${params.length}`)
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`)
    conditions.push(`LOWER(name) LIKE $${params.length}`)
  }

  const where = conditions.join(' AND ')

  params.push(opts.offset)
  params.push(opts.limit)
  const result = await db.query<SemesterDbRow>(
    `SELECT id, name, description, start_date, end_date, status, deleted_at, created_at, updated_at
     FROM semesters
     WHERE ${where}
     ORDER BY name ASC
     OFFSET $${params.length - 1}
     LIMIT $${params.length}`,
    params
  )
  return result.rows.map(mapSemesterRow)
}

// ---------------------------------------------------------------------------
// Query Functions — Write (used inside service transactions only)
// ---------------------------------------------------------------------------

/** Insert a new semester row. Returns the created row. */
export async function insertSemester(
  db: TransactionalClient,
  input: {
    name: string
    description?: string | null
    start_date?: string | null
    end_date?: string | null
  }
): Promise<SemesterRow> {
  const result = await db.query<SemesterDbRow>(
    `INSERT INTO semesters (name, description, start_date, end_date, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'ENABLED', NOW(), NOW())
     RETURNING id, name, description, start_date, end_date, status, deleted_at, created_at, updated_at`,
    [input.name, input.description ?? null, input.start_date ?? null, input.end_date ?? null]
  )
  return mapSemesterRow(result.rows[0] as SemesterDbRow)
}

/** Update an existing active semester row. Returns the updated row. */
export async function updateSemesterRow(
  db: TransactionalClient,
  id: string,
  input: {
    name?: string
    description?: string | null
    start_date?: string | null
    end_date?: string | null
    status?: 'ENABLED' | 'DISABLED'
  }
): Promise<SemesterRow> {
  const setClauses: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (input.name !== undefined) {
    params.push(input.name)
    setClauses.push(`name = $${params.length}`)
  }
  if ('description' in input) {
    params.push(input.description ?? null)
    setClauses.push(`description = $${params.length}`)
  }
  if ('start_date' in input) {
    params.push(input.start_date ?? null)
    setClauses.push(`start_date = $${params.length}`)
  }
  if ('end_date' in input) {
    params.push(input.end_date ?? null)
    setClauses.push(`end_date = $${params.length}`)
  }
  if (input.status !== undefined) {
    params.push(input.status)
    setClauses.push(`status = $${params.length}`)
  }

  params.push(id)
  const result = await db.query<SemesterDbRow>(
    `UPDATE semesters
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}::uuid AND deleted_at IS NULL
     RETURNING id, name, description, start_date, end_date, status, deleted_at, created_at, updated_at`,
    params
  )
  return mapSemesterRow(result.rows[0] as SemesterDbRow)
}

/** Soft-delete a semester by setting deleted_at = NOW(). */
export async function softDeleteSemester(db: TransactionalClient, id: string): Promise<void> {
  await db.query(
    `UPDATE semesters
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  )
}

/** Count active students assigned to this semester. */
export async function countStudentsForSemester(db: DbClient, semesterId: string): Promise<number> {
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS total
     FROM students
     WHERE semester_id = $1::uuid`,
    [semesterId]
  )
  return parseInt(result.rows[0]?.total ?? '0', 10)
}

/**
 * Count subjects assigned to this semester.
 *
 * NOTE (STAGE_28): The `subjects` table does not exist until STAGE_28. This
 * function returns 0 unconditionally so the delete guard for SEMESTER_HAS_SUBJECTS
 * always passes in STAGE_27. When STAGE_28 adds a `subjects` table with a
 * `semester_id FK`, this implementation must be replaced with a real COUNT query.
 */
export async function countSubjectsForSemester(
  _db: DbClient,
  _semesterId: string
): Promise<number> {
  // NOTE (STAGE_28): subjects table not yet created — always returns 0 until wired.
  return Promise.resolve(0)
}

// Re-export AuditContext for service layer convenience
export type { AuditContext }

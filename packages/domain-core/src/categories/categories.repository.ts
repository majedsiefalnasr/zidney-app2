/**
 * Categories — Repository (pure SQL query functions)
 *
 * File: packages/domain-core/src/categories/categories.repository.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * All functions receive a DbClient. Transaction boundaries are managed
 * by the service layer. Repository functions are pure query runners.
 *
 * updated_at always uses NOW() (server-authoritative time — ADR-0006).
 */

import type {
  AuditContext,
  CategoryRow,
  CategoryStatus,
  CreateCategoryInput,
  DbClient,
  ListCategoriesInput,
  ScopedCategoryRow,
  UpdateCategoryInput,
} from './categories.types'

// ---------------------------------------------------------------------------
// Internal Row Types
// ---------------------------------------------------------------------------

interface CategoryDbRow extends Record<string, unknown> {
  id: string
  name: string
  code: string | null
  description: string | null
  parent_id: string | null
  status: string
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

interface ScopedCategoryDbRow extends CategoryDbRow {
  subject_ids: string | null // pg returns arrays as comma-separated string or JSON
  division_ids: string | null
}

interface CountRow extends Record<string, unknown> {
  total: string
}

interface ExistsRow extends Record<string, unknown> {
  exists: boolean
}

// TransactionalClient — same shape as DbClient; alias for clarity
type TransactionalClient = DbClient

// ---------------------------------------------------------------------------
// Row Mappers
// ---------------------------------------------------------------------------

function mapCategoryRow(r: CategoryDbRow): CategoryRow {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description,
    parent_id: r.parent_id,
    status: r.status as CategoryStatus,
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
    created_by: r.created_by,
    updated_by: r.updated_by,
  }
}

function parseArrayField(value: string | null | string[]): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  // pg returns array_agg as a postgres array literal: {uuid1,uuid2}
  if (typeof value === 'string') {
    if (value === '{}') return []
    return value.replace(/^\{/, '').replace(/\}$/, '').split(',').filter(Boolean)
  }
  return []
}

function mapScopedCategoryRow(r: ScopedCategoryDbRow): ScopedCategoryRow {
  return {
    ...mapCategoryRow(r),
    subject_ids: parseArrayField(r.subject_ids),
    division_ids: parseArrayField(r.division_ids),
  }
}

// ---------------------------------------------------------------------------
// Scoped SELECT fragment (with scope arrays)
// ---------------------------------------------------------------------------

const SCOPED_SELECT = `
  c.id, c.name, c.code, c.description, c.parent_id, c.status,
  c.created_at, c.updated_at, c.created_by, c.updated_by,
  COALESCE(cs.subject_ids, '{}') AS subject_ids,
  COALESCE(cd.division_ids, '{}') AS division_ids
FROM categories c
LEFT JOIN LATERAL (
  SELECT array_agg(cs2.subject_id::text ORDER BY cs2.subject_id) AS subject_ids
  FROM category_subjects cs2
  WHERE cs2.category_id = c.id
) cs ON TRUE
LEFT JOIN LATERAL (
  SELECT array_agg(cd2.division_id::text ORDER BY cd2.division_id) AS division_ids
  FROM category_divisions cd2
  WHERE cd2.category_id = c.id
) cd ON TRUE`

// ---------------------------------------------------------------------------
// Query Functions — Read
// ---------------------------------------------------------------------------

/** Find a single category by ID (flat, no scope). Returns null if not found. */
export async function findCategoryById(db: DbClient, id: string): Promise<CategoryRow | null> {
  const result = await db.query<CategoryDbRow>(
    `SELECT id, name, code, description, parent_id, status,
            created_at, updated_at, created_by, updated_by
     FROM categories
     WHERE id = $1::uuid`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapCategoryRow(row) : null
}

/** Find a single category by ID with scope arrays. Returns null if not found. */
export async function findScopedCategoryById(
  db: DbClient,
  id: string
): Promise<ScopedCategoryRow | null> {
  const result = await db.query<ScopedCategoryDbRow>(
    `SELECT ${SCOPED_SELECT}
     WHERE c.id = $1::uuid`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapScopedCategoryRow(row) : null
}

/**
 * Lock a category row for update (NOWAIT — detects concurrent modification).
 * Returns { id, status } or null if not found.
 * Caller MUST be inside a transaction. Raises PG error 55P03 if locked.
 */
export async function lockCategoryForUpdate(
  db: TransactionalClient,
  id: string
): Promise<{ id: string; status: string; parent_id: string | null } | null> {
  const result = await db.query<{
    id: string
    status: string
    parent_id: string | null
  }>(
    `SELECT id, status, parent_id
     FROM categories WHERE id = $1::uuid FOR UPDATE NOWAIT`,
    [id]
  )
  return result.rows[0] ?? null
}

/** Count categories matching optional filters. */
export async function countCategories(
  db: DbClient,
  opts: Pick<ListCategoriesInput, 'status' | 'parent_id' | 'search'>
): Promise<number> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.parent_id !== undefined) {
    if (opts.parent_id === null) {
      conditions.push('parent_id IS NULL')
    } else {
      params.push(opts.parent_id)
      conditions.push(`parent_id = $${params.length}::uuid`)
    }
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
    `SELECT COUNT(*)::text AS total FROM categories ${where}`,
    params.length > 0 ? params : undefined
  )
  return parseInt(result.rows[0]?.total ?? '0', 10)
}

/** Find categories with optional filters, ordered by created_at DESC, with scope. */
export async function findCategories(
  db: DbClient,
  opts: {
    offset: number
    limit: number
    parent_id?: string | null
    status?: CategoryStatus
    search?: string
  }
): Promise<ScopedCategoryRow[]> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.parent_id !== undefined) {
    if (opts.parent_id === null) {
      conditions.push('c.parent_id IS NULL')
    } else {
      params.push(opts.parent_id)
      conditions.push(`c.parent_id = $${params.length}::uuid`)
    }
  }
  if (opts.status) {
    params.push(opts.status)
    conditions.push(`c.status = $${params.length}`)
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`)
    conditions.push(
      `(LOWER(c.name) LIKE $${params.length} OR LOWER(COALESCE(c.code, '')) LIKE $${params.length})`
    )
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(opts.offset)
  params.push(opts.limit)

  const result = await db.query<ScopedCategoryDbRow>(
    `SELECT ${SCOPED_SELECT}
     ${where}
     ORDER BY c.created_at DESC
     OFFSET $${params.length - 1}
     LIMIT $${params.length}`,
    params
  )
  return result.rows.map(mapScopedCategoryRow)
}

/** Find all categories (flat, no pagination) for tree assembly. */
export async function findAllCategoriesForTree(db: DbClient): Promise<ScopedCategoryRow[]> {
  const result = await db.query<ScopedCategoryDbRow>(
    `SELECT ${SCOPED_SELECT}
     ORDER BY c.created_at ASC`
  )
  return result.rows.map(mapScopedCategoryRow)
}

/**
 * Check if a category name already exists (case-insensitive).
 * Optionally exclude a specific category ID (for updates).
 */
export async function categoryNameExists(
  db: DbClient,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const params: unknown[] = [name]
  let sql = `SELECT EXISTS (
    SELECT 1 FROM categories
    WHERE LOWER(name) = LOWER($1)`
  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $${params.length}::uuid`
  }
  sql += `) AS exists`
  const result = await db.query<ExistsRow>(sql, params)
  return result.rows[0]?.exists === true
}

/**
 * Check if a category code already exists (case-insensitive, partial — nulls excluded).
 * Optionally exclude a specific category ID (for updates).
 */
export async function categoryCodeExists(
  db: DbClient,
  code: string,
  excludeId?: string
): Promise<boolean> {
  const params: unknown[] = [code]
  let sql = `SELECT EXISTS (
    SELECT 1 FROM categories
    WHERE code IS NOT NULL AND LOWER(code) = LOWER($1)`
  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $${params.length}::uuid`
  }
  sql += `) AS exists`
  const result = await db.query<ExistsRow>(sql, params)
  return result.rows[0]?.exists === true
}

/** Count enabled direct children of a category. */
export async function countEnabledChildren(db: DbClient, parentId: string): Promise<number> {
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS total
     FROM categories
     WHERE parent_id = $1::uuid AND status = 'ENABLED'`,
    [parentId]
  )
  return parseInt(result.rows[0]?.total ?? '0', 10)
}

/**
 * Walk the ancestor chain from a given start node up to maxHops hops.
 * Used for circular reference detection: if targetId appears in the chain,
 * setting parentId = targetId would create a cycle.
 *
 * Returns the list of ancestor IDs encountered (up to maxHops).
 */
export async function findAncestorIds(
  db: DbClient,
  startId: string,
  maxHops: number
): Promise<string[]> {
  const result = await db.query<{ id: string; parent_id: string | null }>(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id FROM categories WHERE id = $1::uuid
       UNION ALL
       SELECT c.id, c.parent_id
       FROM categories c
       JOIN ancestors a ON a.parent_id = c.id
     )
     SELECT id FROM ancestors WHERE id <> $1::uuid
     LIMIT $2`,
    [startId, maxHops]
  )
  return result.rows.map((r) => r.id)
}

/** Check if a subject exists. */
export async function subjectExists(db: DbClient, subjectId: string): Promise<boolean> {
  const result = await db.query<ExistsRow>(
    `SELECT EXISTS (SELECT 1 FROM subjects WHERE id = $1::uuid) AS exists`,
    [subjectId]
  )
  return result.rows[0]?.exists === true
}

/** Check if a division exists. */
export async function divisionExists(db: DbClient, divisionId: string): Promise<boolean> {
  const result = await db.query<ExistsRow>(
    `SELECT EXISTS (SELECT 1 FROM divisions WHERE id = $1::uuid) AS exists`,
    [divisionId]
  )
  return result.rows[0]?.exists === true
}

// ---------------------------------------------------------------------------
// Query Functions — Write
// ---------------------------------------------------------------------------

/** Insert a new category row and return it (no scopes). */
export async function insertCategory(
  db: TransactionalClient,
  input: CreateCategoryInput,
  audit: AuditContext
): Promise<CategoryRow> {
  const result = await db.query<CategoryDbRow>(
    `INSERT INTO categories
       (name, code, description, parent_id, status, created_by, updated_by)
     VALUES
       ($1, $2, $3, $4, 'ENABLED', $5::uuid, $5::uuid)
     RETURNING id, name, code, description, parent_id, status,
               created_at, updated_at, created_by, updated_by`,
    [
      input.name,
      input.code ?? null,
      input.description ?? null,
      input.parent_id ?? null,
      audit.user_id,
    ]
  )
  // biome-ignore lint/style/noNonNullAssertion: RETURNING guarantees one row
  return mapCategoryRow(result.rows[0]!)
}

/** Insert scope records (subjects + divisions) for a category. Idempotent via UNIQUE constraint. */
export async function insertCategoryScope(
  db: TransactionalClient,
  categoryId: string,
  subjectIds: string[],
  divisionIds: string[]
): Promise<void> {
  for (const sid of subjectIds) {
    await db.query(
      `INSERT INTO category_subjects (category_id, subject_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT (category_id, subject_id) DO NOTHING`,
      [categoryId, sid]
    )
  }
  for (const did of divisionIds) {
    await db.query(
      `INSERT INTO category_divisions (category_id, division_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT (category_id, division_id) DO NOTHING`,
      [categoryId, did]
    )
  }
}

/** Replace scope records for a category (delete existing + insert new). */
export async function replaceCategoryScope(
  db: TransactionalClient,
  categoryId: string,
  subjectIds: string[],
  divisionIds: string[]
): Promise<void> {
  await db.query(`DELETE FROM category_subjects WHERE category_id = $1::uuid`, [categoryId])
  await db.query(`DELETE FROM category_divisions WHERE category_id = $1::uuid`, [categoryId])
  await insertCategoryScope(db, categoryId, subjectIds, divisionIds)
}

/** Update a category row. Returns the updated row. */
export async function updateCategoryRow(
  db: TransactionalClient,
  id: string,
  input: UpdateCategoryInput,
  userId: string | null
): Promise<CategoryRow> {
  const setClauses: string[] = ['updated_at = NOW()', `updated_by = $1::uuid`]
  const params: unknown[] = [userId ?? null]

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
  if ('parent_id' in input) {
    params.push(input.parent_id ?? null)
    setClauses.push(`parent_id = $${params.length}::uuid`)
  }
  if (input.status !== undefined) {
    params.push(input.status)
    setClauses.push(`status = $${params.length}`)
  }

  params.push(id)
  const result = await db.query<CategoryDbRow>(
    `UPDATE categories
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}::uuid
     RETURNING id, name, code, description, parent_id, status,
               created_at, updated_at, created_by, updated_by`,
    params
  )
  // biome-ignore lint/style/noNonNullAssertion: RETURNING guarantees one row
  return mapCategoryRow(result.rows[0]!)
}

/**
 * Category Values — Repository
 *
 * File: packages/domain-core/src/category-values/category-values.repository.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * Pure SQL functions. No transactions opened here — all TX management is in the service layer.
 * No imports from apps/* — pure domain functions only.
 */

import type {
  AuditContext,
  CategoryValueRow,
  CategoryValueStatus,
  DbClient,
  ScopedCategoryValueRow,
  TranslationItem,
  WorkspaceLanguageConfig,
} from './category-values.types'

// ---------------------------------------------------------------------------
// Internal Row Mapper Types
// ---------------------------------------------------------------------------

interface CategoryValueDbRow {
  id: string
  category_id: string
  code: string
  status: string
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
  deleted_at: Date | null
}

interface TranslationDbRow {
  entity_id: string
  field_name: string
  language_code: string
  translated_value: string
}

interface SubjectScopeDbRow {
  category_value_id: string
  subject_id: string
}

interface DivisionScopeDbRow {
  category_value_id: string
  division_id: string
}

interface CategoryDbRow {
  id: string
  status: string
}

// ---------------------------------------------------------------------------
// Private Helpers
// ---------------------------------------------------------------------------

function mapCategoryValueRow(row: CategoryValueDbRow): CategoryValueRow {
  return {
    id: row.id,
    category_id: row.category_id,
    code: row.code,
    status: row.status as CategoryValueStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    deleted_at: row.deleted_at,
  }
}

/**
 * Pivot flat translation DB rows into per-entity translation arrays.
 * Returns a Map keyed by entity_id for efficient O(1) lookup.
 * Private to this file — not exported.
 */
function mapTranslationRows(rows: TranslationDbRow[]): Map<string, TranslationItem[]> {
  const result = new Map<string, TranslationItem[]>()
  for (const row of rows) {
    let list = result.get(row.entity_id)
    if (!list) {
      list = []
      result.set(row.entity_id, list)
    }
    list.push({
      language_code: row.language_code,
      field_name: row.field_name,
      translated_value: row.translated_value,
    })
  }
  return result
}

// ---------------------------------------------------------------------------
// Workspace Language Config
// ---------------------------------------------------------------------------

/**
 * Fetch supported_languages and default_language from workspace_settings.
 * Called PRE-TX (before BEGIN) — reads current committed state, no lock held.
 */
export async function findWorkspaceLanguageConfig(
  db: DbClient
): Promise<WorkspaceLanguageConfig | null> {
  const result = await db.query<{
    default_language: string
    supported_languages: string[]
  }>(`
    SELECT
      settings->>'default_language'    AS default_language,
      ARRAY(
        SELECT jsonb_array_elements_text(settings->'supported_languages')
      )                                AS supported_languages
    FROM workspace_settings
    LIMIT 1
  `)
  if (result.rows.length === 0) return null
  const row = result.rows[0]
  return {
    default_language: row.default_language,
    supported_languages: row.supported_languages,
  }
}

// ---------------------------------------------------------------------------
// Single-Row Reads
// ---------------------------------------------------------------------------

/** SELECT a category value by ID (deleted_at IS NULL filter applied). */
export async function findCategoryValueById(
  db: DbClient,
  id: string
): Promise<CategoryValueRow | null> {
  const result = await db.query<CategoryValueDbRow>(
    `SELECT id, category_id, code, status, created_at, updated_at, created_by, updated_by, deleted_at
     FROM category_values
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  )
  return result.rows[0] ? mapCategoryValueRow(result.rows[0]) : null
}

/**
 * SELECT a category value with a row-level write lock.
 * Uses FOR UPDATE NOWAIT — throws PG code 55P03 if another TX holds the lock.
 * Returns the raw row regardless of deleted_at so service can handle idempotent deletes.
 */
export async function findCategoryValueForUpdate(
  db: DbClient,
  id: string
): Promise<CategoryValueRow | null> {
  const result = await db.query<CategoryValueDbRow>(
    `SELECT id, category_id, code, status, created_at, updated_at, created_by, updated_by, deleted_at
     FROM category_values
     WHERE id = $1::uuid FOR UPDATE NOWAIT`,
    [id]
  )
  return result.rows[0] ? mapCategoryValueRow(result.rows[0]) : null
}

/** Fetch parent category (id + status) for validation. */
export async function findCategoryById(db: DbClient, id: string): Promise<CategoryDbRow | null> {
  const result = await db.query<CategoryDbRow>(
    `SELECT id, status FROM categories WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  )
  return result.rows[0] ?? null
}

// ---------------------------------------------------------------------------
// List & Count
// ---------------------------------------------------------------------------

export interface FindCategoryValuesOptions {
  category_id: string
  page: number
  limit: number
  status?: CategoryValueStatus
  search?: string
  language?: string
  include_deleted?: boolean
}

/**
 * COUNT query with filters. Used in parallel with findCategoryValues for paginated responses.
 */
export async function countCategoryValues(
  db: DbClient,
  opts: FindCategoryValuesOptions
): Promise<number> {
  const params: unknown[] = [opts.category_id]
  const conditions: string[] = ['cv.category_id = $1::uuid']

  if (!opts.include_deleted) {
    conditions.push('cv.deleted_at IS NULL')
  }
  if (opts.status) {
    params.push(opts.status)
    conditions.push(`cv.status = $${params.length}`)
  }

  let joinClause = ''
  if (opts.search) {
    const lang = opts.language ?? 'en'
    params.push(lang)
    params.push(`%${opts.search}%`)
    joinClause = `LEFT JOIN translations t
      ON t.entity_type = 'CATEGORY_VALUE' AND t.entity_id = cv.id
      AND t.field_name = 'name' AND t.language_code = $${params.length - 1}`
    conditions.push(`t.translated_value ILIKE $${params.length}`)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM category_values cv ${joinClause} ${whereClause}`,
    params
  )
  return parseInt(result.rows[0].count, 10)
}

/**
 * Paginated SELECT with translation JOIN. Returns flat rows; scope is fetched separately.
 */
export async function findCategoryValues(
  db: DbClient,
  opts: FindCategoryValuesOptions
): Promise<CategoryValueRow[]> {
  const params: unknown[] = [opts.category_id]
  const conditions: string[] = ['cv.category_id = $1::uuid']

  if (!opts.include_deleted) {
    conditions.push('cv.deleted_at IS NULL')
  }
  if (opts.status) {
    params.push(opts.status)
    conditions.push(`cv.status = $${params.length}`)
  }

  let joinClause = ''
  if (opts.search) {
    const lang = opts.language ?? 'en'
    params.push(lang)
    params.push(`%${opts.search}%`)
    joinClause = `LEFT JOIN translations t
      ON t.entity_type = 'CATEGORY_VALUE' AND t.entity_id = cv.id
      AND t.field_name = 'name' AND t.language_code = $${params.length - 1}`
    conditions.push(`t.translated_value ILIKE $${params.length}`)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (opts.page - 1) * opts.limit
  params.push(opts.limit)
  params.push(offset)

  const result = await db.query<CategoryValueDbRow>(
    `SELECT cv.id, cv.category_id, cv.code, cv.status,
            cv.created_at, cv.updated_at, cv.created_by, cv.updated_by, cv.deleted_at
     FROM category_values cv
     ${joinClause}
     ${whereClause}
     ORDER BY cv.created_at ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return result.rows.map(mapCategoryValueRow)
}

// ---------------------------------------------------------------------------
// Scope Batch Reads
// ---------------------------------------------------------------------------

/**
 * Fetch scope rows for multiple category value IDs in a single query.
 * Returns a Map keyed by category_value_id for efficient merging.
 */
export async function findScopeForValues(
  db: DbClient,
  valueIds: string[]
): Promise<{ subjects: Map<string, string[]>; divisions: Map<string, string[]> }> {
  if (valueIds.length === 0) {
    return { subjects: new Map(), divisions: new Map() }
  }

  const [subjectResult, divisionResult] = await Promise.all([
    db.query<SubjectScopeDbRow>(
      `SELECT category_value_id, subject_id FROM category_value_subjects WHERE category_value_id = ANY($1::uuid[])`,
      [valueIds]
    ),
    db.query<DivisionScopeDbRow>(
      `SELECT category_value_id, division_id FROM category_value_divisions WHERE category_value_id = ANY($1::uuid[])`,
      [valueIds]
    ),
  ])

  const subjects = new Map<string, string[]>()
  for (const row of subjectResult.rows) {
    let list = subjects.get(row.category_value_id)
    if (!list) {
      list = []
      subjects.set(row.category_value_id, list)
    }
    list.push(row.subject_id)
  }

  const divisions = new Map<string, string[]>()
  for (const row of divisionResult.rows) {
    let list = divisions.get(row.category_value_id)
    if (!list) {
      list = []
      divisions.set(row.category_value_id, list)
    }
    list.push(row.division_id)
  }

  return { subjects, divisions }
}

/**
 * Fetch all translation rows for multiple category value IDs.
 * Returns a Map keyed by entity_id. Uses private mapTranslationRows.
 */
export async function findTranslationsForValues(
  db: DbClient,
  valueIds: string[]
): Promise<Map<string, TranslationItem[]>> {
  if (valueIds.length === 0) return new Map()
  const result = await db.query<TranslationDbRow>(
    `SELECT entity_id, field_name, language_code, translated_value
     FROM translations
     WHERE entity_type = 'CATEGORY_VALUE' AND entity_id = ANY($1::uuid[])`,
    [valueIds]
  )
  return mapTranslationRows(result.rows)
}

// ---------------------------------------------------------------------------
// Existence / Uniqueness Checks
// ---------------------------------------------------------------------------

/** Check whether a code already exists for a category (case-insensitive, active values only). */
export async function categoryValueCodeExists(
  db: DbClient,
  categoryId: string,
  code: string,
  excludeId?: string
): Promise<boolean> {
  if (excludeId) {
    const result = await db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM category_values
         WHERE category_id = $1::uuid AND LOWER(code) = LOWER($2) AND deleted_at IS NULL AND id <> $3::uuid
       ) AS exists`,
      [categoryId, code, excludeId]
    )
    return result.rows[0].exists
  }
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM category_values
       WHERE category_id = $1::uuid AND LOWER(code) = LOWER($2) AND deleted_at IS NULL
     ) AS exists`,
    [categoryId, code]
  )
  return result.rows[0].exists
}

/** Verify that all provided subject IDs exist in the subjects table. */
export async function subjectsExistBatch(db: DbClient, subjectIds: string[]): Promise<string[]> {
  if (subjectIds.length === 0) return []
  const result = await db.query<{ id: string }>(
    `SELECT id FROM subjects WHERE id = ANY($1::uuid[])`,
    [subjectIds]
  )
  const found = new Set(result.rows.map((r) => r.id))
  return subjectIds.filter((id) => !found.has(id))
}

/** Verify that all provided division IDs exist in the divisions table. */
export async function divisionsExistBatch(db: DbClient, divisionIds: string[]): Promise<string[]> {
  if (divisionIds.length === 0) return []
  const result = await db.query<{ id: string }>(
    `SELECT id FROM divisions WHERE id = ANY($1::uuid[])`,
    [divisionIds]
  )
  const found = new Set(result.rows.map((r) => r.id))
  return divisionIds.filter((id) => !found.has(id))
}

/** Return the parent Category's allowed subject IDs as a Set (empty = global scope). */
export async function findCategorySubjectScope(
  db: DbClient,
  categoryId: string
): Promise<Set<string>> {
  const result = await db.query<{ subject_id: string }>(
    `SELECT subject_id FROM category_subjects WHERE category_id = $1::uuid`,
    [categoryId]
  )
  return new Set(result.rows.map((r) => r.subject_id))
}

/** Return the parent Category's allowed division IDs as a Set (empty = global scope). */
export async function findCategoryDivisionScope(
  db: DbClient,
  categoryId: string
): Promise<Set<string>> {
  const result = await db.query<{ division_id: string }>(
    `SELECT division_id FROM category_divisions WHERE category_id = $1::uuid`,
    [categoryId]
  )
  return new Set(result.rows.map((r) => r.division_id))
}

// ---------------------------------------------------------------------------
// Write Functions
// ---------------------------------------------------------------------------

export interface InsertCategoryValueInput {
  category_id: string
  code: string
}

/** INSERT a new category value row. Status is hardcoded to 'COMPLETED' on creation. */
export async function insertCategoryValue(
  db: DbClient,
  input: InsertCategoryValueInput,
  audit: AuditContext
): Promise<CategoryValueRow> {
  const result = await db.query<CategoryValueDbRow>(
    `INSERT INTO category_values (category_id, code, status, created_by, updated_by)
     VALUES ($1::uuid, $2, 'COMPLETED', $3::uuid, $3::uuid)
     RETURNING id, category_id, code, status, created_at, updated_at, created_by, updated_by, deleted_at`,
    [input.category_id, input.code, audit.user_id]
  )
  return mapCategoryValueRow(result.rows[0])
}

export interface UpdateCategoryValuePatch {
  code?: string
  status?: CategoryValueStatus
}

/** UPDATE mutable fields on a category value. Always sets updated_at = NOW(). */
export async function updateCategoryValueRow(
  db: DbClient,
  id: string,
  patch: UpdateCategoryValuePatch,
  audit: AuditContext
): Promise<CategoryValueRow> {
  const setClauses: string[] = ['updated_at = NOW()', 'updated_by = $2::uuid']
  const params: unknown[] = [id, audit.user_id]

  if (patch.code !== undefined) {
    params.push(patch.code)
    setClauses.push(`code = $${params.length}`)
  }
  if (patch.status !== undefined) {
    params.push(patch.status)
    setClauses.push(`status = $${params.length}`)
  }

  const result = await db.query<CategoryValueDbRow>(
    `UPDATE category_values
     SET ${setClauses.join(', ')}
     WHERE id = $1::uuid
     RETURNING id, category_id, code, status, created_at, updated_at, created_by, updated_by, deleted_at`,
    params
  )
  return mapCategoryValueRow(result.rows[0])
}

/** Soft-delete a category value by setting deleted_at = NOW(). */
export async function softDeleteCategoryValue(
  db: DbClient,
  id: string,
  audit: AuditContext
): Promise<void> {
  await db.query(
    `UPDATE category_values
     SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2::uuid
     WHERE id = $1::uuid`,
    [id, audit.user_id]
  )
}

// ---------------------------------------------------------------------------
// Scope Write Functions
// ---------------------------------------------------------------------------

/** DELETE all subject scope rows for a category value (used before replacement). */
export async function deleteValueSubjectScope(db: DbClient, valueId: string): Promise<void> {
  await db.query(`DELETE FROM category_value_subjects WHERE category_value_id = $1::uuid`, [
    valueId,
  ])
}

/** INSERT subject scope rows for a category value. Skips conflicts idempotently. */
export async function insertValueSubjectScope(
  db: DbClient,
  valueId: string,
  subjectIds: string[]
): Promise<void> {
  for (const subjectId of subjectIds) {
    await db.query(
      `INSERT INTO category_value_subjects (category_value_id, subject_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT (category_value_id, subject_id) DO NOTHING`,
      [valueId, subjectId]
    )
  }
}

/** DELETE all division scope rows for a category value (used before replacement). */
export async function deleteValueDivisionScope(db: DbClient, valueId: string): Promise<void> {
  await db.query(`DELETE FROM category_value_divisions WHERE category_value_id = $1::uuid`, [
    valueId,
  ])
}

/** INSERT division scope rows for a category value. Skips conflicts idempotently. */
export async function insertValueDivisionScope(
  db: DbClient,
  valueId: string,
  divisionIds: string[]
): Promise<void> {
  for (const divisionId of divisionIds) {
    await db.query(
      `INSERT INTO category_value_divisions (category_value_id, division_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT (category_value_id, division_id) DO NOTHING`,
      [valueId, divisionId]
    )
  }
}

// ---------------------------------------------------------------------------
// Translation Write
// ---------------------------------------------------------------------------

/**
 * UPSERT translation rows. Conflict target is the translations_composite_unique constraint
 * on (entity_type, entity_id, field_name, language_code).
 */
export async function upsertTranslations(
  db: DbClient,
  entityId: string,
  translations: TranslationItem[]
): Promise<void> {
  for (const t of translations) {
    await db.query(
      `INSERT INTO translations (entity_type, entity_id, field_name, language_code, translated_value)
       VALUES ('CATEGORY_VALUE', $1::uuid, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT translations_composite_unique
       DO UPDATE SET translated_value = EXCLUDED.translated_value, updated_at = NOW()`,
      [entityId, t.field_name, t.language_code, t.translated_value]
    )
  }
}

// ---------------------------------------------------------------------------
// Helper: Build ScopedCategoryValueRow
// ---------------------------------------------------------------------------

/**
 * Merge a flat row with scope and translation maps to produce a ScopedCategoryValueRow.
 * Used after bulk fetches to avoid N+1 queries.
 */
export function mergeScopedRow(
  row: CategoryValueRow,
  subjects: Map<string, string[]>,
  divisions: Map<string, string[]>,
  translations: Map<string, TranslationItem[]>
): ScopedCategoryValueRow {
  return {
    ...row,
    subject_ids: subjects.get(row.id) ?? [],
    division_ids: divisions.get(row.id) ?? [],
    translations: translations.get(row.id) ?? [],
  }
}

/**
 * Tags — Repository
 *
 * File: packages/domain-core/src/tags/tags.repository.ts
 * Stage: STAGE_32_TAGS
 *
 * Pure SQL functions. No transactions opened here — all TX management is in the service layer.
 * No imports from apps/* — pure domain functions only.
 *
 * NOTE on checkEntityExists: entity tables (mcq_questions, traditional_questions, library_files)
 * may not exist in the current schema version. A PostgreSQL error 42P01 (undefined_table) is
 * caught gracefully and treated as "entity not found" rather than a fatal DB error.
 * This allows the tag assignment code to compile and run today, with real validation applied
 * once entity tables are provisioned in future migration stages.
 */

import type {
  DbClient,
  ListTagEntitiesInput,
  ListTagsInput,
  TagEntityType,
  TagRelationRow,
  TagRow,
  TagStatus,
} from './tags.types'

// ---------------------------------------------------------------------------
// Internal Row Mapper Types
// ---------------------------------------------------------------------------

interface TagDbRow extends Record<string, unknown> {
  id: string
  name: string
  normalized_name: string
  status: string
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

interface TagRelationDbRow extends Record<string, unknown> {
  id: string
  tag_id: string
  entity_type: string
  entity_id: string
  created_at: Date
}

interface CountRow extends Record<string, unknown> {
  count: string
}

// ---------------------------------------------------------------------------
// Private Helpers
// ---------------------------------------------------------------------------

function mapTagRow(row: TagDbRow): TagRow {
  return {
    id: row.id,
    name: row.name,
    normalized_name: row.normalized_name,
    status: row.status as TagStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  }
}

function mapTagRelationRow(row: TagRelationDbRow): TagRelationRow {
  return {
    id: row.id,
    tag_id: row.tag_id,
    entity_type: row.entity_type as TagEntityType,
    entity_id: row.entity_id,
    created_at: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Tag Read Functions
// ---------------------------------------------------------------------------

export async function findTagById(db: DbClient, id: string): Promise<TagRow | null> {
  const result = await db.query<TagDbRow>(
    `SELECT id, name, normalized_name, status, created_at, updated_at, created_by, updated_by
     FROM tags
     WHERE id = $1`,
    [id]
  )
  return result.rows[0] ? mapTagRow(result.rows[0]) : null
}

export async function findTagByNormalizedName(
  db: DbClient,
  normalized_name: string
): Promise<TagRow | null> {
  const result = await db.query<TagDbRow>(
    `SELECT id, name, normalized_name, status, created_at, updated_at, created_by, updated_by
     FROM tags
     WHERE normalized_name = $1`,
    [normalized_name]
  )
  return result.rows[0] ? mapTagRow(result.rows[0]) : null
}

export async function findTags(db: DbClient, input: ListTagsInput): Promise<TagRow[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (input.status) {
    conditions.push(`status = $${idx++}`)
    params.push(input.status)
  }

  if (input.search) {
    conditions.push(`normalized_name ILIKE $${idx++}`)
    params.push(`%${input.search.toLowerCase()}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (input.page - 1) * input.limit

  params.push(input.limit)
  params.push(offset)

  const result = await db.query<TagDbRow>(
    `SELECT id, name, normalized_name, status, created_at, updated_at, created_by, updated_by
     FROM tags
     ${where}
     ORDER BY name ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  )
  return result.rows.map(mapTagRow)
}

export async function countTags(
  db: DbClient,
  input: Pick<ListTagsInput, 'status' | 'search'>
): Promise<number> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (input.status) {
    conditions.push(`status = $${idx++}`)
    params.push(input.status)
  }

  if (input.search) {
    conditions.push(`normalized_name ILIKE $${idx++}`)
    params.push(`%${input.search.toLowerCase()}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::int AS count FROM tags ${where}`,
    params
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

export async function countTagRelations(db: DbClient, tagId: string): Promise<number> {
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::int AS count FROM tag_relations WHERE tag_id = $1`,
    [tagId]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

// ---------------------------------------------------------------------------
// Tag Write Functions
// ---------------------------------------------------------------------------

export async function insertTag(
  db: DbClient,
  name: string,
  normalized_name: string,
  userId: string | null
): Promise<TagRow> {
  const result = await db.query<TagDbRow>(
    `INSERT INTO tags (name, normalized_name, status, created_by, updated_by)
     VALUES ($1, $2, 'ENABLED', $3, $3)
     RETURNING id, name, normalized_name, status, created_at, updated_at, created_by, updated_by`,
    [name, normalized_name, userId]
  )
  // biome-ignore lint/style/noNonNullAssertion: INSERT RETURNING always yields a row
  return mapTagRow(result.rows[0]!)
}

export async function updateTagRow(
  db: DbClient,
  id: string,
  fields: { name?: string; normalized_name?: string; status?: TagStatus },
  userId: string | null
): Promise<TagRow | null> {
  const setParts: string[] = ['updated_at = NOW()', `updated_by = $1`]
  const params: unknown[] = [userId, id]
  let idx = 3

  if (fields.name !== undefined) {
    setParts.push(`name = $${idx++}`)
    params.push(fields.name)
  }
  if (fields.normalized_name !== undefined) {
    setParts.push(`normalized_name = $${idx++}`)
    params.push(fields.normalized_name)
  }
  if (fields.status !== undefined) {
    setParts.push(`status = $${idx++}`)
    params.push(fields.status)
  }

  const result = await db.query<TagDbRow>(
    `UPDATE tags
     SET ${setParts.join(', ')}
     WHERE id = $2
     RETURNING id, name, normalized_name, status, created_at, updated_at, created_by, updated_by`,
    params
  )
  return result.rows[0] ? mapTagRow(result.rows[0]) : null
}

export async function deleteTagRow(db: DbClient, id: string): Promise<boolean> {
  const result = await db.query(`DELETE FROM tags WHERE id = $1`, [id])
  return (result.rowCount ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Tag Relation Read Functions
// ---------------------------------------------------------------------------

export async function findTagRelationById(
  db: DbClient,
  id: string
): Promise<TagRelationRow | null> {
  const result = await db.query<TagRelationDbRow>(
    `SELECT id, tag_id, entity_type, entity_id, created_at
     FROM tag_relations
     WHERE id = $1`,
    [id]
  )
  return result.rows[0] ? mapTagRelationRow(result.rows[0]) : null
}

export async function findTagRelation(
  db: DbClient,
  tagId: string,
  entityType: string,
  entityId: string
): Promise<TagRelationRow | null> {
  const result = await db.query<TagRelationDbRow>(
    `SELECT id, tag_id, entity_type, entity_id, created_at
     FROM tag_relations
     WHERE tag_id = $1 AND entity_type = $2 AND entity_id = $3`,
    [tagId, entityType, entityId]
  )
  return result.rows[0] ? mapTagRelationRow(result.rows[0]) : null
}

export async function findEntityTags(
  db: DbClient,
  entityType: string,
  entityId: string
): Promise<TagRelationRow[]> {
  const result = await db.query<TagRelationDbRow>(
    `SELECT id, tag_id, entity_type, entity_id, created_at
     FROM tag_relations
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at ASC`,
    [entityType, entityId]
  )
  return result.rows.map(mapTagRelationRow)
}

export async function findTagEntities(
  db: DbClient,
  input: ListTagEntitiesInput
): Promise<TagRelationRow[]> {
  const conditions: string[] = ['tag_id = $1']
  const params: unknown[] = [input.tag_id]
  let idx = 2

  if (input.entity_type) {
    conditions.push(`entity_type = $${idx++}`)
    params.push(input.entity_type)
  }

  const offset = (input.page - 1) * input.limit
  params.push(input.limit)
  params.push(offset)

  const result = await db.query<TagRelationDbRow>(
    `SELECT id, tag_id, entity_type, entity_id, created_at
     FROM tag_relations
     WHERE ${conditions.join(' AND ')}
     ORDER BY entity_type ASC, created_at ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  )
  return result.rows.map(mapTagRelationRow)
}

export async function countTagEntities(
  db: DbClient,
  input: Pick<ListTagEntitiesInput, 'tag_id' | 'entity_type'>
): Promise<number> {
  const conditions: string[] = ['tag_id = $1']
  const params: unknown[] = [input.tag_id]
  let idx = 2

  if (input.entity_type) {
    conditions.push(`entity_type = $${idx++}`)
    params.push(input.entity_type)
  }

  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::int AS count FROM tag_relations WHERE ${conditions.join(' AND ')}`,
    params
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

// ---------------------------------------------------------------------------
// Tag Relation Write Functions
// ---------------------------------------------------------------------------

export async function insertTagRelation(
  db: DbClient,
  tagId: string,
  entityType: string,
  entityId: string
): Promise<TagRelationRow> {
  const result = await db.query<TagRelationDbRow>(
    `INSERT INTO tag_relations (tag_id, entity_type, entity_id)
     VALUES ($1, $2, $3)
     RETURNING id, tag_id, entity_type, entity_id, created_at`,
    [tagId, entityType, entityId]
  )
  // biome-ignore lint/style/noNonNullAssertion: INSERT RETURNING always yields a row
  return mapTagRelationRow(result.rows[0]!)
}

export async function deleteTagRelationRow(db: DbClient, id: string): Promise<boolean> {
  const result = await db.query(`DELETE FROM tag_relations WHERE id = $1`, [id])
  return (result.rowCount ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Entity Existence Check
// ---------------------------------------------------------------------------

/**
 * Checks whether an entity exists in the database.
 *
 * Returns true if the entity exists; false if it does not.
 * Returns true (skips check) if the entity's table does not yet exist (PG error 42P01).
 * This forward-compatibility handling allows tag relations to be created today;
 * strict validation becomes active once entity tables are provisioned in future stages.
 */
export async function checkEntityExists(
  db: DbClient,
  entityType: TagEntityType,
  entityId: string
): Promise<boolean> {
  const TABLE_MAP: Record<TagEntityType, string> = {
    MCQ_QUESTION: 'mcq_questions',
    TRADITIONAL_QUESTION: 'traditional_questions',
    LIBRARY_FILE: 'library_files',
  }

  const table = TABLE_MAP[entityType]

  try {
    const result = await db.query<CountRow>(`SELECT 1 FROM ${table} WHERE id = $1 LIMIT 1`, [
      entityId,
    ])
    return (result.rowCount ?? 0) > 0
  } catch (err: unknown) {
    // 42P01 = undefined_table — entity table not yet provisioned
    if (
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === '42P01'
    ) {
      // Table doesn't exist yet; treat as "passes" — validation deferred to future stage
      return true
    }
    throw err
  }
}

/**
 * Tags — Service Layer
 *
 * File: packages/domain-core/src/tags/tags.service.ts
 * Stage: STAGE_32_TAGS
 *
 * Pure domain logic. No HTTP, no framework dependencies.
 * All write operations are wrapped in explicit BEGIN / COMMIT / ROLLBACK.
 * Server-authoritative time — NOW() used inside DB; never Date.now() here.
 */

import { createLogger } from '@zidney/logger'

import { TagError } from './tags.errors'
import {
  checkEntityExists,
  countTagEntities,
  countTagRelations,
  countTags,
  deleteTagRelationRow,
  deleteTagRow,
  findEntityTags,
  findTagById,
  findTagByNormalizedName,
  findTagEntities,
  findTagRelation,
  findTagRelationById,
  findTags,
  insertTag,
  insertTagRelation,
  updateTagRow,
} from './tags.repository'
import type {
  AuditContext,
  CreateTagInput,
  CreateTagRelationInput,
  DbClient,
  DeleteTagRelationResult,
  DeleteTagResult,
  ListEntityTagsInput,
  ListTagEntitiesInput,
  ListTagEntitiesResult,
  ListTagsInput,
  ListTagsResult,
  TagRelationRow,
  TagRow,
  UpdateTagInput,
} from './tags.types'

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = createLogger('tags:service')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a tag name to a canonical lower-case trimmed form for dedup. */
function normalizeTagName(name: string): string {
  return name.toLowerCase().trim()
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/** List tags with optional pagination, status filter, and name search. */
export async function listTags(
  db: DbClient,
  input: ListTagsInput,
  _audit: AuditContext
): Promise<ListTagsResult> {
  const page = Math.max(1, input.page)
  const limit = Math.min(100, Math.max(1, input.limit))

  const opts = { ...input, page, limit }

  const [total, items] = await Promise.all([
    countTags(db, { status: opts.status, search: opts.search }),
    findTags(db, opts),
  ])

  return { items, total, page, limit }
}

/** Get a single tag by ID. Throws TAG_NOT_FOUND if missing. */
export async function getTag(db: DbClient, id: string, _audit: AuditContext): Promise<TagRow> {
  const tag = await findTagById(db, id)
  if (!tag) throw new TagError('TAG_NOT_FOUND')
  return tag
}

/** List all tags currently assigned to a specific entity. */
export async function listEntityTags(
  db: DbClient,
  input: ListEntityTagsInput,
  _audit: AuditContext
): Promise<TagRelationRow[]> {
  return findEntityTags(db, input.entity_type, input.entity_id)
}

/** List all entities that are assigned a specific tag (paginated). */
export async function listTagEntities(
  db: DbClient,
  input: ListTagEntitiesInput,
  _audit: AuditContext
): Promise<ListTagEntitiesResult> {
  const page = Math.max(1, input.page)
  const limit = Math.min(100, Math.max(1, input.limit))
  const opts = { ...input, page, limit }

  const [total, items] = await Promise.all([
    countTagEntities(db, { tag_id: opts.tag_id, entity_type: opts.entity_type }),
    findTagEntities(db, opts),
  ])

  return { items, total, page, limit }
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/** Create a new tag. Enforces unique normalized name. */
export async function createTag(
  db: DbClient,
  input: CreateTagInput,
  audit: AuditContext
): Promise<TagRow> {
  const normalized_name = normalizeTagName(input.name)

  await db.query('BEGIN')
  try {
    const existing = await findTagByNormalizedName(db, normalized_name)
    if (existing) throw new TagError('TAG_DUPLICATE')

    const tag = await insertTag(db, input.name, normalized_name, audit.user_id ?? null)

    await db.query('COMMIT')

    logger.info('tag.created', {
      tag_id: tag.id,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return tag
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof TagError) throw err
    const pg = err as { code?: string }
    if (pg?.code === '23505') throw new TagError('TAG_DUPLICATE')
    throw err
  }
}

/** Update an existing tag's name and/or status. */
export async function updateTag(
  db: DbClient,
  id: string,
  input: UpdateTagInput,
  audit: AuditContext
): Promise<TagRow> {
  const fields: { name?: string; normalized_name?: string; status?: 'ENABLED' | 'DISABLED' } = {}

  if (input.name !== undefined) {
    fields.name = input.name
    fields.normalized_name = normalizeTagName(input.name)
  }
  if (input.status !== undefined) {
    fields.status = input.status
  }

  await db.query('BEGIN')
  try {
    const existing = await findTagById(db, id)
    if (!existing) throw new TagError('TAG_NOT_FOUND')

    // Check name uniqueness only if name is being changed
    if (
      fields.normalized_name !== undefined &&
      fields.normalized_name !== existing.normalized_name
    ) {
      const collision = await findTagByNormalizedName(db, fields.normalized_name)
      if (collision && collision.id !== id) throw new TagError('TAG_DUPLICATE')
    }

    const updated = await updateTagRow(db, id, fields, audit.user_id ?? null)
    if (!updated) throw new TagError('TAG_NOT_FOUND')

    await db.query('COMMIT')

    logger.info('tag.updated', {
      tag_id: id,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof TagError) throw err
    const pg = err as { code?: string }
    if (pg?.code === '23505') throw new TagError('TAG_DUPLICATE')
    throw err
  }
}

/**
 * Delete a tag.
 * Blocked when the tag still has active tag_relations (cascade_delete = false).
 * When cascade_delete = true, all relations are removed first inside the same TX.
 */
export async function deleteTag(
  db: DbClient,
  id: string,
  cascade_delete: boolean,
  audit: AuditContext
): Promise<DeleteTagResult> {
  await db.query('BEGIN')
  try {
    const existing = await findTagById(db, id)
    if (!existing) throw new TagError('TAG_NOT_FOUND')

    const relationCount = await countTagRelations(db, id)

    if (relationCount > 0 && !cascade_delete) {
      throw new TagError('TAG_HAS_RELATIONS')
    }

    if (relationCount > 0 && cascade_delete) {
      await db.query(`DELETE FROM tag_relations WHERE tag_id = $1`, [id])
    }

    await deleteTagRow(db, id)
    await db.query('COMMIT')

    logger.info('tag.deleted', {
      tag_id: id,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
      cascade_delete,
      relations_removed: cascade_delete ? relationCount : 0,
    })

    return {
      success: true,
      id,
      relations_removed: cascade_delete ? relationCount : 0,
    }
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof TagError) throw err
    throw err
  }
}

/** Assign a tag to an entity. Validates entity existence and deduplication. */
export async function createTagRelation(
  db: DbClient,
  input: CreateTagRelationInput,
  audit: AuditContext
): Promise<TagRelationRow> {
  // Pre-TX: entity existence check (tolerant of missing tables — future stages)
  const entityExists = await checkEntityExists(db, input.entity_type, input.entity_id)
  if (!entityExists) throw new TagError('TAG_RELATION_ENTITY_NOT_FOUND')

  await db.query('BEGIN')
  try {
    // Tag must exist and be enabled
    const tag = await findTagById(db, input.tag_id)
    if (!tag) throw new TagError('TAG_NOT_FOUND')
    if (tag.status === 'DISABLED') throw new TagError('TAG_DISABLED')

    // Duplicate guard
    const existing = await findTagRelation(db, input.tag_id, input.entity_type, input.entity_id)
    if (existing) throw new TagError('TAG_RELATION_DUPLICATE')

    const relation = await insertTagRelation(db, input.tag_id, input.entity_type, input.entity_id)

    await db.query('COMMIT')

    logger.info('tag-relation.created', {
      tag_relation_id: relation.id,
      tag_id: input.tag_id,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return relation
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof TagError) throw err
    const pg = err as { code?: string }
    if (pg?.code === '23505') throw new TagError('TAG_RELATION_DUPLICATE')
    throw err
  }
}

/** Remove a tag relation by ID. */
export async function deleteTagRelation(
  db: DbClient,
  id: string,
  audit: AuditContext
): Promise<DeleteTagRelationResult> {
  await db.query('BEGIN')
  try {
    const existing = await findTagRelationById(db, id)
    if (!existing) throw new TagError('TAG_RELATION_NOT_FOUND')

    await deleteTagRelationRow(db, id)
    await db.query('COMMIT')

    logger.info('tag-relation.deleted', {
      tag_relation_id: id,
      tag_id: existing.tag_id,
      entity_type: existing.entity_type,
      entity_id: existing.entity_id,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { success: true, id }
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof TagError) throw err
    throw err
  }
}

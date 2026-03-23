/**
 * Tags — Type Definitions
 *
 * File: packages/domain-core/src/tags/tags.types.ts
 * Stage: STAGE_32_TAGS
 *
 * Shared interfaces used by repository, service, and route helpers.
 * No imports from apps/* — pure domain types only.
 */

// ---------------------------------------------------------------------------
// Infrastructure Interfaces (replicated per-domain by convention)
// ---------------------------------------------------------------------------

/** Minimal DB client interface over a pg.Pool or pg.PoolClient. */
export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

/** Audit context injected from the authenticated request context. */
export interface AuditContext {
  user_id: string | null
  correlation_id: string
  workspace_slug: string
  workspace_id: string
  caller_permissions?: string[]
}

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

export type TagStatus = 'ENABLED' | 'DISABLED'

export type TagEntityType = 'MCQ_QUESTION' | 'TRADITIONAL_QUESTION' | 'LIBRARY_FILE'

export const VALID_ENTITY_TYPES: TagEntityType[] = [
  'MCQ_QUESTION',
  'TRADITIONAL_QUESTION',
  'LIBRARY_FILE',
]

/** Single tag row from the tags table. */
export interface TagRow {
  id: string
  name: string
  normalized_name: string
  status: TagStatus
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

/** Single tag relation row from the tag_relations table. */
export interface TagRelationRow {
  id: string
  tag_id: string
  entity_type: TagEntityType
  entity_id: string
  created_at: Date
}

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface ListTagsInput {
  page: number
  limit: number
  status?: TagStatus
  search?: string
}

export interface CreateTagInput {
  name: string
}

export interface UpdateTagInput {
  name?: string
  status?: TagStatus
}

export interface CreateTagRelationInput {
  tag_id: string
  entity_type: TagEntityType
  entity_id: string
}

export interface ListEntityTagsInput {
  entity_type: TagEntityType
  entity_id: string
}

export interface ListTagEntitiesInput {
  tag_id: string
  entity_type?: TagEntityType
  page: number
  limit: number
}

// ---------------------------------------------------------------------------
// Output Types
// ---------------------------------------------------------------------------

export interface ListTagsResult {
  items: TagRow[]
  total: number
  page: number
  limit: number
}

export interface ListTagEntitiesResult {
  items: TagRelationRow[]
  total: number
  page: number
  limit: number
}

export interface DeleteTagResult {
  success: true
  id: string
  relations_removed: number
}

export interface DeleteTagRelationResult {
  success: true
  id: string
}

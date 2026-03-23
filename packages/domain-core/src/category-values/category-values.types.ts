/**
 * Category Values — Type Definitions
 *
 * File: packages/domain-core/src/category-values/category-values.types.ts
 * Stage: STAGE_31_CATEGORY_VALUES
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
  /**
   * Permissions held by the authenticated caller.
   * Used to gate include_deleted queries (requires classification_manage).
   */
  caller_permissions: string[]
}

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

export type CategoryValueStatus = 'COMPLETED' | 'UNDER_REVIEW' | 'APPROVED' | 'ENABLED' | 'DISABLED'

/** Single translation row as stored in the translations table. */
export interface TranslationItem {
  language_code: string
  field_name: string
  translated_value: string
}

/** Flat category value row from the category_values table. */
export interface CategoryValueRow {
  id: string
  category_id: string
  code: string
  status: CategoryValueStatus
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
  deleted_at: Date | null
}

/**
 * Category value enriched with translations and scope arrays.
 * Returned by getCategoryValue and create/updateCategoryValue.
 */
export interface ScopedCategoryValueRow extends CategoryValueRow {
  translations: TranslationItem[]
  subject_ids: string[]
  division_ids: string[]
}

/**
 * Workspace language configuration from workspace_settings.
 */
export interface WorkspaceLanguageConfig {
  default_language: string
  supported_languages: string[]
}

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface ListCategoryValuesInput {
  category_id: string
  page: number
  limit: number
  status?: CategoryValueStatus
  search?: string
  language?: string
  include_deleted?: boolean
}

export interface CreateCategoryValueInput {
  category_id: string
  code: string
  translations: TranslationItem[]
  subject_ids?: string[]
  division_ids?: string[]
}

export interface UpdateCategoryValueInput {
  code?: string
  status?: CategoryValueStatus
  translations?: TranslationItem[]
  subject_ids?: string[]
  division_ids?: string[]
}

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export interface ListCategoryValuesResult {
  items: ScopedCategoryValueRow[]
  total: number
  page: number
  limit: number
}

export interface DeleteCategoryValueResult {
  deleted: boolean
}

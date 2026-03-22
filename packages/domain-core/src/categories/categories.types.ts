/**
 * Categories — Type Definitions
 *
 * File: packages/domain-core/src/categories/categories.types.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Shared interfaces used by repository, service, and route helpers.
 * No imports from apps/* — pure domain types only.
 */

// ---------------------------------------------------------------------------
// Infrastructure Interfaces (replicated per-domain by convention)
// ---------------------------------------------------------------------------

/**
 * Minimal DB client interface over a pg.Pool or pg.PoolClient.
 * Allows passing either a long-lived pool or a transactional PoolClient.
 */
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
}

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

export type CategoryStatus = 'ENABLED' | 'DISABLED'

/** Flat category row from the categories table. */
export interface CategoryRow {
  id: string
  name: string
  code: string | null
  description: string | null
  parent_id: string | null
  status: CategoryStatus
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

/**
 * Category row enriched with scope arrays.
 * Returned by getCategory and createCategory/updateCategory (via a JOIN query).
 */
export interface ScopedCategoryRow extends CategoryRow {
  subject_ids: string[]
  division_ids: string[]
}

/**
 * Tree node — CategoryRow + resolved children.
 * Returned by getCategoriesTree.
 */
export interface CategoryTreeNode extends ScopedCategoryRow {
  children: CategoryTreeNode[]
}

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface ListCategoriesInput {
  page: number
  limit: number
  parent_id?: string | null
  status?: CategoryStatus
  search?: string
}

export interface CreateCategoryInput {
  name: string
  code?: string | null
  description?: string | null
  parent_id?: string | null
  subject_ids?: string[]
  division_ids?: string[]
}

export interface UpdateCategoryInput {
  name?: string
  code?: string | null
  description?: string | null
  parent_id?: string | null
  status?: CategoryStatus
  subject_ids?: string[]
  division_ids?: string[]
}

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export interface ListCategoriesResult {
  items: ScopedCategoryRow[]
  total: number
  page: number
  limit: number
}

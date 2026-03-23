/**
 * Baskets — Type Definitions
 *
 * File: packages/domain-core/src/baskets/baskets.types.ts
 * Stage: STAGE_33_MCQ_BASKETS
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
  connect?(): Promise<{
    query<T extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      params?: unknown[]
    ): Promise<{ rows: T[]; rowCount: number | null }>
    release(): void
  }>
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
// Domain Enums
// ---------------------------------------------------------------------------

export type BasketType = 'LINKED' | 'UNLINKED'
export type BasketStatus = 'DRAFT' | 'COMPLETED' | 'UNDER_REVIEW' | 'APPROVED' | 'ENABLED'

export const VALID_BASKET_TYPES: BasketType[] = ['LINKED', 'UNLINKED']
export const VALID_BASKET_STATUSES: BasketStatus[] = [
  'DRAFT',
  'COMPLETED',
  'UNDER_REVIEW',
  'APPROVED',
  'ENABLED',
]

// ---------------------------------------------------------------------------
// Row Types (as returned from DB)
// ---------------------------------------------------------------------------

/** Single basket row from the mcq_baskets table. */
export interface BasketRow {
  id: string
  name: string
  code: string
  type: BasketType
  max_questions: number | null
  description: string | null
  status: BasketStatus
  status_updated_at: Date | null
  status_updated_by: string | null
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

/** Basket row enriched with computed question count. */
export interface BasketWithCount extends BasketRow {
  question_count: number
}

/** Single row from the mcq_basket_questions table. */
export interface BasketQuestionRow {
  id: string
  basket_id: string
  question_id: string
  created_at: Date
}

// ---------------------------------------------------------------------------
// Input / Output Types
// ---------------------------------------------------------------------------

export interface CreateBasketInput {
  name: string
  code: string
  type: BasketType
  max_questions?: number | null
  description?: string | null
}

export interface UpdateBasketInput {
  name?: string
  code?: string
  max_questions?: number | null
  description?: string | null
}

export interface ListBasketsInput {
  page: number
  perPage: number
  type?: BasketType
  status?: BasketStatus
  search?: string
}

export interface ListBasketsResult {
  items: BasketWithCount[]
  total: number
  page: number
  perPage: number
}

export interface LinkQuestionInput {
  basket_id: string
  question_id: string
}

export interface ListBasketQuestionsInput {
  basket_id: string
  page: number
  perPage: number
}

export interface ListBasketQuestionsResult {
  items: BasketQuestionRow[]
  total: number
  page: number
  perPage: number
}

export interface DeletionGuardResult {
  blocked: boolean
  reason?: 'BASKET_REFERENCED_IN_EXAM_CONFIG' | 'BASKET_REFERENCED_IN_AUTO_SELECTION'
}

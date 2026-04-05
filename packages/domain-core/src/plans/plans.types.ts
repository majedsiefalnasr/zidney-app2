/**
 * Plans Domain — Types
 *
 * File: packages/domain-core/src/plans/plans.types.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Pure type definitions — no logic, no imports from framework layer.
 */

// ---------------------------------------------------------------------------
// Database client interface (re-used from students pattern)
// ---------------------------------------------------------------------------

/** Minimal structural interface for query execution and transaction control */
export interface TransactionClient {
  query<T = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
  release(): void
}

/** Database pool with transaction capabilities */
export interface DbClient {
  query<T = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
  connect(): Promise<TransactionClient>
}

// ---------------------------------------------------------------------------
// Domain Enums
// ---------------------------------------------------------------------------

export type BillingType = 'one-time' | 'recurring'

// ---------------------------------------------------------------------------
// Raw DB rows
// ---------------------------------------------------------------------------

/**
 * Full database row for a plan.
 * `price` is returned as a string by the pg driver (numeric type).
 */
export interface PlanRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  price: string
  billing_type: BillingType
  duration_days: number
  enabled_modules: string[]
  is_active: boolean
  is_deleted: boolean
  created_at: Date
  updated_at: Date
}

// ---------------------------------------------------------------------------
// Public records (safe to serialize in HTTP responses)
// ---------------------------------------------------------------------------

/** Plan record with price coerced to number — safe for API responses. */
export interface PlanRecord {
  id: string
  workspace_id: string
  name: string
  description: string | null
  price: number
  billing_type: BillingType
  duration_days: number
  enabled_modules: string[]
  is_active: boolean
  is_deleted: boolean
  created_at: Date
  updated_at: Date
}

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface CreatePlanInput {
  workspace_id: string
  name: string
  description?: string | null
  price: number
  billing_type: BillingType
  duration_days: number
  enabled_modules?: string[]
}

export interface UpdatePlanInput {
  name?: string
  description?: string | null
  price?: number
  billing_type?: BillingType
  duration_days?: number
  enabled_modules?: string[]
  is_active?: boolean
}

// ---------------------------------------------------------------------------
// Query shapes
// ---------------------------------------------------------------------------

export interface PlanListQuery {
  page: number
  limit: number
  is_active?: boolean
}

export interface PlanListResult {
  items: PlanRecord[]
  total: number
  page: number
  limit: number
}

// ---------------------------------------------------------------------------
// Audit context (identical shape to students — shared by all domain modules)
// ---------------------------------------------------------------------------

export interface AuditContext {
  user_id: string
  workspace_id: string
  workspace_slug: string
  correlation_id: string
}

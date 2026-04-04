/**
 * Plans Domain — Repository (Raw SQL)
 *
 * File: packages/domain-core/src/plans/plans.repository.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * All queries are tenant-scoped via the database pool connection (database-per-tenant).
 * The `plans` table carries a `workspace_id` column for scoping.
 *
 * No ORM — raw pg queries for explicit control.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ All writes are caller-transactional
 * ✓ Tenant-scoped via workspace_id column
 */

import type {
  CreatePlanInput,
  DbClient,
  PlanListQuery,
  PlanListResult,
  PlanRecord,
  PlanRow,
  TransactionClient,
  UpdatePlanInput,
} from './plans.types'

// ---------------------------------------------------------------------------
// Column sets
// ---------------------------------------------------------------------------

const PLAN_COLUMNS =
  'id, workspace_id, name, description, price, billing_type, duration_days, enabled_modules, is_active, is_deleted, created_at, updated_at'

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function toPlanRecord(row: PlanRow): PlanRecord {
  return {
    ...row,
    price: parseFloat(row.price),
  }
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Find a non-deleted plan by primary key, scoped to workspace.
 */
export async function findPlanById(
  client: DbClient | TransactionClient,
  workspaceId: string,
  planId: string
): Promise<PlanRecord | null> {
  const { rows } = await client.query<PlanRow>(
    `SELECT ${PLAN_COLUMNS}
       FROM plans
      WHERE id = $1
        AND workspace_id = $2
        AND is_deleted = FALSE`,
    [planId, workspaceId]
  )
  return rows[0] ? toPlanRecord(rows[0]) : null
}

/**
 * List non-deleted plans for a workspace with pagination.
 */
export async function listPlans(
  client: DbClient,
  workspaceId: string,
  query: PlanListQuery
): Promise<PlanListResult> {
  const { page, limit, is_active } = query
  const offset = (page - 1) * limit

  const conditions: string[] = ['workspace_id = $1', 'is_deleted = FALSE']
  const params: unknown[] = [workspaceId]

  if (is_active !== undefined) {
    params.push(is_active)
    conditions.push(`is_active = $${params.length}`)
  }

  const where = conditions.join(' AND ')

  const [{ rows: items }, { rows: countRows }] = await Promise.all([
    client.query<PlanRow>(
      `SELECT ${PLAN_COLUMNS}
         FROM plans
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    client.query<{ count: string }>(`SELECT COUNT(*) AS count FROM plans WHERE ${where}`, params),
  ])

  return {
    items: items.map(toPlanRecord),
    total: parseInt(countRows[0]?.count ?? '0', 10),
    page,
    limit,
  }
}

/**
 * Count active subscriptions referencing this plan.
 * Used inside the soft-delete guard to prevent deleting plans in use.
 */
export async function countActiveSubscriptionsByPlanId(
  client: DbClient | TransactionClient,
  planId: string
): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM subscriptions
      WHERE plan_id = $1
        AND status = 'ACTIVE'`,
    [planId]
  )
  return parseInt(rows[0]?.count ?? '0', 10)
}

// ---------------------------------------------------------------------------
// Write helpers (called inside transactions by the service layer)
// ---------------------------------------------------------------------------

/**
 * Insert a new plan row. Returns the created PlanRecord.
 */
export async function insertPlan(
  client: TransactionClient,
  input: CreatePlanInput
): Promise<PlanRecord> {
  const { rows } = await client.query<PlanRow>(
    `INSERT INTO plans
       (workspace_id, name, description, price, billing_type, duration_days, enabled_modules)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PLAN_COLUMNS}`,
    [
      input.workspace_id,
      input.name,
      input.description ?? null,
      input.price,
      input.billing_type,
      input.duration_days,
      JSON.stringify(input.enabled_modules ?? []),
    ]
  )
  return toPlanRecord(rows[0] as PlanRow)
}

/**
 * Update a plan's mutable fields. Returns the updated PlanRecord.
 */
export async function updatePlan(
  client: TransactionClient,
  workspaceId: string,
  planId: string,
  input: UpdatePlanInput
): Promise<PlanRecord | null> {
  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) {
    params.push(input.name)
    sets.push(`name = $${params.length}`)
  }
  if (input.description !== undefined) {
    params.push(input.description)
    sets.push(`description = $${params.length}`)
  }
  if (input.price !== undefined) {
    params.push(input.price)
    sets.push(`price = $${params.length}`)
  }
  if (input.billing_type !== undefined) {
    params.push(input.billing_type)
    sets.push(`billing_type = $${params.length}`)
  }
  if (input.duration_days !== undefined) {
    params.push(input.duration_days)
    sets.push(`duration_days = $${params.length}`)
  }
  if (input.enabled_modules !== undefined) {
    params.push(JSON.stringify(input.enabled_modules))
    sets.push(`enabled_modules = $${params.length}`)
  }
  if (input.is_active !== undefined) {
    params.push(input.is_active)
    sets.push(`is_active = $${params.length}`)
  }

  if (sets.length === 0) return null

  sets.push(`updated_at = NOW()`)

  params.push(planId, workspaceId)
  const { rows } = await client.query<PlanRow>(
    `UPDATE plans
        SET ${sets.join(', ')}
      WHERE id = $${params.length - 1}
        AND workspace_id = $${params.length}
        AND is_deleted = FALSE
      RETURNING ${PLAN_COLUMNS}`,
    params
  )
  return rows[0] ? toPlanRecord(rows[0]) : null
}

/**
 * Soft-delete a plan. Sets is_deleted = TRUE.
 * Returns true if a row was updated.
 */
export async function softDeletePlan(
  client: TransactionClient,
  workspaceId: string,
  planId: string
): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE plans
        SET is_deleted = TRUE, updated_at = NOW()
      WHERE id = $1
        AND workspace_id = $2
        AND is_deleted = FALSE`,
    [planId, workspaceId]
  )
  return (rowCount ?? 0) > 0
}

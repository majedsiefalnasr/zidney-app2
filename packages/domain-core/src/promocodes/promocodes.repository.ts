/**
 * Promocodes Domain — Repository (Raw SQL)
 *
 * File: packages/domain-core/src/promocodes/promocodes.repository.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * All queries are tenant-scoped via the database pool connection (database-per-tenant).
 * The `promocodes` and `promocode_usages` tables carry no workspace_id column;
 * tenant isolation is enforced at the pool level.
 *
 * No ORM — raw pg for explicit transaction control, FOR UPDATE locking, and
 * status filters that use DB NOW().
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ All writes receive caller-owned transaction client
 * ✓ Tenant isolation enforced at pool level
 * ✓ Server-authoritative time via DB NOW()
 */

import { PromocodeError } from './promocodes.errors'
import type {
  AnalyticsFilter,
  DbClient,
  ListPromocodesFilter,
  NewPromocodeUsageInput,
  PromocodeAnalytics,
  PromocodeInput,
  PromocodeRow,
  PromocodeUsageRow,
  SinglePromocodeAnalytics,
  TransactionClient,
} from './promocodes.types'

// ---------------------------------------------------------------------------
// Column set
// ---------------------------------------------------------------------------

const PROMO_COLUMNS =
  'id, code, type, value, free_trial_days, valid_from, valid_until, usage_limit, per_user_limit, applies_to_plan_ids, target_division_ids, target_group_ids, is_stackable, is_active, created_at, updated_at'

const USAGE_COLUMNS = 'id, promocode_id, student_id, subscription_id, discount_amount, redeemed_at'

// ---------------------------------------------------------------------------
// Read — list (admin)
// ---------------------------------------------------------------------------

/**
 * List promocodes with optional filters and pagination.
 * Status filter (ACTIVE_NOW / EXPIRED / NOT_YET_VALID / INACTIVE) is evaluated
 * server-side using DB NOW() to stay server-authoritative.
 */
export async function listPromocodes(
  db: DbClient,
  filter: ListPromocodesFilter
): Promise<{ rows: PromocodeRow[]; total: number }> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filter.is_active !== undefined) {
    conditions.push(`is_active = $${idx++}`)
    values.push(filter.is_active)
  }

  if (filter.type !== undefined) {
    conditions.push(`type = $${idx++}`)
    values.push(filter.type)
  }

  if (filter.status !== undefined) {
    switch (filter.status) {
      case 'ACTIVE_NOW':
        conditions.push(`is_active = true AND valid_from <= NOW() AND valid_until >= NOW()`)
        break
      case 'EXPIRED':
        conditions.push(`valid_until < NOW()`)
        break
      case 'NOT_YET_VALID':
        conditions.push(`valid_from > NOW()`)
        break
      case 'INACTIVE':
        conditions.push(`is_active = false`)
        break
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const page = Math.max(1, filter.page ?? 1)
  const limit = Math.min(100, Math.max(1, filter.limit ?? 20))
  const offset = (page - 1) * limit

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM promocodes ${where}`,
    values
  )
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

  const dataResult = await db.query<PromocodeRow>(
    `SELECT ${PROMO_COLUMNS}
       FROM promocodes
       ${where}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  )

  return { rows: dataResult.rows, total }
}

// ---------------------------------------------------------------------------
// Read — single
// ---------------------------------------------------------------------------

/**
 * Get a promocode by primary key.
 * Accepts both a pool (DbClient) or transaction client (TransactionClient).
 */
export async function getPromocodeById(
  db: DbClient | TransactionClient,
  id: string
): Promise<PromocodeRow | null> {
  const { rows } = await db.query<PromocodeRow>(
    `SELECT ${PROMO_COLUMNS}
       FROM promocodes
      WHERE id = $1`,
    [id]
  )
  return rows[0] ?? null
}

/**
 * Get a promocode by its code string (case-insensitive via LOWER index).
 */
export async function getPromocodeByCode(db: DbClient, code: string): Promise<PromocodeRow | null> {
  const { rows } = await db.query<PromocodeRow>(
    `SELECT ${PROMO_COLUMNS}
       FROM promocodes
      WHERE LOWER(code) = LOWER($1)`,
    [code]
  )
  return rows[0] ?? null
}

// ---------------------------------------------------------------------------
// Write — create
// ---------------------------------------------------------------------------

/**
 * Insert a new promocode row.
 * Caller is responsible for normalising `code` to uppercase before calling.
 * Throws `PromocodeError('PROMOCODE_CODE_ALREADY_EXISTS')` on PG unique violation (23505).
 */
export async function createPromocode(db: DbClient, input: PromocodeInput): Promise<PromocodeRow> {
  try {
    const { rows } = await db.query<PromocodeRow>(
      `INSERT INTO promocodes (
         code, type, value, free_trial_days,
         valid_from, valid_until, usage_limit, per_user_limit,
         applies_to_plan_ids, target_division_ids, target_group_ids,
         is_stackable
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${PROMO_COLUMNS}`,
      [
        input.code,
        input.type,
        input.value ?? null,
        input.free_trial_days ?? null,
        input.valid_from,
        input.valid_until,
        input.usage_limit ?? null,
        input.per_user_limit ?? 1,
        JSON.stringify(input.applies_to_plan_ids ?? []),
        input.target_division_ids ? JSON.stringify(input.target_division_ids) : null,
        input.target_group_ids ? JSON.stringify(input.target_group_ids) : null,
        input.is_stackable ?? false,
      ]
    )
    const row = rows[0]
    if (!row) {
      throw new Error('Failed to create promocode')
    }
    return row
  } catch (err: unknown) {
    const pgErr = err as { code?: string; constraint?: string }
    if (pgErr.code === '23505') {
      throw new PromocodeError(
        'PROMOCODE_CODE_ALREADY_EXISTS',
        `Promocode with code '${input.code}' already exists`
      )
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Write — deactivate
// ---------------------------------------------------------------------------

/**
 * Set `is_active = false` on a promocode.
 * Idempotent — returns the current row state even if already inactive.
 */
export async function deactivatePromocode(db: DbClient, id: string): Promise<PromocodeRow> {
  const { rows } = await db.query<PromocodeRow>(
    `UPDATE promocodes
        SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING ${PROMO_COLUMNS}`,
    [id]
  )
  const row = rows[0]
  if (!row) {
    throw new PromocodeError('PROMOCODE_NOT_FOUND', `Promocode ${id} not found`)
  }
  return row
}

// ---------------------------------------------------------------------------
// Transactional helpers (called inside SERIALIZABLE tx by applyPromocode)
// ---------------------------------------------------------------------------

/**
 * Acquire a row-level lock on a promocode for update.
 * Must be called inside a transaction before counting usages.
 */
export async function lockPromocodeForUpdate(
  tx: TransactionClient,
  promocodeId: string
): Promise<PromocodeRow | null> {
  const { rows } = await tx.query<PromocodeRow>(
    `SELECT ${PROMO_COLUMNS}
       FROM promocodes
      WHERE id = $1
      FOR UPDATE`,
    [promocodeId]
  )
  return rows[0] ?? null
}

/**
 * Count total redemptions of a promocode across all students.
 * Must be called inside a transaction that holds the FOR UPDATE lock.
 */
export async function countTotalUsages(
  tx: TransactionClient,
  promocodeId: string
): Promise<number> {
  const { rows } = await tx.query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM promocode_usages
      WHERE promocode_id = $1`,
    [promocodeId]
  )
  return parseInt(rows[0]?.count ?? '0', 10)
}

/**
 * Count per-student redemptions of a promocode.
 * Must be called inside a transaction that holds the FOR UPDATE lock.
 */
export async function countUserUsages(
  tx: TransactionClient,
  promocodeId: string,
  studentId: string
): Promise<number> {
  const { rows } = await tx.query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM promocode_usages
      WHERE promocode_id = $1
        AND student_id = $2`,
    [promocodeId, studentId]
  )
  return parseInt(rows[0]?.count ?? '0', 10)
}

/**
 * Insert a usage record inside the caller's SERIALIZABLE transaction.
 */
export async function insertUsage(
  tx: TransactionClient,
  input: NewPromocodeUsageInput
): Promise<PromocodeUsageRow> {
  const { rows } = await tx.query<PromocodeUsageRow>(
    `INSERT INTO promocode_usages (
       promocode_id, student_id, subscription_id, discount_amount
     )
     VALUES ($1, $2, $3, $4)
     RETURNING ${USAGE_COLUMNS}`,
    [input.promocode_id, input.student_id, input.subscription_id, input.discount_amount]
  )
  const usageRow = rows[0]
  if (!usageRow) {
    throw new Error('Failed to insert promocode usage')
  }
  return usageRow
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/**
 * Workspace-level promo analytics.
 * Returns aggregate stats across all codes in this tenant DB.
 */
export async function getAnalyticsSummary(
  db: DbClient,
  _filter?: AnalyticsFilter
): Promise<PromocodeAnalytics> {
  // Aggregate counts
  const summaryResult = await db.query<{
    total_codes: string
    active_codes: string
    expired_codes: string
    total_redemptions: string
    revenue_impact: string
  }>(`
    SELECT
      COUNT(*) AS total_codes,
      COUNT(*) FILTER (WHERE is_active = true AND valid_from <= NOW() AND valid_until >= NOW()) AS active_codes,
      COUNT(*) FILTER (WHERE valid_until < NOW()) AS expired_codes,
      COALESCE((SELECT COUNT(*) FROM promocode_usages), 0) AS total_redemptions,
      COALESCE((SELECT SUM(discount_amount) FROM promocode_usages), 0) AS revenue_impact
    FROM promocodes
  `)

  const summary = summaryResult.rows[0] ?? {
    total_codes: '0',
    active_codes: '0',
    expired_codes: '0',
    total_redemptions: '0',
    revenue_impact: '0',
  }

  // By-type breakdown
  const byTypeResult = await db.query<{
    type: string
    count: string
    total_usages: string
  }>(`
    SELECT
      p.type,
      COUNT(DISTINCT p.id) AS count,
      COUNT(pu.id) AS total_usages
    FROM promocodes p
    LEFT JOIN promocode_usages pu ON pu.promocode_id = p.id
    GROUP BY p.type
  `)

  // Top 10 codes by usage
  const topCodesResult = await db.query<{
    code: string
    total_usages: string
    revenue_impact: string
  }>(`
    SELECT
      p.code,
      COUNT(pu.id) AS total_usages,
      COALESCE(SUM(pu.discount_amount), 0) AS revenue_impact
    FROM promocodes p
    LEFT JOIN promocode_usages pu ON pu.promocode_id = p.id
    GROUP BY p.id, p.code
    ORDER BY total_usages DESC
    LIMIT 10
  `)

  return {
    total_codes: parseInt(summary.total_codes, 10),
    active_codes: parseInt(summary.active_codes, 10),
    expired_codes: parseInt(summary.expired_codes, 10),
    total_redemptions: parseInt(summary.total_redemptions, 10),
    revenue_impact: parseFloat(summary.revenue_impact),
    by_type: byTypeResult.rows.map((r) => ({
      type: r.type as import('./promocodes.types').PromocodeType,
      count: parseInt(r.count, 10),
      total_usages: parseInt(r.total_usages, 10),
    })),
    top_codes: topCodesResult.rows.map((r) => ({
      code: r.code,
      total_usages: parseInt(r.total_usages, 10),
      revenue_impact: parseFloat(r.revenue_impact),
    })),
  }
}

/**
 * Per-code analytics for the GET /:id response.
 */
export async function getSinglePromocodeAnalytics(
  db: DbClient,
  promocodeId: string
): Promise<SinglePromocodeAnalytics> {
  const { rows } = await db.query<{
    total_usages: string
    total_discount_amount: string
    unique_students: string
  }>(
    `
    SELECT
      COUNT(*) AS total_usages,
      COALESCE(SUM(discount_amount), 0) AS total_discount_amount,
      COUNT(DISTINCT student_id) AS unique_students
    FROM promocode_usages
    WHERE promocode_id = $1
  `,
    [promocodeId]
  )

  const row = rows[0]
  if (!row) {
    return { total_usages: 0, total_discount_amount: 0, unique_students: 0 }
  }
  return {
    total_usages: parseInt(row.total_usages, 10),
    total_discount_amount: parseFloat(row.total_discount_amount),
    unique_students: parseInt(row.unique_students, 10),
  }
}

/**
 * Load all usage records for a given subscription (used by subscription integration).
 */
export async function getUsagesBySubscription(
  db: DbClient,
  subscriptionId: string
): Promise<PromocodeUsageRow[]> {
  const { rows } = await db.query<PromocodeUsageRow>(
    `SELECT ${USAGE_COLUMNS}
       FROM promocode_usages
      WHERE subscription_id = $1`,
    [subscriptionId]
  )
  return rows
}

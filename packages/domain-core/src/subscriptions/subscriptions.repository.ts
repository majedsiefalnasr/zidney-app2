/**
 * Subscriptions Domain — Repository (Raw SQL)
 *
 * File: packages/domain-core/src/subscriptions/subscriptions.repository.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * All queries are tenant-scoped via the database pool connection (database-per-tenant).
 * The `subscriptions` table does not carry a `workspace_id` column; tenant isolation
 * is enforced at the pool level and via the student_id / plan_id FKs.
 *
 * No ORM — raw pg queries for explicit control.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ All writes are caller-transactional
 * ✓ Tenant isolation enforced at pool level
 */

import type {
  CreateSubscriptionInput,
  DbClient,
  SubscriptionListQuery,
  SubscriptionListResult,
  SubscriptionRecord,
  SubscriptionRow,
  TransactionClient,
} from './subscriptions.types'

// ---------------------------------------------------------------------------
// Column sets
// ---------------------------------------------------------------------------

const SUB_COLUMNS =
  'id, student_id, plan_id, status, started_at, expires_at, auto_renew, payment_method, gateway_ref, notes, created_at, updated_at'

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Find a subscription by primary key.
 */
export async function findSubscriptionById(
  client: DbClient | TransactionClient,
  subscriptionId: string
): Promise<SubscriptionRecord | null> {
  const { rows } = await client.query<SubscriptionRow>(
    `SELECT ${SUB_COLUMNS}
       FROM subscriptions
      WHERE id = $1`,
    [subscriptionId]
  )
  return (rows[0] as SubscriptionRecord) ?? null
}

/**
 * Find the current ACTIVE subscription for a student.
 * Returns null if no ACTIVE subscription exists.
 */
export async function findActiveSubscriptionByStudent(
  client: DbClient | TransactionClient,
  studentId: string
): Promise<SubscriptionRecord | null> {
  const { rows } = await client.query<SubscriptionRow>(
    `SELECT ${SUB_COLUMNS}
       FROM subscriptions
      WHERE student_id = $1
        AND status = 'ACTIVE'`,
    [studentId]
  )
  return (rows[0] as SubscriptionRecord) ?? null
}

/**
 * List subscriptions with optional student_id / status filter and pagination.
 */
export async function listSubscriptions(
  client: DbClient,
  query: SubscriptionListQuery
): Promise<SubscriptionListResult> {
  const { page, limit, student_id, status } = query
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []

  if (student_id) {
    params.push(student_id)
    conditions.push(`student_id = $${params.length}`)
  }
  if (status) {
    params.push(status)
    conditions.push(`status = $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [{ rows: items }, { rows: countRows }] = await Promise.all([
    client.query<SubscriptionRow>(
      `SELECT ${SUB_COLUMNS}
         FROM subscriptions
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    client.query<{ count: string }>(`SELECT COUNT(*) AS count FROM subscriptions ${where}`, params),
  ])

  return {
    items: items as SubscriptionRecord[],
    total: parseInt(countRows[0]?.count ?? '0', 10),
    page,
    limit,
  }
}

// ---------------------------------------------------------------------------
// Write helpers (called inside transactions by the service layer)
// ---------------------------------------------------------------------------

/**
 * Insert a new subscription. expires_at is computed server-side using DB NOW().
 * Returns the inserted SubscriptionRecord.
 */
export async function insertSubscription(
  client: TransactionClient,
  input: CreateSubscriptionInput,
  durationDays: number
): Promise<SubscriptionRecord> {
  const startedAt = input.started_at ? `'${input.started_at}'::TIMESTAMPTZ` : 'NOW()'
  const { rows } = await client.query<SubscriptionRow>(
    `INSERT INTO subscriptions
       (student_id, plan_id, status, started_at, expires_at, payment_method, notes)
     VALUES ($1, $2, 'ACTIVE', ${startedAt}, ${startedAt}::TIMESTAMPTZ + INTERVAL '${durationDays} days', 'MANUAL', $3)
     RETURNING ${SUB_COLUMNS}`,
    [input.student_id, input.plan_id, input.notes ?? null]
  )
  return rows[0] as SubscriptionRecord
}

/**
 * Set a subscription's status to EXPIRED in-place.
 */
export async function expireSubscription(
  client: TransactionClient,
  subscriptionId: string
): Promise<void> {
  await client.query(
    `UPDATE subscriptions
        SET status = 'EXPIRED', updated_at = NOW()
      WHERE id = $1`,
    [subscriptionId]
  )
}

/**
 * Set a subscription's status to CANCELED in-place.
 */
export async function cancelSubscription(
  client: TransactionClient,
  subscriptionId: string
): Promise<void> {
  await client.query(
    `UPDATE subscriptions
        SET status = 'CANCELED', updated_at = NOW()
      WHERE id = $1`,
    [subscriptionId]
  )
}

/**
 * Sync the student's subscription_status column in the same transaction.
 * An active subscription → 'ACTIVE'; everything else → 'NONE'.
 */
export async function syncStudentSubscriptionStatus(
  client: TransactionClient,
  studentId: string,
  newStatus: 'ACTIVE' | 'NONE' | 'EXPIRED'
): Promise<void> {
  await client.query(
    `UPDATE students
        SET subscription_status = $1, updated_at = NOW()
      WHERE id = $2`,
    [newStatus, studentId]
  )
}

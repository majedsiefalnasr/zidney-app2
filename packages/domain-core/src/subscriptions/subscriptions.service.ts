/**
 * Subscriptions Domain — Service Layer (Business Logic)
 *
 * File: packages/domain-core/src/subscriptions/subscriptions.service.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Business-logic entry points for subscription management.
 *
 * Key invariants:
 * - activateSubscription uses SERIALIZABLE isolation to prevent duplicate ACTIVE
 *   subscriptions under concurrent requests.
 * - If a student already has an ACTIVE subscription, it is expired first in the
 *   same transaction, then the new subscription is inserted.
 * - students.subscription_status is always synced in the same transaction.
 * - cancelSubscription uses READ COMMITTED (single-row state machine transition).
 * - payment_method is hard-coded to 'MANUAL' in Stage 44.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ No logging side-effects
 * ✓ All writes transactional (BEGIN/COMMIT/ROLLBACK)
 * ✓ SERIALIZABLE isolation for activateSubscription
 * ✓ Server-authoritative time (expires_at via DB NOW() + INTERVAL)
 */

import { findPlanById } from '../plans/plans.repository'
import { SubscriptionError } from './subscriptions.errors'
import {
  cancelSubscription,
  expireSubscription,
  findActiveSubscriptionByStudent,
  findSubscriptionById,
  insertSubscription,
  listSubscriptions,
  syncStudentSubscriptionStatus,
} from './subscriptions.repository'
import type {
  AuditContext,
  CreateSubscriptionInput,
  DbClient,
  SubscriptionListQuery,
  SubscriptionListResult,
  SubscriptionRecord,
} from './subscriptions.types'

// ---------------------------------------------------------------------------
// activateSubscription
// ---------------------------------------------------------------------------

/**
 * Activate a subscription for a student.
 *
 * Transactional flow (SERIALIZABLE):
 *  1. Fetch plan — 404 if missing
 *  2. Validate plan.is_active — 422 PLAN_INACTIVE if false
 *  3. Get current ACTIVE subscription
 *     → If exists: expire it + set students.subscription_status = 'EXPIRED'
 *  4. Insert new subscription (status='ACTIVE', expires computed server-side)
 *  5. Set students.subscription_status = 'ACTIVE'
 *
 * @returns The newly created SubscriptionRecord
 * @throws SubscriptionError PLAN_NOT_FOUND
 * @throws SubscriptionError PLAN_INACTIVE
 */
export async function activateSubscription(
  db: DbClient,
  input: CreateSubscriptionInput,
  _audit: AuditContext
): Promise<SubscriptionRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // 1. Fetch plan
    const plan = await findPlanById(client, input.workspace_id, input.plan_id)
    if (!plan) throw new SubscriptionError('PLAN_NOT_FOUND', `Plan not found: ${input.plan_id}`)

    // 2. Validate plan is active
    if (!plan.is_active) {
      throw new SubscriptionError('PLAN_INACTIVE', `Plan is not active: ${input.plan_id}`)
    }

    // 3. Check for existing ACTIVE subscription
    const existing = await findActiveSubscriptionByStudent(client, input.student_id)
    if (existing) {
      await expireSubscription(client, existing.id)
      await syncStudentSubscriptionStatus(client, input.student_id, 'EXPIRED')
    }

    // 4. Insert new ACTIVE subscription (expires_at computed server-side)
    const subscription = await insertSubscription(client, input, plan.duration_days)

    // 5. Sync student subscription_status
    await syncStudentSubscriptionStatus(client, input.student_id, 'ACTIVE')

    await client.query('COMMIT')
    return subscription
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// listSubscriptions
// ---------------------------------------------------------------------------

/**
 * List subscriptions with optional filters.
 */
export async function listSubscriptionsService(
  db: DbClient,
  query: SubscriptionListQuery,
  _audit: AuditContext
): Promise<SubscriptionListResult> {
  return listSubscriptions(db, query)
}

// ---------------------------------------------------------------------------
// getSubscriptionById
// ---------------------------------------------------------------------------

/**
 * Get a single subscription by ID.
 * @throws SubscriptionError SUBSCRIPTION_NOT_FOUND if not found
 */
export async function getSubscriptionById(
  db: DbClient,
  subscriptionId: string
): Promise<SubscriptionRecord> {
  const record = await findSubscriptionById(db, subscriptionId)
  if (!record) {
    throw new SubscriptionError(
      'SUBSCRIPTION_NOT_FOUND',
      `Subscription not found: ${subscriptionId}`
    )
  }
  return record
}

// ---------------------------------------------------------------------------
// cancelSubscriptionService
// ---------------------------------------------------------------------------

/**
 * Cancel a subscription.
 *
 * Transactional flow (READ COMMITTED):
 *  1. Find subscription — 404 if missing
 *  2. Validate status is ACTIVE or PENDING — 409 SUBSCRIPTION_CANNOT_CANCEL if not
 *  3. Set status = 'CANCELED'
 *  4. Sync students.subscription_status = 'NONE'
 *
 * @throws SubscriptionError SUBSCRIPTION_NOT_FOUND
 * @throws SubscriptionError SUBSCRIPTION_CANNOT_CANCEL
 */
export async function cancelSubscriptionService(
  db: DbClient,
  subscriptionId: string,
  _audit: AuditContext
): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const sub = await findSubscriptionById(client, subscriptionId)
    if (!sub) {
      throw new SubscriptionError(
        'SUBSCRIPTION_NOT_FOUND',
        `Subscription not found: ${subscriptionId}`
      )
    }

    if (sub.status !== 'ACTIVE' && sub.status !== 'PENDING') {
      throw new SubscriptionError(
        'SUBSCRIPTION_CANNOT_CANCEL',
        `Subscription with status '${sub.status}' cannot be canceled`
      )
    }

    await cancelSubscription(client, subscriptionId)
    await syncStudentSubscriptionStatus(client, sub.student_id, 'NONE')

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

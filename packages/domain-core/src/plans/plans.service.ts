/**
 * Plans Domain — Service Layer (Business Logic)
 *
 * File: packages/domain-core/src/plans/plans.service.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Business-logic entry points for plan management.
 * All write operations are wrapped in explicit transactions.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ No logging side-effects — callers are responsible for logging
 * ✓ All writes are transactional (BEGIN/COMMIT/ROLLBACK)
 * ✓ Soft-delete only — no hard deletes
 */

import { PlanError } from './plans.errors'
import {
  countActiveSubscriptionsByPlanId,
  findPlanById,
  insertPlan,
  listPlans,
  softDeletePlan,
  updatePlan,
} from './plans.repository'
import type {
  AuditContext,
  CreatePlanInput,
  DbClient,
  PlanListQuery,
  PlanListResult,
  PlanRecord,
  UpdatePlanInput,
} from './plans.types'

// ---------------------------------------------------------------------------
// createPlan
// ---------------------------------------------------------------------------

/**
 * Create a new plan in the workspace.
 * Uses READ COMMITTED isolation (no concurrent uniqueness constraint to enforce).
 */
export async function createPlan(
  db: DbClient,
  input: CreatePlanInput,
  _audit: AuditContext
): Promise<PlanRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const record = await insertPlan(client, input)
    await client.query('COMMIT')
    return record
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// listPlans
// ---------------------------------------------------------------------------

/**
 * List non-deleted plans for a workspace, with optional active filter.
 */
export async function listPlansService(
  db: DbClient,
  workspaceId: string,
  query: PlanListQuery,
  _audit: AuditContext
): Promise<PlanListResult> {
  return listPlans(db, workspaceId, query)
}

// ---------------------------------------------------------------------------
// getPlanById
// ---------------------------------------------------------------------------

/**
 * Get a single non-deleted plan by ID.
 * @throws PlanError PLAN_NOT_FOUND if not found
 */
export async function getPlanById(
  db: DbClient,
  workspaceId: string,
  planId: string
): Promise<PlanRecord> {
  const record = await findPlanById(db, workspaceId, planId)
  if (!record) throw new PlanError('PLAN_NOT_FOUND', `Plan not found: ${planId}`)
  return record
}

// ---------------------------------------------------------------------------
// updatePlan
// ---------------------------------------------------------------------------

/**
 * Update mutable fields of a plan.
 * @throws PlanError PLAN_NOT_FOUND if the plan does not exist or is soft-deleted
 */
export async function updatePlanService(
  db: DbClient,
  workspaceId: string,
  planId: string,
  input: UpdatePlanInput,
  _audit: AuditContext
): Promise<PlanRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const updated = await updatePlan(client, workspaceId, planId, input)
    if (!updated) throw new PlanError('PLAN_NOT_FOUND', `Plan not found: ${planId}`)
    await client.query('COMMIT')
    return updated
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// deletePlan (soft-delete)
// ---------------------------------------------------------------------------

/**
 * Soft-delete a plan.
 * Blocked if any ACTIVE subscription references this plan.
 * @throws PlanError PLAN_NOT_FOUND if not found
 * @throws PlanError PLAN_HAS_ACTIVE_SUBSCRIPTIONS if active subscriptions exist
 */
export async function deletePlan(
  db: DbClient,
  workspaceId: string,
  planId: string,
  _audit: AuditContext
): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const existing = await findPlanById(client, workspaceId, planId)
    if (!existing) throw new PlanError('PLAN_NOT_FOUND', `Plan not found: ${planId}`)

    const activeCount = await countActiveSubscriptionsByPlanId(client, planId)
    if (activeCount > 0) {
      throw new PlanError(
        'PLAN_HAS_ACTIVE_SUBSCRIPTIONS',
        `Cannot delete plan with ${activeCount} active subscription(s)`
      )
    }

    await softDeletePlan(client, workspaceId, planId)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

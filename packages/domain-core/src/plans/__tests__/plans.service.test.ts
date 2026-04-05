/**
 * Plans Domain Unit Tests — STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * File: packages/domain-core/src/plans/__tests__/plans.service.test.ts
 *
 * Tests for:
 *   - createPlan: success path, client.release() called
 *   - getPlanById: success, PLAN_NOT_FOUND
 *   - updatePlanService: success, PLAN_NOT_FOUND
 *   - deletePlan: PLAN_NOT_FOUND, PLAN_HAS_ACTIVE_SUBSCRIPTIONS, success (soft-delete)
 */

import { describe, expect, it, vi } from 'vitest'

import { PlanError } from '../plans.errors'
import {
  createPlan,
  deletePlan,
  getPlanById,
  listPlansService,
  updatePlanService,
} from '../plans.service'
import type { AuditContext, PlanRecord } from '../plans.types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'
const PLAN_ID = 'pl-00000000-0000-0000-0000-000000000001'
const NOW = new Date('2026-04-06T10:00:00Z')

const audit: AuditContext = {
  user_id: 'user-001',
  workspace_id: WORKSPACE_ID,
  workspace_slug: 'test-ws',
  correlation_id: 'corr-001',
}

const createInput = {
  workspace_id: WORKSPACE_ID,
  name: 'Standard Plan',
  description: null,
  price: 99.0,
  billing_type: 'recurring' as const,
  duration_days: 30,
  enabled_modules: ['exams'],
}

function makePlanRecord(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: PLAN_ID,
    workspace_id: WORKSPACE_ID,
    name: 'Standard Plan',
    description: null,
    price: 99.0,
    billing_type: 'recurring',
    duration_days: 30,
    enabled_modules: ['exams'],
    is_active: true,
    is_deleted: false,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Pool / client mock factory
// ---------------------------------------------------------------------------

type QueryMatcher = (
  sql: string,
  params?: unknown[]
) => { rows: unknown[]; rowCount: number | null }

/**
 * Pool mock that supports both pool-level queries and client-checkout pattern.
 * Transaction commands (BEGIN/COMMIT/ROLLBACK) are handled transparently.
 */
function makePool(matcher: QueryMatcher) {
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const txCmds = ['BEGIN', 'COMMIT', 'ROLLBACK']
      if (txCmds.includes(sql.trim())) return { rows: [], rowCount: 0 }
      return matcher(sql, params)
    }),
    release: vi.fn(),
  }

  const pool = {
    connect: vi.fn(async () => client),
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const txCmds = ['BEGIN', 'COMMIT', 'ROLLBACK']
      if (txCmds.includes(sql.trim())) return { rows: [], rowCount: 0 }
      return matcher(sql, params)
    }),
    _client: client,
  }

  return pool
}

// ---------------------------------------------------------------------------
// 1. createPlan
// ---------------------------------------------------------------------------

describe('createPlan', () => {
  it('returns the inserted plan record on success', async () => {
    const plan = makePlanRecord()
    const pool = makePool(() => ({ rows: [plan], rowCount: 1 }))

    const result = await createPlan(pool as any, createInput, audit)
    expect(result.id).toBe(PLAN_ID)
    expect(result.name).toBe('Standard Plan')
    expect(result.price).toBe(99.0)
  })

  it('calls client.release() after success', async () => {
    const plan = makePlanRecord()
    const pool = makePool(() => ({ rows: [plan], rowCount: 1 }))

    await createPlan(pool as any, createInput, audit)
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('calls client.release() after error', async () => {
    const pool = makePool(() => {
      throw new Error('DB write error')
    })

    await expect(createPlan(pool as any, createInput, audit)).rejects.toThrow('DB write error')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 2. getPlanById
// ---------------------------------------------------------------------------

describe('getPlanById', () => {
  it('returns the plan when found', async () => {
    const plan = makePlanRecord()
    const pool = makePool(() => ({ rows: [plan], rowCount: 1 }))

    const result = await getPlanById(pool as any, WORKSPACE_ID, PLAN_ID)
    expect(result.id).toBe(PLAN_ID)
  })

  it('throws PLAN_NOT_FOUND when plan does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await getPlanById(pool as any, WORKSPACE_ID, PLAN_ID).catch((e) => e)
    expect(err).toBeInstanceOf(PlanError)
    expect((err as PlanError).code).toBe('PLAN_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 3. listPlansService
// ---------------------------------------------------------------------------

describe('listPlansService', () => {
  it('returns items and total from repository', async () => {
    const plan = makePlanRecord()
    const pool = makePool((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 }
      return { rows: [plan], rowCount: 1 }
    })

    const result = await listPlansService(pool as any, WORKSPACE_ID, { page: 1, limit: 20 }, audit)
    expect(result.items).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 4. updatePlanService
// ---------------------------------------------------------------------------

describe('updatePlanService', () => {
  it('returns the updated plan on success', async () => {
    const updated = makePlanRecord({ name: 'Updated Plan' })
    const pool = makePool(() => ({ rows: [updated], rowCount: 1 }))

    const result = await updatePlanService(
      pool as any,
      WORKSPACE_ID,
      PLAN_ID,
      { name: 'Updated Plan' },
      audit
    )
    expect(result.name).toBe('Updated Plan')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws PLAN_NOT_FOUND when plan does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await updatePlanService(
      pool as any,
      WORKSPACE_ID,
      PLAN_ID,
      { name: 'Updated Plan' },
      audit
    ).catch((e) => e)
    expect(err).toBeInstanceOf(PlanError)
    expect((err as PlanError).code).toBe('PLAN_NOT_FOUND')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 5. deletePlan
// ---------------------------------------------------------------------------

describe('deletePlan', () => {
  it('throws PLAN_NOT_FOUND when plan does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await deletePlan(pool as any, WORKSPACE_ID, PLAN_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(PlanError)
    expect((err as PlanError).code).toBe('PLAN_NOT_FOUND')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws PLAN_HAS_ACTIVE_SUBSCRIPTIONS when active subscriptions exist', async () => {
    const plan = makePlanRecord()
    const pool = makePool((sql) => {
      // findPlanById — SELECT FROM plans
      if (sql.includes('SELECT') && sql.includes('FROM plans')) return { rows: [plan], rowCount: 1 }
      // countActiveSubscriptionsByPlanId — returns 2 active subscriptions
      if (sql.includes('COUNT(*)') && sql.includes('plan_id'))
        return { rows: [{ count: '2' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const err = await deletePlan(pool as any, WORKSPACE_ID, PLAN_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(PlanError)
    expect((err as PlanError).code).toBe('PLAN_HAS_ACTIVE_SUBSCRIPTIONS')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('soft-deletes the plan when no active subscriptions exist', async () => {
    const plan = makePlanRecord()
    let softDeleteCalled = false

    const pool = makePool((sql) => {
      // findPlanById — SELECT FROM plans
      if (sql.includes('SELECT') && sql.includes('FROM plans')) return { rows: [plan], rowCount: 1 }
      // countActiveSubscriptionsByPlanId — 0 active
      if (sql.includes('COUNT(*)') && sql.includes('plan_id'))
        return { rows: [{ count: '0' }], rowCount: 1 }
      // softDeletePlan — UPDATE plans SET is_deleted = TRUE
      if (sql.includes('UPDATE plans') && sql.includes('is_deleted = TRUE')) {
        softDeleteCalled = true
        return { rows: [], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await deletePlan(pool as any, WORKSPACE_ID, PLAN_ID, audit)
    expect(softDeleteCalled).toBe(true)
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })
})

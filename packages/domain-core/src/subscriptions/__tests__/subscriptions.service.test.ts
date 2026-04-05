/**
 * Subscriptions Domain Unit Tests — STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * File: packages/domain-core/src/subscriptions/__tests__/subscriptions.service.test.ts
 *
 * Tests for:
 *   - activateSubscription: success, PLAN_NOT_FOUND, PLAN_INACTIVE,
 *                           expires existing ACTIVE subscription first
 *   - getSubscriptionById: success, SUBSCRIPTION_NOT_FOUND
 *   - cancelSubscriptionService: success, SUBSCRIPTION_CANNOT_CANCEL (EXPIRED)
 */

import { describe, expect, it, vi } from 'vitest'

import { SubscriptionError } from '../subscriptions.errors'
import {
  activateSubscription,
  cancelSubscriptionService,
  getSubscriptionById,
  listSubscriptionsService,
} from '../subscriptions.service'
import type { AuditContext, SubscriptionRecord } from '../subscriptions.types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'
const PLAN_ID = 'pl-00000000-0000-0000-0000-000000000001'
const STUDENT_ID = 'st-00000000-0000-0000-0000-000000000001'
const SUB_ID = 'sb-00000000-0000-0000-0000-000000000001'
const OLD_SUB_ID = 'sb-00000000-0000-0000-0000-000000000099'
const NOW = new Date('2026-04-06T10:00:00Z')
const FUTURE = new Date('2026-05-06T10:00:00Z')

const audit: AuditContext = {
  user_id: 'user-001',
  workspace_id: WORKSPACE_ID,
  workspace_slug: 'test-ws',
  correlation_id: 'corr-001',
}

const activateInput = {
  workspace_id: WORKSPACE_ID,
  student_id: STUDENT_ID,
  plan_id: PLAN_ID,
  started_at: null,
  notes: null,
}

function makePlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    workspace_id: WORKSPACE_ID,
    name: 'Standard Plan',
    description: null,
    price: '99.00',
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

function makeSubRecord(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: SUB_ID,
    student_id: STUDENT_ID,
    plan_id: PLAN_ID,
    status: 'ACTIVE',
    started_at: NOW,
    expires_at: FUTURE,
    auto_renew: false,
    payment_method: 'MANUAL',
    gateway_ref: null,
    notes: null,
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

function makePool(matcher: QueryMatcher) {
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const txCmds = ['BEGIN', 'BEGIN ISOLATION LEVEL SERIALIZABLE', 'COMMIT', 'ROLLBACK']
      if (txCmds.includes(sql.trim())) return { rows: [], rowCount: 0 }
      return matcher(sql, params)
    }),
    release: vi.fn(),
  }

  const pool = {
    connect: vi.fn(async () => client),
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const txCmds = ['BEGIN', 'BEGIN ISOLATION LEVEL SERIALIZABLE', 'COMMIT', 'ROLLBACK']
      if (txCmds.includes(sql.trim())) return { rows: [], rowCount: 0 }
      return matcher(sql, params)
    }),
    _client: client,
  }

  return pool
}

// ---------------------------------------------------------------------------
// 1. activateSubscription
// ---------------------------------------------------------------------------

describe('activateSubscription', () => {
  it('creates a new subscription when plan is active and no prior subscription exists', async () => {
    const sub = makeSubRecord()
    const pool = makePool((sql) => {
      // findPlanById — SELECT FROM plans
      if (sql.includes('FROM plans')) return { rows: [makePlanRow()], rowCount: 1 }
      // findActiveSubscriptionByStudent — no existing ACTIVE sub
      if (sql.includes('student_id') && sql.includes('FROM subscriptions'))
        return { rows: [], rowCount: 0 }
      // insertSubscription
      if (sql.includes('INSERT INTO subscriptions')) return { rows: [sub], rowCount: 1 }
      // syncStudentSubscriptionStatus
      if (sql.includes('UPDATE students')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await activateSubscription(pool as any, activateInput, audit)
    expect(result.id).toBe(SUB_ID)
    expect(result.status).toBe('ACTIVE')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws PLAN_NOT_FOUND when plan does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await activateSubscription(pool as any, activateInput, audit).catch((e) => e)
    expect(err).toBeInstanceOf(SubscriptionError)
    expect((err as SubscriptionError).code).toBe('PLAN_NOT_FOUND')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws PLAN_INACTIVE when plan is not active', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('FROM plans'))
        return { rows: [makePlanRow({ is_active: false })], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const err = await activateSubscription(pool as any, activateInput, audit).catch((e) => e)
    expect(err).toBeInstanceOf(SubscriptionError)
    expect((err as SubscriptionError).code).toBe('PLAN_INACTIVE')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('expires the existing ACTIVE subscription before creating a new one', async () => {
    const existingSub = makeSubRecord({ id: OLD_SUB_ID })
    const newSub = makeSubRecord({ id: SUB_ID })
    let expireCalled = false
    let syncCallCount = 0

    const pool = makePool((sql) => {
      // findPlanById
      if (sql.includes('FROM plans')) return { rows: [makePlanRow()], rowCount: 1 }
      // findActiveSubscriptionByStudent — returns existing ACTIVE sub
      if (sql.includes('student_id') && sql.includes('FROM subscriptions'))
        return { rows: [existingSub], rowCount: 1 }
      // expireSubscription — UPDATE subscriptions SET status = 'EXPIRED'
      if (sql.includes('UPDATE subscriptions') && sql.includes('EXPIRED')) {
        expireCalled = true
        return { rows: [], rowCount: 1 }
      }
      // syncStudentSubscriptionStatus — called twice (EXPIRED then ACTIVE)
      if (sql.includes('UPDATE students')) {
        syncCallCount++
        return { rows: [], rowCount: 1 }
      }
      // insertSubscription
      if (sql.includes('INSERT INTO subscriptions')) return { rows: [newSub], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await activateSubscription(pool as any, activateInput, audit)
    expect(result.id).toBe(SUB_ID)
    expect(expireCalled).toBe(true)
    expect(syncCallCount).toBe(1) // once for ACTIVE (no longer updates to EXPIRED before inserting replacement)
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 2. getSubscriptionById
// ---------------------------------------------------------------------------

describe('getSubscriptionById', () => {
  it('returns the subscription when found', async () => {
    const sub = makeSubRecord()
    const pool = makePool(() => ({ rows: [sub], rowCount: 1 }))

    const result = await getSubscriptionById(pool as any, SUB_ID)
    expect(result.id).toBe(SUB_ID)
  })

  it('throws SUBSCRIPTION_NOT_FOUND when subscription does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await getSubscriptionById(pool as any, SUB_ID).catch((e) => e)
    expect(err).toBeInstanceOf(SubscriptionError)
    expect((err as SubscriptionError).code).toBe('SUBSCRIPTION_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 3. listSubscriptionsService
// ---------------------------------------------------------------------------

describe('listSubscriptionsService', () => {
  it('returns items and total from repository', async () => {
    const sub = makeSubRecord()
    const pool = makePool((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }], rowCount: 1 }
      return { rows: [sub], rowCount: 1 }
    })

    const result = await listSubscriptionsService(pool as any, { page: 1, limit: 20 }, audit)
    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 4. cancelSubscriptionService
// ---------------------------------------------------------------------------

describe('cancelSubscriptionService', () => {
  it('cancels an ACTIVE subscription successfully', async () => {
    const sub = makeSubRecord({ status: 'ACTIVE' })
    let cancelCalled = false

    const pool = makePool((sql) => {
      // findSubscriptionById — SELECT FROM subscriptions WHERE id
      if (sql.includes('FROM subscriptions') && sql.includes('WHERE id'))
        return { rows: [sub], rowCount: 1 }
      // cancelSubscription UPDATE
      if (sql.includes('UPDATE subscriptions') && sql.includes('CANCELED')) {
        cancelCalled = true
        return { rows: [], rowCount: 1 }
      }
      // syncStudentSubscriptionStatus
      if (sql.includes('UPDATE students')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await cancelSubscriptionService(pool as any, SUB_ID, audit)
    expect(cancelCalled).toBe(true)
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('cancels a PENDING subscription successfully', async () => {
    const sub = makeSubRecord({ status: 'PENDING' })

    const pool = makePool((sql) => {
      if (sql.includes('FROM subscriptions') && sql.includes('WHERE id'))
        return { rows: [sub], rowCount: 1 }
      return { rows: [], rowCount: 1 }
    })

    await expect(cancelSubscriptionService(pool as any, SUB_ID, audit)).resolves.toBeUndefined()
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws SUBSCRIPTION_NOT_FOUND when subscription does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await cancelSubscriptionService(pool as any, SUB_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(SubscriptionError)
    expect((err as SubscriptionError).code).toBe('SUBSCRIPTION_NOT_FOUND')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws SUBSCRIPTION_CANNOT_CANCEL when subscription is EXPIRED', async () => {
    const sub = makeSubRecord({ status: 'EXPIRED' })
    const pool = makePool((sql) => {
      if (sql.includes('FROM subscriptions') && sql.includes('WHERE id'))
        return { rows: [sub], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const err = await cancelSubscriptionService(pool as any, SUB_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(SubscriptionError)
    expect((err as SubscriptionError).code).toBe('SUBSCRIPTION_CANNOT_CANCEL')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws SUBSCRIPTION_CANNOT_CANCEL when subscription is CANCELED', async () => {
    const sub = makeSubRecord({ status: 'CANCELED' })
    const pool = makePool((sql) => {
      if (sql.includes('FROM subscriptions') && sql.includes('WHERE id'))
        return { rows: [sub], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const err = await cancelSubscriptionService(pool as any, SUB_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(SubscriptionError)
    expect((err as SubscriptionError).code).toBe('SUBSCRIPTION_CANNOT_CANCEL')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })
})

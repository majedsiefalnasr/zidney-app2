/**
 * Promocodes Service Unit Tests — STAGE_45_PROMOCODES
 *
 * File: packages/domain-core/src/promocodes/__tests__/promocodes.service.test.ts
 *
 * Tests for PromocodeService covering all public methods.
 * Uses a SQL-dispatching mock pool — no vi.mock() module fakes.
 */

import { describe, expect, it, vi } from 'vitest'

import { PromocodeError } from '../promocodes.errors'
import { promocodeService } from '../promocodes.service'
import type { AuditContext, PromocodeRow, PromocodeValidationContext } from '../promocodes.types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-08T10:00:00Z')
const FUTURE = new Date('2027-01-01T00:00:00Z')
const PAST = new Date('2026-01-01T00:00:00Z')
const PROMO_ID = 'pc-00000000-0000-0000-0000-000000000001'
const PLAN_ID = 'pl-00000000-0000-0000-0000-000000000001'
const STUDENT_ID = 'st-00000000-0000-0000-0000-000000000001'
const SUB_ID = 'sb-00000000-0000-0000-0000-000000000001'
const USAGE_ID = 'pu-00000000-0000-0000-0000-000000000001'

const audit: AuditContext = {
  user_id: 'user-001',
  workspace_id: 'ws-001',
  workspace_slug: 'acme',
  correlation_id: 'corr-001',
}

function makePromoRow(overrides: Partial<PromocodeRow> = {}): PromocodeRow {
  return {
    id: PROMO_ID,
    code: 'SAVE10',
    type: 'PERCENTAGE',
    value: '10',
    free_trial_days: null,
    is_active: true,
    valid_from: PAST,
    valid_until: FUTURE,
    usage_limit: null,
    per_user_limit: 1,
    applies_to_plan_ids: [],
    target_division_ids: null,
    target_group_ids: null,
    is_stackable: true,
    created_at: PAST,
    updated_at: PAST,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock pool helpers
// ---------------------------------------------------------------------------

type QueryFn = (
  sql: string,
  params?: unknown[]
) => Promise<{ rows: unknown[]; rowCount: number | null }>

function makePool(queryFn: QueryFn) {
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const tx = ['BEGIN', 'BEGIN ISOLATION LEVEL SERIALIZABLE', 'COMMIT', 'ROLLBACK']
      if (tx.includes((sql ?? '').trim())) return { rows: [], rowCount: 0 }
      return queryFn(sql, params)
    }),
    release: vi.fn(),
  }
  return {
    connect: vi.fn(async () => client),
    query: vi.fn((sql: string, params?: unknown[]) => queryFn(sql, params)),
    _client: client,
  }
}

// ---------------------------------------------------------------------------
// 1. createPromocode
// ---------------------------------------------------------------------------

describe('PromocodeService.createPromocode', () => {
  it('inserts a promocode and returns the row', async () => {
    const row = makePromoRow()
    const pool = makePool(async (sql) => {
      if (sql.includes('INSERT INTO promocodes')) return { rows: [row], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await promocodeService.createPromocode(
      pool as any,
      {
        code: 'SAVE10',
        type: 'PERCENTAGE',
        value: 10,
        valid_from: PAST.toISOString(),
        valid_until: FUTURE.toISOString(),
      },
      audit
    )

    expect(result.code).toBe('SAVE10')
    expect(result.type).toBe('PERCENTAGE')
  })
})

// ---------------------------------------------------------------------------
// 2. listPromocodes
// ---------------------------------------------------------------------------

describe('PromocodeService.listPromocodes', () => {
  it('returns paginated rows and total count', async () => {
    const row = makePromoRow()
    const pool = makePool(async (sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '5' }], rowCount: 1 }
      if (sql.includes('SELECT') && sql.includes('FROM promocodes')) {
        return { rows: [row], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const result = await promocodeService.listPromocodes(pool as any, { page: 1, limit: 20 })

    expect(result.total).toBe(5)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.id).toBe(PROMO_ID)
  })
})

// ---------------------------------------------------------------------------
// 3. getPromocode — success
// ---------------------------------------------------------------------------

describe('PromocodeService.getPromocode', () => {
  it('returns promocode + analytics when found', async () => {
    const row = makePromoRow()
    const pool = makePool(async (sql) => {
      if (sql.includes('WHERE id = $1') && !sql.includes('promocode_usages'))
        return { rows: [row], rowCount: 1 }
      // analytics queries — total usages + revenue
      if (sql.includes('COUNT') || sql.includes('promocode_usages')) {
        return {
          rows: [{ total_usages: 3, total_discount_amount: 30, unique_students: 3 }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const result = await promocodeService.getPromocode(pool as any, PROMO_ID)

    expect(result.promocode.id).toBe(PROMO_ID)
    expect(result.analytics).toBeDefined()
  })

  it('throws PROMOCODE_NOT_FOUND when row is null', async () => {
    const _pool = makePool(async () => ({ rows: [], rowCount: 0 }))

    const poolNotFound = makePool(async (sql) => {
      // analytics MUST return a row (aggregate always returns 1 row)
      if (sql.includes('promocode_usages')) {
        return {
          rows: [{ total_usages: '0', total_discount_amount: '0', unique_students: '0' }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })
    const err = await promocodeService
      .getPromocode(poolNotFound as any, 'non-existent-id')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PromocodeError)
    expect((err as PromocodeError).code).toBe('PROMOCODE_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 4. deactivatePromocode
// ---------------------------------------------------------------------------

describe('PromocodeService.deactivatePromocode', () => {
  it('returns updated row with is_active = false', async () => {
    const row = makePromoRow({ is_active: false })
    const pool = makePool(async (sql) => {
      if (sql.includes('UPDATE promocodes')) return { rows: [row], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await promocodeService.deactivatePromocode(pool as any, PROMO_ID, audit)

    expect(result.is_active).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 5. validatePromocode — success path
// ---------------------------------------------------------------------------

describe('PromocodeService.validatePromocode', () => {
  it('returns promocode + discountPreview when all checks pass', async () => {
    const row = makePromoRow()
    const pool = makePool(async (sql) => {
      if (sql.includes('LOWER(code)') || (sql.includes('FROM promocodes') && sql.includes('WHERE')))
        return { rows: [row], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const ctx: PromocodeValidationContext = {
      code: 'SAVE10',
      student_id: STUDENT_ID,
      plan_id: PLAN_ID,
      plan_billing_type: 'recurring',
      student_division_id: null,
      student_group_id: null,
      existing_promo_ids_on_subscription: [],
      server_now: NOW,
    }

    const result = await promocodeService.validatePromocode(pool as any, ctx, 100)

    expect(result.promocode.id).toBe(PROMO_ID)
    expect(result.discountPreview.discount_amount).toBe(10) // 10% of 100
    expect(result.discountPreview.final_price).toBe(90)
  })

  it('throws PromocodeError when code is not found', async () => {
    const _pool = makePool(async () => ({ rows: [], rowCount: 0 }))

    const ctx: PromocodeValidationContext = {
      code: 'NOTEXIST',
      student_id: STUDENT_ID,
      plan_id: PLAN_ID,
      plan_billing_type: 'recurring',
      student_division_id: null,
      student_group_id: null,
      existing_promo_ids_on_subscription: [],
      server_now: NOW,
    }

    const poolEmpty = makePool(async () => ({ rows: [], rowCount: 0 }))
    const err = await promocodeService
      .validatePromocode(poolEmpty as any, ctx, 100)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PromocodeError)
    expect((err as PromocodeError).code).toBe('PROMOCODE_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 6. applyPromocode — success path (inside caller-owned tx)
// ---------------------------------------------------------------------------

describe('PromocodeService.applyPromocode', () => {
  it('locks promo, counts usages, inserts usage record, returns discount', async () => {
    const row = makePromoRow()
    const usageRow = {
      id: USAGE_ID,
      promocode_id: PROMO_ID,
      student_id: STUDENT_ID,
      subscription_id: SUB_ID,
      discount_amount: '10.00',
      redeemed_at: NOW,
    }

    // applyPromocode takes a TransactionClient (has query + release, no connect)
    const txClient = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        const tx = ['BEGIN', 'COMMIT', 'ROLLBACK']
        if (tx.includes((sql ?? '').trim())) return { rows: [], rowCount: 0 }
        if (sql.includes('INSERT INTO promocode_usages')) return { rows: [usageRow], rowCount: 1 }
        if (sql.includes('FOR UPDATE')) return { rows: [row], rowCount: 1 } // lockPromocodeForUpdate
        if (sql.includes('COUNT(*)') || sql.includes('promocode_usages')) {
          return { rows: [{ count: '0' }], rowCount: 1 } // countTotalUsages + countUserUsages
        }
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(),
    }

    const ctx: PromocodeValidationContext = {
      code: 'SAVE10',
      student_id: STUDENT_ID,
      plan_id: PLAN_ID,
      plan_billing_type: 'recurring',
      student_division_id: null,
      student_group_id: null,
      existing_promo_ids_on_subscription: [],
      server_now: NOW,
      promocodeId: PROMO_ID,
    }

    const result = await promocodeService.applyPromocode(txClient as any, ctx, 100, SUB_ID)

    expect(result.discount.discount_amount).toBe(10)
    expect(result.discount.final_price).toBe(90)
    expect(result.usageRow.promocode_id).toBe(PROMO_ID)
  })
})

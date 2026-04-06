import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PromocodeError } from '../promocodes.errors'
import {
  countTotalUsages,
  countUserUsages,
  createPromocode,
  deactivatePromocode,
  getAnalyticsSummary,
  getSinglePromocodeAnalytics,
  getUsagesBySubscription,
  insertUsage,
  lockPromocodeForUpdate,
} from '../promocodes.repository'

describe('promocodes.repository additional tests', () => {
  let db: any

  beforeEach(() => {
    db = { query: vi.fn() }
  })

  it('createPromocode throws domain error on unique violation', async () => {
    db.query.mockRejectedValueOnce({ code: '23505' })
    await expect(
      createPromocode(db as any, { code: 'X', type: 'PERCENT' } as any)
    ).rejects.toBeInstanceOf(PromocodeError)
  })

  it('deactivatePromocode throws PROMOCODE_NOT_FOUND when missing and returns row when present', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await expect(deactivatePromocode(db as any, 'p1')).rejects.toBeInstanceOf(PromocodeError)

    const row = { id: 'p2', is_active: false }
    db.query.mockResolvedValueOnce({ rows: [row] })
    const r = await deactivatePromocode(db as any, 'p2')
    expect(r).toMatchObject(row)
  })

  it('lockPromocodeForUpdate and usage counters parse integers', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    expect(await lockPromocodeForUpdate(db as any, 'x')).toBeNull()

    db.query.mockResolvedValueOnce({ rows: [{ id: 'p3' }] })
    expect((await lockPromocodeForUpdate(db as any, 'x'))?.id).toBe('p3')

    db.query.mockResolvedValueOnce({ rows: [{ count: '4' }] })
    expect(await countTotalUsages(db as any, 'p')).toBe(4)

    db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] })
    expect(await countUserUsages(db as any, 'p', 's')).toBe(2)
  })

  it('insertUsage throws when insert fails', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await expect(
      insertUsage(
        db as any,
        { promocode_id: 'p', student_id: 's', subscription_id: 'sub', discount_amount: 5 } as any
      )
    ).rejects.toThrow()
  })

  it('getAnalyticsSummary parses aggregated rows and lists', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            total_codes: '3',
            active_codes: '1',
            expired_codes: '1',
            total_redemptions: '5',
            revenue_impact: '12.5',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ type: 'PERCENT', count: '2', total_usages: '3' }] })
      .mockResolvedValueOnce({
        rows: [{ code: 'CODE1', total_usages: '3', revenue_impact: '9.0' }],
      })

    const res = await getAnalyticsSummary(db as any)
    expect(res.total_codes).toBe(3)
    expect(res.by_type[0].type).toBe('PERCENT')
    expect(res.top_codes[0].code).toBe('CODE1')
  })

  it('getSinglePromocodeAnalytics returns zeros when empty and parses values when present', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    expect(await getSinglePromocodeAnalytics(db as any, 'p')).toEqual({
      total_usages: 0,
      total_discount_amount: 0,
      unique_students: 0,
    })

    db.query.mockResolvedValueOnce({
      rows: [{ total_usages: '5', total_discount_amount: '2.5', unique_students: '4' }],
    })
    const r = await getSinglePromocodeAnalytics(db as any, 'p')
    expect(r.total_usages).toBe(5)
    expect(r.total_discount_amount).toBeCloseTo(2.5)
  })

  it('getUsagesBySubscription returns rows', async () => {
    const rows = [{ id: 'u1' }]
    db.query.mockResolvedValueOnce({ rows })
    expect(await getUsagesBySubscription(db as any, 'sub')).toEqual(rows)
  })
})

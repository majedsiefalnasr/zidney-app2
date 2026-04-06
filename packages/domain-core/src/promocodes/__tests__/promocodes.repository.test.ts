import { describe, expect, it, vi } from 'vitest'
import { PromocodeError } from '../promocodes.errors'
import * as repo from '../promocodes.repository'

describe('promocodes.repository (unit)', () => {
  it('createPromocode returns created row on success', async () => {
    const fakeRow = {
      id: 'p1',
      code: 'ABC',
      type: 'AMOUNT',
      value: 100,
      free_trial_days: null,
      valid_from: new Date().toISOString(),
      valid_until: new Date().toISOString(),
      usage_limit: null,
      per_user_limit: 1,
      applies_to_plan_ids: '[]',
      target_division_ids: null,
      target_group_ids: null,
      is_stackable: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const db: any = { query: vi.fn().mockResolvedValueOnce({ rows: [fakeRow] }) }

    const out = await repo.createPromocode(db, {
      code: 'ABC',
      type: 'AMOUNT',
      valid_from: new Date().toISOString(),
      valid_until: new Date().toISOString(),
    } as any)
    expect(out).toEqual(fakeRow)
    expect(db.query).toHaveBeenCalled()
  })

  it('createPromocode throws PromocodeError on unique violation', async () => {
    const db: any = {
      query: vi.fn().mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' })),
    }
    await expect(repo.createPromocode(db, { code: 'X' } as any)).rejects.toBeInstanceOf(
      PromocodeError
    )
  })

  it('deactivatePromocode returns row when present', async () => {
    const fakeRow = { id: 'p2', code: 'DEF' }
    const db: any = { query: vi.fn().mockResolvedValueOnce({ rows: [fakeRow] }) }
    const out = await repo.deactivatePromocode(db, 'p2')
    expect(out).toEqual(fakeRow)
  })

  it('deactivatePromocode throws PROMOCODE_NOT_FOUND when no row', async () => {
    const db: any = { query: vi.fn().mockResolvedValueOnce({ rows: [] }) }
    await expect(repo.deactivatePromocode(db, 'missing')).rejects.toBeInstanceOf(PromocodeError)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  countActiveSubscriptionsByPlanId,
  findPlanById,
  insertPlan,
  listPlans,
  softDeletePlan,
  updatePlan,
} from '../plans.repository'

describe('plans.repository', () => {
  let db: any

  beforeEach(() => {
    db = { query: vi.fn() }
  })

  it('findPlanById returns null when missing and maps when present', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    expect(await findPlanById(db, 'ws-1', 'p1')).toBeNull()

    const row = {
      id: 'p1',
      workspace_id: 'ws-1',
      name: 'P',
      description: null,
      price: '9.99',
      billing_type: 'one_time',
      duration_days: 30,
      enabled_modules: '[]',
      is_active: true,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.query.mockResolvedValueOnce({ rows: [row] })
    const r = await findPlanById(db, 'ws-1', 'p1')
    expect(r?.price).toBeCloseTo(9.99)
  })

  it('listPlans supports is_active filter and returns items+total', async () => {
    const itemRow = {
      id: 'p2',
      workspace_id: 'ws-1',
      name: 'P2',
      description: null,
      price: '5.00',
      billing_type: 'recurring',
      duration_days: 30,
      enabled_modules: '[]',
      is_active: true,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // first call for items, second for count
    db.query.mockResolvedValueOnce({ rows: [itemRow] })
    db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] })

    const res = await listPlans(db, 'ws-1', { page: 1, limit: 10, is_active: true })
    expect(res.items[0].price).toBeCloseTo(5.0)
    expect(res.total).toBe(1)
  })

  it('countActiveSubscriptionsByPlanId parses integer', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: '7' }] })
    expect(await countActiveSubscriptionsByPlanId(db, 'plan-1')).toBe(7)
  })

  it('insertPlan throws when no row returned and returns mapped row on success', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await expect(
      insertPlan(db, {
        workspace_id: 'ws',
        name: 'X',
        price: 1,
        billing_type: 'one_time',
        duration_days: 1,
      })
    ).rejects.toThrow()

    const row = {
      id: 'p3',
      workspace_id: 'ws',
      name: 'X',
      description: null,
      price: '1.00',
      billing_type: 'one_time',
      duration_days: 1,
      enabled_modules: '[]',
      is_active: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.query.mockResolvedValueOnce({ rows: [row] })
    const r = await insertPlan(db, {
      workspace_id: 'ws',
      name: 'X',
      price: 1,
      billing_type: 'one_time',
      duration_days: 1,
    })
    expect(r.id).toBe('p3')
  })

  it('updatePlan returns null when no fields provided and updates when present', async () => {
    expect(await updatePlan(db, 'ws', 'p', {})).toBeNull()

    const row = {
      id: 'p4',
      workspace_id: 'ws',
      name: 'Updated',
      description: null,
      price: '2.00',
      billing_type: 'one_time',
      duration_days: 10,
      enabled_modules: '[]',
      is_active: true,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.query.mockResolvedValueOnce({ rows: [row] })
    const r = await updatePlan(db, 'ws', 'p', { name: 'Updated' })
    expect(r?.name).toBe('Updated')
  })

  it('softDeletePlan returns boolean based on rowCount', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1 })
    expect(await softDeletePlan(db, 'ws', 'p')).toBe(true)
    db.query.mockResolvedValueOnce({ rowCount: 0 })
    expect(await softDeletePlan(db, 'ws', 'p')).toBe(false)
  })
})

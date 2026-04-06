import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendAuditLog,
  createInvoice,
  generateInvoiceNumberSequence,
  getInvoiceById,
  getInvoiceByIdempotencyKey,
  listInvoices,
  setActivationDate,
  transitionInvoiceStatus,
  updateInvoiceProof,
} from '../billing.repository'

describe('billing.repository', () => {
  let db: any

  beforeEach(() => {
    db = { query: vi.fn() }
  })

  it('getInvoiceById and getInvoiceByIdempotencyKey return null when missing', async () => {
    db.query.mockResolvedValue({ rows: [] })
    expect(await getInvoiceById(db, 'i1')).toBeNull()
    expect(await getInvoiceByIdempotencyKey(db, 'key1')).toBeNull()
  })

  it('listInvoices returns items and total with filters', async () => {
    const item = { id: 'i1', invoice_number: 'INV-1' }
    // first call -> items, second -> count
    db.query
      .mockResolvedValueOnce({ rows: [item] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })

    const res = await listInvoices(db, {
      page: 1,
      limit: 10,
      subscriber_id: 's1',
      status: 'PAID' as any,
    })
    expect(res.total).toBe(1)
    expect(res.items[0]).toMatchObject({ id: 'i1' })
  })

  it('createInvoice throws when no row returned and returns row on success', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await expect(
      createInvoice(
        db as any,
        {
          invoice_number: 'n',
          subscriber_id: 's',
          subscription_plan_id: 'p',
          billing_period_start: new Date(),
          billing_period_end: new Date(),
          amount: 10,
        } as any
      )
    ).rejects.toThrow()

    const row = { id: 'i2', invoice_number: 'INV-2' }
    db.query.mockResolvedValueOnce({ rows: [row] })
    const r = await createInvoice(
      db as any,
      {
        invoice_number: 'n',
        subscriber_id: 's',
        subscription_plan_id: 'p',
        billing_period_start: new Date(),
        billing_period_end: new Date(),
        amount: 10,
      } as any
    )
    expect(r).toMatchObject({ id: 'i2' })
  })

  it('transitionInvoiceStatus returns null when CAS fails and row when succeeds', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    expect(await transitionInvoiceStatus(db as any, 'i', 'NEW' as any, 'PAID' as any)).toBeNull()

    const updated = { id: 'i3', status: 'PAID' }
    db.query.mockResolvedValueOnce({ rows: [updated] })
    const r = await transitionInvoiceStatus(db as any, 'i', 'NEW' as any, 'PAID' as any)
    expect(r).toMatchObject(updated)
  })

  it('updateInvoiceProof and setActivationDate call db.query with correct params', async () => {
    db.query.mockResolvedValue({})
    await updateInvoiceProof(db as any, 'i4', 'proof-1')
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE invoices'), [
      'proof-1',
      'i4',
    ])

    await setActivationDate(db as any, 'i4')
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SET activation_date'), ['i4'])
  })

  it('appendAuditLog throws when no row and returns row when present', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await expect(appendAuditLog(db as any, { invoice_id: 'i' } as any)).rejects.toThrow()

    const auditRow = { id: 'a1', invoice_id: 'i' }
    db.query.mockResolvedValueOnce({ rows: [auditRow] })
    const r = await appendAuditLog(db as any, { invoice_id: 'i', event: 'e' } as any)
    expect(r).toMatchObject({ id: 'a1' })
  })

  it('generateInvoiceNumberSequence returns next padded sequence', async () => {
    // simulate 2 existing invoices
    db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] })
    const s = await generateInvoiceNumberSequence(db as any)
    const now = new Date()
    const prefix = `INV-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    expect(s.startsWith(prefix)).toBe(true)
    expect(s.endsWith('-0003')).toBe(true)
  })
})

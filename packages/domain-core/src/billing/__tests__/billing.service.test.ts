/**
 * Billing Domain — Unit Tests
 *
 * File: packages/domain-core/src/billing/__tests__/billing.service.test.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Tests for:
 *   - createInvoiceForSubscription: success, idempotent repeat
 *   - cancelInvoice: success, INVOICE_NOT_FOUND, INVOICE_ALREADY_PAID,
 *                    INVOICE_ALREADY_CANCELLED
 *   - uploadInvoiceProof: success, INVOICE_NOT_FOUND, INVOICE_CANNOT_CONFIRM
 *   - verifyManualPayment: success, INVOICE_NOT_FOUND, PROOF_REQUIRED,
 *                          INVOICE_CANNOT_CONFIRM (non-PENDING)
 *   - getInvoiceByIdService: success, INVOICE_NOT_FOUND
 *   - listInvoicesService: returns paginated result
 */

import { describe, expect, it, vi } from 'vitest'

import { BillingError } from '../billing.errors'
import {
  cancelInvoice,
  confirmGatewayPayment,
  createInvoiceForSubscription,
  getInvoiceByIdService,
  listInvoicesService,
  uploadInvoiceProof,
  verifyManualPayment,
} from '../billing.service'
import type { AuditContext, CreateInvoiceInput, InvoiceRecord } from '../billing.types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'
const PLAN_ID = 'pl-00000000-0000-0000-0000-000000000001'
const SUBSCRIBER_ID = 'st-00000000-0000-0000-0000-000000000001'
const INVOICE_ID = 'inv-0000-0000-0000-000000000001'
const PROOF_FILE_ID = 'file-00000000-0000-0000-0000-000000000001'
const IDEMPOTENCY_KEY = 'idem-key-001'
const NOW = new Date('2026-05-01T10:00:00Z')
const FUTURE = new Date('2026-06-01T10:00:00Z')

const audit: AuditContext = {
  user_id: 'staff-user-001',
  workspace_id: WORKSPACE_ID,
  workspace_slug: 'test-ws',
  correlation_id: 'corr-test-001',
}

const systemAudit: AuditContext = {
  user_id: null,
  workspace_id: WORKSPACE_ID,
  workspace_slug: 'test-ws',
  correlation_id: 'corr-gateway-001',
}

function makeInvoiceRecord(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: INVOICE_ID,
    invoice_number: 'INV-2026-05-0001',
    subscriber_id: SUBSCRIBER_ID,
    subscription_plan_id: PLAN_ID,
    billing_period_start: NOW,
    billing_period_end: FUTURE,
    amount: '99.00',
    currency: 'SAR',
    payment_method: 'MANUAL',
    payment_reference: null,
    proof_file_id: null,
    status: 'PENDING',
    activation_date: null,
    idempotency_key: IDEMPOTENCY_KEY,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

const createInput: CreateInvoiceInput = {
  subscriber_id: SUBSCRIBER_ID,
  subscription_plan_id: PLAN_ID,
  billing_period_start: NOW,
  billing_period_end: FUTURE,
  amount: '99.00',
  currency: 'SAR',
  payment_method: 'MANUAL',
  idempotency_key: IDEMPOTENCY_KEY,
}

// ---------------------------------------------------------------------------
// Pool / client mock factory
// ---------------------------------------------------------------------------

type QueryMatcher = (
  sql: string,
  params?: unknown[]
) => { rows: unknown[]; rowCount: number | null }

/**
 * Creates a mock pool that routes all SQL through a single matcher function.
 * Transaction control commands (BEGIN/COMMIT/ROLLBACK) are short-circuited
 * to return empty rows without hitting the matcher.
 */
function makePool(matcher: QueryMatcher) {
  const txCmds = new Set(['BEGIN', 'BEGIN ISOLATION LEVEL SERIALIZABLE', 'COMMIT', 'ROLLBACK'])

  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (txCmds.has(sql.trim())) return { rows: [], rowCount: 0 }
      return matcher(sql, params)
    }),
    release: vi.fn(),
  }

  const pool = {
    connect: vi.fn(async () => client),
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (txCmds.has(sql.trim())) return { rows: [], rowCount: 0 }
      return matcher(sql, params)
    }),
    _client: client,
  }

  return pool
}

// ---------------------------------------------------------------------------
// 1. createInvoiceForSubscription
// ---------------------------------------------------------------------------

describe('createInvoiceForSubscription', () => {
  it('creates a new invoice when no prior idempotency match exists', async () => {
    const invoice = makeInvoiceRecord()

    const pool = makePool((sql) => {
      // idempotency check — no existing invoice
      if (sql.includes('FROM invoices') && sql.includes('idempotency_key'))
        return { rows: [], rowCount: 0 }
      // generateInvoiceNumberSequence
      if (sql.includes('invoice_number LIKE')) return { rows: [{ count: '0' }], rowCount: 1 }
      // createInvoice INSERT
      if (sql.includes('INSERT INTO invoices')) return { rows: [invoice], rowCount: 1 }
      // appendAuditLog
      if (sql.includes('billing_audit_logs')) return { rows: [{ id: 'audit-001' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createInvoiceForSubscription(pool as any, createInput, audit)
    expect(result.id).toBe(INVOICE_ID)
    expect(result.status).toBe('PENDING')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('returns existing invoice on duplicate idempotency key (idempotent repeat)', async () => {
    const existing = makeInvoiceRecord({ invoice_number: 'INV-2026-05-0001' })

    const pool = makePool((sql) => {
      // idempotency check returns existing
      if (sql.includes('FROM invoices') && sql.includes('idempotency_key'))
        return { rows: [existing], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createInvoiceForSubscription(pool as any, createInput, audit)
    expect(result.id).toBe(existing.id)
    expect(pool._client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO invoices'),
      expect.anything()
    )
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 2. cancelInvoice
// ---------------------------------------------------------------------------

describe('cancelInvoice', () => {
  it('transitions PENDING→CANCELLED and returns the updated invoice', async () => {
    const pending = makeInvoiceRecord({ status: 'PENDING' })
    const cancelled = makeInvoiceRecord({ status: 'CANCELLED' })

    let invoiceFetchCount = 0
    const pool = makePool((sql) => {
      // getInvoiceById — first call returns PENDING (within tx), second returns CANCELLED (pool)
      if (sql.includes('FROM invoices') && !sql.includes('UPDATE') && !sql.includes('SET')) {
        invoiceFetchCount++
        return { rows: [invoiceFetchCount === 1 ? pending : cancelled], rowCount: 1 }
      }
      // transitionInvoiceStatus UPDATE
      if (sql.includes('UPDATE invoices') && sql.includes('SET status'))
        return { rows: [cancelled], rowCount: 1 }
      // appendAuditLog
      if (sql.includes('billing_audit_logs')) return { rows: [{ id: 'audit-001' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await cancelInvoice(pool as any, INVOICE_ID, 'Customer request', audit)
    expect(result.id).toBe(INVOICE_ID)
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws INVOICE_NOT_FOUND when invoice does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await cancelInvoice(pool as any, INVOICE_ID, 'reason', audit).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_NOT_FOUND')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws INVOICE_ALREADY_PAID when invoice is PAID', async () => {
    const paid = makeInvoiceRecord({ status: 'PAID' })
    const pool = makePool(() => ({ rows: [paid], rowCount: 1 }))

    const err = await cancelInvoice(pool as any, INVOICE_ID, 'reason', audit).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_ALREADY_PAID')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws INVOICE_ALREADY_CANCELLED when invoice is already CANCELLED', async () => {
    const already = makeInvoiceRecord({ status: 'CANCELLED' })
    const pool = makePool(() => ({ rows: [already], rowCount: 1 }))

    const err = await cancelInvoice(pool as any, INVOICE_ID, 'reason', audit).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_ALREADY_CANCELLED')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 3. uploadInvoiceProof
// ---------------------------------------------------------------------------

describe('uploadInvoiceProof', () => {
  it('sets proof_file_id on a PENDING invoice and returns updated record', async () => {
    const pending = makeInvoiceRecord({ status: 'PENDING' })
    const withProof = makeInvoiceRecord({ status: 'PENDING', proof_file_id: PROOF_FILE_ID })

    let fetchCount = 0
    const pool = makePool((sql) => {
      if (sql.includes('FROM invoices') && !sql.includes('SET')) {
        fetchCount++
        return { rows: [fetchCount === 1 ? pending : withProof], rowCount: 1 }
      }
      // updateInvoiceProof — UPDATE invoices SET proof_file_id
      if (sql.includes('SET proof_file_id')) return { rows: [], rowCount: 1 }
      // appendAuditLog
      if (sql.includes('billing_audit_logs')) return { rows: [{ id: 'audit-001' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await uploadInvoiceProof(pool as any, INVOICE_ID, PROOF_FILE_ID, audit)
    expect(result.id).toBe(INVOICE_ID)
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws INVOICE_NOT_FOUND when invoice does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await uploadInvoiceProof(pool as any, INVOICE_ID, PROOF_FILE_ID, audit).catch(
      (e) => e
    )
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_NOT_FOUND')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws INVOICE_CANNOT_CONFIRM when invoice is not PENDING', async () => {
    const paid = makeInvoiceRecord({ status: 'PAID' })
    const pool = makePool(() => ({ rows: [paid], rowCount: 1 }))

    const err = await uploadInvoiceProof(pool as any, INVOICE_ID, PROOF_FILE_ID, audit).catch(
      (e) => e
    )
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_CANNOT_CONFIRM')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 4. verifyManualPayment
// ---------------------------------------------------------------------------

describe('verifyManualPayment', () => {
  it('approves a PENDING invoice that already has proof_file_id set', async () => {
    const lockRow = {
      id: INVOICE_ID,
      status: 'PENDING',
      subscriber_id: SUBSCRIBER_ID,
      subscription_plan_id: PLAN_ID,
      proof_file_id: PROOF_FILE_ID,
    }
    const paid = makeInvoiceRecord({ status: 'PAID', proof_file_id: PROOF_FILE_ID })

    const pool = makePool((sql) => {
      // FOR UPDATE lock on invoice
      if (sql.includes('FROM invoices') && sql.includes('FOR UPDATE'))
        return { rows: [lockRow], rowCount: 1 }
      // transitionInvoiceStatus UPDATE
      if (sql.includes('UPDATE invoices') && sql.includes('SET status'))
        return { rows: [paid], rowCount: 1 }
      // appendAuditLog
      if (sql.includes('billing_audit_logs')) return { rows: [{ id: 'audit-001' }], rowCount: 1 }
      // activateSubscriptionFromInvoice — plan lock
      if (sql.includes('FROM plans') && sql.includes('FOR SHARE'))
        return {
          rows: [{ id: PLAN_ID, duration_days: 30, is_active: true, workspace_id: WORKSPACE_ID }],
          rowCount: 1,
        }
      // findActiveSubscriptionByStudent — no existing active sub
      if (sql.includes('FROM subscriptions')) return { rows: [], rowCount: 0 }
      // insertSubscription
      if (sql.includes('INSERT INTO subscriptions'))
        return {
          rows: [
            {
              id: 'sub-001',
              student_id: SUBSCRIBER_ID,
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
            },
          ],
          rowCount: 1,
        }
      // syncStudentSubscriptionStatus
      if (sql.includes('UPDATE students')) return { rows: [], rowCount: 1 }
      // setActivationDate — match UPDATE only (not the SELECT column list which also mentions activation_date)
      if (sql.includes('SET activation_date')) return { rows: [], rowCount: 1 }
      // Final getInvoiceById on pool (after COMMIT)
      if (sql.includes('FROM invoices')) return { rows: [paid], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await verifyManualPayment(pool as any, INVOICE_ID, audit)
    expect(result.id).toBe(INVOICE_ID)
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws INVOICE_NOT_FOUND when invoice row does not exist', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const err = await verifyManualPayment(pool as any, INVOICE_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_NOT_FOUND')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws PROOF_REQUIRED when proof_file_id has not been uploaded', async () => {
    const lockRow = {
      id: INVOICE_ID,
      status: 'PENDING',
      subscriber_id: SUBSCRIBER_ID,
      subscription_plan_id: PLAN_ID,
      proof_file_id: null, // no proof yet
    }
    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [lockRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const err = await verifyManualPayment(pool as any, INVOICE_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('PROOF_REQUIRED')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('throws INVOICE_CANNOT_CONFIRM when invoice is not PENDING', async () => {
    const lockRow = {
      id: INVOICE_ID,
      status: 'PAID',
      subscriber_id: SUBSCRIBER_ID,
      subscription_plan_id: PLAN_ID,
      proof_file_id: PROOF_FILE_ID,
    }
    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [lockRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const err = await verifyManualPayment(pool as any, INVOICE_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_CANNOT_CONFIRM')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 5. getInvoiceByIdService
// ---------------------------------------------------------------------------

describe('getInvoiceByIdService', () => {
  it('returns invoice when it exists', async () => {
    const invoice = makeInvoiceRecord()
    const pool = makePool(() => ({ rows: [invoice], rowCount: 1 }))

    const result = await getInvoiceByIdService(pool as any, INVOICE_ID)
    expect(result.id).toBe(INVOICE_ID)
  })

  it('throws INVOICE_NOT_FOUND when invoice does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await getInvoiceByIdService(pool as any, INVOICE_ID).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 6. listInvoicesService
// ---------------------------------------------------------------------------

describe('listInvoicesService', () => {
  it('returns paginated list of invoices', async () => {
    const invoice = makeInvoiceRecord()

    const pool = makePool((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '3' }], rowCount: 1 }
      if (sql.includes('FROM invoices')) return { rows: [invoice], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listInvoicesService(pool as any, { page: 1, limit: 10 }, systemAudit)
    expect(result.total).toBe(3)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe(INVOICE_ID)
  })

  it('returns empty list when no invoices exist', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '0' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listInvoicesService(pool as any, { page: 1, limit: 10 }, systemAudit)
    expect(result.total).toBe(0)
    expect(result.items).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 7. confirmGatewayPayment
// ---------------------------------------------------------------------------

describe('confirmGatewayPayment', () => {
  it('transitions PENDING→PAID and activates subscription', async () => {
    const lockRow = {
      id: INVOICE_ID,
      status: 'PENDING',
      subscriber_id: SUBSCRIBER_ID,
      subscription_plan_id: PLAN_ID,
    }
    const paid = makeInvoiceRecord({ status: 'PAID', payment_reference: 'pay_ref_001' })

    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [lockRow], rowCount: 1 }
      if (sql.includes('UPDATE invoices') && sql.includes('SET status'))
        return { rows: [paid], rowCount: 1 }
      if (sql.includes('billing_audit_logs')) return { rows: [{ id: 'audit-001' }], rowCount: 1 }
      if (sql.includes('FROM plans') && sql.includes('FOR SHARE'))
        return {
          rows: [{ id: PLAN_ID, duration_days: 30, is_active: true, workspace_id: WORKSPACE_ID }],
          rowCount: 1,
        }
      if (sql.includes('FROM subscriptions')) return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO subscriptions'))
        return {
          rows: [
            {
              id: 'sub-001',
              student_id: SUBSCRIBER_ID,
              plan_id: PLAN_ID,
              status: 'ACTIVE',
              started_at: NOW,
              expires_at: FUTURE,
              auto_renew: false,
              payment_method: 'GATEWAY',
              gateway_ref: null,
              notes: null,
              created_at: NOW,
              updated_at: NOW,
            },
          ],
          rowCount: 1,
        }
      if (sql.includes('UPDATE students')) return { rows: [], rowCount: 1 }
      if (sql.includes('SET activation_date')) return { rows: [], rowCount: 1 }
      if (sql.includes('FROM invoices')) return { rows: [paid], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await confirmGatewayPayment(
      pool as any,
      { invoice_id: INVOICE_ID, payment_reference: 'pay_ref_001' },
      audit
    )
    expect(result.id).toBe(INVOICE_ID)
    expect(result.status).toBe('PAID')
    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('returns existing invoice when already PAID (idempotent)', async () => {
    const lockRow = {
      id: INVOICE_ID,
      status: 'PAID',
      subscriber_id: SUBSCRIBER_ID,
      subscription_plan_id: PLAN_ID,
    }
    const paid = makeInvoiceRecord({ status: 'PAID', payment_reference: 'pay_ref_001' })

    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [lockRow], rowCount: 1 }
      if (sql.includes('FROM invoices') && !sql.includes('FOR UPDATE'))
        return { rows: [paid], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await confirmGatewayPayment(
      pool as any,
      { invoice_id: INVOICE_ID, payment_reference: 'pay_ref_001' },
      audit
    )
    expect(result.id).toBe(INVOICE_ID)
    expect(result.status).toBe('PAID')
  })

  it('throws INVOICE_NOT_FOUND when invoice does not exist', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const err = await confirmGatewayPayment(
      pool as any,
      { invoice_id: INVOICE_ID, payment_reference: 'pay_ref_001' },
      audit
    ).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_NOT_FOUND')
  })

  it('throws INVOICE_CANNOT_CONFIRM when invoice is not PENDING', async () => {
    const lockRow = {
      id: INVOICE_ID,
      status: 'CANCELLED',
      subscriber_id: SUBSCRIBER_ID,
      subscription_plan_id: PLAN_ID,
    }
    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [lockRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const err = await confirmGatewayPayment(
      pool as any,
      { invoice_id: INVOICE_ID, payment_reference: 'pay_ref_001' },
      audit
    ).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('INVOICE_CANNOT_CONFIRM')
  })

  it('throws SUBSCRIPTION_ACTIVATION_FAILED when plan is inactive', async () => {
    const lockRow = {
      id: INVOICE_ID,
      status: 'PENDING',
      subscriber_id: SUBSCRIBER_ID,
      subscription_plan_id: PLAN_ID,
    }

    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [lockRow], rowCount: 1 }
      if (sql.includes('UPDATE invoices') && sql.includes('SET status'))
        return { rows: [], rowCount: 1 }
      if (sql.includes('billing_audit_logs')) return { rows: [{ id: 'audit-001' }], rowCount: 1 }
      if (sql.includes('FROM plans') && sql.includes('FOR SHARE'))
        return {
          rows: [{ id: PLAN_ID, duration_days: 30, is_active: false, workspace_id: WORKSPACE_ID }],
          rowCount: 1,
        }
      return { rows: [], rowCount: 0 }
    })

    const err = await confirmGatewayPayment(
      pool as any,
      { invoice_id: INVOICE_ID, payment_reference: 'pay_ref_001' },
      audit
    ).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect((err as BillingError).code).toBe('SUBSCRIPTION_ACTIVATION_FAILED')
  })

  it('expires existing subscription and creates new one on verifyManualPayment', async () => {
    const lockRow = {
      id: INVOICE_ID,
      status: 'PENDING',
      subscriber_id: SUBSCRIBER_ID,
      subscription_plan_id: PLAN_ID,
      proof_file_id: PROOF_FILE_ID,
    }
    const paid = makeInvoiceRecord({ status: 'PAID', proof_file_id: PROOF_FILE_ID })
    const activeSub = {
      id: 'sub-active-001',
      student_id: SUBSCRIBER_ID,
      plan_id: PLAN_ID,
      status: 'ACTIVE',
      started_at: NOW,
      expires_at: FUTURE,
    }

    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [lockRow], rowCount: 1 }
      if (sql.includes('UPDATE invoices') && sql.includes('SET status'))
        return { rows: [paid], rowCount: 1 }
      if (sql.includes('billing_audit_logs')) return { rows: [{ id: 'audit-001' }], rowCount: 1 }
      if (sql.includes('FROM plans') && sql.includes('FOR SHARE'))
        return {
          rows: [{ id: PLAN_ID, duration_days: 30, is_active: true, workspace_id: WORKSPACE_ID }],
          rowCount: 1,
        }
      if (sql.includes('FROM subscriptions') && sql.includes('FOR UPDATE'))
        return { rows: [activeSub], rowCount: 1 }
      if (sql.includes('UPDATE subscriptions') && sql.includes('SET status'))
        return { rows: [], rowCount: 1 }
      if (sql.includes('INSERT INTO subscriptions'))
        return {
          rows: [
            {
              id: 'sub-001',
              student_id: SUBSCRIBER_ID,
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
            },
          ],
          rowCount: 1,
        }
      if (sql.includes('UPDATE students')) return { rows: [], rowCount: 1 }
      if (sql.includes('SET activation_date')) return { rows: [], rowCount: 1 }
      if (sql.includes('FROM invoices')) return { rows: [paid], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await verifyManualPayment(pool as any, INVOICE_ID, audit)
    expect(result.id).toBe(INVOICE_ID)
    expect(result.status).toBe('PAID')
  })
})

/**
 * Billing & Invoices Routes — Integration Tests
 *
 * File: tests/integration/backoffice/billing.routes.test.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Tests the full HTTP layer through the Hono invoicesRouter.
 * Domain service functions are vi.mock()ed — focus is on:
 *   ✓ HTTP method, path, and status code mapping
 *   ✓ Request body validation (422 on bad input)
 *   ✓ Service delegation (correct service function called with correct args)
 *   ✓ Response envelope shape { success, data, error }
 *   ✓ Error → HTTP status mapping (404, 409, 422, 500)
 *   ✓ Permission guard blocks (403) when RBAC returns false
 *   ✓ Two-step approval: proof required before approve
 *   ✓ Tenant isolation: pool extracted from tenant context
 */

import type { InvoiceRow } from '@zidney/domain-core/billing'
import * as billingService from '@zidney/domain-core/billing'
import { BillingError } from '@zidney/domain-core/billing'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoicesRouter } from '../../../apps/api/src/routes/backoffice/invoices/index'
import type { BackofficeEnv } from '../../../apps/api/src/routes/backoffice/types'

// ---------------------------------------------------------------------------
// Mock domain service layer
// ---------------------------------------------------------------------------

vi.mock('@zidney/domain-core/billing', async (importOriginal) => {
  const actual = await importOriginal<typeof billingService>()
  return {
    ...actual,
    createInvoiceForSubscription: vi.fn(),
    cancelInvoice: vi.fn(),
    uploadInvoiceProof: vi.fn(),
    verifyManualPayment: vi.fn(),
    getInvoiceByIdService: vi.fn(),
    listInvoicesService: vi.fn(),
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const INVOICE_ID = '11111111-1111-1111-1111-111111111111'
const SUBSCRIBER_ID = '22222222-2222-2222-2222-222222222222'
const PLAN_ID = '33333333-3333-3333-3333-333333333333'
const USER_ID = 'user-staff-001'
const ROLE_ID = '44444444-4444-4444-4444-444444444444'
const NOW = new Date('2026-05-01T10:00:00Z')
const FUTURE = new Date('2026-06-01T10:00:00Z')

const invoiceRecord = {
  id: INVOICE_ID,
  invoice_number: 'INV-2026-05-0001',
  subscriber_id: SUBSCRIBER_ID,
  subscription_plan_id: PLAN_ID,
  billing_period_start: NOW,
  billing_period_end: FUTURE,
  amount: '99.00',
  currency: 'SAR',
  payment_method: 'MANUAL' as const,
  payment_reference: null,
  proof_file_id: null,
  status: 'PENDING' as const,
  activation_date: null,
  idempotency_key: null,
  created_at: NOW,
  updated_at: NOW,
} satisfies InvoiceRow

// ---------------------------------------------------------------------------
// Mock pool factory
// ---------------------------------------------------------------------------

/**
 * Builds a mock pool that passes RBAC permission guard.
 * All DB queries from the permission middleware are handled here;
 * service calls are handled by vi.mock above.
 */
function buildPassingPool() {
  return {
    connect: vi.fn(async () => ({
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      release: vi.fn(),
    })),
    query: vi.fn(async (sql: string) => {
      const s = sql.trim()

      // backoffice_staff_users check (guard step 2)
      if (s.includes('backoffice_staff_users'))
        return { rows: [{ id: USER_ID, is_active: true, role_id: ROLE_ID }], rowCount: 1 }

      // backoffice_roles check (guard step 5)
      if (s.includes('backoffice_roles'))
        return { rows: [{ id: ROLE_ID, status: 'ACTIVE' }], rowCount: 1 }

      // permission check (guard step 7 — grant all)
      if (s.includes('backoffice_role_module_permissions'))
        return {
          rows: [{ can_view: true, can_create: true, can_edit: true, can_delete: true }],
          rowCount: 1,
        }

      return { rows: [], rowCount: 0 }
    }),
  }
}

/**
 * Creates a Hono test app with invoicesRouter mounted under the
 * standard backoffice workspace path. Context variables are injected
 * via a global middleware before the router.
 */
function buildApp(overrides: { noRole?: boolean } = {}) {
  const app = new Hono<BackofficeEnv>()

  app.use('*', async (c, next) => {
    const pool = overrides.noRole
      ? {
          connect: vi.fn(async () => ({
            query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
            release: vi.fn(),
          })),
          query: vi.fn(async (sql: string) => {
            const s = sql.trim()
            if (s.includes('backoffice_staff_users')) return { rows: [], rowCount: 0 } // not found → 403
            return { rows: [], rowCount: 0 }
          }),
        }
      : buildPassingPool()

    ;(c as any).set('tenant', {
      id: TENANT_ID,
      slug: 'test-ws',
      schema_version: '1.4.0',
      pool,
      redis: {
        get: vi.fn(async () => null),
        set: vi.fn(async () => 'OK'),
        del: vi.fn(async () => 1),
        scan: vi.fn(async () => ['0', []]),
      },
    })

    // Auth context consumed by buildAuditCtx (helpers.ts)
    ;(c as any).set('user', { id: USER_ID })
    ;(c as any).set('workspace_id', TENANT_ID)
    ;(c as any).set('workspace_slug', 'test-ws')
    ;(c as any).set('correlation_id', 'corr-test-001')

    // Auth context consumed by createPermissionGuard
    ;(c as any).set('authPayload', { user_id: USER_ID })
    ;(c as any).set('correlationId', 'corr-test-001')

    await next()
  })

  app.route('/api/v1/backoffice/workspace', invoicesRouter)
  return app
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// GET /invoices — list
// ---------------------------------------------------------------------------

describe('GET /api/v1/backoffice/workspace/invoices', () => {
  it('returns 200 with paginated invoice list', async () => {
    const mockList = vi.mocked(billingService.listInvoicesService)
    mockList.mockResolvedValueOnce({ items: [invoiceRecord], total: 1, page: 1, limit: 10 })

    const app = buildApp()
    const res = await app.request('/api/v1/backoffice/workspace/invoices', { method: 'GET' })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].id).toBe(INVOICE_ID)
    expect(mockList).toHaveBeenCalledOnce()
    // Verify workspace-scoped DB context and pagination params passed correctly
    const callArgs = mockList.mock.calls[0]!
    expect(callArgs).toBeDefined()
    expect(callArgs[0]).toHaveProperty('query') // DB pool client
    expect(callArgs[1]).toMatchObject({ page: expect.any(Number), limit: expect.any(Number) }) // Pagination query
  })

  it('returns 403 when user lacks permission', async () => {
    const app = buildApp({ noRole: true })
    const res = await app.request('/api/v1/backoffice/workspace/invoices', { method: 'GET' })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// POST /invoices — create
// ---------------------------------------------------------------------------

describe('POST /api/v1/backoffice/workspace/invoices', () => {
  const validBody = {
    subscriber_id: SUBSCRIBER_ID,
    subscription_plan_id: PLAN_ID,
    billing_period_start: NOW.toISOString(),
    billing_period_end: FUTURE.toISOString(),
    amount: '99.00',
    currency: 'SAR',
    payment_method: 'MANUAL',
  }

  it('returns 201 with created invoice', async () => {
    const mockCreate = vi.mocked(billingService.createInvoiceForSubscription)
    mockCreate.mockResolvedValueOnce(invoiceRecord)

    const app = buildApp()
    const res = await app.request('/api/v1/backoffice/workspace/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(INVOICE_ID)
    expect(mockCreate).toHaveBeenCalledOnce()
    // Verify workspace-scoped DB, audit context, and invoice data passed correctly
    const callArgs = mockCreate.mock.calls[0]!
    expect(callArgs).toBeDefined()
    expect(callArgs[0]).toHaveProperty('query') // DB pool client
    expect(callArgs[1]).toMatchObject({
      subscriber_id: SUBSCRIBER_ID,
      subscription_plan_id: PLAN_ID,
      payment_method: 'MANUAL',
    }) // Invoice input
    expect(callArgs[2]).toMatchObject({
      user_id: expect.any(String),
      workspace_id: expect.any(String),
    }) // Audit context (staff user + workspace)
  })

  it('returns 422 for invalid request body (missing subscriber_id)', async () => {
    const app = buildApp()
    const res = await app.request('/api/v1/backoffice/workspace/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '99.00' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// GET /invoices/:id — get single
// ---------------------------------------------------------------------------

describe('GET /api/v1/backoffice/workspace/invoices/:id', () => {
  it('returns 200 with invoice when found', async () => {
    const mockGet = vi.mocked(billingService.getInvoiceByIdService)
    mockGet.mockResolvedValueOnce(invoiceRecord)

    const app = buildApp()
    const res = await app.request(`/api/v1/backoffice/workspace/invoices/${INVOICE_ID}`, {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(INVOICE_ID)
  })

  it('returns 404 when invoice does not exist', async () => {
    const mockGet = vi.mocked(billingService.getInvoiceByIdService)
    mockGet.mockRejectedValueOnce(new BillingError('INVOICE_NOT_FOUND', 'Not found'))

    const app = buildApp()
    const res = await app.request(`/api/v1/backoffice/workspace/invoices/${INVOICE_ID}`, {
      method: 'GET',
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INVOICE_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// POST /invoices/:id/proof — upload proof
// ---------------------------------------------------------------------------

describe('POST /api/v1/backoffice/workspace/invoices/:id/proof', () => {
  it('returns 200 with updated invoice after uploading proof', async () => {
    const withProof = { ...invoiceRecord, proof_file_id: 'file-abc-001' }
    const mockUpload = vi.mocked(billingService.uploadInvoiceProof)
    mockUpload.mockResolvedValueOnce(withProof)

    const app = buildApp()
    const res = await app.request(`/api/v1/backoffice/workspace/invoices/${INVOICE_ID}/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof_file_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockUpload).toHaveBeenCalledOnce()
  })

  it('returns 422 when proof_file_id is not a valid UUID', async () => {
    const app = buildApp()
    const res = await app.request(`/api/v1/backoffice/workspace/invoices/${INVOICE_ID}/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof_file_id: 'not-a-uuid' }),
    })
    expect(res.status).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// POST /invoices/:id/approve — approve invoice
// ---------------------------------------------------------------------------

describe('POST /api/v1/backoffice/workspace/invoices/:id/approve', () => {
  it('returns 200 with PAID invoice after approval', async () => {
    const paid = { ...invoiceRecord, status: 'PAID' as const, proof_file_id: 'file-abc-001' }
    const mockApprove = vi.mocked(billingService.verifyManualPayment)
    mockApprove.mockResolvedValueOnce(paid)

    const app = buildApp()
    const res = await app.request(`/api/v1/backoffice/workspace/invoices/${INVOICE_ID}/approve`, {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockApprove).toHaveBeenCalledOnce()
  })

  it('returns 422 PROOF_REQUIRED when proof has not been uploaded', async () => {
    const mockApprove = vi.mocked(billingService.verifyManualPayment)
    mockApprove.mockRejectedValueOnce(
      new BillingError('PROOF_REQUIRED', 'Proof of payment must be uploaded before approving')
    )

    const app = buildApp()
    const res = await app.request(`/api/v1/backoffice/workspace/invoices/${INVOICE_ID}/approve`, {
      method: 'POST',
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('PROOF_REQUIRED')
  })
})

// ---------------------------------------------------------------------------
// PATCH /invoices/:id/cancel — cancel invoice
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/backoffice/workspace/invoices/:id/cancel', () => {
  it('returns 200 with CANCELLED invoice', async () => {
    const cancelled = { ...invoiceRecord, status: 'CANCELLED' as const }
    const mockCancel = vi.mocked(billingService.cancelInvoice)
    mockCancel.mockResolvedValueOnce(cancelled)

    const app = buildApp()
    const res = await app.request(`/api/v1/backoffice/workspace/invoices/${INVOICE_ID}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Customer requested cancellation' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockCancel).toHaveBeenCalledOnce()
  })

  it('returns 409 INVOICE_ALREADY_PAID when invoice is PAID', async () => {
    const mockCancel = vi.mocked(billingService.cancelInvoice)
    mockCancel.mockRejectedValueOnce(new BillingError('INVOICE_ALREADY_PAID', 'Invoice is paid'))

    const app = buildApp()
    const res = await app.request(`/api/v1/backoffice/workspace/invoices/${INVOICE_ID}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'late cancellation' }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('INVOICE_ALREADY_PAID')
  })

  it('returns 422 when reason is missing from body', async () => {
    const app = buildApp()
    const res = await app.request(`/api/v1/backoffice/workspace/invoices/${INVOICE_ID}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

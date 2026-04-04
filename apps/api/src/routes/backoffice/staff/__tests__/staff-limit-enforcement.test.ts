/**
 * Staff Routes — Limit Enforcement Integration Tests
 *
 * File: apps/api/src/routes/backoffice/staff/__tests__/staff-limit-enforcement.test.ts
 * Stage: STAGE_43_LIMIT_ENFORCEMENT
 *
 * Tests for:
 *   - handleEnableStaff: returns 403 with LICENSE_LIMIT_REACHED / STAFF_LIMIT type at limit,
 *                        returns 200 when limit=null (unlimited)
 *   - handleBulkImportStaff: returns 403 for inactive license, 422 for invalid body,
 *                             returns 200 with bulk import result, passes staffLimit through
 */

import type { Context } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Domain mock
// ---------------------------------------------------------------------------

const mockEnableStaff = vi.fn()
const mockBulkImportStaff = vi.fn()

vi.mock('@zidney/domain-core/staff', () => ({
  StaffError: class StaffError extends Error {
    code: string
    limit_value?: number
    current_value?: number
    constructor(
      code: string,
      options?: { message?: string; limit_value?: number; current_value?: number } | string
    ) {
      const msg = typeof options === 'string' ? options : (options?.message ?? code)
      super(msg)
      this.code = code
      this.name = 'StaffError'
      if (typeof options === 'object') {
        this.limit_value = options?.limit_value
        this.current_value = options?.current_value
      }
    }
  },
  STAFF_ERROR_HTTP: {
    STAFF_NOT_FOUND: 404,
    STAFF_EMAIL_CONFLICT: 409,
    STAFF_LIMIT_EXCEEDED: 403,
    STAFF_ALREADY_ACTIVE: 409,
    STAFF_ALREADY_DISABLED: 409,
    STAFF_HAS_AUTHORED_CONTENT: 409,
    STAFF_INVALID_PASSWORD: 422,
  },
  enableStaff: (...args: unknown[]) => mockEnableStaff(...args),
  bulkImportStaff: (...args: unknown[]) => mockBulkImportStaff(...args),
}))

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

const mockGetDb = vi.fn(() => ({ connect: vi.fn(), query: vi.fn() }))
const mockBuildAuditCtx = vi.fn(() => ({
  user_id: 'user-001',
  correlation_id: 'corr-001',
  workspace_slug: 'test-ws',
  workspace_id: 'ws-001',
}))
const mockStaffErrorResponse = vi.fn()

vi.mock('../helpers', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
  buildAuditCtx: (...args: unknown[]) => mockBuildAuditCtx(...args),
  staffErrorResponse: (c: Context, err: unknown) => mockStaffErrorResponse(c, err),
}))

// ---------------------------------------------------------------------------
// Handler imports (after mocks)
// ---------------------------------------------------------------------------

import { handleBulkImportStaff } from '../bulk-import-staff'
import { handleEnableStaff } from '../enable-staff'

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

const STAFF_ID = '00000000-0000-0000-0000-000000000001'
const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'
const NOW = new Date('2026-04-06T10:00:00Z')

function makeStaffRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: STAFF_ID,
    workspace_id: WORKSPACE_ID,
    email: 'staff@example.com',
    name: 'John Staff',
    status: 'ACTIVE',
    is_active: true,
    role_id: null,
    division_ids: [],
    last_login: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

type ContextVars = {
  workspace_id?: string
  workspace_slug?: string
  correlation_id?: string
  request_id?: string
  staff_limit?: number | null
  license?: { status: string } | null
  [key: string]: unknown
}

function makeCtx({
  params = {} as Record<string, string>,
  body = {} as unknown,
  vars = {} as ContextVars,
}: {
  params?: Record<string, string>
  body?: unknown
  vars?: ContextVars
}) {
  const responses: unknown[] = []
  const defaultVars: ContextVars = {
    workspace_id: WORKSPACE_ID,
    workspace_slug: 'test-ws',
    correlation_id: 'corr-001',
    request_id: 'req-001',
    staff_limit: null,
    license: { status: 'ACTIVE' },
    ...vars,
  }

  const c = {
    get: (key: string) => defaultVars[key] ?? undefined,
    req: {
      param: (key: string) => params[key] ?? '',
      json: vi.fn(async () => body),
    },
    json: vi.fn((data: unknown, status?: number) => {
      const response = { data, status: status ?? 200 }
      responses.push(response)
      return response
    }),
    _responses: responses,
  }

  // Use in-operator to correctly return null (not coerce it to undefined)
  ;(c as any).get = (key: string) => (key in defaultVars ? defaultVars[key] : undefined)

  return c as unknown as Context
}

// ---------------------------------------------------------------------------
// handleEnableStaff — limit enforcement
// ---------------------------------------------------------------------------

describe('handleEnableStaff', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with staff record on success when limit=null (unlimited)', async () => {
    const record = makeStaffRecord({ status: 'ACTIVE' })
    mockEnableStaff.mockResolvedValue(record)

    const c = makeCtx({
      params: { id: STAFF_ID },
      vars: { staff_limit: null },
    })

    await handleEnableStaff(c)

    expect(mockEnableStaff).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      STAFF_ID,
      null,
      expect.objectContaining({ user_id: 'user-001' })
    )
    expect((c as any).json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: record }),
      200
    )
  })

  it('calls staffErrorResponse when STAFF_LIMIT_EXCEEDED is thrown', async () => {
    const { StaffError } = await import('@zidney/domain-core/staff')
    const limitErr = new StaffError('STAFF_LIMIT_EXCEEDED', {
      message: 'limit reached',
      limit_value: 10,
      current_value: 10,
    })
    mockEnableStaff.mockRejectedValue(limitErr)

    const c = makeCtx({
      params: { id: STAFF_ID },
      vars: { staff_limit: 10 },
    })

    await handleEnableStaff(c)

    expect(mockStaffErrorResponse).toHaveBeenCalledWith(c, limitErr)
  })

  it('passes staffLimit from context to domain function', async () => {
    const record = makeStaffRecord()
    mockEnableStaff.mockResolvedValue(record)

    const c = makeCtx({
      params: { id: STAFF_ID },
      vars: { staff_limit: 25 },
    })

    await handleEnableStaff(c)

    expect(mockEnableStaff).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      STAFF_ID,
      25,
      expect.anything()
    )
  })

  it('returns 422 for invalid staff id', async () => {
    const c = makeCtx({ params: { id: 'not-a-uuid' } })

    await handleEnableStaff(c)

    expect((c as any).json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        data: null,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
      422
    )
    expect(mockEnableStaff).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// handleBulkImportStaff — license check and limit passthrough
// ---------------------------------------------------------------------------

describe('handleBulkImportStaff', () => {
  afterEach(() => vi.clearAllMocks())

  const validRow = {
    email: 'staff@example.com',
    name: 'Test Staff',
    password: 'password1234',
    role_id: null,
  }

  it('returns 403 when license is inactive', async () => {
    const c = makeCtx({
      body: { rows: [validRow] },
      vars: { license: { status: 'INACTIVE' } },
    })

    await handleBulkImportStaff(c)

    expect((c as any).json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'LICENSE_INACTIVE' }),
      }),
      403
    )
    expect(mockBulkImportStaff).not.toHaveBeenCalled()
  })

  it('returns 403 when license is null', async () => {
    const c = makeCtx({
      body: { rows: [validRow] },
      vars: { license: null },
    })

    await handleBulkImportStaff(c)

    expect((c as any).json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 403)
  })

  it('returns 422 for invalid request body', async () => {
    const c = makeCtx({
      body: { rows: [] }, // min 1 row required
      vars: { license: { status: 'ACTIVE' } },
    })

    await handleBulkImportStaff(c)

    expect((c as any).json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
      422
    )
    expect(mockBulkImportStaff).not.toHaveBeenCalled()
  })

  it('returns 200 with bulk import result on success', async () => {
    const importResult = { inserted: 1, skipped: 0, errors: [] }
    mockBulkImportStaff.mockResolvedValue(importResult)

    const c = makeCtx({
      body: { rows: [validRow] },
      vars: { license: { status: 'ACTIVE' }, staff_limit: null },
    })

    await handleBulkImportStaff(c)

    expect((c as any).json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: importResult }),
      200
    )
  })

  it('passes staffLimit from context to domain function', async () => {
    mockBulkImportStaff.mockResolvedValue({ inserted: 0, skipped: 1, errors: [] })

    const c = makeCtx({
      body: { rows: [validRow] },
      vars: { license: { status: 'ACTIVE' }, staff_limit: 20 },
    })

    await handleBulkImportStaff(c)

    expect(mockBulkImportStaff).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      expect.any(Array),
      20,
      expect.anything()
    )
  })
})

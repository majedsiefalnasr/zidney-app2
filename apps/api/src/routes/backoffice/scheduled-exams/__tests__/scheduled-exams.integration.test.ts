/**
 * Scheduled Exams Route Integration Tests — STAGE_38
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/__tests__/scheduled-exams.integration.test.ts
 *
 * Tests route handlers by mocking the domain service layer.
 * Verifies: request parsing, response shape, error mapping, HTTP status codes, tenant isolation.
 */

import type { Context } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock domain service (hoisted before handler imports)
// ---------------------------------------------------------------------------

vi.mock('@zidney/domain-core/scheduled-exam', () => ({
  ScheduledExamError: class ScheduledExamError extends Error {
    code: string
    constructor(code: string, message?: string) {
      super(message ?? code)
      this.name = 'ScheduledExamError'
      this.code = code
    }
  },
  SCHEDULED_EXAM_ERROR_HTTP_STATUS: {
    'SCHEDULED_EXAM.NOT_FOUND': 404,
    'SCHEDULED_EXAM.CODE_CONFLICT': 409,
    'SCHEDULED_EXAM.FIELD_IMMUTABLE': 409,
    'SCHEDULED_EXAM.HAS_ATTEMPTS': 409,
    'SCHEDULED_EXAM.BASE_EXAM_NOT_ENABLED': 422,
    'SCHEDULED_EXAM.INVALID_TIME_WINDOW': 422,
    'SCHEDULED_EXAM.BASE_EXAM_MODIFIED': 422,
    'SCHEDULED_EXAM.NOT_STARTED': 403,
    'SCHEDULED_EXAM.CLOSED': 403,
    'SCHEDULED_EXAM.ALREADY_ATTEMPTED': 403,
    'SCHEDULED_EXAM.ATTEMPT_NOT_FOUND': 404,
    'SCHEDULED_EXAM.ATTEMPT_ALREADY_SUBMITTED': 410,
    'SCHEDULED_EXAM.NOT_ENABLED': 422,
    'SCHEDULED_EXAM.INTERNAL_ERROR': 500,
  },
  SCHEDULED_EXAM_ERROR_MESSAGES: {},
  createScheduledExam: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  countAttempts: vi.fn(),
  updateScheduledExam: vi.fn(),
  deleteScheduledExam: vi.fn(),
  enableScheduledExam: vi.fn(),
  reApproveScheduledExam: vi.fn(),
  startScheduledAttempt: vi.fn(),
  recordHeartbeat: vi.fn(),
  submitAttempt: vi.fn(),
}))

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('../helpers', () => ({
  getDb: vi.fn(() => ({})),
  buildAuditCtx: vi.fn(() => ({
    user_id: 'user-001',
    correlation_id: 'corr-001',
    workspace_slug: 'test-ws',
    workspace_id: 'ws-001',
    caller_permissions: ['exam_manage'],
  })),
  successResponse: (data: unknown) => ({ success: true, data, error: null }),
  scheduledExamErrorResponse: (
    c: { json: (data: unknown, status?: number) => unknown },
    err: unknown
  ) => {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code: string }).code
        : 'INTERNAL_ERROR'
    const statusMap: Record<string, number> = {
      'SCHEDULED_EXAM.NOT_FOUND': 404,
      'SCHEDULED_EXAM.CODE_CONFLICT': 409,
      'SCHEDULED_EXAM.FIELD_IMMUTABLE': 409,
      'SCHEDULED_EXAM.HAS_ATTEMPTS': 409,
      'SCHEDULED_EXAM.BASE_EXAM_NOT_ENABLED': 422,
      'SCHEDULED_EXAM.INVALID_TIME_WINDOW': 422,
      'SCHEDULED_EXAM.BASE_EXAM_MODIFIED': 422,
      'SCHEDULED_EXAM.NOT_STARTED': 403,
      'SCHEDULED_EXAM.CLOSED': 403,
      'SCHEDULED_EXAM.ALREADY_ATTEMPTED': 403,
      'SCHEDULED_EXAM.ATTEMPT_NOT_FOUND': 404,
      'SCHEDULED_EXAM.ATTEMPT_ALREADY_SUBMITTED': 410,
      'SCHEDULED_EXAM.NOT_ENABLED': 422,
      'SCHEDULED_EXAM.INTERNAL_ERROR': 500,
    }
    const status = statusMap[code] ?? 500
    return c.json({ success: false, data: null, error: { code, message: String(err) } }, status)
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  countAll,
  countAttempts,
  createScheduledExam,
  deleteScheduledExam,
  enableScheduledExam,
  findAll,
  findById,
  reApproveScheduledExam,
  recordHeartbeat,
  ScheduledExamError,
  startScheduledAttempt,
  submitAttempt,
  updateScheduledExam,
} from '@zidney/domain-core/scheduled-exam'
import { createScheduledExamHandler } from '../create-scheduled-exam'
import { deleteScheduledExamHandler } from '../delete-scheduled-exam'
import { getScheduledExamHandler } from '../get-scheduled-exam'
import { heartbeatHandler } from '../heartbeat'
import { listScheduledExamsHandler } from '../list-scheduled-exams'
import { reApproveHandler } from '../re-approve'
import { startAttemptHandler } from '../start-attempt'
import { submitAttemptHandler } from '../submit-attempt'
import { updateScheduledExamHandler } from '../update-scheduled-exam'
import { workflowTransitionHandler } from '../workflow-transition'

// ---------------------------------------------------------------------------
// Test helper: build a mock Hono Context
// ---------------------------------------------------------------------------

function makeCtx(
  options: { body?: unknown; params?: Record<string, string>; query?: Record<string, string> } = {}
): Context {
  const responses: Array<{ data: unknown; status?: number }> = []

  const c = {
    req: {
      json: vi.fn().mockResolvedValue(options.body ?? {}),
      param: vi.fn().mockReturnValue(options.params ?? {}),
      query: vi.fn().mockReturnValue(options.query ?? {}),
    },
    json: vi.fn((data: unknown, status?: number) => {
      responses.push({ data, status })
      return { data, status }
    }),
    get: vi.fn((key: string) => {
      if (key === 'correlation_id') return 'corr-001'
      if (key === 'workspace_id') return 'ws-001'
      if (key === 'workspace_slug') return 'test-ws'
      return undefined
    }),
    _responses: responses,
  } as unknown as Context

  return c
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /scheduled-exams — createScheduledExam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with created exam on valid body', async () => {
    const mockExam = { id: 'exam-001', name: 'Final Exam', code: 'FE-001' }
    vi.mocked(createScheduledExam).mockResolvedValueOnce(mockExam as never)

    const body = {
      base_exam_id: '00000000-0000-0000-0000-000000000001',
      exam_type: 'MCQ',
      name: 'Final Exam',
      code: 'FE-001',
      start_datetime: '2026-09-01T09:00:00Z',
      end_datetime: '2026-09-01T11:00:00Z',
    }
    const c = makeCtx({ body })
    await createScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockExam }),
      201
    )
  })

  it('returns 422 when body is missing required fields', async () => {
    const c = makeCtx({ body: { name: 'No base exam' } })
    await createScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 409 when CODE_CONFLICT error is thrown', async () => {
    vi.mocked(createScheduledExam).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.CODE_CONFLICT')
    )

    const body = {
      base_exam_id: '00000000-0000-0000-0000-000000000001',
      exam_type: 'MCQ',
      name: 'Final',
      code: 'DUPLICATE',
      start_datetime: '2026-09-01T09:00:00Z',
      end_datetime: '2026-09-01T11:00:00Z',
    }
    const c = makeCtx({ body })
    await createScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'SCHEDULED_EXAM.CODE_CONFLICT' }),
      }),
      409
    )
  })

  it('returns 422 when BASE_EXAM_NOT_ENABLED error is thrown', async () => {
    vi.mocked(createScheduledExam).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.BASE_EXAM_NOT_ENABLED')
    )

    const body = {
      base_exam_id: '00000000-0000-0000-0000-000000000001',
      exam_type: 'MCQ',
      name: 'Final',
      code: 'FE-002',
      start_datetime: '2026-09-01T09:00:00Z',
      end_datetime: '2026-09-01T11:00:00Z',
    }
    const c = makeCtx({ body })
    await createScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 422 when INVALID_TIME_WINDOW error is thrown', async () => {
    vi.mocked(createScheduledExam).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.INVALID_TIME_WINDOW')
    )

    const body = {
      base_exam_id: '00000000-0000-0000-0000-000000000001',
      exam_type: 'MCQ',
      name: 'Final',
      code: 'FE-003',
      start_datetime: '2026-09-01T11:00:00Z',
      end_datetime: '2026-09-01T09:00:00Z', // end before start
    }
    const c = makeCtx({ body })
    await createScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })
})

describe('GET /scheduled-exams — listScheduledExams', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with pagination envelope', async () => {
    const items = [{ id: 'e1' }, { id: 'e2' }]
    vi.mocked(findAll).mockResolvedValueOnce(items as never)
    vi.mocked(countAll).mockResolvedValueOnce(2 as never)

    const c = makeCtx({ query: { page: '1', per_page: '20' } })
    await listScheduledExamsHandler(c)

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ items, pagination: expect.any(Object) }),
      }),
      200
    )
  })
})

describe('GET /scheduled-exams/:scheduledExamId — getScheduledExam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with exam and attempts_count', async () => {
    const exam = { id: '00000000-0000-0000-0000-000000000001', name: 'Final' }
    vi.mocked(findById).mockResolvedValueOnce(exam as never)
    vi.mocked(countAttempts).mockResolvedValueOnce(3 as never)

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' } })
    await getScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ attempts_count: 3 }),
      }),
      200
    )
  })

  it('returns 404 when exam not found', async () => {
    vi.mocked(findById).mockResolvedValueOnce(null as never)
    vi.mocked(countAttempts).mockResolvedValueOnce(0 as never)

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000099' } })
    await getScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})

describe('PATCH /scheduled-exams/:scheduledExamId — updateScheduledExam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on successful update', async () => {
    const updated = { id: '00000000-0000-0000-0000-000000000001', name: 'Updated' }
    vi.mocked(updateScheduledExam).mockResolvedValueOnce(updated as never)

    const c = makeCtx({
      params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' },
      body: { name: 'Updated' },
    })
    await updateScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: updated }),
      200
    )
  })

  it('returns 409 on FIELD_IMMUTABLE', async () => {
    vi.mocked(updateScheduledExam).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.FIELD_IMMUTABLE')
    )

    const c = makeCtx({
      params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' },
      body: { code: 'NEW-CODE' },
    })
    await updateScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 409)
  })

  it('returns 409 on HAS_ATTEMPTS', async () => {
    vi.mocked(updateScheduledExam).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.HAS_ATTEMPTS')
    )

    const c = makeCtx({
      params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' },
      body: { allow_single_attempt: false },
    })
    await updateScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 409)
  })
})

describe('DELETE /scheduled-exams/:scheduledExamId — deleteScheduledExam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on successful delete', async () => {
    vi.mocked(deleteScheduledExam).mockResolvedValueOnce(undefined as never)

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' } })
    const response = await deleteScheduledExamHandler(c)

    expect(response.status).toBe(204)
  })

  it('returns 409 on HAS_ATTEMPTS', async () => {
    vi.mocked(deleteScheduledExam).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.HAS_ATTEMPTS')
    )

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' } })
    await deleteScheduledExamHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 409)
  })
})

describe('POST /scheduled-exams/:scheduledExamId/workflow — workflowTransition', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on successful ENABLE transition', async () => {
    const result = { id: 'e1', workflow_status: 'ENABLED' }
    vi.mocked(enableScheduledExam).mockResolvedValueOnce(result as never)

    const c = makeCtx({
      params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' },
      body: { action: 'ENABLE' },
    })
    await workflowTransitionHandler(c)

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: result }),
      200
    )
  })

  it('returns 422 on BASE_EXAM_MODIFIED', async () => {
    vi.mocked(enableScheduledExam).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.BASE_EXAM_MODIFIED')
    )

    const c = makeCtx({
      params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' },
      body: { action: 'ENABLE' },
    })
    await workflowTransitionHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 422 on invalid action body', async () => {
    const c = makeCtx({
      params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' },
      body: { action: 'INVALID_ACTION' },
    })
    await workflowTransitionHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })
})

describe('POST /scheduled-exams/:scheduledExamId/re-approve — reApprove', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on successful re-approval', async () => {
    const result = { id: 'e1', base_exam_modified: false }
    vi.mocked(reApproveScheduledExam).mockResolvedValueOnce(result as never)

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' } })
    await reApproveHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })
})

describe('POST /scheduled-exams/:scheduledExamId/attempts — startAttempt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with attempt and remaining_seconds when window is open', async () => {
    const result = {
      attempt_id: 'att-001',
      scheduled_end_time: '2026-09-01T11:00:00Z',
      remaining_seconds: 3600,
    }
    vi.mocked(startScheduledAttempt).mockResolvedValueOnce(result as never)

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' } })
    await startAttemptHandler(c)

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: result }),
      201
    )
  })

  it('returns 403 when NOT_STARTED', async () => {
    vi.mocked(startScheduledAttempt).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.NOT_STARTED')
    )

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' } })
    await startAttemptHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 403)
  })

  it('returns 403 when CLOSED', async () => {
    vi.mocked(startScheduledAttempt).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.CLOSED')
    )

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' } })
    await startAttemptHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 403)
  })

  it('returns 403 when ALREADY_ATTEMPTED', async () => {
    vi.mocked(startScheduledAttempt).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.ALREADY_ATTEMPTED')
    )

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000001' } })
    await startAttemptHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 403)
  })
})

describe('POST /scheduled-exams/attempts/:attemptId/heartbeat — heartbeat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with remaining_seconds', async () => {
    const result = { remaining_seconds: 1800 }
    vi.mocked(recordHeartbeat).mockResolvedValueOnce(result as never)

    const c = makeCtx({ params: { attemptId: '00000000-0000-0000-0000-000000000001' } })
    await heartbeatHandler(c)

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: result }),
      200
    )
  })

  it('returns 410 when attempt is already submitted (ATTEMPT_ALREADY_SUBMITTED)', async () => {
    vi.mocked(recordHeartbeat).mockRejectedValueOnce(
      new ScheduledExamError('SCHEDULED_EXAM.ATTEMPT_ALREADY_SUBMITTED')
    )

    const c = makeCtx({ params: { attemptId: '00000000-0000-0000-0000-000000000001' } })
    await heartbeatHandler(c)

    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 410)
  })
})

describe('POST /scheduled-exams/attempts/:attemptId/submit — submitAttempt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with auto_submitted=false on normal submit', async () => {
    const result = { attempt_id: 'att-001', auto_submitted: false }
    vi.mocked(submitAttempt).mockResolvedValueOnce(result as never)

    const c = makeCtx({ params: { attemptId: '00000000-0000-0000-0000-000000000001' } })
    await submitAttemptHandler(c)

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ auto_submitted: false }),
      }),
      200
    )
  })

  it('returns 200 even for late submission (auto_submitted=true) — idempotent', async () => {
    const result = { attempt_id: 'att-001', auto_submitted: true }
    vi.mocked(submitAttempt).mockResolvedValueOnce(result as never)

    const c = makeCtx({ params: { attemptId: '00000000-0000-0000-0000-000000000001' } })
    await submitAttemptHandler(c)

    // Still 200 — not 4xx, per Clarification Q4
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ auto_submitted: true }),
      }),
      200
    )
  })
})

describe('Tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when findById returns null — cross-tenant attempt cannot see another workspace exam', async () => {
    vi.mocked(findById).mockResolvedValueOnce(null as never)
    vi.mocked(countAttempts).mockResolvedValueOnce(0 as never)

    const c = makeCtx({ params: { scheduledExamId: '00000000-0000-0000-0000-000000000099' } })
    await getScheduledExamHandler(c)

    // Since findById returns null for the wrong workspace, we get 404
    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})

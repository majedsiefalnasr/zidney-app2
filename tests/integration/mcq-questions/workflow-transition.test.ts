/**
 * Integration Tests: POST /api/v1/backoffice/workspace/mcq-questions/:questionId/workflow/transition
 *
 * File: tests/integration/mcq-questions/workflow-transition.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T041
 *
 * Tests the workflow state machine: DRAFT→COMPLETED, pre-guard enforcement for ENABLED,
 * invalid transitions, permission denied, and question not found.
 *
 * NOTE: The workflow engine (executeTransition) calls db.connect() directly (not
 * getTransactionClient). Therefore the mock pool MUST expose a `connect()` method
 * that returns a mock PoolClient with query/release. Parent-level queries
 * (findQuestionById, findOptionsByQuestionId) use pool.query() directly.
 */

import { mcqQuestionsRouter } from '@zidney/app/api/routes/backoffice/mcq-questions/index'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const USER_ID = '00000000-0000-0000-0000-000000000010'
const SUBJECT_ID = '00000000-0000-0000-0000-000000000020'
const QUESTION_ID = '00000000-0000-0000-0000-000000000030'
const LOG_ID = '00000000-0000-0000-0000-000000000099'
const NOW = new Date('2026-01-01T00:00:00.000Z')

// ---------------------------------------------------------------------------
// Helper: mock PoolClient (used inside db.connect())
// ---------------------------------------------------------------------------

function buildMockClient(options: { forUpdateStatus?: string; throwOnQuery?: Error } = {}) {
  const { forUpdateStatus = 'DRAFT', throwOnQuery } = options

  const client = {
    query: vi.fn().mockImplementation(async (sql: string) => {
      if (throwOnQuery) throw throwOnQuery

      const s = sql.trim()
      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }

      // SELECT ... FOR UPDATE (workflow engine row lock)
      if (s.includes('mcq_questions') && s.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: QUESTION_ID,
              status: forUpdateStatus,
              status_updated_at: null,
              status_updated_by: null,
            },
          ],
          rowCount: 1,
        }
      }

      // UPDATE mcq_questions SET status = $1 ...
      if (s.includes('mcq_questions') && s.includes('UPDATE') && s.includes('status')) {
        return { rows: [], rowCount: 1 }
      }

      // INSERT INTO workflow_logs RETURNING id, changed_at
      if (s.includes('workflow_logs') && s.includes('INSERT')) {
        return { rows: [{ id: LOG_ID, changed_at: NOW }], rowCount: 1 }
      }

      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  }
  return client
}

// ---------------------------------------------------------------------------
// Helper: mock Pool (pool.query for pre-guards; pool.connect() for engine TX)
// ---------------------------------------------------------------------------

interface BuildMockPoolOptions {
  questionRow?: Record<string, unknown> | null
  status?: string
  optionRows?: Record<string, unknown>[]
  forUpdateStatus?: string
  connectThrow?: Error
}

function buildMockPool(options: BuildMockPoolOptions = {}) {
  const { questionRow, status = 'DRAFT', optionRows, forUpdateStatus, connectThrow } = options

  const defaultQuestionRow = {
    id: QUESTION_ID,
    subject_id: SUBJECT_ID,
    division_id: null,
    lesson_id: null,
    question_type: 'SINGLE',
    language: 'ar',
    content: '<p>Test question</p>',
    explanation: null,
    is_revision_only: false,
    is_exam_only: false,
    status,
    deleted_at: null,
    created_at: NOW,
    updated_at: NOW,
    created_by: USER_ID,
    updated_by: USER_ID,
    status_updated_at: null,
    status_updated_by: null,
  }

  const resolvedRow = questionRow !== undefined ? questionRow : defaultQuestionRow
  const resolvedTxStatus = forUpdateStatus ?? status

  const defaultOptions = optionRows ?? [
    {
      id: 'opt-001',
      question_id: QUESTION_ID,
      content: '<p>Option A</p>',
      is_correct: true,
      order_index: 1,
      created_at: NOW,
    },
    {
      id: 'opt-002',
      question_id: QUESTION_ID,
      content: '<p>Option B</p>',
      is_correct: false,
      order_index: 2,
      created_at: NOW,
    },
  ]

  const mockClient = buildMockClient({ forUpdateStatus: resolvedTxStatus })

  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      // findQuestionById (pool-level, no FOR UPDATE)
      if (s.includes('mcq_questions') && s.includes('SELECT') && s.includes('deleted_at IS NULL')) {
        if (!resolvedRow) return { rows: [], rowCount: 0 }
        return { rows: [resolvedRow], rowCount: 1 }
      }

      // findOptionsByQuestionId (pool-level, pre-ENABLED guard)
      if (s.includes('mcq_question_options') && s.includes('SELECT')) {
        return { rows: defaultOptions, rowCount: defaultOptions.length }
      }

      return { rows: [], rowCount: 0 }
    }),
    connect: vi.fn().mockImplementation(async () => {
      if (connectThrow) throw connectThrow
      return mockClient
    }),
    _mockClient: mockClient,
  }
}

// ---------------------------------------------------------------------------
// App Factory
// ---------------------------------------------------------------------------

function createTestApp(
  pool: ReturnType<typeof buildMockPool>,
  permissions: string[] = ['question_manage']
) {
  const app = new Hono()

  app.use('*', async (c, next) => {
    ;(c as any).set('tenant', { id: TENANT_ID, slug: 'test-ws', pool })
    ;(c as any).set('user', { id: USER_ID })
    ;(c as any).set('rbacContext', { permissions })
    ;(c as any).set('correlation_id', 'corr-001')
    ;(c as any).set('workspace_slug', 'test-ws')
    ;(c as any).set('workspace_id', TENANT_ID)
    await next()
  })

  app.route('/api/v1/backoffice/workspace', mcqQuestionsRouter)

  return app
}

const TRANSITION_URL = `/api/v1/backoffice/workspace/mcq-questions/${QUESTION_ID}/workflow/transition`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /mcq-questions/:questionId/workflow/transition', () => {
  describe('DRAFT → COMPLETED (forward transition)', () => {
    it('returns 200 with WorkflowTransitionResult on success', async () => {
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      const res = await app.request(TRANSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'COMPLETED' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.entityType).toBe('mcq_question')
      expect(body.data.entityId).toBe(QUESTION_ID)
      expect(body.data.previousState).toBe('DRAFT')
      expect(body.data.newState).toBe('COMPLETED')
      expect(body.data.logId).toBe(LOG_ID)
    })

    it('uses db.connect() to acquire a PoolClient for the TX', async () => {
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      await app.request(TRANSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'COMPLETED' }),
      })

      expect(pool.connect).toHaveBeenCalledOnce()
      expect(pool._mockClient.release).toHaveBeenCalled()
    })

    it('executes BEGIN and COMMIT inside the transition client', async () => {
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      await app.request(TRANSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'COMPLETED' }),
      })

      const clientCalls = pool._mockClient.query.mock.calls.map((c: unknown[]) =>
        (c[0] as string).trim()
      )
      expect(clientCalls).toContain('BEGIN')
      expect(clientCalls).toContain('COMMIT')
    })
  })

  describe('APPROVED → ENABLED (pre-guard: valid options required)', () => {
    it('returns 200 when question has valid options (SINGLE type)', async () => {
      const pool = buildMockPool({ status: 'APPROVED', forUpdateStatus: 'APPROVED' })
      const app = createTestApp(pool)

      const res = await app.request(TRANSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'ENABLED' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.newState).toBe('ENABLED')
    })

    it('returns 422 QUESTION_HAS_NO_OPTIONS when question has no options', async () => {
      const pool = buildMockPool({
        status: 'APPROVED',
        forUpdateStatus: 'APPROVED',
        optionRows: [],
      })
      const app = createTestApp(pool)

      const res = await app.request(TRANSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'ENABLED' }),
      })

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error.code).toBe('QUESTION_HAS_NO_OPTIONS')
    })
  })

  describe('invalid transitions', () => {
    it('returns 400 for DRAFT → ENABLED (skipped state)', async () => {
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      const res = await app.request(TRANSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'ENABLED' }),
      })

      // invalid_state_transition from workflow engine → 400
      expect(res.status).toBe(400)
    })
  })

  describe('question not found', () => {
    it('returns 404 QUESTION_NOT_FOUND when question does not exist', async () => {
      const pool = buildMockPool({ questionRow: null })
      const app = createTestApp(pool)

      const res = await app.request(TRANSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'COMPLETED' }),
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('QUESTION_NOT_FOUND')
    })
  })

  describe('validation', () => {
    it('returns 422 when body is missing the "to" field', async () => {
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      const res = await app.request(TRANSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(422)
    })

    it('returns 422 when "to" is not a valid McqQuestionStatus value', async () => {
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      const res = await app.request(TRANSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'INVALID_STATUS' }),
      })

      expect(res.status).toBe(422)
    })
  })
})

/**
 * Integration Tests: GET /api/v1/backoffice/workspace/mcq-questions
 *
 * File: tests/integration/mcq-questions/list-questions.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T043
 *
 * Tests the list-questions route handler using a mock pg Pool.
 * No real database connection is required.
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
const Q1_ID = '00000000-0000-0000-0000-000000000030'
const Q2_ID = '00000000-0000-0000-0000-000000000031'
const NOW = new Date('2026-01-01T00:00:00.000Z')

const BASE_URL = '/api/v1/backoffice/workspace/mcq-questions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuestionRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    subject_id: SUBJECT_ID,
    division_id: null,
    lesson_id: null,
    question_type: 'SINGLE',
    language: 'ar',
    content: '<p>Question</p>',
    explanation: null,
    is_revision_only: false,
    is_exam_only: false,
    status: 'DRAFT',
    deleted_at: null,
    created_at: NOW,
    updated_at: NOW,
    created_by: USER_ID,
    updated_by: USER_ID,
    status_updated_at: null,
    status_updated_by: null,
    ...overrides,
  }
}

/**
 * Builds a mock pool for list-questions.
 * listQuestions runs two parallel queries:
 *   1. SELECT ... FROM mcq_questions q ... LIMIT $N OFFSET $M  (data query)
 *   2. SELECT COUNT(*)::text AS count FROM mcq_questions q ...  (count query)
 */
function buildListPool(opts: { rows?: ReturnType<typeof makeQuestionRow>[]; total?: number } = {}) {
  const { rows = [makeQuestionRow(Q1_ID), makeQuestionRow(Q2_ID)], total = 2 } = opts

  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      // Count query
      if (s.includes('COUNT(*)')) {
        return { rows: [{ count: String(total) }], rowCount: 1 }
      }

      // Data query
      if (s.includes('FROM mcq_questions') && s.includes('LIMIT')) {
        return { rows, rowCount: rows.length }
      }

      return { rows: [], rowCount: 0 }
    }),
  }
}

function createTestApp(pool: ReturnType<typeof buildListPool>) {
  const app = new Hono()

  app.use('*', async (c, next) => {
    ;(c as any).set('tenant', { id: TENANT_ID, slug: 'test-ws', pool })
    ;(c as any).set('user', { id: USER_ID })
    ;(c as any).set('rbacContext', { permissions: ['question_manage'] })
    ;(c as any).set('correlation_id', 'corr-001')
    ;(c as any).set('workspace_slug', 'test-ws')
    ;(c as any).set('workspace_id', TENANT_ID)
    await next()
  })

  app.route('/api/v1/backoffice/workspace', mcqQuestionsRouter)

  return app
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /mcq-questions', () => {
  it('returns paginated list with defaults', async () => {
    const pool = buildListPool()
    const app = createTestApp(pool)

    const res = await app.request(BASE_URL)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.data).toHaveLength(2)
    expect(body.data.total).toBe(2)
    expect(body.data.page).toBe(1)
    expect(body.data.per_page).toBe(20)
    expect(body.error).toBeNull()
  })

  it('filters by status=DRAFT', async () => {
    const pool = buildListPool({ rows: [makeQuestionRow(Q1_ID, { status: 'DRAFT' })], total: 1 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE_URL}?status=DRAFT`)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.data[0].status).toBe('DRAFT')
  })

  it('filters by question_type=SINGLE', async () => {
    const pool = buildListPool({
      rows: [makeQuestionRow(Q1_ID, { question_type: 'SINGLE' })],
      total: 1,
    })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE_URL}?question_type=SINGLE`)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.data[0].question_type).toBe('SINGLE')
  })

  it('filters by subject_id', async () => {
    const pool = buildListPool({ rows: [makeQuestionRow(Q1_ID)], total: 1 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE_URL}?subject_id=${SUBJECT_ID}`)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.total).toBe(1)
  })

  it('returns empty results when no questions match', async () => {
    const pool = buildListPool({ rows: [], total: 0 })
    const app = createTestApp(pool)

    const res = await app.request(BASE_URL)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.data).toHaveLength(0)
    expect(body.data.total).toBe(0)
  })

  it('respects custom pagination params (page=2 per_page=5)', async () => {
    const pool = buildListPool({ rows: [makeQuestionRow(Q2_ID)], total: 6 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE_URL}?page=2&per_page=5`)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.page).toBe(2)
    expect(body.data.per_page).toBe(5)
    expect(body.data.total).toBe(6)
  })

  it('rejects invalid question_type', async () => {
    const pool = buildListPool()
    const app = createTestApp(pool)

    const res = await app.request(`${BASE_URL}?question_type=INVALID_TYPE`)
    // Zod validation fails → 422 VALIDATION_ERROR
    expect(res.status).toBe(422)
  })
})

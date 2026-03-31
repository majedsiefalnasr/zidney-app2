/**
 * Integration Tests: PATCH /api/v1/backoffice/workspace/mcq-questions/:questionId
 *
 * File: tests/integration/mcq-questions/update-question.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T039
 *
 * Tests question update including optimistic concurrency and type immutability.
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
const OPTION_ID_1 = '00000000-0000-0000-0000-000000000040'
const OPTION_ID_2 = '00000000-0000-0000-0000-000000000041'
const NOW = new Date('2026-01-01T00:00:00.000Z')
const NOW_ISO = NOW.toISOString()

// ---------------------------------------------------------------------------
// Base question row (DRAFT SINGLE)
// ---------------------------------------------------------------------------

const BASE_QUESTION_ROW = {
  id: QUESTION_ID,
  subject_id: SUBJECT_ID,
  division_id: null,
  lesson_id: null,
  question_type: 'SINGLE',
  language: 'ar',
  content: '<p>Original question</p>',
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
}

const BASE_OPTION_ROWS = [
  {
    id: OPTION_ID_1,
    question_id: QUESTION_ID,
    content: '<p>Opt A</p>',
    is_correct: true,
    order_index: 1,
    created_at: NOW,
  },
  {
    id: OPTION_ID_2,
    question_id: QUESTION_ID,
    content: '<p>Opt B</p>',
    is_correct: false,
    order_index: 2,
    created_at: NOW,
  },
]

// ---------------------------------------------------------------------------
// Mock Pool Factory
// ---------------------------------------------------------------------------

function buildMockPool(
  options: {
    questionRow?: Record<string, unknown>
    updatedQuestionRow?: Record<string, unknown> | null
    optionRows?: Record<string, unknown>[]
    newOptionRows?: Record<string, unknown>[]
  } = {}
) {
  const {
    questionRow = BASE_QUESTION_ROW,
    updatedQuestionRow,
    optionRows = BASE_OPTION_ROWS,
    newOptionRows,
  } = options

  const resolvedUpdated =
    updatedQuestionRow !== undefined
      ? updatedQuestionRow
      : { ...BASE_QUESTION_ROW, content: '<p>Updated question</p>' }
  let optionInsertCount = 0

  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }

      // findQuestionById (SELECT ... FROM mcq_questions WHERE id = $1 AND deleted_at IS NULL)
      if (
        s.includes('mcq_questions') &&
        s.includes('SELECT') &&
        s.includes('deleted_at IS NULL') &&
        !s.includes('FOR UPDATE')
      ) {
        if (!questionRow) return { rows: [], rowCount: 0 }
        return { rows: [questionRow], rowCount: 1 }
      }

      // subjects check
      if (s.includes('subjects') && s.includes('SELECT 1')) {
        return { rows: [{ count: '1' }], rowCount: 1 }
      }

      // updateQuestionRow (UPDATE mcq_questions SET ... WHERE id = $N AND updated_at = $N+1 AND deleted_at IS NULL RETURNING ...)
      if (s.includes('mcq_questions') && s.includes('UPDATE') && s.includes('RETURNING')) {
        if (resolvedUpdated === null) return { rows: [], rowCount: 0 }
        return { rows: [resolvedUpdated], rowCount: 1 }
      }

      // findOptionsByQuestionId (SELECT ... FROM mcq_question_options WHERE question_id)
      if (s.includes('mcq_question_options') && s.includes('SELECT')) {
        return { rows: optionRows, rowCount: optionRows.length }
      }

      // deleteOptionsByQuestionId
      if (s.includes('mcq_question_options') && s.includes('DELETE')) {
        return { rows: [], rowCount: 0 }
      }

      // insertOption
      if (s.includes('mcq_question_options') && s.includes('INSERT')) {
        const rows = newOptionRows ?? optionRows
        const row = rows[optionInsertCount] ?? rows[0]
        optionInsertCount++
        return { rows: [row], rowCount: 1 }
      }

      // Post-update: findCategoriesByQuestionId / findTagsByQuestionId / findBasketsByQuestionId
      if (s.includes('mcq_question_categories') && s.includes('SELECT')) {
        return { rows: [], rowCount: 0 }
      }
      if (s.includes('mcq_question_tags') && s.includes('SELECT')) {
        return { rows: [], rowCount: 0 }
      }
      if (s.includes('mcq_question_baskets') && s.includes('SELECT')) {
        return { rows: [], rowCount: 0 }
      }

      return { rows: [], rowCount: 0 }
    }),
  }
}

// ---------------------------------------------------------------------------
// App Factory
// ---------------------------------------------------------------------------

function createTestApp(pool: ReturnType<typeof buildMockPool>) {
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

const PATCH_URL = `/api/v1/backoffice/workspace/mcq-questions/${QUESTION_ID}`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH /mcq-questions/:questionId', () => {
  describe('happy path — metadata update', () => {
    it('updates content and returns 200 with updated question', async () => {
      const pool = buildMockPool()
      const app = createTestApp(pool)

      const res = await app.request(PATCH_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '<p>Updated question</p>',
          updatedAt: NOW_ISO,
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe(QUESTION_ID)
    })

    it('replaces options when options array is provided', async () => {
      const newOptionRows = [
        {
          id: '00000000-0000-0000-0000-000000000099',
          question_id: QUESTION_ID,
          content: '<p>New A</p>',
          is_correct: true,
          order_index: 1,
          created_at: NOW,
        },
        {
          id: '00000000-0000-0000-0000-000000000098',
          question_id: QUESTION_ID,
          content: '<p>New B</p>',
          is_correct: false,
          order_index: 2,
          created_at: NOW,
        },
      ]

      const pool = buildMockPool({ newOptionRows })
      const app = createTestApp(pool)

      const res = await app.request(PATCH_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: NOW_ISO,
          options: [
            { content: '<p>New A</p>', isCorrect: true, orderIndex: 1 },
            { content: '<p>New B</p>', isCorrect: false, orderIndex: 2 },
          ],
        }),
      })

      expect(res.status).toBe(200)

      // Verify DELETE options was called before INSERT
      const deleteSql = pool.query.mock.calls.findIndex(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          c[0].includes('mcq_question_options') &&
          c[0].includes('DELETE')
      )
      const insertSql = pool.query.mock.calls.findIndex(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          c[0].includes('mcq_question_options') &&
          c[0].includes('INSERT')
      )
      expect(deleteSql).toBeGreaterThan(-1)
      expect(insertSql).toBeGreaterThan(deleteSql)
    })
  })

  describe('question_type immutability', () => {
    it('returns 422 QUESTION_TYPE_IMMUTABLE when question_type differs from existing', async () => {
      const pool = buildMockPool() // question_type is SINGLE
      const app = createTestApp(pool)

      const res = await app.request(PATCH_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionType: 'MULTIPLE', // different from existing SINGLE
          updatedAt: NOW_ISO,
        }),
      })

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error.code).toBe('QUESTION_TYPE_IMMUTABLE')
    })
  })

  describe('optimistic concurrency', () => {
    it('returns 409 CONCURRENT_UPDATE_CONFLICT when updateQuestionRow returns null', async () => {
      // Mock: updateQuestionRow returns empty rows → conflict
      const pool = buildMockPool({ updatedQuestionRow: null })
      const app = createTestApp(pool)

      const res = await app.request(PATCH_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '<p>Updated</p>',
          updatedAt: NOW_ISO,
        }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('CONCURRENT_UPDATE_CONFLICT')
    })

    it('rolls back transaction on concurrency conflict', async () => {
      const pool = buildMockPool({ updatedQuestionRow: null })
      const app = createTestApp(pool)

      await app.request(PATCH_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '<p>Conflicting update</p>',
          updatedAt: NOW_ISO,
        }),
      })

      const calls = pool.query.mock.calls.map((c: unknown[]) => (c[0] as string).trim())
      expect(calls).toContain('ROLLBACK')
      expect(calls).not.toContain('COMMIT')
    })
  })

  describe('not found', () => {
    it('returns 404 QUESTION_NOT_FOUND when question does not exist', async () => {
      // Mock: findQuestionById returns empty
      const pool = buildMockPool()
      pool.query.mockImplementation(async (sql: string) => {
        if (
          sql.includes('mcq_questions') &&
          sql.includes('SELECT') &&
          sql.includes('deleted_at IS NULL')
        ) {
          return { rows: [], rowCount: 0 }
        }
        return { rows: [], rowCount: 0 }
      })
      const app = createTestApp(pool)

      const res = await app.request(PATCH_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '<p>Orphan update</p>',
          updatedAt: NOW_ISO,
        }),
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('QUESTION_NOT_FOUND')
    })
  })

  describe('validation', () => {
    it('returns 422 when body is missing updated_at', async () => {
      const pool = buildMockPool()
      const app = createTestApp(pool)

      const res = await app.request(PATCH_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '<p>No timestamp</p>' }), // no updatedAt
      })

      expect(res.status).toBe(422)
    })
  })
})

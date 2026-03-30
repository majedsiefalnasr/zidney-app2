/**
 * Integration Tests: Concurrency guards for MCQ questions
 *
 * File: tests/integration/mcq-questions/concurrency.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T045
 *
 * Verifies optimistic concurrency enforcement:
 *   1. POST /mcq-questions — DB raises 23505 unique violation on concurrent insert → 409
 *   2. PATCH /mcq-questions/:id — updateQuestionRow returns null (stale timestamp) → 409
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
const _NOW_ISO = NOW.toISOString()

const BASE_URL = '/api/v1/backoffice/workspace/mcq-questions'

// ---------------------------------------------------------------------------
// Base rows
// ---------------------------------------------------------------------------

const QUESTION_ROW = {
  id: QUESTION_ID,
  subject_id: SUBJECT_ID,
  division_id: null,
  lesson_id: null,
  question_type: 'SINGLE',
  language: 'ar',
  content: '<p>What is 2+2?</p>',
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

const OPTION_ROWS = [
  {
    id: OPTION_ID_1,
    question_id: QUESTION_ID,
    content: '<p>4</p>',
    is_correct: true,
    order_index: 1,
    created_at: NOW,
  },
  {
    id: OPTION_ID_2,
    question_id: QUESTION_ID,
    content: '<p>5</p>',
    is_correct: false,
    order_index: 2,
    created_at: NOW,
  },
]

// ---------------------------------------------------------------------------
// Pool factories
// ---------------------------------------------------------------------------

/**
 * Pool for POST create where mcq_questions INSERT throws 23505.
 * The catch block in createQuestion translates 23505 → CONCURRENT_UPDATE_CONFLICT.
 */
function buildCreateRacePool() {
  const pg23505 = { code: '23505', message: 'duplicate key value violates unique constraint' }

  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }

      // Subject exists check
      if (s.includes('subjects') && s.includes('SELECT 1')) {
        return { rows: [{ count: '1' }], rowCount: 1 }
      }

      // INSERT mcq_questions → simulate unique constraint violation
      if (s.includes('mcq_questions') && s.includes('INSERT')) {
        throw pg23505
      }

      return { rows: [], rowCount: 0 }
    }),
  }
}

/**
 * Pool for PATCH update where updateQuestionRow returns empty rows (stale timestamp).
 * Service throws CONCURRENT_UPDATE_CONFLICT when `updated` is null.
 */
function buildUpdateRacePool() {
  let optionInsertCount = 0

  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }

      // Subject exists check
      if (s.includes('subjects') && s.includes('SELECT 1')) {
        return { rows: [{ count: '1' }], rowCount: 1 }
      }

      // findQuestionById
      if (s.includes('mcq_questions') && s.includes('SELECT') && s.includes('deleted_at IS NULL')) {
        return { rows: [QUESTION_ROW], rowCount: 1 }
      }

      // updateQuestionRow → returns empty rows (stale updated_at mismatch)
      if (s.includes('mcq_questions') && s.includes('UPDATE') && s.includes('RETURNING')) {
        return { rows: [], rowCount: 0 }
      }

      // options
      if (s.includes('mcq_question_options') && s.includes('SELECT')) {
        return { rows: OPTION_ROWS, rowCount: OPTION_ROWS.length }
      }
      if (s.includes('mcq_question_options') && s.includes('DELETE')) {
        return { rows: [], rowCount: 0 }
      }
      if (s.includes('mcq_question_options') && s.includes('INSERT')) {
        const row = OPTION_ROWS[optionInsertCount] ?? OPTION_ROWS[0]
        optionInsertCount++
        return { rows: [row], rowCount: 1 }
      }

      return { rows: [], rowCount: 0 }
    }),
  }
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function createTestApp(pool: Record<string, unknown>) {
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

describe('MCQ questions concurrency guards', () => {
  describe('POST /mcq-questions — creation race (23505 unique violation)', () => {
    it('returns 409 CONCURRENT_UPDATE_CONFLICT when INSERT raises 23505', async () => {
      const pool = buildCreateRacePool()
      const app = createTestApp(pool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: SUBJECT_ID,
          questionType: 'SINGLE',
          language: 'ar',
          content: '<p>What is 2+2?</p>',
          options: [
            { content: '<p>4</p>', isCorrect: true, orderIndex: 1 },
            { content: '<p>5</p>', isCorrect: false, orderIndex: 2 },
          ],
        }),
      })

      expect(res.status).toBe(409)

      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('CONCURRENT_UPDATE_CONFLICT')
    })
  })

  describe('PATCH /mcq-questions/:id — stale updated_at optimistic lock', () => {
    it('returns 409 CONCURRENT_UPDATE_CONFLICT when updateQuestionRow returns null rows', async () => {
      const pool = buildUpdateRacePool()
      const app = createTestApp(pool)

      const res = await app.request(`${BASE_URL}/${QUESTION_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // stale updated_at — server has a newer version
          updatedAt: new Date('2025-01-01T00:00:00.000Z').toISOString(),
          content: '<p>Updated content</p>',
          language: 'ar',
          isRevisionOnly: false,
          isExamOnly: false,
          options: [
            { content: '<p>4</p>', isCorrect: true, orderIndex: 1 },
            { content: '<p>5</p>', isCorrect: false, orderIndex: 2 },
          ],
        }),
      })

      expect(res.status).toBe(409)

      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('CONCURRENT_UPDATE_CONFLICT')
    })
  })
})

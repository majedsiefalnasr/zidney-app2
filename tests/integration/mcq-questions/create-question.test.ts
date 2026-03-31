/**
 * Integration Tests: POST /api/v1/backoffice/workspace/mcq-questions
 *
 * File: tests/integration/mcq-questions/create-question.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T038
 *
 * Tests the create-question route handler using a mock pg Pool.
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
const QUESTION_ID = '00000000-0000-0000-0000-000000000030'
const OPTION_ID_1 = '00000000-0000-0000-0000-000000000040'
const OPTION_ID_2 = '00000000-0000-0000-0000-000000000041'
const NOW = new Date('2026-01-01T00:00:00.000Z')

// ---------------------------------------------------------------------------
// Mock Pool
// ---------------------------------------------------------------------------

function buildMockPool(
  options: {
    subjectExists?: boolean
    questionRow?: Record<string, unknown>
    optionRows?: Record<string, unknown>[]
    throwOnInsert?: { code: string; message: string }
  } = {}
) {
  const { subjectExists = true, questionRow, optionRows, throwOnInsert } = options

  const defaultQuestionRow = {
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

  const defaultOptionRows = [
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

  const resolvedQuestionRow = questionRow ?? defaultQuestionRow
  const resolvedOptionRows = optionRows ?? defaultOptionRows

  let optionInsertCallCount = 0

  const pool = {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      // Transaction control
      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }

      // Existence checks (SELECT 1 AS count)
      if (s.includes('subjects') && s.includes('SELECT 1')) {
        if (!subjectExists) return { rows: [], rowCount: 0 }
        return { rows: [{ count: '1' }], rowCount: 1 }
      }
      if (s.includes('divisions') && s.includes('SELECT 1')) {
        return { rows: [{ count: '1' }], rowCount: 1 }
      }
      if (s.includes('lessons') && s.includes('SELECT 1')) {
        return { rows: [{ count: '1' }], rowCount: 1 }
      }

      // Insert question
      if (s.includes('mcq_questions') && s.includes('INSERT')) {
        if (throwOnInsert) throw throwOnInsert
        return { rows: [resolvedQuestionRow], rowCount: 1 }
      }

      // Insert option (called once per option)
      if (s.includes('mcq_question_options') && s.includes('INSERT')) {
        const row = resolvedOptionRows[optionInsertCallCount] ?? resolvedOptionRows[0]
        optionInsertCallCount++
        return { rows: [row], rowCount: 1 }
      }

      return { rows: [], rowCount: 0 }
    }),
  }

  return pool
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    subjectId: SUBJECT_ID,
    questionType: 'SINGLE',
    language: 'ar',
    content: '<p>What is 2+2?</p>',
    options: [
      { content: '<p>4</p>', isCorrect: true, orderIndex: 1 },
      { content: '<p>5</p>', isCorrect: false, orderIndex: 2 },
    ],
    ...overrides,
  })
}

const BASE_URL = '/api/v1/backoffice/workspace/mcq-questions'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /mcq-questions', () => {
  describe('SINGLE type — happy path', () => {
    it('creates a SINGLE question and returns 201', async () => {
      const pool = buildMockPool()
      const app = createTestApp(pool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody(),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe(QUESTION_ID)
      expect(body.data.question_type).toBe('SINGLE')
      expect(body.data.status).toBe('DRAFT')
      expect(body.data.options).toHaveLength(2)
      expect(body.error).toBeNull()
    })

    it('calls pool.query with BEGIN and COMMIT', async () => {
      const pool = buildMockPool()
      const app = createTestApp(pool)

      await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody(),
      })

      const calls = pool.query.mock.calls.map((c: unknown[]) => (c[0] as string).trim())
      expect(calls).toContain('BEGIN')
      expect(calls).toContain('COMMIT')
    })
  })

  describe('MULTIPLE type', () => {
    it('creates a MULTIPLE question with multiple correct options', async () => {
      const multipleRow = {
        id: QUESTION_ID,
        subject_id: SUBJECT_ID,
        division_id: null,
        lesson_id: null,
        question_type: 'MULTIPLE',
        language: 'ar',
        content: '<p>Select all prime numbers</p>',
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

      const optionRows = [
        {
          id: OPTION_ID_1,
          question_id: QUESTION_ID,
          content: '<p>2</p>',
          is_correct: true,
          order_index: 1,
          created_at: NOW,
        },
        {
          id: OPTION_ID_2,
          question_id: QUESTION_ID,
          content: '<p>3</p>',
          is_correct: true,
          order_index: 2,
          created_at: NOW,
        },
        {
          id: '00000000-0000-0000-0000-000000000042',
          question_id: QUESTION_ID,
          content: '<p>4</p>',
          is_correct: false,
          order_index: 3,
          created_at: NOW,
        },
      ]

      const pool = buildMockPool({ questionRow: multipleRow, optionRows })
      const app = createTestApp(pool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody({
          questionType: 'MULTIPLE',
          content: '<p>Select all prime numbers</p>',
          options: [
            { content: '<p>2</p>', isCorrect: true, orderIndex: 1 },
            { content: '<p>3</p>', isCorrect: true, orderIndex: 2 },
            { content: '<p>4</p>', isCorrect: false, orderIndex: 3 },
          ],
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.question_type).toBe('MULTIPLE')
      expect(body.data.options).toHaveLength(3)
    })
  })

  describe('TRUE_FALSE type', () => {
    it('creates a TRUE_FALSE question with exactly 2 options', async () => {
      const tfRow = {
        id: QUESTION_ID,
        subject_id: SUBJECT_ID,
        division_id: null,
        lesson_id: null,
        question_type: 'TRUE_FALSE',
        language: 'ar',
        content: '<p>The sky is blue</p>',
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

      const optionRows = [
        {
          id: OPTION_ID_1,
          question_id: QUESTION_ID,
          content: '<p>True</p>',
          is_correct: true,
          order_index: 1,
          created_at: NOW,
        },
        {
          id: OPTION_ID_2,
          question_id: QUESTION_ID,
          content: '<p>False</p>',
          is_correct: false,
          order_index: 2,
          created_at: NOW,
        },
      ]

      const pool = buildMockPool({ questionRow: tfRow, optionRows })
      const app = createTestApp(pool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody({
          questionType: 'TRUE_FALSE',
          content: '<p>The sky is blue</p>',
          options: [
            { content: '<p>True</p>', isCorrect: true, orderIndex: 1 },
            { content: '<p>False</p>', isCorrect: false, orderIndex: 2 },
          ],
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.question_type).toBe('TRUE_FALSE')
      expect(body.data.options).toHaveLength(2)
    })
  })

  describe('ARRANGEMENT type', () => {
    it('creates an ARRANGEMENT question with uniquely ordered options (all is_correct=false)', async () => {
      const arrRow = {
        id: QUESTION_ID,
        subject_id: SUBJECT_ID,
        division_id: null,
        lesson_id: null,
        question_type: 'ARRANGEMENT',
        language: 'ar',
        content: '<p>Order these steps</p>',
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

      const optionRows = [
        {
          id: OPTION_ID_1,
          question_id: QUESTION_ID,
          content: '<p>Step 1</p>',
          is_correct: false,
          order_index: 1,
          created_at: NOW,
        },
        {
          id: OPTION_ID_2,
          question_id: QUESTION_ID,
          content: '<p>Step 2</p>',
          is_correct: false,
          order_index: 2,
          created_at: NOW,
        },
      ]

      const pool = buildMockPool({ questionRow: arrRow, optionRows })
      const app = createTestApp(pool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody({
          questionType: 'ARRANGEMENT',
          content: '<p>Order these steps</p>',
          options: [
            { content: '<p>Step 1</p>', isCorrect: false, orderIndex: 1 },
            { content: '<p>Step 2</p>', isCorrect: false, orderIndex: 2 },
          ],
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.question_type).toBe('ARRANGEMENT')
    })
  })

  describe('validation errors', () => {
    it('returns 422 when subject_id is missing', async () => {
      const pool = buildMockPool()
      const app = createTestApp(pool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionType: 'SINGLE',
          language: 'ar',
          content: '<p>Test</p>',
          options: [
            { content: '<p>A</p>', isCorrect: true, orderIndex: 1 },
            { content: '<p>B</p>', isCorrect: false, orderIndex: 2 },
          ],
        }),
      })

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
    })

    it('returns 422 for SINGLE type with no correct option', async () => {
      const pool = buildMockPool()
      const app = createTestApp(pool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody({
          options: [
            { content: '<p>A</p>', isCorrect: false, orderIndex: 1 },
            { content: '<p>B</p>', isCorrect: false, orderIndex: 2 },
          ],
        }),
      })

      // Domain validation fires before DB → 422 INVALID_OPTION_CONFIGURATION
      expect(res.status).toBe(422)
    })

    it('returns 422 for SINGLE type with duplicate order_index', async () => {
      const pool = buildMockPool()
      const app = createTestApp(pool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody({
          options: [
            { content: '<p>A</p>', isCorrect: true, orderIndex: 1 },
            { content: '<p>B</p>', isCorrect: false, orderIndex: 1 }, // duplicate
          ],
        }),
      })

      expect(res.status).toBe(422)
    })
  })

  describe('academic boundary errors', () => {
    it('returns 404 when subject_id does not exist', async () => {
      const pool = buildMockPool({ subjectExists: false })
      const app = createTestApp(pool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody(),
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('SUBJECT_NOT_FOUND')
    })
  })

  describe('permission enforcement', () => {
    it('returns 403 when user lacks question_manage permission', async () => {
      const pool = buildMockPool()
      const app = new Hono()

      app.use('*', async (c, next) => {
        ;(c as any).set('tenant', { id: TENANT_ID, slug: 'test-ws', pool })
        ;(c as any).set('user', { id: USER_ID })
        ;(c as any).set('rbacContext', { permissions: [] }) // no permissions
        ;(c as any).set('correlation_id', 'corr-001')
        ;(c as any).set('workspace_slug', 'test-ws')
        ;(c as any).set('workspace_id', TENANT_ID)
        await next()
      })

      app.route('/api/v1/backoffice/workspace', mcqQuestionsRouter)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody(),
      })

      expect(res.status).toBe(403)
    })
  })

  describe('content sanitization', () => {
    it('sanitizes XSS in content field — stored content is clean HTML', async () => {
      const xssPool = buildMockPool({
        questionRow: {
          id: QUESTION_ID,
          subject_id: SUBJECT_ID,
          division_id: null,
          lesson_id: null,
          question_type: 'SINGLE',
          language: 'ar',
          content: 'alert(1)', // sanitized output — no script tags
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
        },
      })
      const app = createTestApp(xssPool)

      const res = await app.request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody({
          content: '<script>alert(1)</script><p>Valid content</p>',
        }),
      })

      // Route completes — sanitizer strips the script tag, inserts clean content
      expect(res.status).toBe(201)

      // Verify the query called on INSERT does NOT contain the raw script tag
      const insertCall = xssPool.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' && c[0].includes('mcq_questions') && c[0].includes('INSERT')
      )
      expect(insertCall).toBeDefined()
      const insertArgs = insertCall![1] as unknown[]
      const contentArg = insertArgs.find(
        (a) => typeof a === 'string' && (a as string).toLowerCase().includes('valid content')
      )
      expect(contentArg).toBeDefined()
      const contentStr = contentArg as string
      expect(contentStr).not.toContain('<script>')
    })
  })
})

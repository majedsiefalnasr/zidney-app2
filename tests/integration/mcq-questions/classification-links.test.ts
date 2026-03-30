/**
 * Integration Tests: Classification link/unlink endpoints
 *
 * File: tests/integration/mcq-questions/classification-links.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T042
 *
 * Tests category, tag, and basket link/unlink handlers using a mock pg Pool.
 * No real database connection is required.
 *
 * Covered routes:
 *   POST   /mcq-questions/:id/categories
 *   DELETE /mcq-questions/:id/categories/:categoryValueId
 *   POST   /mcq-questions/:id/tags
 *   DELETE /mcq-questions/:id/tags/:tagId
 *   POST   /mcq-questions/:id/baskets
 *   DELETE /mcq-questions/:id/baskets/:basketId
 */

import { mcqQuestionsRouter } from '@zidney/app/api/routes/backoffice/mcq-questions/index'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const USER_ID = '00000000-0000-0000-0000-000000000010'
const QUESTION_ID = '00000000-0000-0000-0000-000000000030'
const CATEGORY_VALUE_ID = '00000000-0000-0000-0000-000000000050'
const TAG_ID = '00000000-0000-0000-0000-000000000060'
const BASKET_ID = '00000000-0000-0000-0000-000000000070'
const CATEGORY_LINK_ID = '00000000-0000-0000-0000-000000000080'
const TAG_LINK_ID = '00000000-0000-0000-0000-000000000081'
const BASKET_LINK_ID = '00000000-0000-0000-0000-000000000082'
const NOW = new Date('2026-01-01T00:00:00.000Z')

// ---------------------------------------------------------------------------
// Shared question row (used in all findQuestionById calls)
// ---------------------------------------------------------------------------

const QUESTION_ROW = {
  id: QUESTION_ID,
  subject_id: '00000000-0000-0000-0000-000000000020',
  division_id: null,
  lesson_id: null,
  question_type: 'SINGLE',
  language: 'ar',
  content: '<p>Q</p>',
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

// ---------------------------------------------------------------------------
// Mock Pool / App Factories
// ---------------------------------------------------------------------------

/**
 * Builds a mock pool for category / tag link tests (no transaction needed).
 */
function buildCategoryPool(
  opts: {
    questionExists?: boolean
    categoryValueExists?: boolean
    throwOnInsert?: { code: string; message: string }
    deleteRowCount?: number
  } = {}
) {
  const {
    questionExists = true,
    categoryValueExists = true,
    throwOnInsert,
    deleteRowCount = 1,
  } = opts

  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      // findQuestionById
      if (s.includes('mcq_questions') && s.includes('SELECT') && !s.includes('INSERT')) {
        if (!questionExists) return { rows: [], rowCount: 0 }
        return { rows: [QUESTION_ROW], rowCount: 1 }
      }

      // checkCategoryValueExists
      if (s.includes('category_values') && s.includes('SELECT 1')) {
        if (!categoryValueExists) return { rows: [], rowCount: 0 }
        return { rows: [{ count: '1' }], rowCount: 1 }
      }

      // insertQuestionCategory (INSERT ... RETURNING)
      if (s.includes('mcq_question_categories') && s.includes('INSERT')) {
        if (throwOnInsert) throw throwOnInsert
        return {
          rows: [
            {
              id: CATEGORY_LINK_ID,
              question_id: QUESTION_ID,
              category_value_id: CATEGORY_VALUE_ID,
            },
          ],
          rowCount: 1,
        }
      }

      // deleteQuestionCategory (DELETE)
      if (s.includes('mcq_question_categories') && s.includes('DELETE')) {
        return { rows: [], rowCount: deleteRowCount }
      }

      return { rows: [], rowCount: 0 }
    }),
  }
}

function buildTagPool(
  opts: {
    questionExists?: boolean
    tagExists?: boolean
    throwOnInsert?: { code: string; message: string }
    deleteRowCount?: number
  } = {}
) {
  const { questionExists = true, tagExists = true, throwOnInsert, deleteRowCount = 1 } = opts

  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      // findQuestionById
      if (s.includes('mcq_questions') && s.includes('SELECT') && !s.includes('INSERT')) {
        if (!questionExists) return { rows: [], rowCount: 0 }
        return { rows: [QUESTION_ROW], rowCount: 1 }
      }

      // checkTagExists
      if (s.includes('FROM tags') && s.includes('SELECT 1')) {
        if (!tagExists) return { rows: [], rowCount: 0 }
        return { rows: [{ count: '1' }], rowCount: 1 }
      }

      // insertQuestionTag
      if (s.includes('mcq_question_tags') && s.includes('INSERT')) {
        if (throwOnInsert) throw throwOnInsert
        return {
          rows: [{ id: TAG_LINK_ID, question_id: QUESTION_ID, tag_id: TAG_ID }],
          rowCount: 1,
        }
      }

      // deleteQuestionTag
      if (s.includes('mcq_question_tags') && s.includes('DELETE')) {
        return { rows: [], rowCount: deleteRowCount }
      }

      return { rows: [], rowCount: 0 }
    }),
  }
}

/**
 * Builds a mock pool for basket link tests (requires a transaction client).
 * linkBasket calls db.connect() → client.{BEGIN, INSERT, COMMIT}
 * unlinkBasket uses pool.query directly (no TX).
 */
function buildBasketPool(
  opts: {
    questionExists?: boolean
    basketExists?: boolean
    basketMaxQuestions?: number | null
    currentLinkCount?: number
    throwOnInsert?: { code: string; message: string }
    deleteRowCount?: number
  } = {}
) {
  const {
    questionExists = true,
    basketExists = true,
    basketMaxQuestions = 100,
    currentLinkCount = 0,
    throwOnInsert,
    deleteRowCount = 1,
  } = opts

  const mockClient = {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()
      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }
      if (s.includes('mcq_question_baskets') && s.includes('INSERT')) {
        if (throwOnInsert) throw throwOnInsert
        return {
          rows: [{ id: BASKET_LINK_ID, question_id: QUESTION_ID, basket_id: BASKET_ID }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  }

  const pool = {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      // findQuestionById
      if (
        s.includes('mcq_questions') &&
        s.includes('SELECT') &&
        !s.includes('mcq_question_baskets')
      ) {
        if (!questionExists) return { rows: [], rowCount: 0 }
        return { rows: [QUESTION_ROW], rowCount: 1 }
      }

      // findBasketForLinking
      if (s.includes('mcq_baskets') && s.includes('SELECT')) {
        if (!basketExists) return { rows: [], rowCount: 0 }
        return { rows: [{ id: BASKET_ID, max_questions: basketMaxQuestions }], rowCount: 1 }
      }

      // countBasketQuestionLinks
      if (s.includes('mcq_question_baskets') && s.includes('COUNT')) {
        return { rows: [{ count: String(currentLinkCount) }], rowCount: 1 }
      }

      // deleteQuestionBasket
      if (s.includes('mcq_question_baskets') && s.includes('DELETE')) {
        return { rows: [], rowCount: deleteRowCount }
      }

      return { rows: [], rowCount: 0 }
    }),
    connect: vi.fn().mockResolvedValue(mockClient),
  }

  return { pool, mockClient }
}

function createTestApp(pool: {
  query: ReturnType<typeof vi.fn>
  connect?: ReturnType<typeof vi.fn>
}) {
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

const BASE = `/api/v1/backoffice/workspace/mcq-questions/${QUESTION_ID}`

// ---------------------------------------------------------------------------
// Category Link Tests
// ---------------------------------------------------------------------------

describe('POST /mcq-questions/:id/categories', () => {
  it('links a category — 201 { linked: true }', async () => {
    const pool = buildCategoryPool()
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryValueId: CATEGORY_VALUE_ID }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.linked).toBe(true)
    expect(body.error).toBeNull()
  })

  it('returns 409 on duplicate link (23505)', async () => {
    const pool = buildCategoryPool({
      throwOnInsert: { code: '23505', message: 'unique violation' },
    })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryValueId: CATEGORY_VALUE_ID }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('QUESTION_CATEGORY_ALREADY_LINKED')
  })

  it('returns 422 when category value not found', async () => {
    const pool = buildCategoryPool({ categoryValueExists: false })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryValueId: CATEGORY_VALUE_ID }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('CATEGORY_VALUE_NOT_FOUND')
  })

  it('returns 404 when question not found', async () => {
    const pool = buildCategoryPool({ questionExists: false })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryValueId: CATEGORY_VALUE_ID }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('QUESTION_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// Category Unlink Tests
// ---------------------------------------------------------------------------

describe('DELETE /mcq-questions/:id/categories/:categoryValueId', () => {
  it('unlinks a category — 200 { deleted: true }', async () => {
    const pool = buildCategoryPool({ deleteRowCount: 1 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/categories/${CATEGORY_VALUE_ID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.deleted).toBe(true)
  })

  it('returns 422 when link not found (rowCount=0)', async () => {
    const pool = buildCategoryPool({ deleteRowCount: 0 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/categories/${CATEGORY_VALUE_ID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('QUESTION_CATEGORY_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// Tag Link Tests
// ---------------------------------------------------------------------------

describe('POST /mcq-questions/:id/tags', () => {
  it('links a tag — 201 { linked: true }', async () => {
    const pool = buildTagPool()
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: TAG_ID }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.linked).toBe(true)
  })

  it('returns 422 when tag not found', async () => {
    const pool = buildTagPool({ tagExists: false })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: TAG_ID }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('TAG_NOT_FOUND')
  })

  it('returns 409 on duplicate tag link (23505)', async () => {
    const pool = buildTagPool({ throwOnInsert: { code: '23505', message: 'unique violation' } })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: TAG_ID }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('QUESTION_TAG_ALREADY_LINKED')
  })
})

// ---------------------------------------------------------------------------
// Tag Unlink Tests
// ---------------------------------------------------------------------------

describe('DELETE /mcq-questions/:id/tags/:tagId', () => {
  it('unlinks a tag — 200 { deleted: true }', async () => {
    const pool = buildTagPool({ deleteRowCount: 1 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/tags/${TAG_ID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('returns 422 when tag link not found', async () => {
    const pool = buildTagPool({ deleteRowCount: 0 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/tags/${TAG_ID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('QUESTION_TAG_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// Basket Link Tests
// ---------------------------------------------------------------------------

describe('POST /mcq-questions/:id/baskets', () => {
  it('links a basket — 201 { linked: true }, uses transaction', async () => {
    const { pool, mockClient } = buildBasketPool({ basketMaxQuestions: 100, currentLinkCount: 5 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/baskets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basketId: BASKET_ID }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.linked).toBe(true)
    // A transaction was used
    expect(pool.connect).toHaveBeenCalledOnce()
    expect(mockClient.release).toHaveBeenCalledOnce()
  })

  it('returns 422 when basket max_questions reached', async () => {
    const { pool } = buildBasketPool({ basketMaxQuestions: 5, currentLinkCount: 5 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/baskets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basketId: BASKET_ID }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('BASKET_MAX_QUESTIONS_REACHED')
  })

  it('returns 409 on duplicate basket link (23505)', async () => {
    const { pool } = buildBasketPool({
      throwOnInsert: { code: '23505', message: 'unique violation' },
    })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/baskets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basketId: BASKET_ID }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('QUESTION_BASKET_ALREADY_LINKED')
  })

  it('returns 422 when basket not found', async () => {
    const { pool } = buildBasketPool({ basketExists: false })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/baskets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basketId: BASKET_ID }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('BASKET_NOT_FOUND')
  })

  it('returns 404 when question not found (basket link)', async () => {
    const { pool } = buildBasketPool({ questionExists: false })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/baskets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basketId: BASKET_ID }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('QUESTION_NOT_FOUND')
  })

  it('links basket with no max_questions limit (null)', async () => {
    const { pool } = buildBasketPool({ basketMaxQuestions: null, currentLinkCount: 9999 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/baskets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basketId: BASKET_ID }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.linked).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Basket Unlink Tests
// ---------------------------------------------------------------------------

describe('DELETE /mcq-questions/:id/baskets/:basketId', () => {
  it('unlinks a basket — 200 { deleted: true }', async () => {
    const { pool } = buildBasketPool({ deleteRowCount: 1 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/baskets/${BASKET_ID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('returns 404 when basket link not found (rowCount=0)', async () => {
    const { pool } = buildBasketPool({ deleteRowCount: 0 })
    const app = createTestApp(pool)

    const res = await app.request(`${BASE}/baskets/${BASKET_ID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('QUESTION_BASKET_NOT_FOUND')
  })
})

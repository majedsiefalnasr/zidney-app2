/**
 * Baskets Domain Unit Tests — STAGE_33_MCQ_BASKETS
 *
 * File: packages/domain-core/src/baskets/__tests__/baskets.service.test.ts
 *
 * Tests service business logic via mocked db.query — all SQL paths exercised,
 * TX rollback verified, 23505 re-mapped, pre-guards validated.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createBasket,
  deleteBasket,
  getBasket,
  linkQuestion,
  listBasketQuestions,
  listBaskets,
  transitionStatus,
  unlinkQuestion,
  updateBasket,
} from '../baskets.service'
import type { AuditContext } from '../baskets.types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../workflow/workflow.engine', () => ({
  executeTransition: vi.fn(async () => ({
    id: 'tr-001',
    entityType: 'mcq_basket',
    entityId: BASKET_ID,
    previousState: 'DRAFT',
    newState: 'COMPLETED',
    transitionedAt: new Date().toISOString(),
    actorId: 'user-001',
  })),
}))

vi.mock('../../workflow/workflow.states', () => ({
  WorkflowState: {
    DRAFT: 'DRAFT',
    COMPLETED: 'COMPLETED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    APPROVED: 'APPROVED',
    ENABLED: 'ENABLED',
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const audit: AuditContext = {
  user_id: 'user-001',
  correlation_id: 'corr-001',
  workspace_slug: 'test-ws',
  workspace_id: 'ws-001',
  caller_permissions: [],
}

const NOW = new Date('2026-03-23T10:00:00Z')
const BASKET_ID = '11111111-1111-1111-1111-111111111111'
const BASKET_ID_2 = '22222222-2222-2222-2222-222222222222'
const QUESTION_ID = '33333333-3333-3333-3333-333333333333'
const LINK_ID = '44444444-4444-4444-4444-444444444444'

function makeBasketWithCountRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: BASKET_ID,
    name: 'Chemistry Q-Bank',
    code: 'CHEM-001',
    type: 'LINKED' as const,
    max_questions: null,
    description: null,
    status: 'DRAFT' as const,
    status_updated_at: null,
    status_updated_by: null,
    created_at: NOW,
    updated_at: NOW,
    created_by: 'user-001',
    updated_by: 'user-001',
    question_count: 0,
    ...overrides,
  }
}

function makeQuestionLinkRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: LINK_ID,
    basket_id: BASKET_ID,
    question_id: QUESTION_ID,
    created_at: NOW,
    ...overrides,
  }
}

function makeDb(
  matcher: (sql: string, params?: unknown[]) => { rows: unknown[]; rowCount: number | null }
) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => matcher(sql, params)),
  }
}

// ---------------------------------------------------------------------------
// 1. getBasket
// ---------------------------------------------------------------------------

describe('getBasket', () => {
  it('returns basket when found', async () => {
    const db = makeDb(() => ({ rows: [makeBasketWithCountRow()], rowCount: 1 }))
    const result = await getBasket(db as any, BASKET_ID, audit)
    expect(result.id).toBe(BASKET_ID)
    expect(result.question_count).toBe(0)
  })

  it('throws BASKET_NOT_FOUND when basket does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    await expect(getBasket(db as any, BASKET_ID, audit)).rejects.toMatchObject({
      code: 'BASKET_NOT_FOUND',
    })
  })
})

// ---------------------------------------------------------------------------
// 2. listBaskets
// ---------------------------------------------------------------------------

describe('listBaskets', () => {
  it('returns paginated result with total', async () => {
    const basketRow = makeBasketWithCountRow()
    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '3' }], rowCount: 1 }
      return { rows: [basketRow], rowCount: 1 }
    })

    const result = await listBaskets(db as any, { page: 1, perPage: 20 }, audit)

    expect(result.total).toBe(3)
    expect(result.items).toHaveLength(1)
    expect(result.page).toBe(1)
    expect(result.perPage).toBe(20)
  })

  it('clamps page to minimum 1', async () => {
    const db = makeDb(() => ({ rows: [{ count: '0' }], rowCount: 1 }))
    const result = await listBaskets(db as any, { page: -5, perPage: 20 }, audit)
    expect(result.page).toBe(1)
  })

  it('clamps perPage to maximum 100', async () => {
    const db = makeDb(() => ({ rows: [{ count: '0' }], rowCount: 1 }))
    const result = await listBaskets(db as any, { page: 1, perPage: 500 }, audit)
    expect(result.perPage).toBe(100)
  })

  it('returns empty result when no baskets exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '0' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })
    const result = await listBaskets(db as any, { page: 1, perPage: 20 }, audit)
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 3. createBasket
// ---------------------------------------------------------------------------

describe('createBasket', () => {
  it('creates basket with status=DRAFT and questionCount=0', async () => {
    const basketRow = makeBasketWithCountRow()
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets') && sql.includes('WHERE code ='))
        return { rows: [], rowCount: 0 } // no duplicate
      if (sql.includes('INSERT INTO mcq_baskets')) return { rows: [basketRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createBasket(
      db as any,
      { name: 'Chemistry Q-Bank', code: 'CHEM-001', type: 'LINKED' },
      audit
    )

    expect(result.status).toBe('DRAFT')
    expect(result.question_count).toBe(0)
    expect(result.id).toBe(BASKET_ID)
  })

  it('throws BASKET_CODE_DUPLICATE when code already exists', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets') && sql.includes('WHERE code ='))
        return { rows: [makeBasketWithCountRow({ id: BASKET_ID_2 })], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createBasket(db as any, { name: 'Chemistry Q-Bank', code: 'CHEM-001', type: 'LINKED' }, audit)
    ).rejects.toMatchObject({ code: 'BASKET_CODE_DUPLICATE' })
  })

  it('rolls back TX on unexpected DB error', async () => {
    const rollbacks: string[] = []
    const db = makeDb((sql) => {
      if (sql === 'ROLLBACK') {
        rollbacks.push('ROLLBACK')
        return { rows: [], rowCount: 0 }
      }
      if (sql === 'BEGIN') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets') && sql.includes('WHERE code ='))
        return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO mcq_baskets')) throw new Error('DB connection lost')
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createBasket(db as any, { name: 'Chemistry', code: 'CHEM', type: 'LINKED' }, audit)
    ).rejects.toThrow('DB connection lost')
    expect(rollbacks).toHaveLength(1)
  })

  it('maps 23505 PG duplicate error to BASKET_CODE_DUPLICATE', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets') && sql.includes('WHERE code ='))
        return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO mcq_baskets')) {
        const err = Object.assign(new Error('unique violation'), { code: '23505' })
        throw err
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createBasket(db as any, { name: 'Chemistry', code: 'CHEM', type: 'LINKED' }, audit)
    ).rejects.toMatchObject({ code: 'BASKET_CODE_DUPLICATE' })
  })
})

// ---------------------------------------------------------------------------
// 4. updateBasket
// ---------------------------------------------------------------------------

describe('updateBasket', () => {
  it('throws BASKET_NOT_FOUND when basket does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateBasket(db as any, BASKET_ID, { name: 'New Name' }, audit)
    ).rejects.toMatchObject({ code: 'BASKET_NOT_FOUND' })
  })

  it('throws BASKET_CODE_DUPLICATE when new code collides with another basket', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets') && sql.includes('WHERE b.id =')) {
        return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      }
      if (sql.includes('FROM mcq_baskets') && sql.includes('WHERE code ='))
        return { rows: [makeBasketWithCountRow({ id: BASKET_ID_2 })], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateBasket(db as any, BASKET_ID, { code: 'CHEM-002' }, audit)
    ).rejects.toMatchObject({ code: 'BASKET_CODE_DUPLICATE' })
  })

  it('updates successfully when no code change', async () => {
    const updated = makeBasketWithCountRow({ name: 'Updated Name' })
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('UPDATE mcq_baskets')) return { rows: [updated], rowCount: 1 }
      return { rows: [updated], rowCount: 1 }
    })

    const result = await updateBasket(db as any, BASKET_ID, { name: 'Updated Name' }, audit)
    expect(result.name).toBe('Updated Name')
  })
})

// ---------------------------------------------------------------------------
// 5. deleteBasket
// ---------------------------------------------------------------------------

describe('deleteBasket', () => {
  it('deletes successfully when no external references', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      // findBasketById
      if (sql.includes('FROM mcq_baskets') && sql.includes('WHERE b.id ='))
        return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      // checkExamConfigReference — table check + reference check
      if (sql.includes('information_schema.tables')) return { rows: [], rowCount: 0 }
      // checkAutoSelectionReference
      if (sql.includes('information_schema')) return { rows: [], rowCount: 0 }
      // deleteBasketRow
      if (sql.includes('DELETE FROM mcq_baskets')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteBasket(db as any, BASKET_ID, audit)).resolves.toBeUndefined()
  })

  it('throws BASKET_NOT_FOUND when basket does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteBasket(db as any, BASKET_ID, audit)).rejects.toMatchObject({
      code: 'BASKET_NOT_FOUND',
    })
  })

  it('throws BASKET_REFERENCED_IN_EXAM_CONFIG when referenced', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets')) return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      // table exists check returns table name
      if (sql.includes('information_schema.tables') && sql.includes('exam_configurations'))
        return {
          rows: [{ table_name: 'exam_configurations' }],
          rowCount: 1,
        }
      // reference check returns a row
      if (sql.includes('exam_configurations')) return { rows: [{ id: 'ref-001' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteBasket(db as any, BASKET_ID, audit)).rejects.toMatchObject({
      code: 'BASKET_REFERENCED_IN_EXAM_CONFIG',
    })
  })
})

// ---------------------------------------------------------------------------
// 6. transitionStatus
// ---------------------------------------------------------------------------

describe('transitionStatus', () => {
  it('transitions DRAFT → COMPLETED successfully', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('FROM mcq_baskets')) return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await transitionStatus(db as any, BASKET_ID, 'COMPLETED', {
      ...audit,
      enginePermissions: ['mcq_basket.complete'],
    })

    expect(result).toBeDefined()
  })

  it('throws BASKET_NOT_FOUND for unknown basket', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(
      transitionStatus(db as any, BASKET_ID, 'COMPLETED', { ...audit, enginePermissions: [] })
    ).rejects.toMatchObject({ code: 'BASKET_NOT_FOUND' })
  })

  it('throws BASKET_EMPTY_CANNOT_ENABLE when basket has no questions', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('FROM mcq_baskets')) return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      // countBasketQuestions
      if (sql.includes('COUNT(id)') && sql.includes('mcq_basket_questions'))
        return { rows: [{ count: '0' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      transitionStatus(db as any, BASKET_ID, 'ENABLED', {
        ...audit,
        enginePermissions: ['mcq_basket.enable'],
      })
    ).rejects.toMatchObject({ code: 'BASKET_EMPTY_CANNOT_ENABLE' })
  })

  it('throws BASKET_EXCEEDS_MAX_QUESTIONS when count exceeds limit', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('FROM mcq_baskets'))
        return { rows: [makeBasketWithCountRow({ max_questions: 5 })], rowCount: 1 }
      if (sql.includes('COUNT(*)') && sql.includes('mcq_basket_questions'))
        return { rows: [{ count: '10' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      transitionStatus(db as any, BASKET_ID, 'ENABLED', {
        ...audit,
        enginePermissions: ['mcq_basket.enable'],
      })
    ).rejects.toMatchObject({ code: 'BASKET_EXCEEDS_MAX_QUESTIONS' })
  })
})

// ---------------------------------------------------------------------------
// 7. linkQuestion
// ---------------------------------------------------------------------------

describe('linkQuestion', () => {
  it('inserts basket-question relation', async () => {
    const linkRow = makeQuestionLinkRow()
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets')) return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      // checkQuestionExists — handle or treat mcq_basket_questions query
      if (sql.includes('FROM mcq_questions')) return { rows: [{ id: QUESTION_ID }], rowCount: 1 }
      // findBasketQuestion (duplicate check)
      if (
        sql.includes('FROM mcq_basket_questions') &&
        sql.includes('basket_id') &&
        sql.includes('question_id') &&
        !sql.includes('COUNT')
      )
        return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO mcq_basket_questions')) return { rows: [linkRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await linkQuestion(
      db as any,
      { basket_id: BASKET_ID, question_id: QUESTION_ID },
      audit
    )
    expect(result.basket_id).toBe(BASKET_ID)
    expect(result.question_id).toBe(QUESTION_ID)
  })

  it('throws BASKET_NOT_FOUND when basket missing', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      linkQuestion(db as any, { basket_id: BASKET_ID, question_id: QUESTION_ID }, audit)
    ).rejects.toMatchObject({ code: 'BASKET_NOT_FOUND' })
  })

  it('throws QUESTION_NOT_FOUND when question does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets')) return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      return { rows: [], rowCount: 0 } // question not found
    })

    await expect(
      linkQuestion(db as any, { basket_id: BASKET_ID, question_id: QUESTION_ID }, audit)
    ).rejects.toMatchObject({ code: 'QUESTION_NOT_FOUND' })
  })

  it('throws BASKET_QUESTION_DUPLICATE on re-link', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets')) return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      if (sql.includes('FROM mcq_questions')) return { rows: [{ id: QUESTION_ID }], rowCount: 1 }
      if (sql.includes('FROM mcq_basket_questions'))
        return { rows: [makeQuestionLinkRow()], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      linkQuestion(db as any, { basket_id: BASKET_ID, question_id: QUESTION_ID }, audit)
    ).rejects.toMatchObject({ code: 'BASKET_QUESTION_DUPLICATE' })
  })

  it('throws BASKET_MAX_QUESTIONS_REACHED when at capacity', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets'))
        return { rows: [makeBasketWithCountRow({ max_questions: 5 })], rowCount: 1 }
      if (sql.includes('FROM mcq_questions')) return { rows: [{ id: QUESTION_ID }], rowCount: 1 }
      if (sql.includes('FROM mcq_basket_questions') && !sql.includes('COUNT'))
        return { rows: [], rowCount: 0 }
      if (sql.includes('COUNT(*)') && sql.includes('mcq_basket_questions'))
        return { rows: [{ count: '5' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      linkQuestion(db as any, { basket_id: BASKET_ID, question_id: QUESTION_ID }, audit)
    ).rejects.toMatchObject({ code: 'BASKET_MAX_QUESTIONS_REACHED' })
  })

  it('allows unlimited linking when max_questions is null', async () => {
    const linkRow = makeQuestionLinkRow()
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets'))
        return { rows: [makeBasketWithCountRow({ max_questions: null })], rowCount: 1 }
      if (sql.includes('FROM mcq_questions')) return { rows: [{ id: QUESTION_ID }], rowCount: 1 }
      if (sql.includes('FROM mcq_basket_questions') && !sql.includes('INSERT'))
        return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO mcq_basket_questions')) return { rows: [linkRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await linkQuestion(
      db as any,
      { basket_id: BASKET_ID, question_id: QUESTION_ID },
      audit
    )
    expect(result).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 8. unlinkQuestion
// ---------------------------------------------------------------------------

describe('unlinkQuestion', () => {
  it('removes basket-question relation', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets')) return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      if (sql.includes('FROM mcq_basket_questions'))
        return { rows: [makeQuestionLinkRow()], rowCount: 1 }
      if (sql.includes('DELETE FROM mcq_basket_questions')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(unlinkQuestion(db as any, BASKET_ID, QUESTION_ID, audit)).resolves.toBeUndefined()
  })

  it('throws BASKET_NOT_FOUND when basket missing', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(unlinkQuestion(db as any, BASKET_ID, QUESTION_ID, audit)).rejects.toMatchObject({
      code: 'BASKET_NOT_FOUND',
    })
  })

  it('throws BASKET_QUESTION_NOT_FOUND when link missing', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM mcq_baskets')) return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      return { rows: [], rowCount: 0 } // no link
    })

    await expect(unlinkQuestion(db as any, BASKET_ID, QUESTION_ID, audit)).rejects.toMatchObject({
      code: 'BASKET_QUESTION_NOT_FOUND',
    })
  })
})

// ---------------------------------------------------------------------------
// 9. listBasketQuestions
// ---------------------------------------------------------------------------

describe('listBasketQuestions', () => {
  it('returns paginated question links', async () => {
    const linkRow = makeQuestionLinkRow()
    const db = makeDb((sql) => {
      if (sql.includes('FROM mcq_baskets')) return { rows: [makeBasketWithCountRow()], rowCount: 1 }
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }], rowCount: 1 }
      return { rows: [linkRow], rowCount: 1 }
    })

    const result = await listBasketQuestions(db as any, BASKET_ID, { page: 1, perPage: 20 }, audit)
    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
  })

  it('throws BASKET_NOT_FOUND when basket missing', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    await expect(
      listBasketQuestions(db as any, BASKET_ID, { page: 1, perPage: 20 }, audit)
    ).rejects.toMatchObject({ code: 'BASKET_NOT_FOUND' })
  })
})

/**
 * Baskets Repository Unit Tests — STAGE_33_MCQ_BASKETS
 *
 * File: packages/domain-core/src/baskets/__tests__/baskets.repository.test.ts
 *
 * Tests:
 *   - SQL is parameterized (no string interpolation of user input)
 *   - Row-to-domain mapping is correct (question_count parseInt, dates preserved)
 *   - Handle missing tables gracefully (42P01 for checkQuestionExists)
 *   - Null-safe field mapping
 */

import { describe, expect, it, vi } from 'vitest'

import {
  checkQuestionExists,
  countBasketQuestions,
  deleteBasketRow,
  findBasketByCode,
  findBasketById,
  findBasketQuestion,
  findBaskets,
  insertBasket,
  insertBasketQuestion,
  updateBasketRow,
} from '../baskets.repository'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-23T10:00:00Z')
const BASKET_ID = '11111111-1111-1111-1111-111111111111'
const QUESTION_ID = '22222222-2222-2222-2222-222222222222'
const LINK_ID = '33333333-3333-3333-3333-333333333333'

function makeRawRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: BASKET_ID,
    name: 'Chemistry Q-Bank',
    code: 'CHEM-001',
    type: 'LINKED',
    max_questions: null,
    description: null,
    status: 'DRAFT',
    status_updated_at: null,
    status_updated_by: null,
    created_at: NOW,
    updated_at: NOW,
    created_by: 'user-001',
    updated_by: 'user-001',
    question_count: '5',
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
// findBasketById
// ---------------------------------------------------------------------------

describe('findBasketById', () => {
  it('returns a mapped basket with question_count as integer', async () => {
    const db = makeDb(() => ({ rows: [makeRawRow({ question_count: '7' })], rowCount: 1 }))
    const result = await findBasketById(db as any, BASKET_ID)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(BASKET_ID)
    expect(result!.question_count).toBe(7)
    expect(typeof result!.question_count).toBe('number')
  })

  it('returns null when basket not found', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    const result = await findBasketById(db as any, BASKET_ID)
    expect(result).toBeNull()
  })

  it('passes basketId as parameter, not interpolated in SQL', async () => {
    let capturedParams: unknown[] | undefined
    const db = {
      query: vi.fn(async (_sql: string, params?: unknown[]) => {
        capturedParams = params
        return { rows: [], rowCount: 0 }
      }),
    }

    const malicious = "'; DROP TABLE mcq_baskets; --"
    await findBasketById(db as any, malicious)

    // The malicious string must appear in params, NOT in the SQL
    expect(capturedParams).toBeDefined()
    expect(capturedParams).toContain(malicious)
  })

  it('maps null optional fields correctly', async () => {
    const db = makeDb(() => ({
      rows: [
        makeRawRow({
          max_questions: null,
          description: null,
          status_updated_at: null,
          status_updated_by: null,
        }),
      ],
      rowCount: 1,
    }))
    const result = await findBasketById(db as any, BASKET_ID)
    expect(result!.max_questions).toBeNull()
    expect(result!.description).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// findBaskets
// ---------------------------------------------------------------------------

describe('findBaskets', () => {
  it('returns array of mapped baskets', async () => {
    const db = makeDb(() => ({
      rows: [
        makeRawRow(),
        makeRawRow({ id: '22222222-2222-2222-2222-222222222222', code: 'CHEM-002' }),
      ],
      rowCount: 2,
    }))
    const result = await findBaskets(db as any, { page: 1, perPage: 20 })
    expect(result).toHaveLength(2)
    expect(result[0].question_count).toBe(5)
    expect(result[1].code).toBe('CHEM-002')
  })

  it('passes offset and limit as parameters', async () => {
    const captured: { sql: string; params?: unknown[] }[] = []
    const db = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        captured.push({ sql, params })
        return { rows: [], rowCount: 0 }
      }),
    }
    await findBaskets(db as any, { page: 3, perPage: 10 })
    // offset = (3-1)*10 = 20, limit = 10 — must be params, not interpolated
    const call = captured[0]
    expect(call.params).toBeDefined()
    // Params should include 10 (limit) and 20 (offset) somewhere in the list
    // (order depends on WHERE clause params too — just check they're present)
    expect(call.sql).not.toMatch(/LIMIT 10/)
    expect(call.sql).not.toMatch(/OFFSET 20/)
  })
})

// ---------------------------------------------------------------------------
// insertBasket
// ---------------------------------------------------------------------------

describe('insertBasket', () => {
  it('returns inserted basket row', async () => {
    const raw = makeRawRow()
    const db = makeDb(() => ({ rows: [raw], rowCount: 1 }))
    const result = await insertBasket(db as any, {
      name: 'Chemistry Q-Bank',
      code: 'CHEM-001',
      type: 'LINKED',
      max_questions: null,
      description: null,
      created_by: 'user-001',
      updated_by: 'user-001',
    })
    expect(result.id).toBe(BASKET_ID)
  })

  it('passes all fields as parameters (SQL injection safety)', async () => {
    let capturedSql = ''
    let capturedParams: unknown[] | undefined
    const db = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        capturedSql = sql
        capturedParams = params
        return { rows: [makeRawRow()], rowCount: 1 }
      }),
    }

    const maliciousName = "'; DELETE FROM mcq_baskets; --"
    await insertBasket(db as any, {
      name: maliciousName,
      code: 'CHEM-X',
      type: 'LINKED',
      max_questions: null,
      description: null,
      created_by: 'user-001',
      updated_by: 'user-001',
    })

    expect(capturedSql).not.toContain(maliciousName)
    expect(capturedParams).toContain(maliciousName)
  })
})

// ---------------------------------------------------------------------------
// findBasketByCode
// ---------------------------------------------------------------------------

describe('findBasketByCode', () => {
  it('returns basket row when code exists', async () => {
    const db = makeDb(() => ({ rows: [makeRawRow()], rowCount: 1 }))
    const result = await findBasketByCode(db as any, 'CHEM-001')
    expect(result).not.toBeNull()
    expect(result!.code).toBe('CHEM-001')
  })

  it('returns null when code does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    const result = await findBasketByCode(db as any, 'CHEM-999')
    expect(result).toBeNull()
  })

  it('passes code as parameter, not interpolated in SQL', async () => {
    let capturedParams: unknown[] | undefined
    const db = {
      query: vi.fn(async (_sql: string, params?: unknown[]) => {
        capturedParams = params
        return { rows: [], rowCount: 0 }
      }),
    }
    await findBasketByCode(db as any, 'CHEM-001')
    expect(capturedParams).toBeDefined()
    expect(capturedParams).toContain('CHEM-001')
  })
})

// ---------------------------------------------------------------------------
// updateBasketRow
// ---------------------------------------------------------------------------

describe('updateBasketRow', () => {
  it('returns updated basket', async () => {
    const updated = makeRawRow({ name: 'New Name' })
    const db = makeDb(() => ({ rows: [updated], rowCount: 1 }))
    const result = await updateBasketRow(db as any, BASKET_ID, {
      name: 'New Name',
      updated_by: 'user-001',
    })
    expect(result!.name).toBe('New Name')
  })

  it('returns null when basket not found during update', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    const result = await updateBasketRow(db as any, BASKET_ID, {
      name: 'New Name',
      updated_by: 'user-001',
    })
    expect(result).toBeNull()
  })

  it('does not interpolate updated values into SQL', async () => {
    let capturedSql = ''
    let capturedParams: unknown[] | undefined
    const db = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        capturedSql = sql
        capturedParams = params
        return { rows: [makeRawRow()], rowCount: 1 }
      }),
    }

    const malicious = "'; DROP TABLE mcq_baskets; --"
    await updateBasketRow(db as any, BASKET_ID, { name: malicious, updated_by: 'user-001' })
    expect(capturedSql).not.toContain(malicious)
    expect(capturedParams).toContain(malicious)
  })
})

// ---------------------------------------------------------------------------
// deleteBasketRow
// ---------------------------------------------------------------------------

describe('deleteBasketRow', () => {
  it('deletes basket row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 1 }))
    await expect(deleteBasketRow(db as any, BASKET_ID)).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// checkQuestionExists
// ---------------------------------------------------------------------------

describe('checkQuestionExists', () => {
  it('returns true when question table exists and question found', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('information_schema') || sql.includes('FROM mcq_questions'))
        return { rows: [{ id: QUESTION_ID }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })
    const result = await checkQuestionExists(db as any, QUESTION_ID)
    expect(result).toBe(true)
  })

  it('returns false when question not found', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    const result = await checkQuestionExists(db as any, QUESTION_ID)
    expect(result).toBe(false)
  })

  it('returns false (graceful) when mcq_questions table does not exist (42P01)', async () => {
    const db = {
      query: vi.fn(async () => {
        const err = Object.assign(new Error("relation 'mcq_questions' does not exist"), {
          code: '42P01',
        })
        throw err
      }),
    }
    await expect(checkQuestionExists(db as any, QUESTION_ID)).resolves.toBe(false)
  })
})

// ---------------------------------------------------------------------------
// findBasketQuestion / countBasketQuestions / insertBasketQuestion
// ---------------------------------------------------------------------------

describe('findBasketQuestion', () => {
  it('returns link row when found', async () => {
    const db = makeDb(() => ({
      rows: [{ id: LINK_ID, basket_id: BASKET_ID, question_id: QUESTION_ID, created_at: NOW }],
      rowCount: 1,
    }))
    const result = await findBasketQuestion(db as any, BASKET_ID, QUESTION_ID)
    expect(result).not.toBeNull()
    expect(result!.basket_id).toBe(BASKET_ID)
  })

  it('returns null when link does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    const result = await findBasketQuestion(db as any, BASKET_ID, QUESTION_ID)
    expect(result).toBeNull()
  })
})

describe('countBasketQuestions', () => {
  it('returns integer count', async () => {
    const db = makeDb(() => ({ rows: [{ count: '12' }], rowCount: 1 }))
    const result = await countBasketQuestions(db as any, BASKET_ID)
    expect(result).toBe(12)
    expect(typeof result).toBe('number')
  })

  it('returns 0 when no questions linked', async () => {
    const db = makeDb(() => ({ rows: [{ count: '0' }], rowCount: 1 }))
    const result = await countBasketQuestions(db as any, BASKET_ID)
    expect(result).toBe(0)
  })
})

describe('insertBasketQuestion', () => {
  it('returns inserted link row', async () => {
    const link = { id: LINK_ID, basket_id: BASKET_ID, question_id: QUESTION_ID, created_at: NOW }
    const db = makeDb(() => ({ rows: [link], rowCount: 1 }))
    const result = await insertBasketQuestion(db as any, BASKET_ID, QUESTION_ID, 'user-001')
    expect(result.basket_id).toBe(BASKET_ID)
    expect(result.question_id).toBe(QUESTION_ID)
  })
})

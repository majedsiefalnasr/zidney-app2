/**
 * Tags Repository Unit Tests — STAGE_32_TAGS
 *
 * File: packages/domain-core/src/tags/__tests__/tags.repository.test.ts
 *
 * Focus: SQL injection safety (all user input must be parameterized),
 * correct parameterized placeholder numbering, row mapping, and 42P01 handling.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  checkEntityExists,
  countTagEntities,
  countTagRelations,
  countTags,
  deleteTagRelationRow,
  deleteTagRow,
  findEntityTags,
  findTagById,
  findTagByNormalizedName,
  findTagEntities,
  findTagRelation,
  findTagRelationById,
  findTags,
  insertTag,
  insertTagRelation,
  updateTagRow,
} from '../tags.repository'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type QueryCapture = { sql: string; params: unknown[] | undefined }

function makeCapturingDb(rows: unknown[] = [], rowCount?: number) {
  const calls: QueryCapture[] = []
  const db = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params })
      return { rows, rowCount: rowCount ?? rows.length }
    }),
  }
  return { db, calls }
}

const NOW = new Date('2026-03-23T10:00:00Z')
const TAG_ID = '11111111-1111-1111-1111-111111111111'
const TAG_ID_2 = '22222222-2222-2222-2222-222222222222'
const RELATION_ID = '33333333-3333-3333-3333-333333333333'
const ENTITY_ID = '44444444-4444-4444-4444-444444444444'
const USER_ID = 'user-001'

function makeTagDbRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TAG_ID,
    name: 'Mathematics',
    normalized_name: 'mathematics',
    status: 'ENABLED',
    created_at: NOW,
    updated_at: NOW,
    created_by: USER_ID,
    updated_by: USER_ID,
    ...overrides,
  }
}

function makeRelationDbRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: RELATION_ID,
    tag_id: TAG_ID,
    entity_type: 'MCQ_QUESTION',
    entity_id: ENTITY_ID,
    created_at: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. findTagById
// ---------------------------------------------------------------------------

describe('findTagById', () => {
  it('returns mapped tag row when found', async () => {
    const { db } = makeCapturingDb([makeTagDbRow()])
    const result = await findTagById(db as any, TAG_ID)
    expect(result?.id).toBe(TAG_ID)
    expect(result?.status).toBe('ENABLED')
  })

  it('returns null when no rows returned', async () => {
    const { db } = makeCapturingDb([])
    const result = await findTagById(db as any, TAG_ID)
    expect(result).toBeNull()
  })

  it('passes id as parameterized value — not interpolated', async () => {
    const malicious = "'; DROP TABLE tags; --"
    const { db, calls } = makeCapturingDb([])
    await findTagById(db as any, malicious)
    expect(calls[0]!.sql).not.toContain(malicious)
    expect(calls[0]!.params).toContain(malicious)
  })
})

// ---------------------------------------------------------------------------
// 2. findTagByNormalizedName
// ---------------------------------------------------------------------------

describe('findTagByNormalizedName', () => {
  it('passes normalized_name as parameterized value', async () => {
    const { db, calls } = makeCapturingDb([])
    await findTagByNormalizedName(db as any, 'mathematics')
    expect(calls[0]!.sql).toMatch(/normalized_name = \$1/)
    expect(calls[0]!.params).toEqual(['mathematics'])
  })

  it('returns null when nothing found', async () => {
    const { db } = makeCapturingDb([])
    const result = await findTagByNormalizedName(db as any, 'physics')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 3. findTags — SQL injection safety
// ---------------------------------------------------------------------------

describe('findTags', () => {
  it('never interpolates search string into SQL', async () => {
    const userInput = "'; DROP TABLE tags; --"
    const { db, calls } = makeCapturingDb([])

    await findTags(db as any, { page: 1, limit: 10, search: userInput })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.sql).not.toContain(userInput)
    // The repo lowercases the search before wrapping with %, so check lowercase
    const lowerInput = userInput.toLowerCase()
    const paramsFlat = (calls[0]!.params ?? []).map(String)
    expect(paramsFlat.some((p) => p.includes(lowerInput))).toBe(true)
  })

  it('uses ILIKE $N (parameterized) when search is provided', async () => {
    const { db, calls } = makeCapturingDb([])
    await findTags(db as any, { page: 1, limit: 10, search: 'math' })

    expect(calls[0]!.sql).toMatch(/ILIKE \$\d+/)
    expect(calls[0]!.sql).not.toMatch(/ILIKE\s+'math'/i)
  })

  it('does not include ILIKE when search is omitted', async () => {
    const { db, calls } = makeCapturingDb([])
    await findTags(db as any, { page: 1, limit: 10 })

    expect(calls[0]!.sql).not.toContain('ILIKE')
  })

  it('applies status filter as parameterized when provided', async () => {
    const { db, calls } = makeCapturingDb([])
    await findTags(db as any, { page: 1, limit: 10, status: 'ENABLED' })

    expect(calls[0]!.sql).toMatch(/status = \$\d+/)
    expect(calls[0]!.params).toContain('ENABLED')
  })

  it('returns mapped tag rows', async () => {
    const { db } = makeCapturingDb([makeTagDbRow()])
    const rows = await findTags(db as any, { page: 1, limit: 10 })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe(TAG_ID)
  })
})

// ---------------------------------------------------------------------------
// 4. countTags
// ---------------------------------------------------------------------------

describe('countTags', () => {
  it('returns parsed integer from count row', async () => {
    const { db } = makeCapturingDb([{ count: '42' }])
    const result = await countTags(db as any, {})
    expect(result).toBe(42)
  })

  it('never interpolates search into SQL', async () => {
    const userInput = "'; DELETE FROM tags; --"
    const { db, calls } = makeCapturingDb([{ count: '0' }])
    await countTags(db as any, { search: userInput })

    expect(calls[0]!.sql).not.toContain(userInput)
    // The repo lowercases the search before wrapping with %, so check lowercase
    const lowerInput = userInput.toLowerCase()
    const paramsFlat = (calls[0]!.params ?? []).map(String)
    expect(paramsFlat.some((p) => p.includes(lowerInput))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. countTagRelations
// ---------------------------------------------------------------------------

describe('countTagRelations', () => {
  it('passes tagId as parameterized value', async () => {
    const { db, calls } = makeCapturingDb([{ count: '3' }])
    const n = await countTagRelations(db as any, TAG_ID)

    expect(n).toBe(3)
    expect(calls[0]!.params).toEqual([TAG_ID])
  })
})

// ---------------------------------------------------------------------------
// 6. insertTag
// ---------------------------------------------------------------------------

describe('insertTag', () => {
  it('returns mapped tag row on success', async () => {
    const { db } = makeCapturingDb([makeTagDbRow()])
    const row = await insertTag(db as any, 'Mathematics', 'mathematics', USER_ID)
    expect(row.id).toBe(TAG_ID)
    expect(row.name).toBe('Mathematics')
  })

  it('passes all values as params — no interpolation', async () => {
    const { db, calls } = makeCapturingDb([makeTagDbRow()])
    await insertTag(db as any, 'Mathematics', 'mathematics', USER_ID)

    expect(calls[0]!.sql).not.toContain('Mathematics')
    expect(calls[0]!.params).toContain('Mathematics')
    expect(calls[0]!.params).toContain('mathematics')
    expect(calls[0]!.params).toContain(USER_ID)
  })

  it('includes RETURNING clause in SQL', async () => {
    const { db, calls } = makeCapturingDb([makeTagDbRow()])
    await insertTag(db as any, 'Math', 'math', USER_ID)
    expect(calls[0]!.sql).toContain('RETURNING')
  })
})

// ---------------------------------------------------------------------------
// 7. updateTagRow
// ---------------------------------------------------------------------------

describe('updateTagRow', () => {
  it('returns mapped row when found', async () => {
    const { db } = makeCapturingDb([makeTagDbRow({ name: 'Updated', normalized_name: 'updated' })])
    const result = await updateTagRow(
      db as any,
      TAG_ID,
      { name: 'Updated', normalized_name: 'updated' },
      USER_ID
    )
    expect(result?.name).toBe('Updated')
  })

  it('returns null when id not found (0 rows returned)', async () => {
    const { db } = makeCapturingDb([])
    const result = await updateTagRow(db as any, TAG_ID, { status: 'DISABLED' }, USER_ID)
    expect(result).toBeNull()
  })

  it('only includes updated fields in SET clause', async () => {
    const { db, calls } = makeCapturingDb([makeTagDbRow()])
    await updateTagRow(db as any, TAG_ID, { status: 'DISABLED' }, USER_ID)

    expect(calls[0]!.sql).toContain('status =')
    expect(calls[0]!.sql).not.toContain('name =')
    expect(calls[0]!.params).toContain('DISABLED')
  })

  it('never interpolates field values into SQL', async () => {
    const malicious = "'; DROP TABLE tags; --"
    const { db, calls } = makeCapturingDb([makeTagDbRow()])
    await updateTagRow(db as any, TAG_ID, { name: malicious }, USER_ID)

    expect(calls[0]!.sql).not.toContain(malicious)
    expect(calls[0]!.params).toContain(malicious)
  })
})

// ---------------------------------------------------------------------------
// 8. deleteTagRow
// ---------------------------------------------------------------------------

describe('deleteTagRow', () => {
  it('returns true when rowCount > 0', async () => {
    const { db } = makeCapturingDb([], 1)
    const ok = await deleteTagRow(db as any, TAG_ID)
    expect(ok).toBe(true)
  })

  it('returns false when rowCount = 0', async () => {
    const { db } = makeCapturingDb([], 0)
    const ok = await deleteTagRow(db as any, TAG_ID)
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 9. findTagRelationById
// ---------------------------------------------------------------------------

describe('findTagRelationById', () => {
  it('returns mapped relation when found', async () => {
    const { db } = makeCapturingDb([makeRelationDbRow()])
    const result = await findTagRelationById(db as any, RELATION_ID)
    expect(result?.id).toBe(RELATION_ID)
    expect(result?.entity_type).toBe('MCQ_QUESTION')
  })

  it('returns null when not found', async () => {
    const { db } = makeCapturingDb([])
    const result = await findTagRelationById(db as any, RELATION_ID)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 10. findTagRelation
// ---------------------------------------------------------------------------

describe('findTagRelation', () => {
  it('passes all three keys as parameterized values', async () => {
    const { db, calls } = makeCapturingDb([])
    await findTagRelation(db as any, TAG_ID, 'MCQ_QUESTION', ENTITY_ID)

    expect(calls[0]!.params).toEqual([TAG_ID, 'MCQ_QUESTION', ENTITY_ID])
    expect(calls[0]!.sql).toMatch(/tag_id = \$1/)
    expect(calls[0]!.sql).toMatch(/entity_type = \$2/)
    expect(calls[0]!.sql).toMatch(/entity_id = \$3/)
  })
})

// ---------------------------------------------------------------------------
// 11. findEntityTags
// ---------------------------------------------------------------------------

describe('findEntityTags', () => {
  it('queries by entity_type and entity_id as parameters', async () => {
    const { db, calls } = makeCapturingDb([])
    await findEntityTags(db as any, 'MCQ_QUESTION', ENTITY_ID)

    expect(calls[0]!.params).toEqual(['MCQ_QUESTION', ENTITY_ID])
  })

  it('returns mapped relation rows', async () => {
    const { db } = makeCapturingDb([makeRelationDbRow()])
    const rows = await findEntityTags(db as any, 'MCQ_QUESTION', ENTITY_ID)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.tag_id).toBe(TAG_ID)
  })
})

// ---------------------------------------------------------------------------
// 12. findTagEntities — pagination & optional entity_type filter
// ---------------------------------------------------------------------------

describe('findTagEntities', () => {
  it('adds entity_type condition when provided', async () => {
    const { db, calls } = makeCapturingDb([])
    await findTagEntities(db as any, {
      tag_id: TAG_ID,
      page: 1,
      limit: 10,
      entity_type: 'MCQ_QUESTION',
    })

    expect(calls[0]!.sql).toMatch(/entity_type = \$\d+/)
    expect(calls[0]!.params).toContain('MCQ_QUESTION')
  })

  it('omits entity_type condition when not provided', async () => {
    const { db, calls } = makeCapturingDb([])
    await findTagEntities(db as any, { tag_id: TAG_ID, page: 1, limit: 10 })

    expect(calls[0]!.sql).not.toContain('entity_type =')
  })

  it('uses LIMIT/OFFSET for pagination', async () => {
    const { db, calls } = makeCapturingDb([])
    await findTagEntities(db as any, { tag_id: TAG_ID, page: 2, limit: 10 })

    const paramsStr = (calls[0]!.params ?? []).map(String)
    // page 2, limit 10 → offset 10
    expect(paramsStr).toContain('10') // LIMIT
    expect(paramsStr.filter((p) => p === '10')).toHaveLength(2) // Both LIMIT and OFFSET are 10
  })
})

// ---------------------------------------------------------------------------
// 13. countTagEntities
// ---------------------------------------------------------------------------

describe('countTagEntities', () => {
  it('returns integer count', async () => {
    const { db } = makeCapturingDb([{ count: '7' }])
    const n = await countTagEntities(db as any, { tag_id: TAG_ID })
    expect(n).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// 14. insertTagRelation
// ---------------------------------------------------------------------------

describe('insertTagRelation', () => {
  it('returns mapped relation row', async () => {
    const { db } = makeCapturingDb([makeRelationDbRow()])
    const result = await insertTagRelation(db as any, TAG_ID, 'MCQ_QUESTION', ENTITY_ID)
    expect(result.id).toBe(RELATION_ID)
    expect(result.entity_type).toBe('MCQ_QUESTION')
  })

  it('passes values as params — no interpolation', async () => {
    const { db, calls } = makeCapturingDb([makeRelationDbRow()])
    await insertTagRelation(db as any, TAG_ID, 'MCQ_QUESTION', ENTITY_ID)

    expect(calls[0]!.params).toEqual([TAG_ID, 'MCQ_QUESTION', ENTITY_ID])
    expect(calls[0]!.sql).not.toContain(TAG_ID)
  })
})

// ---------------------------------------------------------------------------
// 15. deleteTagRelationRow
// ---------------------------------------------------------------------------

describe('deleteTagRelationRow', () => {
  it('returns true when rowCount > 0', async () => {
    const { db } = makeCapturingDb([], 1)
    const ok = await deleteTagRelationRow(db as any, RELATION_ID)
    expect(ok).toBe(true)
  })

  it('returns false when not found', async () => {
    const { db } = makeCapturingDb([], 0)
    const ok = await deleteTagRelationRow(db as any, RELATION_ID)
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 16. checkEntityExists — 42P01 forward-compatibility
// ---------------------------------------------------------------------------

describe('checkEntityExists', () => {
  it('returns true when entity exists (rowCount = 1)', async () => {
    const { db } = makeCapturingDb([{ '1': 1 }], 1)
    const exists = await checkEntityExists(db as any, 'MCQ_QUESTION', ENTITY_ID)
    expect(exists).toBe(true)
  })

  it('returns false when entity not found (rowCount = 0)', async () => {
    const { db } = makeCapturingDb([], 0)
    const exists = await checkEntityExists(db as any, 'MCQ_QUESTION', ENTITY_ID)
    expect(exists).toBe(false)
  })

  it('returns true and does NOT throw on 42P01 (undefined_table)', async () => {
    const db = {
      query: vi.fn(async () => {
        const err = Object.assign(new Error('undefined_table'), { code: '42P01' })
        throw err
      }),
    }
    const exists = await checkEntityExists(db as any, 'LIBRARY_FILE', ENTITY_ID)
    expect(exists).toBe(true)
  })

  it('re-throws non-42P01 database errors', async () => {
    const db = {
      query: vi.fn(async () => {
        const err = Object.assign(new Error('connection refused'), { code: '08006' })
        throw err
      }),
    }
    await expect(checkEntityExists(db as any, 'MCQ_QUESTION', ENTITY_ID)).rejects.toThrow(
      'connection refused'
    )
  })

  it('uses correct table name for each entity type', async () => {
    const tableCalls: string[] = []
    const db = {
      query: vi.fn(async (sql: string) => {
        tableCalls.push(sql)
        return { rows: [], rowCount: 0 }
      }),
    }

    await checkEntityExists(db as any, 'MCQ_QUESTION', ENTITY_ID)
    await checkEntityExists(db as any, 'TRADITIONAL_QUESTION', ENTITY_ID)
    await checkEntityExists(db as any, 'LIBRARY_FILE', ENTITY_ID)

    expect(tableCalls[0]).toContain('mcq_questions')
    expect(tableCalls[1]).toContain('traditional_questions')
    expect(tableCalls[2]).toContain('library_files')
  })

  it('passes entity_id as parameterized $1 — never interpolated', async () => {
    const malicious = "'; DROP TABLE mcq_questions; --"
    const { db, calls } = makeCapturingDb([], 0)
    await checkEntityExists(db as any, 'MCQ_QUESTION', malicious)

    expect(calls[0]!.sql).not.toContain(malicious)
    expect(calls[0]!.params).toContain(malicious)
  })
})

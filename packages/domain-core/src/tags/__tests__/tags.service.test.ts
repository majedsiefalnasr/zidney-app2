/**
 * Tags Domain Unit Tests — STAGE_32_TAGS
 *
 * File: packages/domain-core/src/tags/__tests__/tags.service.test.ts
 *
 * Tests business logic: name normalization, uniqueness guard, ENABLED guard on create-relation,
 * delete guard (TAG_HAS_RELATIONS), cascade delete, idempotency on duplicate tag/relation,
 * TX rollback path on unexpected DB error.
 */

import { describe, expect, it, vi } from 'vitest'

import { TagError } from '../tags.errors'
import {
  createTag,
  createTagRelation,
  deleteTag,
  deleteTagRelation,
  getTag,
  listEntityTags,
  listTagEntities,
  listTags,
  updateTag,
} from '../tags.service'
import type { AuditContext } from '../tags.types'

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
const TAG_ID = '11111111-1111-1111-1111-111111111111'
const TAG_ID_2 = '22222222-2222-2222-2222-222222222222'
const RELATION_ID = '33333333-3333-3333-3333-333333333333'
const ENTITY_ID = '44444444-4444-4444-4444-444444444444'

function makeTagRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TAG_ID,
    name: 'Mathematics',
    normalized_name: 'mathematics',
    status: 'ENABLED' as const,
    created_at: NOW,
    updated_at: NOW,
    created_by: 'user-001',
    updated_by: 'user-001',
    ...overrides,
  }
}

function makeRelationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: RELATION_ID,
    tag_id: TAG_ID,
    entity_type: 'MCQ_QUESTION' as const,
    entity_id: ENTITY_ID,
    created_at: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// DB mock factory
// ---------------------------------------------------------------------------

function makeDb(
  matcher: (sql: string, params?: unknown[]) => { rows: unknown[]; rowCount: number | null }
) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => matcher(sql, params)),
  }
}

// ---------------------------------------------------------------------------
// 1. listTags
// ---------------------------------------------------------------------------

describe('listTags', () => {
  it('returns paginated result with total count', async () => {
    const tagRow = makeTagRow()
    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '5' }], rowCount: 1 }
      return { rows: [tagRow], rowCount: 1 }
    })

    const result = await listTags(db, { page: 1, limit: 20 }, audit)

    expect(result.total).toBe(5)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.id).toBe(TAG_ID)
  })

  it('clamps page to minimum 1', async () => {
    const db = makeDb(() => ({ rows: [{ count: '0' }], rowCount: 1 }))
    const result = await listTags(db, { page: -5, limit: 20 }, audit)
    expect(result.page).toBe(1)
  })

  it('clamps limit to maximum 100', async () => {
    const db = makeDb(() => ({ rows: [{ count: '0' }], rowCount: 1 }))
    const result = await listTags(db, { page: 1, limit: 500 }, audit)
    expect(result.limit).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// 2. getTag
// ---------------------------------------------------------------------------

describe('getTag', () => {
  it('returns tag when found', async () => {
    const db = makeDb(() => ({ rows: [makeTagRow()], rowCount: 1 }))
    const tag = await getTag(db, TAG_ID, audit)
    expect(tag.id).toBe(TAG_ID)
  })

  it('throws TAG_NOT_FOUND when tag does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    await expect(getTag(db, TAG_ID, audit)).rejects.toThrow(TagError)
    await expect(getTag(db, TAG_ID, audit)).rejects.toMatchObject({ code: 'TAG_NOT_FOUND' })
  })
})

// ---------------------------------------------------------------------------
// 3. createTag
// ---------------------------------------------------------------------------

describe('createTag', () => {
  it('normalizes name before inserting', async () => {
    const queries: string[] = []
    const db = makeDb((sql) => {
      queries.push(sql)
      if (sql.includes('normalized_name =')) return { rows: [], rowCount: 0 } // no duplicate
      if (sql.includes('INSERT INTO tags')) return { rows: [makeTagRow()], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await createTag(db, { name: '  Mathematics  ' }, audit)

    const insertCall = queries.find((q) => q.includes('INSERT INTO tags'))
    expect(insertCall).toBeDefined()
  })

  it('throws TAG_DUPLICATE when normalized name already exists', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('normalized_name =')) return { rows: [makeTagRow()], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(createTag(db, { name: 'Mathematics' }, audit)).rejects.toMatchObject({
      code: 'TAG_DUPLICATE',
    })
  })

  it('rolls back TX on unexpected DB error', async () => {
    const rollbacks: string[] = []
    const db = makeDb((sql) => {
      if (sql === 'ROLLBACK') {
        rollbacks.push('ROLLBACK')
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('normalized_name =')) return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO tags')) throw new Error('DB connection lost')
      return { rows: [], rowCount: 0 }
    })

    await expect(createTag(db, { name: 'Math' }, audit)).rejects.toThrow('DB connection lost')
    expect(rollbacks).toHaveLength(1)
  })

  it('maps 23505 PG duplicate error to TAG_DUPLICATE', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('normalized_name =')) return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO tags')) {
        const err = Object.assign(new Error('unique violation'), { code: '23505' })
        throw err
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(createTag(db, { name: 'Math' }, audit)).rejects.toMatchObject({
      code: 'TAG_DUPLICATE',
    })
  })
})

// ---------------------------------------------------------------------------
// 4. updateTag
// ---------------------------------------------------------------------------

describe('updateTag', () => {
  it('throws TAG_NOT_FOUND when tag does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    await expect(updateTag(db, TAG_ID, { status: 'DISABLED' }, audit)).rejects.toMatchObject({
      code: 'TAG_NOT_FOUND',
    })
  })

  it('throws TAG_DUPLICATE when new normalized name collides with another tag', async () => {
    let callCount = 0
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM tags') && sql.includes('WHERE id =')) {
        callCount++
        if (callCount === 1) return { rows: [makeTagRow()], rowCount: 1 }
      }
      if (sql.includes('normalized_name ='))
        return { rows: [makeTagRow({ id: TAG_ID_2 })], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(updateTag(db, TAG_ID, { name: 'Physics' }, audit)).rejects.toMatchObject({
      code: 'TAG_DUPLICATE',
    })
  })

  it('updates successfully when name is unchanged', async () => {
    const existing = makeTagRow()
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
        return { rows: [existing], rowCount: 1 }
      if (sql.includes('UPDATE tags'))
        return { rows: [{ ...existing, status: 'DISABLED' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await updateTag(db, TAG_ID, { status: 'DISABLED' }, audit)
    expect(result.id).toBe(TAG_ID)
  })
})

// ---------------------------------------------------------------------------
// 5. deleteTag
// ---------------------------------------------------------------------------

describe('deleteTag', () => {
  it('throws TAG_NOT_FOUND when tag does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    await expect(deleteTag(db, TAG_ID, false, audit)).rejects.toMatchObject({
      code: 'TAG_NOT_FOUND',
    })
  })

  it('throws TAG_HAS_RELATIONS when tag has relations and cascade_delete=false', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
        return { rows: [makeTagRow()], rowCount: 1 }
      if (sql.includes('COUNT(*)') && sql.includes('tag_relations'))
        return { rows: [{ count: '3' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteTag(db, TAG_ID, false, audit)).rejects.toMatchObject({
      code: 'TAG_HAS_RELATIONS',
    })
  })

  it('cascades delete and removes relations when cascade_delete=true', async () => {
    const deletedRelationsQueries: string[] = []
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
        return { rows: [makeTagRow()], rowCount: 1 }
      if (sql.includes('COUNT(*)') && sql.includes('tag_relations'))
        return { rows: [{ count: '2' }], rowCount: 1 }
      if (sql.includes('DELETE FROM tag_relations')) {
        deletedRelationsQueries.push(sql)
        return { rows: [], rowCount: 2 }
      }
      if (sql.includes('DELETE FROM tags')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await deleteTag(db, TAG_ID, true, audit)
    expect(result.relations_removed).toBe(2)
    expect(deletedRelationsQueries).toHaveLength(1)
  })

  it('deletes tag with no relations when cascade_delete=false', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
        return { rows: [makeTagRow()], rowCount: 1 }
      if (sql.includes('COUNT(*)') && sql.includes('tag_relations'))
        return { rows: [{ count: '0' }], rowCount: 1 }
      if (sql.includes('DELETE FROM tags')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await deleteTag(db, TAG_ID, false, audit)
    expect(result.success).toBe(true)
    expect(result.relations_removed).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 6. createTagRelation
// ---------------------------------------------------------------------------

describe('createTagRelation', () => {
  it('throws TAG_NOT_FOUND when tag does not exist', async () => {
    const db = makeDb((sql) => {
      // checkEntityExists returns true (table not found = tolerated)
      if (sql.includes('FROM mcq_questions')) {
        const err = Object.assign(new Error('undefined_table'), { code: '42P01' })
        throw err
      }
      if (sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 } // findTagById → no tag
    })

    await expect(
      createTagRelation(
        db,
        { tag_id: TAG_ID, entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID },
        audit
      )
    ).rejects.toMatchObject({ code: 'TAG_NOT_FOUND' })
  })

  it('throws TAG_DISABLED when tag is disabled', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('FROM mcq_questions')) return { rows: [{ '1': 1 }], rowCount: 1 }
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
        return { rows: [makeTagRow({ status: 'DISABLED' })], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createTagRelation(
        db,
        { tag_id: TAG_ID, entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID },
        audit
      )
    ).rejects.toMatchObject({ code: 'TAG_DISABLED' })
  })

  it('throws TAG_RELATION_DUPLICATE when relation already exists', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('FROM mcq_questions')) return { rows: [{ '1': 1 }], rowCount: 1 }
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
        return { rows: [makeTagRow()], rowCount: 1 }
      if (sql.includes('WHERE tag_id =') && sql.includes('entity_type'))
        return { rows: [makeRelationRow()], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createTagRelation(
        db,
        { tag_id: TAG_ID, entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID },
        audit
      )
    ).rejects.toMatchObject({ code: 'TAG_RELATION_DUPLICATE' })
  })

  it('tolerates 42P01 (undefined_table) and creates relation', async () => {
    let insertCalled = false
    const db = makeDb((sql) => {
      if (sql.includes('FROM mcq_questions')) {
        const err = Object.assign(new Error('undefined_table'), { code: '42P01' })
        throw err
      }
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
        return { rows: [makeTagRow()], rowCount: 1 }
      if (sql.includes('WHERE tag_id =') && sql.includes('entity_type'))
        return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO tag_relations')) {
        insertCalled = true
        return { rows: [makeRelationRow()], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await createTagRelation(
      db,
      { tag_id: TAG_ID, entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID },
      audit
    )
    expect(insertCalled).toBe(true)
  })

  it('throws TAG_RELATION_ENTITY_NOT_FOUND when entity is not found', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('FROM mcq_questions')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createTagRelation(
        db,
        { tag_id: TAG_ID, entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID },
        audit
      )
    ).rejects.toMatchObject({ code: 'TAG_RELATION_ENTITY_NOT_FOUND' })
  })
})

// ---------------------------------------------------------------------------
// 7. deleteTagRelation
// ---------------------------------------------------------------------------

describe('deleteTagRelation', () => {
  it('throws TAG_RELATION_NOT_FOUND when relation does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteTagRelation(db, RELATION_ID, audit)).rejects.toMatchObject({
      code: 'TAG_RELATION_NOT_FOUND',
    })
  })

  it('deletes relation and returns success', async () => {
    const db = makeDb((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM tag_relations') && sql.includes('WHERE id ='))
        return { rows: [makeRelationRow()], rowCount: 1 }
      if (sql.includes('DELETE FROM tag_relations')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await deleteTagRelation(db, RELATION_ID, audit)
    expect(result.success).toBe(true)
    expect(result.id).toBe(RELATION_ID)
  })
})

// ---------------------------------------------------------------------------
// 8. listEntityTags
// ---------------------------------------------------------------------------

describe('listEntityTags', () => {
  it('returns all relations for an entity', async () => {
    const db = makeDb(() => ({ rows: [makeRelationRow()], rowCount: 1 }))
    const items = await listEntityTags(
      db,
      { entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID },
      audit
    )
    expect(items).toHaveLength(1)
    expect(items[0]!.entity_type).toBe('MCQ_QUESTION')
  })
})

// ---------------------------------------------------------------------------
// 9. listTagEntities
// ---------------------------------------------------------------------------

describe('listTagEntities', () => {
  it('returns paginated results and total count', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '3' }], rowCount: 1 }
      return { rows: [makeRelationRow()], rowCount: 1 }
    })

    const result = await listTagEntities(db, { tag_id: TAG_ID, page: 1, limit: 20 }, audit)

    expect(result.total).toBe(3)
    expect(result.items).toHaveLength(1)
  })
})

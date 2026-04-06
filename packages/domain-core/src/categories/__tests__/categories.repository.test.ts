import { describe, expect, it, vi } from 'vitest'

import {
  categoryCodeExists,
  categoryNameExists,
  findScopedCategoryById,
  replaceCategoryScope,
} from '../categories.repository'

describe('categories.repository', () => {
  it('findScopedCategoryById parses subject_ids and division_ids', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'c1',
            name: 'C',
            code: null,
            description: null,
            parent_id: null,
            status: 'ENABLED',
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
            created_by: null,
            updated_by: null,
            subject_ids: '{s1,s2}',
            division_ids: '{}',
          },
        ],
      }),
    }
    const res = await findScopedCategoryById(db as any, 'c1')
    expect(res).not.toBeNull()
    expect(res!.subject_ids).toEqual(['s1', 's2'])
    expect(res!.division_ids).toEqual([])
  })

  it('categoryNameExists respects excludeId and returns boolean', async () => {
    const db1 = { query: vi.fn().mockResolvedValue({ rows: [{ exists: true }] }) }
    expect(await categoryNameExists(db1 as any, 'Math')).toBe(true)
    const db2 = { query: vi.fn().mockResolvedValue({ rows: [{ exists: false }] }) }
    expect(await categoryNameExists(db2 as any, 'Math', 'c1')).toBe(false)
  })

  it('categoryCodeExists respects excludeId and returns boolean', async () => {
    const db1 = { query: vi.fn().mockResolvedValue({ rows: [{ exists: true }] }) }
    expect(await categoryCodeExists(db1 as any, 'MATH101')).toBe(true)
    const db2 = { query: vi.fn().mockResolvedValue({ rows: [{ exists: false }] }) }
    expect(await categoryCodeExists(db2 as any, 'MATH101', 'c1')).toBe(false)
  })

  it('replaceCategoryScope deletes existing scope and inserts new ones', async () => {
    const calls: string[] = []
    const db = {
      query: vi.fn().mockImplementation((sql: string) => {
        calls.push(sql)
        return Promise.resolve({ rows: [] })
      }),
    }
    await replaceCategoryScope(db as any, 'c1', ['s1'], ['d1'])
    expect(calls.some((s) => s.includes('DELETE FROM category_subjects'))).toBe(true)
    expect(calls.some((s) => s.includes('DELETE FROM category_divisions'))).toBe(true)
    expect(calls.some((s) => s.includes('INSERT INTO category_subjects'))).toBe(true)
    expect(calls.some((s) => s.includes('INSERT INTO category_divisions'))).toBe(true)
  })
})

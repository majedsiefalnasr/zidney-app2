/**
 * Categories Domain Unit Tests — STAGE_30_CATEGORIES
 *
 * File: packages/domain-core/src/categories/__tests__/categories.service.test.ts
 *
 * Tests business logic: parent validation, depth enforcement, name/code uniqueness,
 * circular reference detection, disabled edit guard, status idempotency, and soft-delete.
 */

import { describe, expect, it, vi } from 'vitest'

import type { AuditContext, CreateCategoryInput, UpdateCategoryInput } from '../index'

import {
  CategoryError,
  createCategory,
  deleteCategory,
  getCategoriesTree,
  getCategory,
  listCategories,
  updateCategory,
} from '../index'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const auditCtx: AuditContext = {
  user_id: 'user-001',
  correlation_id: 'corr-001',
  workspace_slug: 'test-ws',
  workspace_id: 'ws-001',
}

const NOW = new Date('2026-03-22T12:00:00Z')

const CAT_ID = '11111111-1111-1111-1111-111111111111'
const PARENT_ID = '22222222-2222-2222-2222-222222222222'
const SUBJECT_ID = '33333333-3333-3333-3333-333333333333'
const DIVISION_ID = '44444444-4444-4444-4444-444444444444'

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CAT_ID,
    name: 'Science',
    code: 'SCI',
    description: null,
    parent_id: null,
    status: 'ENABLED' as const,
    subject_ids: [] as string[],
    division_ids: [] as string[],
    created_by: 'user-001',
    updated_by: 'user-001',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// db mock factory
// ---------------------------------------------------------------------------

/**
 * Builds a mock DbClient that routes queries by SQL content.
 * The matcher receives (sql, params) and must return { rows, rowCount }.
 */
function makeDb(
  matcher: (sql: string, params?: unknown[]) => { rows: unknown[]; rowCount: number | null }
) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => matcher(sql, params)),
  }
}

// ---------------------------------------------------------------------------
// 1. listCategories
// ---------------------------------------------------------------------------

describe('listCategories', () => {
  it('returns paginated items with total', async () => {
    const category = makeRow()

    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 }
      return { rows: [category], rowCount: 1 }
    })

    const result = await listCategories(db as any, { page: 1, limit: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('returns empty items when no categories exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '0' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listCategories(db as any, { page: 1, limit: 20 })

    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 2. getCategory
// ---------------------------------------------------------------------------

describe('getCategory', () => {
  it('returns category when found', async () => {
    const db = makeDb(() => ({ rows: [makeRow()], rowCount: 1 }))
    const result = await getCategory(db as any, CAT_ID)
    expect(result.id).toBe(CAT_ID)
  })

  it('throws CATEGORY_NOT_FOUND when missing', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(getCategory(db as any, 'missing')).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_NOT_FOUND'
    )
  })
})

// ---------------------------------------------------------------------------
// 3. getCategoriesTree
// ---------------------------------------------------------------------------

describe('getCategoriesTree', () => {
  it('returns empty array when no categories', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))
    const result = await getCategoriesTree(db as any)
    expect(result).toEqual([])
  })

  it('assembles parent-child tree from flat rows', async () => {
    const parent = makeRow({ id: PARENT_ID, parent_id: null })
    const child = makeRow({ id: CAT_ID, parent_id: PARENT_ID })

    const db = makeDb(() => ({ rows: [parent, child], rowCount: 2 }))
    const tree = await getCategoriesTree(db as any)

    expect(tree).toHaveLength(1)
    expect(tree[0]?.id).toBe(PARENT_ID)
    expect(tree[0]?.children).toHaveLength(1)
    expect(tree[0]?.children[0]?.id).toBe(CAT_ID)
  })

  it('returns root-level nodes when categories have no parent', async () => {
    const a = makeRow({ id: '00000000-0000-0000-0000-000000000001', parent_id: null })
    const b = makeRow({ id: '00000000-0000-0000-0000-000000000002', parent_id: null })

    const db = makeDb(() => ({ rows: [a, b], rowCount: 2 }))
    const tree = await getCategoriesTree(db as any)

    expect(tree).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 4. createCategory — validation guards
// ---------------------------------------------------------------------------

describe('createCategory', () => {
  it('throws CATEGORY_PARENT_NOT_FOUND when parent does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // findScopedCategoryById for parent returns nothing
      if (sql.includes('WHERE c.id')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategory(
        db as any,
        { name: 'Child', parent_id: PARENT_ID } as CreateCategoryInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_PARENT_NOT_FOUND'
    )
  })

  it('throws CATEGORY_MAX_DEPTH_EXCEEDED when depth would exceed 3', async () => {
    // parent_id provided, MAX CTE returns depth 3 (child would be 4)
    const parent = makeRow({ id: PARENT_ID, parent_id: null })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('WHERE c.id')) return { rows: [parent], rowCount: 1 }
      // resolveChildDepth CTE returns parent depth = 3 → child would be 4
      if (sql.includes('RECURSIVE chain')) return { rows: [{ depth: '3' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategory(
        db as any,
        { name: 'TooDeep', parent_id: PARENT_ID } as CreateCategoryInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_MAX_DEPTH_EXCEEDED'
    )
  })

  it('throws CATEGORY_NAME_DUPLICATE when name already exists', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('RECURSIVE chain')) return { rows: [{ depth: '1' }], rowCount: 1 }
      // categoryNameExists returns true
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategory(db as any, { name: 'Science' } as CreateCategoryInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_NAME_DUPLICATE'
    )
  })

  it('throws CATEGORY_CODE_DUPLICATE when code already exists', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('RECURSIVE chain')) return { rows: [{ depth: '1' }], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      // categoryCodeExists returns true
      if (sql.includes('LOWER(code)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategory(db as any, { name: 'Science', code: 'SCI' } as CreateCategoryInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_CODE_DUPLICATE'
    )
  })

  it('throws CATEGORY_SUBJECT_NOT_FOUND when a subject id is invalid', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('RECURSIVE chain')) return { rows: [{ depth: '1' }], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('LOWER(code)')) return { rows: [{ exists: false }], rowCount: 1 }
      // subjectExists returns false
      if (sql.includes('subjects')) return { rows: [{ exists: false }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategory(
        db as any,
        { name: 'Science', subject_ids: [SUBJECT_ID] } as CreateCategoryInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_SUBJECT_NOT_FOUND'
    )
  })

  it('throws CATEGORY_DIVISION_NOT_FOUND when a division id is invalid', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('RECURSIVE chain')) return { rows: [{ depth: '1' }], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('LOWER(code)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('subjects')) return { rows: [{ exists: true }], rowCount: 1 }
      // divisionExists returns false
      if (sql.includes('divisions')) return { rows: [{ exists: false }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategory(
        db as any,
        { name: 'Science', division_ids: [DIVISION_ID] } as CreateCategoryInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_DIVISION_NOT_FOUND'
    )
  })

  it('creates and returns the new category when inputs are valid', async () => {
    const newCat = makeRow({ id: 'new-cat-id' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('RECURSIVE chain')) return { rows: [{ depth: '1' }], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('INSERT INTO categories')) return { rows: [newCat], rowCount: 1 }
      // findScopedCategoryById after insert
      if (sql.includes('WHERE c.id')) return { rows: [newCat], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createCategory(
      db as any,
      { name: 'Science' } as CreateCategoryInput,
      auditCtx
    )

    expect(result.name).toBe('Science')
    expect(result.status).toBe('ENABLED')
  })
})

// ---------------------------------------------------------------------------
// 5. updateCategory — disabled guard, idempotency, lock conflict, circular ref
// ---------------------------------------------------------------------------

describe('updateCategory', () => {
  it('throws CATEGORY_NOT_FOUND when category does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // lockCategoryForUpdate returns nothing
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategory(db as any, 'missing', { name: 'New' } as UpdateCategoryInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_NOT_FOUND'
    )
  })

  it('throws CATEGORY_DISABLED when editing structural fields on a disabled category', async () => {
    const disabled = { id: CAT_ID, status: 'DISABLED', parent_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [disabled], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategory(db as any, CAT_ID, { name: 'New Name' } as UpdateCategoryInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_DISABLED'
    )
  })

  it('throws CATEGORY_ALREADY_ENABLED when status is already ENABLED', async () => {
    const enabled = { id: CAT_ID, status: 'ENABLED', parent_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [enabled], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategory(db as any, CAT_ID, { status: 'ENABLED' } as UpdateCategoryInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_ALREADY_ENABLED'
    )
  })

  it('throws CATEGORY_ALREADY_DISABLED when status is already DISABLED (status-only payload)', async () => {
    const disabled = { id: CAT_ID, status: 'DISABLED', parent_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [disabled], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategory(db as any, CAT_ID, { status: 'DISABLED' } as UpdateCategoryInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_ALREADY_DISABLED'
    )
  })

  it('throws CATEGORY_CIRCULAR_REFERENCE when parent would create a cycle', async () => {
    const enabled = { id: CAT_ID, status: 'ENABLED', parent_id: null }
    const parent = makeRow({ id: PARENT_ID })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [enabled], rowCount: 1 }
      // findScopedCategoryById for proposed parent
      if (sql.includes('WHERE c.id')) return { rows: [parent], rowCount: 1 }
      // wouldCreateCircularReference — ancestors check returns CAT_ID
      if (sql.includes('RECURSIVE ancestors')) {
        return { rows: [{ id: CAT_ID, parent_id: null }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategory(db as any, CAT_ID, { parent_id: PARENT_ID } as UpdateCategoryInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_CIRCULAR_REFERENCE'
    )
  })

  it('throws CATEGORY_NAME_DUPLICATE when new name is already taken', async () => {
    const enabled = { id: CAT_ID, status: 'ENABLED', parent_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [enabled], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategory(db as any, CAT_ID, { name: 'Already Taken' } as UpdateCategoryInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_NAME_DUPLICATE'
    )
  })

  it('throws CATEGORY_LOCK_CONFLICT when PG raises 55P03', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) {
        const err = Object.assign(new Error('could not obtain lock'), { code: '55P03' })
        throw err
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategory(db as any, CAT_ID, { name: 'New' } as UpdateCategoryInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_LOCK_CONFLICT'
    )
  })

  it('updates and returns the category when inputs are valid', async () => {
    const enabled = { id: CAT_ID, status: 'ENABLED', parent_id: null }
    const updatedRow = makeRow({ name: 'Advanced Science' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [enabled], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('UPDATE categories')) return { rows: [updatedRow], rowCount: 1 }
      if (sql.includes('WHERE c.id')) return { rows: [updatedRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await updateCategory(
      db as any,
      CAT_ID,
      { name: 'Advanced Science' } as UpdateCategoryInput,
      auditCtx
    )

    expect(result.name).toBe('Advanced Science')
  })
})

// ---------------------------------------------------------------------------
// 6. deleteCategory — guards and happy path
// ---------------------------------------------------------------------------

describe('deleteCategory', () => {
  it('throws CATEGORY_NOT_FOUND when category does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteCategory(db as any, 'missing', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_NOT_FOUND'
    )
  })

  it('throws CATEGORY_ALREADY_DISABLED when category is already disabled', async () => {
    const disabled = { id: CAT_ID, status: 'DISABLED', parent_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [disabled], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteCategory(db as any, CAT_ID, auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_ALREADY_DISABLED'
    )
  })

  it('throws CATEGORY_HAS_ENABLED_CHILDREN when enabled children exist', async () => {
    const enabled = { id: CAT_ID, status: 'ENABLED', parent_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [enabled], rowCount: 1 }
      // countEnabledChildren returns 2
      if (sql.includes("status = 'ENABLED'")) return { rows: [{ total: '2' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteCategory(db as any, CAT_ID, auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryError && err.code === 'CATEGORY_HAS_ENABLED_CHILDREN'
    )
  })

  it('disables the category when no children and no dependents', async () => {
    const enabled = { id: CAT_ID, status: 'ENABLED', parent_id: null }
    const disabledRow = makeRow({ status: 'DISABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [enabled], rowCount: 1 }
      // countEnabledChildren returns 0
      if (sql.includes("status = 'ENABLED'")) return { rows: [{ total: '0' }], rowCount: 1 }
      // UPDATE to DISABLED
      if (sql.includes('UPDATE categories')) return { rows: [disabledRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    // Should resolve without throwing
    await expect(deleteCategory(db as any, CAT_ID, auditCtx)).resolves.toBeUndefined()
  })
})

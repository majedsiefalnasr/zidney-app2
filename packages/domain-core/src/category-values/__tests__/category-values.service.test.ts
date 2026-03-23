/**
 * Category Values Domain Unit Tests — STAGE_31_CATEGORY_VALUES
 *
 * File: packages/domain-core/src/category-values/__tests__/category-values.service.test.ts
 *
 * Tests business logic: permissions guard, category validation, code uniqueness,
 * scope containment, status transitions, lock conflict, dependency check, and soft-delete idempotency.
 */

import { describe, expect, it, vi } from 'vitest'

import type { AuditContext } from '../index'

import {
  CategoryValueError,
  createCategoryValue,
  deleteCategoryValue,
  getCategoryValue,
  listCategoryValues,
  updateCategoryValue,
} from '../index'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const auditCtx: AuditContext = {
  user_id: 'user-001',
  correlation_id: 'corr-001',
  workspace_slug: 'test-ws',
  workspace_id: 'ws-001',
  caller_permissions: [],
}

const auditWithClassify: AuditContext = {
  ...auditCtx,
  caller_permissions: ['classification_manage'],
}

const NOW = new Date('2026-03-22T12:00:00Z')

const VAL_ID = '11111111-1111-1111-1111-111111111111'
const CAT_ID = '22222222-2222-2222-2222-222222222222'
const SUBJECT_ID = '33333333-3333-3333-3333-333333333333'
const DIVISION_ID = '44444444-4444-4444-4444-444444444444'

const DEFAULT_LANG_CONFIG = {
  default_language: 'en',
  supported_languages: ['en', 'ar'],
}

function makeValueRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: VAL_ID,
    category_id: CAT_ID,
    code: 'VAL01',
    status: 'COMPLETED' as const,
    created_by: 'user-001',
    updated_by: 'user-001',
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    ...overrides,
  }
}

function makeScopedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...makeValueRow(overrides),
    subject_ids: [] as string[],
    division_ids: [] as string[],
    translations: [] as Array<{
      language_code: string
      field_name: string
      translated_value: string
    }>,
  }
}

const validTranslations = [
  { language_code: 'en', field_name: 'name', translated_value: 'Math Value' },
]

// ---------------------------------------------------------------------------
// db mock factory
// ---------------------------------------------------------------------------

function makeDb(
  matcher: (sql: string, params?: unknown[]) => { rows: unknown[]; rowCount: number | null }
) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => matcher(sql, params)),
  }
}

// ---------------------------------------------------------------------------
// 1. listCategoryValues
// ---------------------------------------------------------------------------

describe('listCategoryValues', () => {
  it('returns paginated items with total', async () => {
    const row = makeValueRow()

    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [{ id: CAT_ID, status: 'ENABLED' }], rowCount: 1 }
      }
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }], rowCount: 1 }
      if (sql.includes('FROM category_values cv') && !sql.includes('COUNT')) {
        return { rows: [row], rowCount: 1 }
      }
      if (sql.includes('category_value_subjects')) return { rows: [], rowCount: 0 }
      if (sql.includes('category_value_divisions')) return { rows: [], rowCount: 0 }
      if (sql.includes("entity_type = 'CATEGORY_VALUE'")) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listCategoryValues(
      db as any,
      { category_id: CAT_ID, page: 1, limit: 20 },
      auditCtx
    )

    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('returns empty list when category exists but has no values', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [{ id: CAT_ID, status: 'ENABLED' }], rowCount: 1 }
      }
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '0' }], rowCount: 1 }
      if (sql.includes('FROM category_values cv')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listCategoryValues(
      db as any,
      { category_id: CAT_ID, page: 1, limit: 20 },
      auditCtx
    )

    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('throws CATEGORY_NOT_FOUND when category_id does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [], rowCount: 0 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      listCategoryValues(db as any, { category_id: 'missing', page: 1, limit: 20 }, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'CATEGORY_NOT_FOUND'
    )
  })

  it('throws FORBIDDEN when include_deleted=true but caller lacks classification_manage', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(
      listCategoryValues(
        db as any,
        { category_id: CAT_ID, page: 1, limit: 20, include_deleted: true },
        auditCtx // no classification_manage
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'FORBIDDEN'
    )
  })

  it('allows include_deleted=true for caller with classification_manage', async () => {
    const row = makeValueRow({ deleted_at: NOW })

    const db = makeDb((sql) => {
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [{ id: CAT_ID, status: 'ENABLED' }], rowCount: 1 }
      }
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }], rowCount: 1 }
      if (sql.includes('FROM category_values cv')) return { rows: [row], rowCount: 1 }
      if (sql.includes('category_value_subjects')) return { rows: [], rowCount: 0 }
      if (sql.includes('category_value_divisions')) return { rows: [], rowCount: 0 }
      if (sql.includes("entity_type = 'CATEGORY_VALUE'")) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listCategoryValues(
      db as any,
      { category_id: CAT_ID, page: 1, limit: 20, include_deleted: true },
      auditWithClassify
    )

    expect(result.items).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 2. getCategoryValue
// ---------------------------------------------------------------------------

describe('getCategoryValue', () => {
  it('returns a scoped value with translations', async () => {
    const row = makeValueRow()

    const db = makeDb((sql) => {
      if (sql.includes('FROM category_values') && sql.includes('deleted_at IS NULL')) {
        return { rows: [row], rowCount: 1 }
      }
      if (sql.includes('category_value_subjects')) return { rows: [], rowCount: 0 }
      if (sql.includes('category_value_divisions')) return { rows: [], rowCount: 0 }
      if (sql.includes("entity_type = 'CATEGORY_VALUE'")) {
        return {
          rows: [
            {
              entity_id: VAL_ID,
              field_name: 'name',
              language_code: 'en',
              translated_value: 'Math Value',
            },
          ],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const result = await getCategoryValue(db as any, VAL_ID)
    expect(result.id).toBe(VAL_ID)
    expect(result.translations).toHaveLength(1)
    expect(result.translations[0]?.field_name).toBe('name')
  })

  it('throws CATEGORY_VALUE_NOT_FOUND when value is missing', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(getCategoryValue(db as any, 'missing')).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_NOT_FOUND'
    )
  })

  it('throws CATEGORY_VALUE_NOT_FOUND for a soft-deleted value', async () => {
    const db = makeDb((sql) => {
      // findCategoryValueById: checks deleted_at IS NULL — so soft-deleted row is not returned
      if (sql.includes('FROM category_values') && sql.includes('deleted_at IS NULL')) {
        return { rows: [], rowCount: 0 } // filtered by deleted_at
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(getCategoryValue(db as any, VAL_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_NOT_FOUND'
    )
  })
})

// ---------------------------------------------------------------------------
// 3. createCategoryValue — validation guards
// ---------------------------------------------------------------------------

describe('createCategoryValue', () => {
  it('returns a ScopedCategoryValueRow with status=COMPLETED on happy path', async () => {
    const newRow = makeValueRow({ status: 'COMPLETED' })
    let insertCount = 0

    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [{ id: CAT_ID, status: 'UNDER_REVIEW' }], rowCount: 1 }
      }
      if (sql.includes('LOWER(code)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('category_subjects')) return { rows: [], rowCount: 0 } // empty → global
      if (sql.includes('category_divisions')) return { rows: [], rowCount: 0 } // empty → global
      if (sql.includes('INSERT INTO category_values')) {
        insertCount++
        return { rows: [newRow], rowCount: 1 }
      }
      if (sql.includes('INSERT INTO translations')) return { rows: [], rowCount: 0 }
      // fetchScopedRow after insert
      if (sql.includes('FROM category_values') && sql.includes('deleted_at IS NULL')) {
        return { rows: [newRow], rowCount: 1 }
      }
      if (sql.includes('category_value_subjects')) return { rows: [], rowCount: 0 }
      if (sql.includes('category_value_divisions')) return { rows: [], rowCount: 0 }
      if (sql.includes("entity_type = 'CATEGORY_VALUE'")) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createCategoryValue(
      db as any,
      { category_id: CAT_ID, code: 'VAL01', translations: validTranslations },
      auditCtx
    )

    expect(result.id).toBe(VAL_ID)
    expect(result.status).toBe('COMPLETED')
    expect(insertCount).toBe(1)
  })

  it('throws CATEGORY_VALUE_NAME_REQUIRED when no name translation is provided', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategoryValue(
        db as any,
        { category_id: CAT_ID, code: 'VAL01', translations: [] },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_NAME_REQUIRED'
    )
  })

  it('throws UNSUPPORTED_LANGUAGE when translation language is not configured', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategoryValue(
        db as any,
        {
          category_id: CAT_ID,
          code: 'VAL01',
          translations: [
            { language_code: 'fr', field_name: 'name', translated_value: 'Valeur Francaise' },
          ],
        },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'UNSUPPORTED_LANGUAGE'
    )
  })

  it('throws UNSUPPORTED_LANGUAGE when workspace_settings not found', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategoryValue(
        db as any,
        { category_id: CAT_ID, code: 'VAL01', translations: validTranslations },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'UNSUPPORTED_LANGUAGE'
    )
  })

  it('throws CATEGORY_NOT_FOUND when category_id does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [], rowCount: 0 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategoryValue(
        db as any,
        { category_id: CAT_ID, code: 'VAL01', translations: validTranslations },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'CATEGORY_NOT_FOUND'
    )
  })

  it('throws CATEGORY_DISABLED when category status is DISABLED', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [{ id: CAT_ID, status: 'DISABLED' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategoryValue(
        db as any,
        { category_id: CAT_ID, code: 'VAL01', translations: validTranslations },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'CATEGORY_DISABLED'
    )
  })

  it('throws CATEGORY_VALUE_CODE_DUPLICATE when code already exists in category', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [{ id: CAT_ID, status: 'UNDER_REVIEW' }], rowCount: 1 }
      }
      if (sql.includes('LOWER(code)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategoryValue(
        db as any,
        { category_id: CAT_ID, code: 'VAL01', translations: validTranslations },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_CODE_DUPLICATE'
    )
  })

  it('throws CATEGORY_VALUE_SUBJECT_NOT_FOUND when a subject ID is invalid', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [{ id: CAT_ID, status: 'UNDER_REVIEW' }], rowCount: 1 }
      }
      if (sql.includes('LOWER(code)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('FROM subjects WHERE id = ANY')) {
        return { rows: [], rowCount: 0 } // no matching subjects → all invalid
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategoryValue(
        db as any,
        {
          category_id: CAT_ID,
          code: 'VAL01',
          translations: validTranslations,
          subject_ids: [SUBJECT_ID],
        },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_SUBJECT_NOT_FOUND'
    )
  })

  it('throws CATEGORY_VALUE_DIVISION_NOT_FOUND when a division ID is invalid', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [{ id: CAT_ID, status: 'UNDER_REVIEW' }], rowCount: 1 }
      }
      if (sql.includes('LOWER(code)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('FROM subjects WHERE id = ANY')) return { rows: [], rowCount: 0 }
      // subjectsExistBatch only called if subject_ids provided — skipping
      if (sql.includes('FROM divisions WHERE id = ANY')) {
        return { rows: [], rowCount: 0 } // no matching divisions → all invalid
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategoryValue(
        db as any,
        {
          category_id: CAT_ID,
          code: 'VAL01',
          translations: validTranslations,
          division_ids: [DIVISION_ID],
        },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_DIVISION_NOT_FOUND'
    )
  })

  it('throws CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT when subject scope exceeds parent', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('SELECT id, status FROM categories')) {
        return { rows: [{ id: CAT_ID, status: 'UNDER_REVIEW' }], rowCount: 1 }
      }
      if (sql.includes('LOWER(code)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('FROM subjects WHERE id = ANY')) {
        return { rows: [{ id: SUBJECT_ID }], rowCount: 1 } // valid subject
      }
      // Parent category has a DIFFERENT subject in scope
      const OTHER_SUBJECT = '55555555-5555-5555-5555-555555555555'
      if (sql.includes('category_subjects WHERE category_id')) {
        return { rows: [{ subject_id: OTHER_SUBJECT }], rowCount: 1 } // parent allows OTHER, not SUBJECT_ID
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createCategoryValue(
        db as any,
        {
          category_id: CAT_ID,
          code: 'VAL01',
          translations: validTranslations,
          subject_ids: [SUBJECT_ID], // not in parent's scope
        },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT'
    )
  })
})

// ---------------------------------------------------------------------------
// 4. updateCategoryValue — guards, status transitions, lock conflict
// ---------------------------------------------------------------------------

describe('updateCategoryValue', () => {
  it('throws CATEGORY_VALUE_NOT_FOUND when value does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategoryValue(
        db as any,
        VAL_ID,
        { code: 'NEW01', translations: validTranslations },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_NOT_FOUND'
    )
  })

  it('throws CATEGORY_VALUE_CODE_DUPLICATE when the updated code conflicts with an existing value', async () => {
    const lockedRow = makeValueRow({ status: 'UNDER_REVIEW', code: 'OLD_CODE' })
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK'))
        return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [lockedRow], rowCount: 1 }
      if (sql.includes('EXISTS') && sql.includes('LOWER(code)'))
        return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategoryValue(db as any, VAL_ID, { code: 'DUPLICATE_CODE' }, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_CODE_DUPLICATE'
    )
  })

  it('throws INVALID_STATUS_TRANSITION for COMPLETED → ENABLED (invalid)', async () => {
    const completedRow = makeValueRow({ status: 'COMPLETED' })

    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [completedRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategoryValue(db as any, VAL_ID, { status: 'ENABLED' }, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'INVALID_STATUS_TRANSITION'
    )
  })

  it('throws INVALID_STATUS_TRANSITION for APPROVED → COMPLETED (invalid)', async () => {
    const approvedRow = makeValueRow({ status: 'APPROVED' })

    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [approvedRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategoryValue(db as any, VAL_ID, { status: 'COMPLETED' }, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'INVALID_STATUS_TRANSITION'
    )
  })

  it('accepts valid status transition COMPLETED → UNDER_REVIEW', async () => {
    const completedRow = makeValueRow({ status: 'COMPLETED' })
    const underReviewRow = makeValueRow({ status: 'UNDER_REVIEW' })

    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [completedRow], rowCount: 1 }
      if (sql.includes('UPDATE category_values')) return { rows: [underReviewRow], rowCount: 1 }
      // fetchScopedRow after update
      if (sql.includes('FROM category_values') && sql.includes('deleted_at IS NULL')) {
        return { rows: [underReviewRow], rowCount: 1 }
      }
      if (sql.includes('category_value_subjects')) return { rows: [], rowCount: 0 }
      if (sql.includes('category_value_divisions')) return { rows: [], rowCount: 0 }
      if (sql.includes("entity_type = 'CATEGORY_VALUE'")) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const result = await updateCategoryValue(
      db as any,
      VAL_ID,
      { status: 'UNDER_REVIEW' },
      auditCtx
    )
    expect(result.status).toBe('UNDER_REVIEW')
  })

  it('accepts valid status transition APPROVED → ENABLED', async () => {
    const approvedRow = makeValueRow({ status: 'APPROVED' })
    const enabledRow = makeValueRow({ status: 'ENABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [approvedRow], rowCount: 1 }
      if (sql.includes('UPDATE category_values')) return { rows: [enabledRow], rowCount: 1 }
      if (sql.includes('FROM category_values') && sql.includes('deleted_at IS NULL')) {
        return { rows: [enabledRow], rowCount: 1 }
      }
      if (sql.includes('category_value_subjects')) return { rows: [], rowCount: 0 }
      if (sql.includes('category_value_divisions')) return { rows: [], rowCount: 0 }
      if (sql.includes("entity_type = 'CATEGORY_VALUE'")) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const result = await updateCategoryValue(db as any, VAL_ID, { status: 'ENABLED' }, auditCtx)
    expect(result.status).toBe('ENABLED')
  })

  it('throws CATEGORY_VALUE_LOCK_CONFLICT when PG raises 55P03', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('workspace_settings')) {
        return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
      }
      if (sql.includes('BEGIN')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) {
        const err = Object.assign(new Error('could not obtain lock'), { code: '55P03' })
        throw err
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateCategoryValue(
        db as any,
        VAL_ID,
        { code: 'VAL02', translations: validTranslations },
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_LOCK_CONFLICT'
    )
  })
})

// ---------------------------------------------------------------------------
// 5. deleteCategoryValue — guards, idempotency, lock conflict
// ---------------------------------------------------------------------------

describe('deleteCategoryValue', () => {
  it('returns { deleted: true } on successful soft-delete', async () => {
    const activeRow = makeValueRow()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [activeRow], rowCount: 1 }
      // No dependency checks fire (empty registry)
      if (sql.includes('UPDATE category_values') && sql.includes('deleted_at')) {
        return { rows: [{ ...activeRow, deleted_at: NOW }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const result = await deleteCategoryValue(db as any, VAL_ID, auditCtx)
    expect(result.deleted).toBe(true)
  })

  it('returns { deleted: true } idempotently when value is already deleted', async () => {
    const deletedRow = makeValueRow({ deleted_at: NOW })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      // findCategoryValueForUpdate returns the row regardless of deleted_at
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [deletedRow], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await deleteCategoryValue(db as any, VAL_ID, auditCtx)
    expect(result.deleted).toBe(true)
  })

  it('throws CATEGORY_VALUE_NOT_FOUND when value does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteCategoryValue(db as any, 'missing', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_NOT_FOUND'
    )
  })

  it('throws CATEGORY_VALUE_LOCK_CONFLICT when PG raises 55P03', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) {
        const err = Object.assign(new Error('could not obtain lock'), { code: '55P03' })
        throw err
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteCategoryValue(db as any, VAL_ID, auditCtx)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CategoryValueError && err.code === 'CATEGORY_VALUE_LOCK_CONFLICT'
    )
  })
})

// ---------------------------------------------------------------------------
// 6. validateStatusTransition (via updateCategoryValue) — all 6 valid transitions
// ---------------------------------------------------------------------------

describe('validateStatusTransition — valid paths', () => {
  const allowedTransitions: Array<[string, string]> = [
    ['COMPLETED', 'UNDER_REVIEW'],
    ['UNDER_REVIEW', 'APPROVED'],
    ['APPROVED', 'ENABLED'],
    ['APPROVED', 'DISABLED'],
    ['ENABLED', 'DISABLED'],
    ['DISABLED', 'ENABLED'],
  ]

  for (const [from, to] of allowedTransitions) {
    it(`allows ${from} → ${to}`, async () => {
      const fromRow = makeValueRow({ status: from })
      const toRow = makeValueRow({ status: to })

      const db = makeDb((sql) => {
        if (sql.includes('workspace_settings')) {
          return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
        }
        if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
        if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [fromRow], rowCount: 1 }
        if (sql.includes('UPDATE category_values')) return { rows: [toRow], rowCount: 1 }
        if (sql.includes('FROM category_values') && sql.includes('deleted_at IS NULL')) {
          return { rows: [toRow], rowCount: 1 }
        }
        if (sql.includes('category_value_subjects')) return { rows: [], rowCount: 0 }
        if (sql.includes('category_value_divisions')) return { rows: [], rowCount: 0 }
        if (sql.includes("entity_type = 'CATEGORY_VALUE'")) return { rows: [], rowCount: 0 }
        return { rows: [], rowCount: 0 }
      })

      const result = await updateCategoryValue(db as any, VAL_ID, { status: to as any }, auditCtx)
      expect(result.status).toBe(to)
    })
  }
})

describe('validateStatusTransition — invalid rejections', () => {
  const invalidTransitions: Array<[string, string]> = [
    ['COMPLETED', 'APPROVED'],
    ['COMPLETED', 'ENABLED'],
    ['COMPLETED', 'DISABLED'],
    ['UNDER_REVIEW', 'COMPLETED'],
    ['UNDER_REVIEW', 'ENABLED'],
    ['UNDER_REVIEW', 'DISABLED'],
    ['APPROVED', 'COMPLETED'],
    ['APPROVED', 'UNDER_REVIEW'],
    ['ENABLED', 'COMPLETED'],
    ['DISABLED', 'COMPLETED'],
  ]

  for (const [from, to] of invalidTransitions) {
    it(`rejects ${from} → ${to}`, async () => {
      const fromRow = makeValueRow({ status: from })

      const db = makeDb((sql) => {
        if (sql.includes('workspace_settings')) {
          return { rows: [DEFAULT_LANG_CONFIG], rowCount: 1 }
        }
        if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
        if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [fromRow], rowCount: 1 }
        return { rows: [], rowCount: 0 }
      })

      await expect(
        updateCategoryValue(db as any, VAL_ID, { status: to as any }, auditCtx)
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof CategoryValueError && err.code === 'INVALID_STATUS_TRANSITION'
      )
    })
  }
})

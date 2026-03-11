/**
 * Translation Service — Unit Tests
 *
 * File: tests/unit/translation/translation-service.test.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Tests business logic: validation, upsert, fallback resolution, pagination.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  TRANSLATION_ERROR_CODES,
  TranslationError,
} from '../../../packages/domain-core/src/translation/translation.errors'
import {
  batchLoadTranslations,
  deleteEntityTranslations,
  deleteLanguageTranslations,
  type EntityValidator,
  listEntityTranslations,
  resolveEntityTranslations,
  upsertTranslations,
} from '../../../packages/domain-core/src/translation/translation.service'
import type { TranslationOperationContext } from '../../../packages/domain-core/src/translation/translation.types'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseCtx: TranslationOperationContext = {
  workspace_id: 'ws-001',
  workspace_slug: 'test-workspace',
  user_id: 'user-001',
  correlation_id: 'corr-001',
  default_language: 'en',
  supported_languages: ['en', 'ar', 'fr'],
}

function createMockDb(queryResponses: Record<string, unknown> = {}) {
  const queryLog: Array<{ sql: string; params?: unknown[] }> = []

  const db = {
    _queryLog: queryLog,
    query: vi.fn(async <T = unknown>(sql: string, params?: unknown[]) => {
      queryLog.push({ sql, params })

      if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
        return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number | null }
      }

      // Match query override by keyword
      for (const [keyword, response] of Object.entries(queryResponses)) {
        if (sql.includes(keyword)) {
          return response as { rows: T[]; rowCount: number | null }
        }
      }

      return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number | null }
    }),
  }

  return db as unknown as {
    _queryLog: Array<{ sql: string; params?: unknown[] }>
    query: <T = unknown>(
      sql: string,
      params?: unknown[]
    ) => Promise<{ rows: T[]; rowCount: number | null }>
  }
}

const alwaysExistsValidator: EntityValidator = async () => true
const neverExistsValidator: EntityValidator = async () => false

// ---------------------------------------------------------------------------
// upsertTranslations tests
// ---------------------------------------------------------------------------

describe('upsertTranslations', () => {
  it('throws UNKNOWN_ENTITY_TYPE for unregistered entity type', async () => {
    const db = createMockDb()
    const items = [
      {
        entity_type: 'unknown_type',
        entity_id: 'e1',
        field_name: 'title',
        language_code: 'ar',
        translated_value: 'Test',
      },
    ]

    await expect(upsertTranslations(db, baseCtx, items, alwaysExistsValidator)).rejects.toThrow(
      TranslationError
    )

    await expect(
      upsertTranslations(db, baseCtx, items, alwaysExistsValidator)
    ).rejects.toMatchObject({
      code: TRANSLATION_ERROR_CODES.UNKNOWN_ENTITY_TYPE,
    })
  })

  it('throws UNSUPPORTED_LANGUAGE for language not in supported_languages', async () => {
    const db = createMockDb()
    const items = [
      {
        entity_type: 'question',
        entity_id: 'q-001',
        field_name: 'text',
        language_code: 'de', // Not in supported_languages
        translated_value: 'Frage',
      },
    ]

    await expect(
      upsertTranslations(db, baseCtx, items, alwaysExistsValidator)
    ).rejects.toMatchObject({
      code: TRANSLATION_ERROR_CODES.UNSUPPORTED_LANGUAGE,
    })
  })

  it('throws DEFAULT_LANGUAGE_WRITE for default language', async () => {
    const db = createMockDb()
    const items = [
      {
        entity_type: 'question',
        entity_id: 'q-001',
        field_name: 'text',
        language_code: 'en', // Default language
        translated_value: 'Question text',
      },
    ]

    await expect(
      upsertTranslations(db, baseCtx, items, alwaysExistsValidator)
    ).rejects.toMatchObject({
      code: TRANSLATION_ERROR_CODES.DEFAULT_LANGUAGE_WRITE,
    })
  })

  it('throws UNSUPPORTED_LANGUAGE for language with removing status', async () => {
    const db = createMockDb()
    const ctx: TranslationOperationContext = {
      ...baseCtx,
      language_status: { ar: 'removing' },
    }
    const items = [
      {
        entity_type: 'question',
        entity_id: 'q-001',
        field_name: 'text',
        language_code: 'ar',
        translated_value: 'سؤال',
      },
    ]

    await expect(upsertTranslations(db, ctx, items, alwaysExistsValidator)).rejects.toMatchObject({
      code: TRANSLATION_ERROR_CODES.UNSUPPORTED_LANGUAGE,
    })
  })

  it('throws INVALID_FIELD_NAME for non-translatable field', async () => {
    const db = createMockDb()
    const items = [
      {
        entity_type: 'question',
        entity_id: 'q-001',
        field_name: 'nonexistent_field',
        language_code: 'ar',
        translated_value: 'test',
      },
    ]

    await expect(
      upsertTranslations(db, baseCtx, items, alwaysExistsValidator)
    ).rejects.toMatchObject({
      code: TRANSLATION_ERROR_CODES.INVALID_FIELD_NAME,
    })
  })

  it('throws ENTITY_NOT_FOUND when entity does not exist', async () => {
    const db = createMockDb()
    const items = [
      {
        entity_type: 'question',
        entity_id: 'q-nonexistent',
        field_name: 'text',
        language_code: 'ar',
        translated_value: 'سؤال',
      },
    ]

    await expect(
      upsertTranslations(db, baseCtx, items, neverExistsValidator)
    ).rejects.toMatchObject({
      code: TRANSLATION_ERROR_CODES.ENTITY_NOT_FOUND,
    })
  })

  it('succeeds for valid upsert and returns saved rows', async () => {
    const savedRow = {
      id: 'tr-001',
      entity_type: 'question',
      entity_id: 'q-001',
      field_name: 'text',
      language_code: 'ar',
      translated_value: 'سؤال',
      created_at: new Date(),
      updated_at: new Date(),
    }

    const db = createMockDb({
      'ON CONFLICT': { rows: [savedRow], rowCount: 1 },
    })

    const items = [
      {
        entity_type: 'question',
        entity_id: 'q-001',
        field_name: 'text',
        language_code: 'ar',
        translated_value: 'سؤال',
      },
    ]

    const result = await upsertTranslations(db, baseCtx, items, alwaysExistsValidator)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      entity_type: 'question',
      entity_id: 'q-001',
      field_name: 'text',
      language_code: 'ar',
    })
  })

  it('rolls back transaction on error', async () => {
    const queries: Array<{ sql: string }> = []
    const db = {
      _queryLog: queries,
      query: vi.fn(async (sql: string) => {
        queries.push({ sql })
        if (sql.includes('BEGIN')) return { rows: [], rowCount: 0 }
        if (sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
        if (sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
        // The first non-transaction query (entity existence check or INSERT) throws
        throw new Error('DB error')
      }),
    }

    const items = [
      {
        entity_type: 'question',
        entity_id: 'q-001',
        field_name: 'text',
        language_code: 'ar',
        translated_value: 'سؤال',
      },
    ]

    await expect(upsertTranslations(db, baseCtx, items, alwaysExistsValidator)).rejects.toThrow(
      'DB error'
    )

    const rollbackCalled = queries.some((q) => q.sql.includes('ROLLBACK'))
    expect(rollbackCalled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// resolveEntityTranslations tests
// ---------------------------------------------------------------------------

describe('resolveEntityTranslations', () => {
  it('returns base fields directly for default language (no DB call)', async () => {
    const db = createMockDb()
    const baseFields = { text: 'Question text', explanation: 'Explanation' }

    const result = await resolveEntityTranslations(
      db,
      baseCtx,
      'question',
      'q-001',
      'en', // Default language
      baseFields
    )

    expect(result.fields.text).toBe('Question text')
    expect(result.fallback_fields).toEqual([])
    expect(db.query).not.toHaveBeenCalled()
  })

  it('returns translated values when translation exists', async () => {
    const db = createMockDb({
      'FROM translations': {
        rows: [
          { field_name: 'text', translated_value: 'سؤال' },
          { field_name: 'explanation', translated_value: 'شرح' },
        ],
        rowCount: 2,
      },
    })

    const result = await resolveEntityTranslations(db, baseCtx, 'question', 'q-001', 'ar', {
      text: 'Question text',
      explanation: 'Explanation',
    })

    expect(result.fields.text).toBe('سؤال')
    expect(result.fields.explanation).toBe('شرح')
    expect(result.fallback_fields).toEqual([])
  })

  it('falls back to base entity value when translation is missing', async () => {
    const db = createMockDb({
      'FROM translations': {
        rows: [{ field_name: 'text', translated_value: 'سؤال' }],
        rowCount: 1,
      },
    })

    const result = await resolveEntityTranslations(db, baseCtx, 'question', 'q-001', 'ar', {
      text: 'Question text',
      explanation: 'Fallback explanation',
    })

    // text has translation
    expect(result.fields.text).toBe('سؤال')
    // explanation falls back to base
    expect(result.fields.explanation).toBe('Fallback explanation')
    expect(result.fallback_fields).toContain('explanation')
  })

  it('returns empty string and adds to fallback_fields when both translation and base are absent', async () => {
    const db = createMockDb({
      'FROM translations': { rows: [], rowCount: 0 },
    })

    const result = await resolveEntityTranslations(
      db,
      baseCtx,
      'question',
      'q-001',
      'ar',
      {} // No base fields
    )

    expect(result.fields.text).toBe('')
    expect(result.fallback_fields).toContain('text')
  })
})

// ---------------------------------------------------------------------------
// batchLoadTranslations tests
// ---------------------------------------------------------------------------

describe('batchLoadTranslations', () => {
  it('returns empty map for empty entity IDs array', async () => {
    const db = createMockDb()
    const result = await batchLoadTranslations(db, 'question', [], 'ar')
    expect(result.size).toBe(0)
    expect(db.query).not.toHaveBeenCalled()
  })

  it('groups results by entity_id', async () => {
    const db = createMockDb({
      'FROM translations': {
        rows: [
          {
            entity_id: 'q-001',
            field_name: 'text',
            translated_value: 'سؤال ١',
          },
          {
            entity_id: 'q-001',
            field_name: 'explanation',
            translated_value: 'شرح ١',
          },
          {
            entity_id: 'q-002',
            field_name: 'text',
            translated_value: 'سؤال ٢',
          },
        ],
        rowCount: 3,
      },
    })

    const result = await batchLoadTranslations(db, 'question', ['q-001', 'q-002'], 'ar')

    expect(result.get('q-001')?.get('text')).toBe('سؤال ١')
    expect(result.get('q-001')?.get('explanation')).toBe('شرح ١')
    expect(result.get('q-002')?.get('text')).toBe('سؤال ٢')
  })
})

// ---------------------------------------------------------------------------
// listEntityTranslations tests
// ---------------------------------------------------------------------------

describe('listEntityTranslations', () => {
  it('returns paginated results with next_cursor', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `tr-${String(i + 1).padStart(3, '0')}`,
      entity_type: 'question',
      entity_id: 'q-001',
      field_name: 'text',
      language_code: 'ar',
      translated_value: `Translation ${i + 1}`,
      created_at: new Date(),
      updated_at: new Date(),
    }))

    const db = createMockDb({
      'FROM translations': { rows: rows.slice(0, 21), rowCount: 21 },
    })

    const result = await listEntityTranslations(db, {
      entityType: 'question',
      entityId: 'q-001',
      pageSize: 20,
    })

    expect(result.items).toHaveLength(20)
    expect(result.next_cursor).toBe('tr-020')
  })

  it('returns null next_cursor on last page', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `tr-00${i + 1}`,
      entity_type: 'question',
      entity_id: 'q-001',
      field_name: 'text',
      language_code: 'ar',
      translated_value: `Translation ${i + 1}`,
      created_at: new Date(),
      updated_at: new Date(),
    }))

    const db = createMockDb({
      'FROM translations': { rows, rowCount: 5 },
    })

    const result = await listEntityTranslations(db, {
      entityType: 'question',
      entityId: 'q-001',
      pageSize: 20,
    })

    expect(result.items).toHaveLength(5)
    expect(result.next_cursor).toBeNull()
  })

  it('caps page_size at 50', async () => {
    const db = createMockDb({
      'FROM translations': { rows: [], rowCount: 0 },
    })

    await listEntityTranslations(db, {
      entityType: 'question',
      entityId: 'q-001',
      pageSize: 100, // Over the max
    })

    // fetchLimit passed to DB should be 51 (50 + 1)
    const query = db._queryLog.find((q) => q.sql.includes('FROM translations'))
    const params = query?.params as unknown[]
    expect(params?.[params.length - 1]).toBe(51) // 50 + 1 for hasMore detection
  })
})

// ---------------------------------------------------------------------------
// deleteEntityTranslations tests
// ---------------------------------------------------------------------------

describe('deleteEntityTranslations', () => {
  it('returns 0 when no translations exist', async () => {
    const db = createMockDb({
      'DELETE FROM translations': { rows: [], rowCount: 0 },
    })

    const count = await deleteEntityTranslations(db, baseCtx, 'question', 'q-nonexistent')

    expect(count).toBe(0)
  })

  it('deletes rows and inserts audit entries', async () => {
    const deletedRows = [
      {
        id: 'tr-001',
        field_name: 'text',
        language_code: 'ar',
        translated_value: 'سؤال',
      },
    ]

    const db = createMockDb({
      'DELETE FROM translations': { rows: deletedRows, rowCount: 1 },
    })

    const count = await deleteEntityTranslations(db, baseCtx, 'question', 'q-001')

    expect(count).toBe(1)

    const auditInsert = db._queryLog.find((q) =>
      q.sql.includes('INSERT INTO translation_audit_logs')
    )
    expect(auditInsert).toBeDefined()
    expect(auditInsert?.sql).toContain("'deleted'")
  })
})

// ---------------------------------------------------------------------------
// deleteLanguageTranslations tests
// ---------------------------------------------------------------------------

describe('deleteLanguageTranslations', () => {
  it('deletes all translations for language and inserts audit batch with reason=language_removed', async () => {
    const deletedRows = [
      {
        id: 'tr-001',
        entity_type: 'question',
        entity_id: 'q-001',
        field_name: 'text',
        language_code: 'ar',
        translated_value: 'سؤال',
      },
    ]

    const db = createMockDb({
      'DELETE FROM translations': { rows: deletedRows, rowCount: 1 },
    })

    const result = await deleteLanguageTranslations(db, baseCtx, 'ar')

    expect(result).toHaveLength(1)

    const auditInsert = db._queryLog.find((q) =>
      q.sql.includes('INSERT INTO translation_audit_logs')
    )
    expect(auditInsert?.sql).toContain("'language_removed'")
  })
})

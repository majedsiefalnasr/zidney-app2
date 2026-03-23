/**
 * Category Values Repository Unit Tests — STAGE_31_CATEGORY_VALUES
 *
 * File: packages/domain-core/src/category-values/__tests__/category-values.repository.test.ts
 *
 * Focuses on SQL injection safety (all user input must be parameterized),
 * batch query correctness, and conflict-target verification.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  categoryValueCodeExists,
  findCategoryValues,
  findScopeForValues,
  findTranslationsForValues,
  upsertTranslations,
} from '../category-values.repository'

// ---------------------------------------------------------------------------
// db mock factory
// ---------------------------------------------------------------------------

type QueryCapture = { sql: string; params: unknown[] | undefined }

function makeCapturingDb(rows: unknown[] = []) {
  const calls: QueryCapture[] = []
  const db = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params })
      return { rows, rowCount: rows.length }
    }),
  }
  return { db, calls }
}

// ---------------------------------------------------------------------------
// 1. findCategoryValues — search is parameterised, never interpolated
// ---------------------------------------------------------------------------

describe('findCategoryValues', () => {
  it('passes search value as a parameterised $N placeholder — not interpolated', async () => {
    const userInput = "'; DROP TABLE category_values; --"

    const { db, calls } = makeCapturingDb([])

    await findCategoryValues(db as any, {
      category_id: '11111111-1111-1111-1111-111111111111',
      page: 1,
      limit: 10,
      search: userInput,
    })

    // Exactly one query should have been issued
    expect(calls.length).toBeGreaterThanOrEqual(1)

    const selectCall = calls.find((c) => c.sql.includes('FROM category_values cv'))
    expect(selectCall).toBeDefined()

    // The raw SQL must NOT contain the user string
    expect(selectCall!.sql).not.toContain(userInput)

    // The user string MUST appear as a parameter value (wrapped with %)
    const paramsFlat = (selectCall!.params ?? []).map(String)
    expect(paramsFlat.some((p) => p.includes(userInput))).toBe(true)
  })

  it('uses ILIKE $N (parameterised) in the WHERE clause when search is provided', async () => {
    const { db, calls } = makeCapturingDb([])

    await findCategoryValues(db as any, {
      category_id: '11111111-1111-1111-1111-111111111111',
      page: 1,
      limit: 10,
      search: 'math',
    })

    const selectCall = calls.find((c) => c.sql.includes('FROM category_values cv'))
    expect(selectCall).toBeDefined()

    // The SQL must contain the ILIKE parameterised form, not ILIKE 'math'
    expect(selectCall!.sql).toMatch(/ILIKE \$\d+/)
    expect(selectCall!.sql).not.toMatch(/ILIKE\s+'math'/i)
  })

  it('does not include search JOIN or condition when search is omitted', async () => {
    const { db, calls } = makeCapturingDb([])

    await findCategoryValues(db as any, {
      category_id: '22222222-2222-2222-2222-222222222222',
      page: 1,
      limit: 5,
    })

    const selectCall = calls.find((c) => c.sql.includes('FROM category_values cv'))
    expect(selectCall).toBeDefined()
    expect(selectCall!.sql).not.toContain('ILIKE')
    expect(selectCall!.sql).not.toContain('LEFT JOIN translations')
  })

  it('appends deleted soft-deleted WHERE clause when include_deleted is NOT set', async () => {
    const { db, calls } = makeCapturingDb([])

    await findCategoryValues(db as any, {
      category_id: '33333333-3333-3333-3333-333333333333',
      page: 1,
      limit: 10,
    })

    const selectCall = calls.find((c) => c.sql.includes('FROM category_values cv'))
    expect(selectCall!.sql).toContain('deleted_at IS NULL')
  })

  it('omits deleted_at IS NULL when include_deleted=true', async () => {
    const { db, calls } = makeCapturingDb([])

    await findCategoryValues(db as any, {
      category_id: '33333333-3333-3333-3333-333333333333',
      page: 1,
      limit: 10,
      include_deleted: true,
    })

    const selectCall = calls.find((c) => c.sql.includes('FROM category_values cv'))
    expect(selectCall!.sql).not.toContain('deleted_at IS NULL')
  })
})

// ---------------------------------------------------------------------------
// 2. findScopeForValues — ANY($1::uuid[]) batch shape
// ---------------------------------------------------------------------------

describe('findScopeForValues', () => {
  it('returns empty maps when valueIds is empty (zero DB calls)', async () => {
    const { db, calls } = makeCapturingDb([])

    const result = await findScopeForValues(db as any, [])

    expect(calls).toHaveLength(0)
    expect(result.subjects.size).toBe(0)
    expect(result.divisions.size).toBe(0)
  })

  it('issues two parallel queries using ANY($1::uuid[]) for subject and division tables', async () => {
    const valueIds = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ]

    const { db, calls } = makeCapturingDb([])
    // Both queries return empty rows — we only care about shape
    await findScopeForValues(db as any, valueIds)

    // Two parallel queries issued
    expect(calls).toHaveLength(2)

    const subjCall = calls.find((c) => c.sql.includes('category_value_subjects'))
    const divCall = calls.find((c) => c.sql.includes('category_value_divisions'))

    expect(subjCall).toBeDefined()
    expect(divCall).toBeDefined()

    // Both must use ANY($1::uuid[]) — batch parameterised array
    expect(subjCall!.sql).toMatch(/ANY\(\$1::uuid\[\]\)/)
    expect(divCall!.sql).toMatch(/ANY\(\$1::uuid\[\]\)/)

    // Both must pass the valueIds array as the single parameter
    expect(subjCall!.params).toEqual([valueIds])
    expect(divCall!.params).toEqual([valueIds])
  })

  it('correctly groups subject_ids by category_value_id', async () => {
    const VALUE_A = '11111111-1111-1111-1111-111111111111'
    const VALUE_B = '22222222-2222-2222-2222-222222222222'
    const SUBJECT_1 = 'aaaa0000-0000-0000-0000-000000000001'
    const SUBJECT_2 = 'aaaa0000-0000-0000-0000-000000000002'

    let _callIndex = 0
    const db = {
      query: vi.fn(async (sql: string) => {
        _callIndex++
        if (sql.includes('category_value_subjects')) {
          return {
            rows: [
              { category_value_id: VALUE_A, subject_id: SUBJECT_1 },
              { category_value_id: VALUE_B, subject_id: SUBJECT_2 },
            ],
            rowCount: 2,
          }
        }
        // divisions — empty
        return { rows: [], rowCount: 0 }
      }),
    }

    const result = await findScopeForValues(db as any, [VALUE_A, VALUE_B])

    expect(result.subjects.get(VALUE_A)).toEqual([SUBJECT_1])
    expect(result.subjects.get(VALUE_B)).toEqual([SUBJECT_2])
    expect(result.divisions.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 3. findTranslationsForValues — entity_type constant + ANY batch
// ---------------------------------------------------------------------------

describe('findTranslationsForValues', () => {
  it('returns empty map when valueIds is empty (zero DB calls)', async () => {
    const { db, calls } = makeCapturingDb([])

    const result = await findTranslationsForValues(db as any, [])

    expect(calls).toHaveLength(0)
    expect(result.size).toBe(0)
  })

  it("uses entity_type = 'CATEGORY_VALUE' constant (not parameterized)", async () => {
    const { db, calls } = makeCapturingDb([])

    await findTranslationsForValues(db as any, ['11111111-1111-1111-1111-111111111111'])

    expect(calls).toHaveLength(1)
    const { sql } = calls[0]!
    // The entity_type MUST be a hardcoded string literal — NOT a parameter
    expect(sql).toContain("entity_type = 'CATEGORY_VALUE'")
    expect(sql).not.toMatch(/entity_type\s*=\s*\$\d+/)
  })

  it('uses ANY($N::uuid[]) for the valueIds parameter', async () => {
    const ids = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']

    const { db, calls } = makeCapturingDb([])
    await findTranslationsForValues(db as any, ids)

    const { sql, params } = calls[0]!
    expect(sql).toMatch(/ANY\(\$1::uuid\[\]\)/)
    expect(params).toEqual([ids])
  })

  it('groups translations correctly by entity_id', async () => {
    const VALUE_ID = '11111111-1111-1111-1111-111111111111'
    const rows = [
      { entity_id: VALUE_ID, field_name: 'name', language_code: 'en', translated_value: 'Math' },
      { entity_id: VALUE_ID, field_name: 'name', language_code: 'ar', translated_value: 'رياضيات' },
    ]

    const { db } = makeCapturingDb(rows)
    const result = await findTranslationsForValues(db as any, [VALUE_ID])

    expect(result.has(VALUE_ID)).toBe(true)
    const translations = result.get(VALUE_ID)!
    expect(translations).toHaveLength(2)
    expect(translations.find((t) => t.language_code === 'ar')?.translated_value).toBe('رياضيات')
  })
})

// ---------------------------------------------------------------------------
// 4. upsertTranslations — conflict target + SET clause
// ---------------------------------------------------------------------------

describe('upsertTranslations', () => {
  it('issues one INSERT per translation', async () => {
    const { db, calls } = makeCapturingDb([])

    await upsertTranslations(db as any, '11111111-1111-1111-1111-111111111111', [
      { language_code: 'en', field_name: 'name', translated_value: 'Math' },
      { language_code: 'ar', field_name: 'name', translated_value: 'رياضيات' },
    ])

    expect(calls).toHaveLength(2)
  })

  it('uses ON CONFLICT ON CONSTRAINT translations_composite_unique', async () => {
    const { db, calls } = makeCapturingDb([])

    await upsertTranslations(db as any, '11111111-1111-1111-1111-111111111111', [
      { language_code: 'en', field_name: 'name', translated_value: 'Math' },
    ])

    const { sql } = calls[0]!
    expect(sql).toContain('ON CONFLICT ON CONSTRAINT translations_composite_unique')
  })

  it('updates translated_value on conflict', async () => {
    const { db, calls } = makeCapturingDb([])

    await upsertTranslations(db as any, '11111111-1111-1111-1111-111111111111', [
      { language_code: 'en', field_name: 'name', translated_value: 'New Name' },
    ])

    const { sql } = calls[0]!
    expect(sql).toContain('DO UPDATE SET translated_value = EXCLUDED.translated_value')
  })

  it("inserts with entity_type = 'CATEGORY_VALUE' as a hardcoded literal", async () => {
    const { db, calls } = makeCapturingDb([])

    await upsertTranslations(db as any, '11111111-1111-1111-1111-111111111111', [
      { language_code: 'en', field_name: 'name', translated_value: 'Test' },
    ])

    const { sql } = calls[0]!
    expect(sql).toContain("'CATEGORY_VALUE'")
    // entity_type must NOT be passed as a runtime parameter
    const params = calls[0]!.params ?? []
    expect(params).not.toContain('CATEGORY_VALUE')
  })

  it('passes all 4 translation fields as parameters in correct order', async () => {
    const ENTITY_ID = '11111111-1111-1111-1111-111111111111'
    const { db, calls } = makeCapturingDb([])

    await upsertTranslations(db as any, ENTITY_ID, [
      { language_code: 'en', field_name: 'name', translated_value: 'Math' },
    ])

    const params = calls[0]!.params!
    // Expected: [entityId, field_name, language_code, translated_value]
    expect(params[0]).toBe(ENTITY_ID)
    expect(params[1]).toBe('name')
    expect(params[2]).toBe('en')
    expect(params[3]).toBe('Math')
  })

  it('is a no-op when translations array is empty', async () => {
    const { db, calls } = makeCapturingDb([])

    await upsertTranslations(db as any, '11111111-1111-1111-1111-111111111111', [])

    expect(calls).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 5. categoryValueCodeExists — excludeId becomes a parameterised $N placeholder
// ---------------------------------------------------------------------------

describe('categoryValueCodeExists', () => {
  it('uses LOWER(code) to perform case-insensitive comparison', async () => {
    const { db, calls } = makeCapturingDb([{ exists: false }])

    await categoryValueCodeExists(db as any, '11111111-1111-1111-1111-111111111111', 'VAL01')

    const { sql } = calls[0]!
    expect(sql).toContain('LOWER(code)')
  })

  it('excludes only active (non-deleted) rows from the uniqueness check', async () => {
    const { db, calls } = makeCapturingDb([{ exists: false }])

    await categoryValueCodeExists(db as any, '11111111-1111-1111-1111-111111111111', 'VAL01')

    const { sql } = calls[0]!
    expect(sql).toContain('deleted_at IS NULL')
  })

  it('excludes the given ID via parameterised $3::uuid when excludeId is provided', async () => {
    const EXCLUDE_ID = '99999999-9999-9999-9999-999999999999'
    const { db, calls } = makeCapturingDb([{ exists: false }])

    await categoryValueCodeExists(
      db as any,
      '11111111-1111-1111-1111-111111111111',
      'VAL01',
      EXCLUDE_ID
    )

    const { sql, params } = calls[0]!

    // The SQL parameterised placeholder ($3) must appear
    expect(sql).toMatch(/\$3::uuid/)

    // The EXCLUDE_ID must be passed as third parameter
    expect(params?.[2]).toBe(EXCLUDE_ID)

    // The raw ID string must NOT appear inside the SQL text itself
    expect(sql).not.toContain(EXCLUDE_ID)
  })

  it('does NOT add exclusion clause when excludeId is omitted', async () => {
    const { db, calls } = makeCapturingDb([{ exists: false }])

    await categoryValueCodeExists(db as any, '11111111-1111-1111-1111-111111111111', 'VAL01')

    const { sql, params } = calls[0]!
    expect(sql).not.toContain('id <>') // no exclusion in SQL
    expect(params).toHaveLength(2) // only category_id + code
  })

  it('returns true when a matching code already exists', async () => {
    const { db } = makeCapturingDb([{ exists: true }])

    const result = await categoryValueCodeExists(
      db as any,
      '11111111-1111-1111-1111-111111111111',
      'VAL01'
    )
    expect(result).toBe(true)
  })

  it('returns false when no matching code exists', async () => {
    const { db } = makeCapturingDb([{ exists: false }])

    const result = await categoryValueCodeExists(
      db as any,
      '11111111-1111-1111-1111-111111111111',
      'NEW_CODE'
    )
    expect(result).toBe(false)
  })
})

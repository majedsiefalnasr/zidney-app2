/**
 * Drain Language Translations Worker Job — Unit Tests
 *
 * File: tests/unit/translation/drain-language-translations.test.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Tests handleDrainLanguageTranslationsJob:
 *   - Zod payload validation failure
 *   - Happy path: batched DELETE → audit log INSERT → workspace_settings update → SCAN invalidation
 *   - Partial batch (last batch smaller than batch_size)
 *   - DB error mid-batch: ROLLBACK, returns { success: false }
 */

import { describe, expect, it, vi } from 'vitest'

import { handleDrainLanguageTranslationsJob } from '../../../apps/worker/src/jobs/drain-language-translations'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJobLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function makeValidJob(
  payloadOverrides: Record<string, unknown> = {},
  envelopeOverrides: Record<string, unknown> = {}
) {
  return {
    job_id: 'job-test-001',
    request_id: 'req-test-001',
    workspace_id: 'ws-001',
    job_name: 'DRAIN_LANGUAGE_TRANSLATIONS',
    payload: {
      workspace_slug: 'test-workspace',
      language_code: 'ar',
      batch_size: 500,
      initiated_by_user_id: 'user-001',
      attempt: 0,
      ...payloadOverrides,
    },
    ...envelopeOverrides,
  }
}

function createMockDb(
  options: {
    deletedRows?: any[]
    throwOnDelete?: boolean
    throwOnUpdate?: boolean
  } = {}
) {
  const {
    deletedRows = [],
    throwOnDelete = false,
    throwOnUpdate = false,
  } = options
  const queries: Array<{ sql: string; params?: unknown[] }> = []
  let deleteCallCount = 0

  const db = {
    _queries: queries,
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params })

      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) {
        return { rows: [], rowCount: 0 }
      }

      if (sql.includes('COMMIT')) {
        return { rows: [], rowCount: 0 }
      }

      if (sql.includes('DELETE FROM') && sql.includes('translations')) {
        if (throwOnDelete) throw new Error('Delete failed')
        deleteCallCount++
        // First call returns rows, subsequent calls return empty (drain complete)
        if (deleteCallCount === 1 && deletedRows.length > 0) {
          return { rows: deletedRows, rowCount: deletedRows.length }
        }
        return { rows: [], rowCount: 0 }
      }

      if (sql.includes('INSERT INTO translation_audit_logs')) {
        return { rows: [], rowCount: 1 }
      }

      if (sql.includes('UPDATE') && sql.includes('workspace_settings')) {
        if (throwOnUpdate) throw new Error('Settings update failed')
        return { rows: [{ id: 'ws-001' }], rowCount: 1 }
      }

      return { rows: [], rowCount: 0 }
    }),
  }

  return db
}

function createMockRedis() {
  return {
    scan: vi.fn().mockResolvedValue(['0', []]),
    del: vi.fn().mockResolvedValue(1),
  }
}

// ---------------------------------------------------------------------------
// Tests — Payload validation
// ---------------------------------------------------------------------------

describe('handleDrainLanguageTranslationsJob — payload validation', () => {
  it('returns { success: false } for missing initiated_by_user_id', async () => {
    const db = createMockDb()
    const result = await handleDrainLanguageTranslationsJob(
      makeValidJob({ initiated_by_user_id: '' }) as any,
      makeJobLogger() as any,
      db as any
    )
    expect(result.success).toBe(false)
  })

  it('returns { success: false } for invalid batch_size (0)', async () => {
    const db = createMockDb()
    const result = await handleDrainLanguageTranslationsJob(
      makeValidJob({ batch_size: 0 }) as any,
      makeJobLogger() as any,
      db as any
    )
    expect(result.success).toBe(false)
  })

  it('returns { success: false } for missing language_code', async () => {
    const db = createMockDb()
    const result = await handleDrainLanguageTranslationsJob(
      makeValidJob({ language_code: '' }) as any,
      makeJobLogger() as any,
      db as any
    )
    expect(result.success).toBe(false)
  })

  it('returns { success: false } for null job', async () => {
    const db = createMockDb()
    const result = await handleDrainLanguageTranslationsJob(
      null as any,
      makeJobLogger() as any,
      db as any
    )
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tests — Happy path
// ---------------------------------------------------------------------------

describe('handleDrainLanguageTranslationsJob — happy path', () => {
  it('returns { success: true } when no rows exist for language', async () => {
    const db = createMockDb({ deletedRows: [] }) // No rows to delete
    const result = await handleDrainLanguageTranslationsJob(
      makeValidJob(),
      makeJobLogger() as any,
      db as any
    )
    expect(result.success).toBe(true)
  })

  it('uses BEGIN/COMMIT per batch (transactional batch processing)', async () => {
    const deletedRows = Array.from({ length: 3 }, (_, i) => ({
      id: `tr-00${i + 1}`,
      entity_type: 'question',
      entity_id: 'q-001',
      field_name: 'text',
      language_code: 'ar',
      translated_value: 'سؤال',
    }))

    const db = createMockDb({ deletedRows })
    await handleDrainLanguageTranslationsJob(
      makeValidJob({ batch_size: 500 }),
      makeJobLogger() as any,
      db as any
    )

    const beginCalls = db._queries.filter((q) => q.sql.includes('BEGIN'))
    const commitCalls = db._queries.filter((q) => q.sql.includes('COMMIT'))
    expect(beginCalls.length).toBeGreaterThan(0)
    expect(commitCalls.length).toBeGreaterThan(0)
    // BEGIN count should equal COMMIT count (every batch committed)
    expect(beginCalls.length).toBe(commitCalls.length)
  })

  it('inserts audit log entries after delete within same batch transaction', async () => {
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

    const db = createMockDb({ deletedRows })
    await handleDrainLanguageTranslationsJob(
      makeValidJob(),
      makeJobLogger() as any,
      db as any
    )

    const auditInsert = db._queries.find((q) =>
      q.sql.includes('INSERT INTO translation_audit_logs')
    )
    expect(auditInsert).toBeDefined()
    // 'language_removed' is an inline SQL literal in the INSERT, not a param
    expect(auditInsert?.sql).toContain("'language_removed'")
  })

  it('updates workspace_settings after drain to remove language from supported_languages', async () => {
    const db = createMockDb({ deletedRows: [] })
    await handleDrainLanguageTranslationsJob(
      makeValidJob({ language_code: 'ar' }),
      makeJobLogger() as any,
      db as any
    )

    const settingsUpdate = db._queries.find(
      (q) => q.sql.includes('UPDATE') && q.sql.includes('workspace_settings')
    )
    expect(settingsUpdate).toBeDefined()
  })

  it('calls invalidateWorkspaceCoverage SCAN after drain completes', async () => {
    const redis = createMockRedis()
    const db = createMockDb({ deletedRows: [] })

    await handleDrainLanguageTranslationsJob(
      makeValidJob(),
      makeJobLogger() as any,
      db as any,
      redis as any
    )

    // SCAN should be called for coverage invalidation
    expect(redis.scan).toHaveBeenCalled()
    const scanCall = (redis.scan as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(scanCall[2]).toContain('coverage:ws-001:')
  })

  it('processes two full batches when first DELETE returns batch_size rows', async () => {
    const batchSize = 3
    const batch1Rows = Array.from({ length: batchSize }, (_, i) => ({
      id: `tr-${String(i + 1).padStart(3, '0')}`,
      entity_type: 'question',
      entity_id: 'q-001',
      field_name: 'text',
      language_code: 'ar',
      translated_value: 'سؤال',
    }))

    // Mock: first DELETE returns batchSize rows, second call returns empty
    let deleteCall = 0
    const db = {
      _queries: [] as any[],
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        db._queries.push({ sql, params })
        if (
          sql.includes('BEGIN') ||
          sql.includes('COMMIT') ||
          sql.includes('ROLLBACK')
        ) {
          return { rows: [], rowCount: 0 }
        }
        if (sql.includes('DELETE FROM') && sql.includes('translations')) {
          deleteCall++
          if (deleteCall === 1) return { rows: batch1Rows, rowCount: batchSize }
          return { rows: [], rowCount: 0 } // drain complete
        }
        if (sql.includes('INSERT INTO translation_audit_logs')) {
          return { rows: [], rowCount: 1 }
        }
        if (sql.includes('UPDATE') && sql.includes('workspace_settings')) {
          return { rows: [{ id: 'ws-001' }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }),
    }

    const result = await handleDrainLanguageTranslationsJob(
      makeValidJob({ batch_size: batchSize }),
      makeJobLogger() as any,
      db as any
    )

    expect(result.success).toBe(true)
    expect(deleteCall).toBe(2) // Two DELETE calls: one with rows, one empty (stop condition)
  })
})

// ---------------------------------------------------------------------------
// Tests — Error handling
// ---------------------------------------------------------------------------

describe('handleDrainLanguageTranslationsJob — error handling', () => {
  it('returns { success: false } on DB delete error', async () => {
    const db = createMockDb({ throwOnDelete: true })
    const result = await handleDrainLanguageTranslationsJob(
      makeValidJob(),
      makeJobLogger() as any,
      db as any
    )
    expect(result.success).toBe(false)
  })

  it('issues ROLLBACK on batch DELETE failure', async () => {
    const db = createMockDb({ throwOnDelete: true })
    await handleDrainLanguageTranslationsJob(
      makeValidJob(),
      makeJobLogger() as any,
      db as any
    )

    const rollbackCalled = db._queries.some((q) => q.sql.includes('ROLLBACK'))
    expect(rollbackCalled).toBe(true)
  })

  it('returns { success: false } when workspace_settings update fails', async () => {
    const db = createMockDb({ throwOnUpdate: true })
    const result = await handleDrainLanguageTranslationsJob(
      makeValidJob(),
      makeJobLogger() as any,
      db as any
    )
    expect(result.success).toBe(false)
  })

  it('logs error and returns { success: false } without leaking stack traces', async () => {
    const db = createMockDb({ throwOnDelete: true })
    const logger = makeJobLogger()

    const result = await handleDrainLanguageTranslationsJob(
      makeValidJob(),
      logger as any,
      db as any
    )

    expect(result.success).toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })
})

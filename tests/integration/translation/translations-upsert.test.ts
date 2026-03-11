/**
 * Translation Routes — Integration Tests (POST /translations)
 *
 * File: tests/integration/translation/translations-upsert.test.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Tests POST /api/v1/backoffice/workspace/translations through Hono test helpers.
 * Mocks tenant context, DB pool, and Redis client.
 */

import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { translationRouter } from '../../../apps/api/src/routes/backoffice/translations/index'
import type { BackofficeEnv } from '../../../apps/api/src/routes/backoffice/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS_ROW = {
  id: 'ws-001',
  singleton_key: 'SETTINGS',
  config_version: 1,
  language_settings: {
    default_language: 'en',
    supported_languages: ['en', 'ar', 'fr'],
  },
}

function createTestApp(
  options: {
    entityExists?: boolean
    dbError?: boolean
    languageStatus?: Record<string, 'active' | 'removing'>
  } = {}
) {
  const app = new Hono<BackofficeEnv>()

  const { entityExists = true, dbError = false, languageStatus = {} } = options

  app.use('*', async (c, next) => {
    const mockPool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (dbError) throw new Error('DB error')

        if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
          return { rows: [], rowCount: 0 }
        }

        // workspace_settings lookup (for context)
        if (sql.includes('workspace_settings') && sql.includes('SELECT')) {
          return {
            rows: [
              {
                ...DEFAULT_SETTINGS_ROW,
                language_settings: {
                  ...DEFAULT_SETTINGS_ROW.language_settings,
                  language_status: languageStatus,
                },
              },
            ],
            rowCount: 1,
          }
        }

        // Entity existence check
        if (sql.includes('FROM') && sql.includes('WHERE') && !sql.includes('translations')) {
          return entityExists ? { rows: [{ id: 'q-001' }], rowCount: 1 } : { rows: [], rowCount: 0 }
        }

        // Translation upsert (ON CONFLICT)
        if (sql.includes('ON CONFLICT') || sql.includes('translations')) {
          return {
            rows: [
              {
                id: 'tr-001',
                entity_type: 'question',
                entity_id: 'q-001',
                field_name: 'text',
                language_code: 'ar',
                translated_value: 'سؤال',
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
            rowCount: 1,
          }
        }

        return { rows: [], rowCount: 0 }
      }),
    }
    ;(c as any).set('tenant', {
      id: 'ws-001',
      slug: 'test-workspace',
      schema_version: 2,
      pool: mockPool,
      redis: null,
    })
    ;(c as any).set('staff_user', { user_id: 'user-001', role: 'institution_admin' })
    ;(c as any).set('correlationId', 'corr-test-001')

    await next()
  })

  app.route('/api/v1/backoffice/workspace', translationRouter)
  return app
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/backoffice/workspace/translations', () => {
  it('returns 200 with saved translations on valid payload', async () => {
    const app = createTestApp({ entityExists: true })

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question',
        entity_id: 'q-001',
        translations: [{ field_name: 'text', language_code: 'ar', translated_value: 'سؤال' }],
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeDefined()
    expect(body.error).toBeNull()
  })

  it('returns 422 for empty translations array', async () => {
    const app = createTestApp()

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question',
        entity_id: 'q-001',
        translations: [],
      }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).not.toBeNull()
  })

  it('returns 422 for translated_value exceeding 10000 characters', async () => {
    const app = createTestApp()
    const longValue = 'x'.repeat(10_001)

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question',
        entity_id: 'q-001',
        translations: [
          {
            field_name: 'text',
            language_code: 'ar',
            translated_value: longValue,
          },
        ],
      }),
    })

    expect(res.status).toBe(422)
  })

  it('returns 422 when language_code is not in supported_languages', async () => {
    const app = createTestApp({ entityExists: true })

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question',
        entity_id: 'q-001',
        translations: [
          {
            field_name: 'text',
            language_code: 'de',
            translated_value: 'Frage',
          },
        ],
      }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error?.code).toBe('UNSUPPORTED_LANGUAGE')
  })

  it('returns 422 when writing for the default language', async () => {
    const app = createTestApp({ entityExists: true })

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question',
        entity_id: 'q-001',
        translations: [
          {
            field_name: 'text',
            language_code: 'en',
            translated_value: 'Question',
          },
        ],
      }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error?.code).toBe('DEFAULT_LANGUAGE_WRITE')
  })

  it('returns 409 when language is in removing status', async () => {
    const app = createTestApp({
      entityExists: true,
      languageStatus: { ar: 'removing' },
    })

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question',
        entity_id: 'q-001',
        translations: [{ field_name: 'text', language_code: 'ar', translated_value: 'سؤال' }],
      }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error?.code).toBe('UNSUPPORTED_LANGUAGE')
  })

  it('returns 404 when entity does not exist', async () => {
    const app = createTestApp({ entityExists: false })

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question',
        entity_id: 'q-nonexistent',
        translations: [{ field_name: 'text', language_code: 'ar', translated_value: 'سؤال' }],
      }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error?.code).toBe('ENTITY_NOT_FOUND')
  })

  it('returns 422 for unknown entity type', async () => {
    const app = createTestApp()

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'unknown_type',
        entity_id: 'x-001',
        translations: [{ field_name: 'text', language_code: 'ar', translated_value: 'test' }],
      }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error?.code).toBe('UNKNOWN_ENTITY_TYPE')
  })

  it('returns 500 on unexpected DB error with standard error shape', async () => {
    const app = createTestApp({ dbError: true })

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question',
        entity_id: 'q-001',
        translations: [{ field_name: 'text', language_code: 'ar', translated_value: 'سؤال' }],
      }),
    })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).not.toBeNull()
  })

  it('response body does not include translated_value in error messages (SC-SEC)', async () => {
    const app = createTestApp({ entityExists: false })
    const sensitiveValue = 'SENSITIVE_TRANSLATION_CONTENT'

    const res = await app.request('/api/v1/backoffice/workspace/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question',
        entity_id: 'q-001',
        translations: [
          {
            field_name: 'text',
            language_code: 'ar',
            translated_value: sensitiveValue,
          },
        ],
      }),
    })

    const text = await res.text()
    expect(text).not.toContain(sensitiveValue)
  })
})

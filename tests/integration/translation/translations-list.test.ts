/**
 * Translation Routes — Integration Tests (GET /translations)
 *
 * File: tests/integration/translation/translations-list.test.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Tests GET /api/v1/backoffice/workspace/translations, cursor pagination,
 * and required query parameter validation.
 */

import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { translationRouter } from '../../../apps/api/src/routes/backoffice/translations/index'
import type { BackofficeEnv } from '../../../apps/api/src/routes/backoffice/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTranslationRow(id: string) {
  return {
    id,
    entity_type: 'question',
    entity_id: 'q-001',
    field_name: 'text',
    language_code: 'ar',
    translated_value: `Translation ${id}`,
    created_at: new Date(),
    updated_at: new Date(),
  }
}

const DEFAULT_SETTINGS_ROW = {
  id: 'ws-001',
  singleton_key: 'SETTINGS',
  config_version: 1,
  language_settings: {
    default_language: 'en',
    supported_languages: ['en', 'ar'],
  },
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function createTestApp(options: { rows?: any[]; dbError?: boolean } = {}) {
  const app = new Hono<BackofficeEnv>()
  const { rows = [], dbError = false } = options

  app.use('*', async (c, next) => {
    const mockPool = {
      query: vi.fn(async (sql: string) => {
        if (dbError) throw new Error('DB error')

        if (sql.includes('workspace_settings') && sql.includes('SELECT')) {
          return { rows: [DEFAULT_SETTINGS_ROW], rowCount: 1 }
        }

        if (sql.includes('FROM translations') || sql.includes('FROM "translations"')) {
          return { rows, rowCount: rows.length }
        }

        return { rows: [], rowCount: 0 }
      }),
    }

    c.set('tenant', {
      id: 'ws-001',
      slug: 'test-workspace',
      schema_version: 2,
      pool: mockPool,
      redis: null,
    })
    c.set('staff_user', { user_id: 'user-001', role: 'institution_admin' })
    c.set('correlationId', 'corr-001')
    await next()
  })

  app.route('/api/v1/backoffice/workspace', translationRouter)
  return app
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/backoffice/workspace/translations', () => {
  it('returns 200 with empty items when no translations exist', async () => {
    const app = createTestApp({ rows: [] })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations?entity_type=question&entity_id=q-001',
      { method: 'GET' }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.items).toEqual([])
    expect(body.data.next_cursor).toBeNull()
    expect(body.error).toBeNull()
  })

  it('returns paginated items with next_cursor when more exist', async () => {
    // 21 rows returned → page_size=20 → next_cursor set to id of row 20
    const rows = Array.from({ length: 21 }, (_, i) =>
      makeTranslationRow(`tr-${String(i + 1).padStart(3, '0')}`)
    )

    const app = createTestApp({ rows })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations?entity_type=question&entity_id=q-001&page_size=20',
      { method: 'GET' }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.items).toHaveLength(20)
    expect(body.data.next_cursor).toBe('tr-020')
  })

  it('returns null next_cursor on last page', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeTranslationRow(`tr-00${i + 1}`))
    const app = createTestApp({ rows })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations?entity_type=question&entity_id=q-001',
      { method: 'GET' }
    )

    const body = await res.json()
    expect(body.data.next_cursor).toBeNull()
  })

  it('accepts optional language_code filter', async () => {
    const app = createTestApp({ rows: [makeTranslationRow('tr-001')] })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations?entity_type=question&entity_id=q-001&language_code=ar',
      { method: 'GET' }
    )
    expect(res.status).toBe(200)
  })

  it('accepts cursor parameter for keyset pagination', async () => {
    const rows = [makeTranslationRow('tr-011'), makeTranslationRow('tr-012')]
    const app = createTestApp({ rows })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations?entity_type=question&entity_id=q-001&cursor=tr-010',
      { method: 'GET' }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.items).toHaveLength(2)
  })

  it('returns 422 when entity_type is missing', async () => {
    const app = createTestApp()
    const res = await app.request('/api/v1/backoffice/workspace/translations?entity_id=q-001', {
      method: 'GET',
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).not.toBeNull()
  })

  it('returns 422 when entity_id is missing', async () => {
    const app = createTestApp()
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations?entity_type=question',
      { method: 'GET' }
    )
    expect(res.status).toBe(422)
  })

  it('response shape has success, data, error fields', async () => {
    const app = createTestApp({ rows: [] })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations?entity_type=question&entity_id=q-001',
      { method: 'GET' }
    )
    const body = await res.json()
    expect(body).toHaveProperty('success')
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('error')
  })

  it('returns 500 on DB error with standard error shape', async () => {
    const app = createTestApp({ dbError: true })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations?entity_type=question&entity_id=q-001',
      { method: 'GET' }
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).not.toBeNull()
  })
})

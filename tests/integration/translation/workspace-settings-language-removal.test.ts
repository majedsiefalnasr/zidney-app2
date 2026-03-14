/**
 * Workspace Settings — Language Removal Integration Tests
 *
 * File: tests/integration/translation/workspace-settings-language-removal.test.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Tests PUT /api/v1/backoffice/workspace/settings/language for language removal behaviour:
 *   - Sync path  (≤10,000 rows): 200 response, translations deleted inline
 *   - Async path (>10,000 rows): 409 LANGUAGE_REMOVAL_REQUIRES_ASYNC, DRAIN job enqueued
 */

import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { workspaceSettingsRouter } from '../../../apps/api/src/modules/workspace-settings/workspace-settings.routes'
import type { BackofficeEnv } from '../../../apps/api/src/routes/backoffice/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYNC_THRESHOLD = 10_000

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SETTINGS_ROW_WITH_TWO_LANGUAGES = {
  id: 'ws-001',
  singleton_key: 'SETTINGS',
  config_version: 2,
  general_settings: {
    app_name: 'Test University',
    timezone: 'UTC',
    date_format: 'DD/MM/YYYY',
  },
  language_settings: {
    default_language: 'en',
    supported_languages: ['en', 'ar', 'fr'],
  },
  branding_settings: {},
  payment_settings: { use_custom_payment_gateway: false },
  security_settings: {},
  created_at: new Date('2026-03-01T00:00:00.000Z'),
  updated_at: new Date('2026-03-01T00:00:00.000Z'),
}

// Body that removes 'ar' from supported_languages
const REMOVE_ARABIC_BODY = {
  default_language: 'en',
  supported_languages: ['en', 'fr'], // 'ar' is removed
}

const REMOVE_ARABIC_REQUEST = {
  config_version: 2,
  settings: REMOVE_ARABIC_BODY,
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function createTestApp(
  options: {
    translationCount?: number // Number of translations for the removed language
    redisLPushSpy?: ReturnType<typeof vi.fn>
    dbError?: boolean
  } = {}
) {
  const {
    translationCount = 0,
    redisLPushSpy = vi.fn().mockResolvedValue(1),
    dbError = false,
  } = options
  const _isAboveThreshold = translationCount > SYNC_THRESHOLD

  const app = new Hono<BackofficeEnv>()

  app.use('*', async (c, next) => {
    const mockRedis = {
      lpush: redisLPushSpy,
      scan: vi.fn().mockResolvedValue(['0', []]),
      del: vi.fn().mockResolvedValue(1),
    }

    const mockPool = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (dbError) throw new Error('DB error')

        if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
          return { rows: [], rowCount: 0 }
        }

        if (sql.includes('workspace_settings_audit')) {
          return { rows: [], rowCount: 1 }
        }

        // SELECT workspace_settings → current settings (two reads may happen)
        if (sql.includes('SELECT') && sql.includes('workspace_settings')) {
          return { rows: [SETTINGS_ROW_WITH_TWO_LANGUAGES], rowCount: 1 }
        }

        // COUNT translations for removed language
        if (sql.includes('COUNT') && sql.includes('translations')) {
          return { rows: [{ count: String(translationCount) }], rowCount: 1 }
        }

        // Sync DELETE translations
        if (sql.includes('DELETE FROM') && sql.includes('translations')) {
          return { rows: [], rowCount: translationCount }
        }

        // INSERT translation_audit_logs
        if (sql.includes('INSERT INTO translation_audit_logs')) {
          return { rows: [], rowCount: translationCount }
        }

        // UPDATE workspace_settings (settings upsert)
        if (sql.includes('UPDATE') && sql.includes('workspace_settings')) {
          return {
            rows: [{ config_version: 3 }],
            rowCount: 1,
          }
        }

        // JSONB update for language_status (async path)
        if (sql.includes('jsonb_set') || sql.includes('language_status')) {
          return { rows: [], rowCount: 1 }
        }

        return { rows: [], rowCount: 0 }
      }),
    }
    ;(c as any).set('tenant', {
      id: 'ws-001',
      slug: 'test-workspace',
      schema_version: 2,
      pool: mockPool,
      redis: mockRedis,
    })
    ;(c as any).set('staff_user', { user_id: 'user-001', role: 'institution_admin' })
    ;(c as any).set('correlationId', 'corr-test-001')
    await next()
  })

  app.route('/api/v1/backoffice/workspace', workspaceSettingsRouter)
  return app
}

// ---------------------------------------------------------------------------
// Tests — Sync path (≤10k rows)
// ---------------------------------------------------------------------------

describe('PUT /api/v1/backoffice/workspace/settings/language — sync language removal (≤10k rows)', () => {
  it('returns 200 when removed language has fewer than 10k translations', async () => {
    const app = createTestApp({ translationCount: 100 })
    const res = await app.request('/api/v1/backoffice/workspace/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REMOVE_ARABIC_REQUEST),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.error).toBeNull()
  })

  it('returns 200 when removed language has exactly 10k translations (boundary)', async () => {
    const app = createTestApp({ translationCount: SYNC_THRESHOLD })
    const res = await app.request('/api/v1/backoffice/workspace/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REMOVE_ARABIC_REQUEST),
    })

    expect(res.status).toBe(200)
  })

  it('does not enqueue a Redis DRAIN job on sync path', async () => {
    const redisSpy = vi.fn().mockResolvedValue(1)
    const app = createTestApp({
      translationCount: 100,
      redisLPushSpy: redisSpy,
    })

    await app.request('/api/v1/backoffice/workspace/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REMOVE_ARABIC_REQUEST),
    })

    const drainJobEnqueued = redisSpy.mock.calls.some(
      ([key]: [string]) => key === 'queue:DRAIN_LANGUAGE_TRANSLATIONS'
    )
    expect(drainJobEnqueued).toBe(false)
  })

  it('returns 200 when no translations exist for removed language', async () => {
    const app = createTestApp({ translationCount: 0 })
    const res = await app.request('/api/v1/backoffice/workspace/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REMOVE_ARABIC_REQUEST),
    })

    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Tests — Async path (>10k rows)
// ---------------------------------------------------------------------------

describe('PUT /api/v1/backoffice/workspace/settings/language — async language removal (>10k rows)', () => {
  it('returns 409 LANGUAGE_REMOVAL_REQUIRES_ASYNC when count exceeds threshold', async () => {
    const app = createTestApp({ translationCount: SYNC_THRESHOLD + 1 })
    const res = await app.request('/api/v1/backoffice/workspace/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REMOVE_ARABIC_REQUEST),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error?.code).toBe('LANGUAGE_REMOVAL_REQUIRES_ASYNC')
    expect(body.error?.message).toContain('ar')
  })

  it('enqueues DRAIN job to Redis on async path', async () => {
    const redisSpy = vi.fn().mockResolvedValue(1)
    const app = createTestApp({
      translationCount: SYNC_THRESHOLD + 5000,
      redisLPushSpy: redisSpy,
    })

    await app.request('/api/v1/backoffice/workspace/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REMOVE_ARABIC_REQUEST),
    })

    const drainJobEnqueued = redisSpy.mock.calls.some(
      ([key]: [string]) => key === 'queue:DRAIN_LANGUAGE_TRANSLATIONS'
    )
    expect(drainJobEnqueued).toBe(true)
  })

  it('409 response error lists the removed language code', async () => {
    const app = createTestApp({ translationCount: SYNC_THRESHOLD + 1 })
    const res = await app.request('/api/v1/backoffice/workspace/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REMOVE_ARABIC_REQUEST),
    })

    const body = await res.json()
    expect(body.error?.message).toContain('ar')
  })
})

// ---------------------------------------------------------------------------
// Tests — No-change path
// ---------------------------------------------------------------------------

describe('PUT /api/v1/backoffice/workspace/settings/language — no language removed', () => {
  it('returns 200 without counting translations when no languages removed', async () => {
    const app = createTestApp({ translationCount: 0 })
    const res = await app.request('/api/v1/backoffice/workspace/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config_version: 2,
        settings: {
          default_language: 'en',
          supported_languages: ['en', 'ar', 'fr'],
        },
      }),
    })

    expect(res.status).toBe(200)
  })
})

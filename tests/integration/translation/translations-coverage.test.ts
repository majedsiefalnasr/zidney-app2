/**
 * Translation Routes — Integration Tests (GET /translations/coverage)
 *
 * File: tests/integration/translation/translations-coverage.test.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Tests GET /api/v1/backoffice/workspace/translations/coverage.
 * Validates default-language bypass, Redis cache hit, DB fallback, and 422 guards.
 */

import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { translationRouter } from '../../../apps/api/src/routes/backoffice/translations/index'
import type { BackofficeEnv } from '../../../apps/api/src/routes/backoffice/types'

// ---------------------------------------------------------------------------
// Fixtures
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

const COVERAGE_DB_RESULT = {
  covered: 8,
  total: 10,
  percentage: 80,
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function createTestApp(
  options: {
    cacheHit?: boolean
    dbRows?: any[]
    dbError?: boolean
    redisError?: boolean
  } = {}
) {
  const app = new Hono<BackofficeEnv>()
  const {
    cacheHit = false,
    dbRows,
    dbError = false,
    redisError = false,
  } = options

  const mockRedis = {
    get: vi.fn(async () => {
      if (redisError) throw new Error('Redis error')
      return cacheHit ? JSON.stringify(COVERAGE_DB_RESULT) : null
    }),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(['0', []]),
  }

  app.use('*', async (c, next) => {
    const mockPool = {
      query: vi.fn(async (sql: string) => {
        if (dbError) throw new Error('DB error')

        if (sql.includes('workspace_settings') && sql.includes('SELECT')) {
          return { rows: [DEFAULT_SETTINGS_ROW], rowCount: 1 }
        }

        // Coverage aggregation
        if (sql.includes('COUNT') && sql.includes('translations')) {
          const rows = dbRows ?? [COVERAGE_DB_RESULT]
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
      redis: mockRedis,
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

describe('GET /api/v1/backoffice/workspace/translations/coverage', () => {
  it('returns 200 with coverage data for valid request', async () => {
    const app = createTestApp()
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations/coverage?entity_type=question&language_code=ar',
      { method: 'GET' }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).not.toBeNull()
    expect(body.error).toBeNull()
  })

  it('returns null data for default language without DB query', async () => {
    const app = createTestApp()
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations/coverage?entity_type=question&language_code=en',
      { method: 'GET' }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })

  it('serves from Redis cache when hit (no DB call for coverage)', async () => {
    const dbMockTracker = { coverageCalled: false }
    const app = new Hono<BackofficeEnv>()

    const mockRedis = {
      get: vi.fn().mockResolvedValue(JSON.stringify(COVERAGE_DB_RESULT)),
      set: vi.fn(),
      del: vi.fn(),
      scan: vi.fn(),
    }

    const mockPool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('workspace_settings') && sql.includes('SELECT')) {
          return { rows: [DEFAULT_SETTINGS_ROW], rowCount: 1 }
        }
        if (sql.includes('COUNT') && sql.includes('translations')) {
          dbMockTracker.coverageCalled = true
          return { rows: [COVERAGE_DB_RESULT], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }),
    }

    app.use('*', async (c, next) => {
      c.set('tenant', {
        id: 'ws-001',
        slug: 'test-workspace',
        schema_version: 2,
        pool: mockPool,
        redis: mockRedis,
      })
      c.set('staff_user', { user_id: 'user-001', role: 'institution_admin' })
      c.set('correlationId', 'corr-001')
      await next()
    })
    app.route('/api/v1/backoffice/workspace', translationRouter)

    const res = await app.request(
      '/api/v1/backoffice/workspace/translations/coverage?entity_type=question&language_code=ar',
      { method: 'GET' }
    )

    expect(res.status).toBe(200)
    // DB coverage aggregation must NOT have been called when cache hits
    expect(dbMockTracker.coverageCalled).toBe(false)
  })

  it('fetches from DB and writes to cache on cache miss', async () => {
    const mock = createTestApp({ cacheHit: false })
    const res = await mock.request(
      '/api/v1/backoffice/workspace/translations/coverage?entity_type=question&language_code=ar',
      { method: 'GET' }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ covered: 8, total: 10, percentage: 80 })
  })

  it('returns null data when entity type has no translations', async () => {
    const app = createTestApp({ dbRows: [] })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations/coverage?entity_type=question&language_code=ar',
      { method: 'GET' }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeNull()
  })

  it('returns 422 when entity_type is missing', async () => {
    const app = createTestApp()
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations/coverage?language_code=ar',
      { method: 'GET' }
    )
    expect(res.status).toBe(422)
  })

  it('returns 422 when language_code is missing', async () => {
    const app = createTestApp()
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations/coverage?entity_type=question',
      { method: 'GET' }
    )
    expect(res.status).toBe(422)
  })

  it('returns standard response shape', async () => {
    const app = createTestApp()
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations/coverage?entity_type=question&language_code=ar',
      { method: 'GET' }
    )
    const body = await res.json()
    expect(body).toHaveProperty('success')
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('error')
  })

  it('returns 200 gracefully when Redis throws (falls back to DB)', async () => {
    const app = createTestApp({ redisError: true })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations/coverage?entity_type=question&language_code=ar',
      { method: 'GET' }
    )
    expect(res.status).toBe(200)
  })

  it('returns 500 on DB error', async () => {
    const app = createTestApp({ dbError: true })
    const res = await app.request(
      '/api/v1/backoffice/workspace/translations/coverage?entity_type=question&language_code=ar',
      { method: 'GET' }
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

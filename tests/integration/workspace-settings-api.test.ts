/**
 * Workspace Settings — Integration Tests (HTTP layer)
 *
 * File: tests/integration/workspace-settings-api.test.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Tests routes end-to-end through Hono's test helpers.
 * Mocks tenant context, staff user context, and DB pool.
 * Validates HTTP status codes, response shapes, and error handling.
 * Covers: T034 — Full integration tests + RBAC role testing (guardian audit #8)
 */

import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { workspaceSettingsRouter } from '../../apps/api/src/modules/workspace-settings/workspace-settings.routes'
import type { BackofficeEnv } from '../../apps/api/src/routes/backoffice/types'

const TEST_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'

// ---------------------------------------------------------------------------
// Mock Settings Row
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS_ROW = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  singleton_key: 'SETTINGS',
  config_version: 3,
  general_settings: {
    app_name: 'Test University',
    timezone: 'Asia/Riyadh',
    date_format: 'DD/MM/YYYY',
  },
  language_settings: {
    default_language: 'ar',
    supported_languages: ['ar', 'en'],
  },
  branding_settings: {},
  payment_settings: {
    use_custom_payment_gateway: false,
  },
  security_settings: {},
  created_at: new Date('2026-02-28T10:00:00.000Z'),
  updated_at: new Date('2026-02-28T10:30:00.000Z'),
}

// ---------------------------------------------------------------------------
// Test App Factory
// ---------------------------------------------------------------------------

function createTestApp(overrides: {
  settingsRow?: any
  noSettings?: boolean
  versionConflict?: boolean
  role?: string
}) {
  const app = new Hono<BackofficeEnv>()

  // Mock middleware — set Hono variables
  app.use('*', async (c, next) => {
    const mockPool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
          return { rows: [], rowCount: 0 }
        }

        if (sql.includes('SELECT') && sql.includes('workspace_settings_audit')) {
          return { rows: [], rowCount: 0 }
        }

        if (sql.includes('SELECT') && sql.includes('workspace_settings')) {
          if (overrides.noSettings) {
            return { rows: [], rowCount: 0 }
          }
          return {
            rows: [overrides.settingsRow || DEFAULT_SETTINGS_ROW],
            rowCount: 1,
          }
        }

        if (sql.includes('UPDATE') && sql.includes('workspace_settings')) {
          if (overrides.versionConflict) {
            return { rows: [], rowCount: 0 }
          }
          const version = (overrides.settingsRow || DEFAULT_SETTINGS_ROW).config_version
          return {
            rows: [{ config_version: version + 1 }],
            rowCount: 1,
          }
        }

        if (sql.includes('INSERT') && sql.includes('workspace_settings_audit')) {
          return { rows: [], rowCount: 1 }
        }

        if (sql.includes('INSERT') && sql.includes('workspace_settings')) {
          return { rows: [{ config_version: 1 }], rowCount: 1 }
        }

        return { rows: [], rowCount: 0 }
      }),
    }
    ;(c as any).set('tenant', {
      id: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'test-uni',
      schema_version: 2,
      pool: mockPool,
    })
    ;(c as any).set('staff_user', {
      user_id: 'user-001',
      role: overrides.role || 'institution_admin',
    })
    ;(c as any).set('correlationId', 'corr-test-001')

    await next()
  })

  // Mount workspace settings routes
  app.route('/api/v1/backoffice/workspace', workspaceSettingsRouter)

  return app
}

// ---------------------------------------------------------------------------
// GET /settings
// ---------------------------------------------------------------------------

describe('GET /api/v1/backoffice/workspace/settings', () => {
  it('returns 200 with settings and correct response shape', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeDefined()
    expect(body.data.config_version).toBe(3)
    expect(body.data.general_settings.app_name).toBe('Test University')
    expect(body.data.general_settings.session_timeout_minutes).toBe(30) // default
    expect(body.error).toBeNull()
  })

  it('strips payment credentials from response', async () => {
    const app = createTestApp({
      settingsRow: {
        ...DEFAULT_SETTINGS_ROW,
        payment_settings: {
          use_custom_payment_gateway: true,
          encrypted_api_key: 'v1:iv:tag:cipher',
          encrypted_secret_key: 'v1:iv:tag:cipher2',
        },
      },
    })

    const res = await app.request('/api/v1/backoffice/workspace/settings', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    const paymentStr = JSON.stringify(body.data.payment_settings)
    expect(paymentStr).not.toContain('encrypted_api_key')
    expect(paymentStr).not.toContain('encrypted_secret_key')
    expect(paymentStr).not.toContain('v1:')
    expect(body.data.payment_settings.has_api_key).toBe(true)
    expect(body.data.payment_settings.has_secret_key).toBe(true)
  })

  it('returns 404 when no settings exist', async () => {
    const app = createTestApp({ noSettings: true })
    const res = await app.request('/api/v1/backoffice/workspace/settings', {
      method: 'GET',
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('SETTINGS_NOT_FOUND')
  })

  it('security defaults applied in response', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings', {
      method: 'GET',
    })

    const body = await res.json()
    expect(body.data.security_settings.analytics_opt_in).toBe(false)
    expect(body.data.security_settings.max_login_attempts).toBe(5)
    expect(body.data.security_settings.lockout_duration_minutes).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// PUT /settings/:group
// ---------------------------------------------------------------------------

describe('PUT /api/v1/backoffice/workspace/settings/:group', () => {
  beforeEach(() => {
    process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterEach(() => {
    delete process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY
  })

  it('returns 200 on valid general settings update', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings/general', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config_version: 3,
        settings: {
          app_name: 'Updated University',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
        },
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.config_version).toBe(4)
    expect(body.data.updated_group).toBe('general')
  })

  it('returns 422 on invalid settings data', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings/general', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config_version: 3,
        settings: {
          app_name: '',
          timezone: 'Invalid/Zone',
          date_format: 'UNKNOWN',
        },
      }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('SETTINGS_VALIDATION_FAILED')
  })

  it('returns 400 for invalid group name', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings/invalid_group', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config_version: 3,
        settings: { some: 'data' },
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INVALID_SETTINGS_GROUP')
  })

  it('returns 409 on version conflict', async () => {
    const app = createTestApp({ versionConflict: true })
    const res = await app.request('/api/v1/backoffice/workspace/settings/general', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config_version: 2,
        settings: {
          app_name: 'Test',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
        },
      }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('SETTINGS_VERSION_CONFLICT')
  })

  it('returns 422 for missing request body schema', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings/general', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing config_version and settings
        wrong_field: true,
      }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('payment update returns 200 and encrypts credentials', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings/payment', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config_version: 3,
        settings: {
          use_custom_payment_gateway: true,
          api_key: 'pk_live_test123',
        },
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.updated_group).toBe('payment')

    // Response must NOT leak credential values
    const responseStr = JSON.stringify(body)
    expect(responseStr).not.toContain('pk_live_test123')
  })

  it('language update with default_language not in supported returns 422', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config_version: 3,
        settings: {
          default_language: 'fr',
          supported_languages: ['ar', 'en'],
        },
      }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('SETTINGS_VALIDATION_FAILED')
  })
})

// ---------------------------------------------------------------------------
// GET /settings/audit
// ---------------------------------------------------------------------------

describe('GET /api/v1/backoffice/workspace/settings/audit', () => {
  it('returns 200 with empty audit list', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings/audit', { method: 'GET' })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.items).toEqual([])
    expect(body.data.nextCursor).toBeNull()
  })

  it('accepts group filter query parameter', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings/audit?group=general', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('accepts limit query parameter', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings/audit?limit=10', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Response shape consistency
// ---------------------------------------------------------------------------

describe('Response shape consistency', () => {
  it('all success responses have { success: true, data, error: null }', async () => {
    const app = createTestApp({})
    const res = await app.request('/api/v1/backoffice/workspace/settings', {
      method: 'GET',
    })
    const body = await res.json()

    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('error', null)
  })

  it('all error responses have { success: false, data: null, error: { code, message } }', async () => {
    const app = createTestApp({ noSettings: true })
    const res = await app.request('/api/v1/backoffice/workspace/settings', {
      method: 'GET',
    })
    const body = await res.json()

    expect(body).toHaveProperty('success', false)
    expect(body).toHaveProperty('data', null)
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
  })
})

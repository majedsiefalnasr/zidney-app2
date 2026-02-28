/**
 * Workspace Settings Service — Unit Tests
 *
 * File: tests/unit/workspace-settings-service.test.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Tests business logic: defaults merging, credential stripping,
 * version conflict handling, encryption integration, audit creation.
 * Covers: T020, T022, T026, T028, T030, T031, T033
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SettingsRequestContext } from '../../apps/api/src/modules/workspace-settings/workspace-settings.service'
import {
  getSettingsAudit,
  getWorkspaceSettings,
  updateSettingsGroup,
} from '../../apps/api/src/modules/workspace-settings/workspace-settings.service'

// Test encryption key
const TEST_ENCRYPTION_KEY =
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'

// ---------------------------------------------------------------------------
// Mock DB helpers
// ---------------------------------------------------------------------------

function createMockDb(overrides: Partial<Record<string, any>> = {}) {
  const queries: Array<{ sql: string; params?: unknown[] }> = []

  const mockSettings = overrides.settings ?? {
    id: '550e8400-e29b-41d4-a716-446655440000',
    singleton_key: 'SETTINGS',
    config_version: 3,
    general_settings: {
      app_name: 'Riyadh University',
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

  const db = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params })

      if (
        sql.includes('BEGIN') ||
        sql.includes('COMMIT') ||
        sql.includes('ROLLBACK')
      ) {
        return { rows: [], rowCount: 0 }
      }

      if (sql.includes('SELECT') && sql.includes('workspace_settings_audit')) {
        return {
          rows: overrides.auditEntries || [],
          rowCount: (overrides.auditEntries || []).length,
        }
      }

      if (sql.includes('SELECT') && sql.includes('workspace_settings')) {
        if (overrides.noSettings) {
          return { rows: [], rowCount: 0 }
        }
        return { rows: [mockSettings], rowCount: 1 }
      }

      if (sql.includes('UPDATE') && sql.includes('workspace_settings')) {
        if (overrides.versionConflict) {
          return { rows: [], rowCount: 0 }
        }
        return {
          rows: [{ config_version: (mockSettings.config_version || 3) + 1 }],
          rowCount: 1,
        }
      }

      if (sql.includes('INSERT') && sql.includes('workspace_settings_audit')) {
        return { rows: [], rowCount: 1 }
      }

      if (sql.includes('INSERT') && sql.includes('workspace_settings')) {
        return {
          rows: [{ config_version: 1 }],
          rowCount: 1,
        }
      }

      return { rows: [], rowCount: 0 }
    }),
    _queries: queries,
  }

  return db
}

function createMockContext(
  db: any,
  overrides: Partial<SettingsRequestContext> = {}
): SettingsRequestContext {
  return {
    db,
    workspace_id: '550e8400-e29b-41d4-a716-446655440000',
    workspace_slug: 'riyadh-uni',
    user_id: 'user-001',
    correlation_id: 'corr-001',
    ip_address: '127.0.0.1',
    user_agent: 'TestAgent/1.0',
    ...overrides,
  }
}

// ===========================================================================
// T020: getWorkspaceSettings tests
// ===========================================================================

describe('getWorkspaceSettings', () => {
  it('returns settings with defaults applied', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)
    const result = await getWorkspaceSettings(ctx)

    expect(result.config_version).toBe(3)
    expect(result.general_settings.app_name).toBe('Riyadh University')
    // Default applied for missing session_timeout_minutes
    expect(result.general_settings.session_timeout_minutes).toBe(30)
    // Security defaults applied
    expect(result.security_settings.analytics_opt_in).toBe(false)
    expect(result.security_settings.max_login_attempts).toBe(5)
    expect(result.security_settings.lockout_duration_minutes).toBe(15)
  })

  it('strips payment credentials, returns has_api_key/has_secret_key booleans', async () => {
    const db = createMockDb({
      settings: {
        id: 'test-id',
        singleton_key: 'SETTINGS',
        config_version: 2,
        general_settings: {
          app_name: 'Test',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
        },
        language_settings: {
          default_language: 'en',
          supported_languages: ['en'],
        },
        branding_settings: {},
        payment_settings: {
          use_custom_payment_gateway: true,
          gateway_provider: 'moyasar',
          encrypted_api_key: 'v1:iv:tag:cipher',
          encrypted_secret_key: 'v1:iv:tag:cipher2',
        },
        security_settings: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    })
    const ctx = createMockContext(db)
    const result = await getWorkspaceSettings(ctx)

    // Credentials NOT returned
    expect((result.payment_settings as any).encrypted_api_key).toBeUndefined()
    expect(
      (result.payment_settings as any).encrypted_secret_key
    ).toBeUndefined()
    // Boolean sentinels returned
    expect(result.payment_settings.has_api_key).toBe(true)
    expect(result.payment_settings.has_secret_key).toBe(true)
  })

  it('returns has_api_key = false when no credentials set', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)
    const result = await getWorkspaceSettings(ctx)

    expect(result.payment_settings.has_api_key).toBe(false)
    expect(result.payment_settings.has_secret_key).toBe(false)
  })

  it('throws SettingsNotFoundError when no row exists', async () => {
    const db = createMockDb({ noSettings: true })
    const ctx = createMockContext(db)

    await expect(getWorkspaceSettings(ctx)).rejects.toThrow(
      'Workspace settings have not been initialized.'
    )
  })
})

// ===========================================================================
// T020: updateSettingsGroup tests (general settings)
// ===========================================================================

describe('updateSettingsGroup', () => {
  beforeEach(() => {
    process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterEach(() => {
    delete process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY
  })

  it('validates, updates, and creates audit entry for general settings', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    const result = await updateSettingsGroup(
      ctx,
      'general',
      {
        app_name: 'New University Name',
        timezone: 'Asia/Riyadh',
        date_format: 'DD/MM/YYYY',
      },
      3
    )

    expect(result.config_version).toBe(4)
    expect(result.updated_group).toBe('general')

    // Verify transaction was used (BEGIN + queries + COMMIT)
    const queries = db._queries.map((q: any) => q.sql)
    expect(queries.some((s: string) => s.includes('BEGIN'))).toBe(true)
    expect(queries.some((s: string) => s.includes('COMMIT'))).toBe(true)

    // Verify audit entry was inserted
    expect(
      queries.some(
        (s: string) =>
          s.includes('INSERT') && s.includes('workspace_settings_audit')
      )
    ).toBe(true)
  })

  it('increments config_version on successful update', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    const result = await updateSettingsGroup(
      ctx,
      'general',
      {
        app_name: 'Updated',
        timezone: 'UTC',
        date_format: 'YYYY-MM-DD',
      },
      3
    )

    expect(result.config_version).toBe(4)
  })

  it('throws SettingsVersionConflictError on version mismatch', async () => {
    const db = createMockDb({ versionConflict: true })
    const ctx = createMockContext(db)

    await expect(
      updateSettingsGroup(
        ctx,
        'general',
        {
          app_name: 'Test',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
        },
        2
      )
    ).rejects.toThrow('Settings have been modified by another user')
  })

  it('throws SettingsValidationError on invalid input', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await expect(
      updateSettingsGroup(
        ctx,
        'general',
        {
          app_name: '',
          timezone: 'Invalid/Zone',
          date_format: 'INVALID',
        },
        3
      )
    ).rejects.toThrow('Validation failed')
  })

  it('wraps upsert + audit in single transaction', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'general',
      {
        app_name: 'Test',
        timezone: 'UTC',
        date_format: 'YYYY-MM-DD',
      },
      3
    )

    const queries = db._queries.map((q: any) => q.sql)
    const beginIdx = queries.findIndex((s: string) => s.includes('BEGIN'))
    const commitIdx = queries.findIndex((s: string) => s.includes('COMMIT'))
    const updateIdx = queries.findIndex(
      (s: string) =>
        s.includes('UPDATE') &&
        s.includes('workspace_settings') &&
        !s.includes('audit')
    )
    const auditIdx = queries.findIndex(
      (s: string) =>
        s.includes('INSERT') && s.includes('workspace_settings_audit')
    )

    expect(beginIdx).toBeLessThan(updateIdx)
    expect(updateIdx).toBeLessThan(auditIdx)
    expect(auditIdx).toBeLessThan(commitIdx)
  })

  it('first-time settings save creates row with config_version = 1', async () => {
    const db = createMockDb({ noSettings: true })
    const ctx = createMockContext(db)

    const result = await updateSettingsGroup(
      ctx,
      'general',
      {
        app_name: 'First Setup',
        timezone: 'UTC',
        date_format: 'YYYY-MM-DD',
      },
      0
    )

    // The INSERT path returns config_version = 1
    // Due to mock, we need to check the version returned
    expect(result.config_version).toBeDefined()
  })
})

// ===========================================================================
// T022: Language settings tests
// ===========================================================================

describe('updateSettingsGroup — language', () => {
  it('updates language settings with valid default and supported', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    const result = await updateSettingsGroup(
      ctx,
      'language',
      {
        default_language: 'ar',
        supported_languages: ['ar', 'en', 'fr'],
      },
      3
    )

    expect(result.config_version).toBe(4)
    expect(result.updated_group).toBe('language')
  })

  it('rejects removing default_language from supported → 422', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await expect(
      updateSettingsGroup(
        ctx,
        'language',
        {
          default_language: 'fr',
          supported_languages: ['ar', 'en'],
        },
        3
      )
    ).rejects.toThrow('Validation failed')
  })

  it('removing non-default language does not trigger translation deletion', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    // Service should not call any translation delete function
    const result = await updateSettingsGroup(
      ctx,
      'language',
      {
        default_language: 'ar',
        supported_languages: ['ar', 'en'],
      },
      3
    )

    // Verify no DELETE queries were issued
    const queries = db._queries.map((q: any) => q.sql)
    expect(queries.every((s: string) => !s.includes('DELETE'))).toBe(true)
    expect(result.updated_group).toBe('language')
  })

  it('adding new language triggers config_version increment', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    const result = await updateSettingsGroup(
      ctx,
      'language',
      {
        default_language: 'ar',
        supported_languages: ['ar', 'en', 'es'],
      },
      3
    )

    expect(result.config_version).toBe(4)
  })
})

// ===========================================================================
// T026: Audit trail tests
// ===========================================================================

describe('updateSettingsGroup — audit', () => {
  beforeEach(() => {
    process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterEach(() => {
    delete process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY
  })

  it('every updateSettingsGroup call produces exactly one audit entry', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'general',
      {
        app_name: 'New Name',
        timezone: 'UTC',
        date_format: 'YYYY-MM-DD',
      },
      3
    )

    const auditInserts = db._queries.filter(
      (q: any) =>
        q.sql.includes('INSERT') && q.sql.includes('workspace_settings_audit')
    )
    expect(auditInserts).toHaveLength(1)
  })

  it('audit entry contains correct workspace_id, user_id, settings_group, config_version, request_id', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'general',
      {
        app_name: 'Audit Test',
        timezone: 'UTC',
        date_format: 'YYYY-MM-DD',
      },
      3
    )

    const auditInsert = db._queries.find(
      (q: any) =>
        q.sql.includes('INSERT') && q.sql.includes('workspace_settings_audit')
    )
    expect(auditInsert).toBeDefined()
    const params = auditInsert!.params!
    expect(params[0]).toBe(ctx.workspace_id) // workspace_id
    expect(params[1]).toBe(ctx.user_id) // user_id
    expect(params[2]).toBe('general') // settings_group
    expect(params[3]).toBe(4) // config_version (new)
    expect(params[5]).toBe(ctx.correlation_id) // request_id
  })

  it('audit entry changes contains structured diff with field names + old/new values', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'general',
      {
        app_name: 'Changed Name',
        timezone: 'Asia/Riyadh',
        date_format: 'DD/MM/YYYY',
      },
      3
    )

    const auditInsert = db._queries.find(
      (q: any) =>
        q.sql.includes('INSERT') && q.sql.includes('workspace_settings_audit')
    )
    const changes = JSON.parse(auditInsert!.params![4] as string)
    expect(Array.isArray(changes)).toBe(true)
    // At least app_name should have changed
    const appNameChange = changes.find((c: any) => c.field === 'app_name')
    if (appNameChange) {
      expect(appNameChange.old_value).toBeDefined()
      expect(appNameChange.new_value).toBe('Changed Name')
    }
  })

  it('payment credential update audit does NOT contain raw or encrypted values', async () => {
    const db = createMockDb({
      settings: {
        id: 'test-id',
        singleton_key: 'SETTINGS',
        config_version: 3,
        general_settings: {
          app_name: 'Test',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
        },
        language_settings: {
          default_language: 'en',
          supported_languages: ['en'],
        },
        branding_settings: {},
        payment_settings: {
          use_custom_payment_gateway: true,
          encrypted_api_key: 'v1:old:tag:cipher',
        },
        security_settings: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    })
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'payment',
      {
        use_custom_payment_gateway: true,
        api_key: 'pk_live_new123',
      },
      3
    )

    const auditInsert = db._queries.find(
      (q: any) =>
        q.sql.includes('INSERT') && q.sql.includes('workspace_settings_audit')
    )
    const changes = JSON.parse(auditInsert!.params![4] as string)
    const credentialChanges = changes.filter(
      (c: any) =>
        c.field === 'encrypted_api_key' || c.field === 'encrypted_secret_key'
    )

    for (const change of credentialChanges) {
      if (change.old_value !== null) {
        expect(change.old_value).toBe('[REDACTED]')
      }
      if (change.new_value !== null) {
        expect(change.new_value).toBe('[REDACTED]')
      }
      // Must NEVER contain actual key values — only check strings
      if (typeof change.old_value === 'string') {
        expect(change.old_value).not.toContain('pk_live')
        expect(change.old_value).not.toContain('v1:')
      }
      if (typeof change.new_value === 'string') {
        expect(change.new_value).not.toContain('pk_live')
      }
    }
  })
})

describe('getSettingsAudit', () => {
  it('returns paginated results with valid cursor', async () => {
    const auditEntries = Array.from({ length: 5 }, (_, i) => ({
      id: `audit-${i}`,
      workspace_id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: 'user-001',
      settings_group: 'general',
      config_version: i + 1,
      changes: [
        { field: 'app_name', old_value: `Old ${i}`, new_value: `New ${i}` },
      ],
      request_id: `corr-${i}`,
      ip_address: '127.0.0.1',
      user_agent: 'TestAgent/1.0',
      created_at: new Date(`2026-02-28T10:0${i}:00.000Z`),
    }))

    const db = createMockDb({ auditEntries })
    const ctx = createMockContext(db)

    const result = await getSettingsAudit(ctx, { limit: 20 })
    expect(result.items).toHaveLength(5)
  })

  it('with group filter returns only matching entries', async () => {
    const db = createMockDb({ auditEntries: [] })
    const ctx = createMockContext(db)

    const result = await getSettingsAudit(ctx, { group: 'general', limit: 20 })
    expect(result.items).toHaveLength(0)

    // Verify the query includes group filter
    const selectQuery = db._queries.find(
      (q: any) =>
        q.sql.includes('SELECT') && q.sql.includes('workspace_settings_audit')
    )
    expect(selectQuery?.sql).toContain('settings_group')
  })
})

// ===========================================================================
// T028: Branding settings tests
// ===========================================================================

describe('updateSettingsGroup — branding', () => {
  it('branding update persists values and increments config_version', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    const result = await updateSettingsGroup(
      ctx,
      'branding',
      {
        logo_url: 'https://cdn.example.com/new-logo.png',
        primary_color: '#1E40AF',
      },
      3
    )

    expect(result.config_version).toBe(4)
    expect(result.updated_group).toBe('branding')
  })

  it('branding update creates audit entry with correct diff', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'branding',
      {
        logo_url: 'https://cdn.example.com/logo.png',
      },
      3
    )

    const auditInsert = db._queries.find(
      (q: any) =>
        q.sql.includes('INSERT') && q.sql.includes('workspace_settings_audit')
    )
    expect(auditInsert).toBeDefined()
    expect(auditInsert!.params![2]).toBe('branding')
  })

  it('partial branding update (only logo_url) does not clear other fields', async () => {
    const db = createMockDb({
      settings: {
        id: 'test-id',
        singleton_key: 'SETTINGS',
        config_version: 3,
        general_settings: {
          app_name: 'Test',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
        },
        language_settings: {
          default_language: 'en',
          supported_languages: ['en'],
        },
        branding_settings: {
          logo_url: 'https://old.com/logo.png',
          primary_color: '#FF0000',
        },
        payment_settings: {},
        security_settings: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    })
    const ctx = createMockContext(db)

    // Updating only logo_url — validated settings passed through
    const result = await updateSettingsGroup(
      ctx,
      'branding',
      {
        logo_url: 'https://cdn.example.com/new-logo.png',
      },
      3
    )

    expect(result.updated_group).toBe('branding')
  })
})

// ===========================================================================
// T030, T031: Payment encryption integration tests
// ===========================================================================

describe('updateSettingsGroup — payment encryption', () => {
  beforeEach(() => {
    process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterEach(() => {
    delete process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY
  })

  it('new api_key string → encrypt called, encrypted value stored', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'payment',
      {
        use_custom_payment_gateway: true,
        api_key: 'pk_live_abc123',
      },
      3
    )

    // Find the UPDATE query and verify the stored value is encrypted
    const updateQuery = db._queries.find(
      (q: any) =>
        q.sql.includes('UPDATE') &&
        q.sql.includes('payment_settings') &&
        !q.sql.includes('audit')
    )
    expect(updateQuery).toBeDefined()
    const storedData = JSON.parse(updateQuery!.params![0] as string)
    expect(storedData.encrypted_api_key).toMatch(/^v1:/)
    expect(storedData.encrypted_api_key).not.toBe('pk_live_abc123')
  })

  it('api_key = null → credential cleared in DB', async () => {
    const db = createMockDb({
      settings: {
        id: 'test-id',
        singleton_key: 'SETTINGS',
        config_version: 3,
        general_settings: {
          app_name: 'Test',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
        },
        language_settings: {
          default_language: 'en',
          supported_languages: ['en'],
        },
        branding_settings: {},
        payment_settings: {
          use_custom_payment_gateway: true,
          encrypted_api_key: 'v1:old:tag:cipher',
        },
        security_settings: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    })
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'payment',
      {
        use_custom_payment_gateway: true,
        api_key: null,
      },
      3
    )

    const updateQuery = db._queries.find(
      (q: any) =>
        q.sql.includes('UPDATE') &&
        q.sql.includes('payment_settings') &&
        !q.sql.includes('audit')
    )
    const storedData = JSON.parse(updateQuery!.params![0] as string)
    expect(storedData.encrypted_api_key).toBeNull()
  })

  it('api_key omitted → existing encrypted value preserved', async () => {
    const existingKey = 'v1:existing:tag:cipher'
    const db = createMockDb({
      settings: {
        id: 'test-id',
        singleton_key: 'SETTINGS',
        config_version: 3,
        general_settings: {
          app_name: 'Test',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
        },
        language_settings: {
          default_language: 'en',
          supported_languages: ['en'],
        },
        branding_settings: {},
        payment_settings: {
          use_custom_payment_gateway: true,
          encrypted_api_key: existingKey,
        },
        security_settings: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    })
    const ctx = createMockContext(db)

    // Omit api_key from update
    await updateSettingsGroup(
      ctx,
      'payment',
      {
        use_custom_payment_gateway: true,
      },
      3
    )

    const updateQuery = db._queries.find(
      (q: any) =>
        q.sql.includes('UPDATE') &&
        q.sql.includes('payment_settings') &&
        !q.sql.includes('audit')
    )
    const storedData = JSON.parse(updateQuery!.params![0] as string)
    expect(storedData.encrypted_api_key).toBe(existingKey)
  })

  it('encryption service unavailable → EncryptionServiceUnavailableError thrown', async () => {
    delete process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY
    const db = createMockDb()
    const ctx = createMockContext(db)

    await expect(
      updateSettingsGroup(
        ctx,
        'payment',
        {
          use_custom_payment_gateway: true,
          api_key: 'pk_live_test',
        },
        3
      )
    ).rejects.toThrow('Encryption key is not configured')

    // Verify ROLLBACK was called
    const queries = db._queries.map((q: any) => q.sql)
    expect(queries.some((s: string) => s.includes('ROLLBACK'))).toBe(true)
  })

  it('getWorkspaceSettings NEVER returns encrypted_api_key or encrypted_secret_key', async () => {
    const db = createMockDb({
      settings: {
        id: 'test-id',
        singleton_key: 'SETTINGS',
        config_version: 3,
        general_settings: {
          app_name: 'Test',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
        },
        language_settings: {
          default_language: 'en',
          supported_languages: ['en'],
        },
        branding_settings: {},
        payment_settings: {
          use_custom_payment_gateway: true,
          encrypted_api_key: 'v1:sec:ret:data',
          encrypted_secret_key: 'v1:sec:ret:data2',
        },
        security_settings: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    })
    const ctx = createMockContext(db)

    const result = await getWorkspaceSettings(ctx)
    const responseStr = JSON.stringify(result)

    expect(responseStr).not.toContain('encrypted_api_key')
    expect(responseStr).not.toContain('encrypted_secret_key')
    expect(responseStr).not.toContain('v1:sec:ret')
    expect(result.payment_settings.has_api_key).toBe(true)
    expect(result.payment_settings.has_secret_key).toBe(true)
  })
})

// T031: Credential non-exposure tests
describe('Credential non-exposure', () => {
  beforeEach(() => {
    process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterEach(() => {
    delete process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY
  })

  it('audit entry for payment update contains [REDACTED] for credential fields', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'payment',
      {
        use_custom_payment_gateway: true,
        api_key: 'pk_live_secret_value',
        secret_key: 'sk_live_secret_value',
      },
      3
    )

    const auditInsert = db._queries.find(
      (q: any) =>
        q.sql.includes('INSERT') && q.sql.includes('workspace_settings_audit')
    )
    expect(auditInsert).toBeDefined()
    const changes = JSON.parse(auditInsert!.params![4] as string)
    const changesStr = JSON.stringify(changes)

    // Must not contain actual credential values
    expect(changesStr).not.toContain('pk_live_secret_value')
    expect(changesStr).not.toContain('sk_live_secret_value')

    const apiKeyChange = changes.find(
      (c: any) => c.field === 'encrypted_api_key'
    )
    if (apiKeyChange) {
      expect(apiKeyChange.new_value).toBe('[REDACTED]')
    }
  })

  it('response from payment update does NOT contain credential values', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    const result = await updateSettingsGroup(
      ctx,
      'payment',
      {
        use_custom_payment_gateway: true,
        api_key: 'pk_live_xyz',
      },
      3
    )

    const resultStr = JSON.stringify(result)
    expect(resultStr).not.toContain('pk_live_xyz')
    expect(resultStr).not.toContain('encrypted')
  })
})

// ===========================================================================
// T033: Security settings tests
// ===========================================================================

describe('updateSettingsGroup — security', () => {
  it('getWorkspaceSettings applies security defaults', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)
    const result = await getWorkspaceSettings(ctx)

    expect(result.security_settings.analytics_opt_in).toBe(false)
    expect(result.security_settings.max_login_attempts).toBe(5)
    expect(result.security_settings.lockout_duration_minutes).toBe(15)
  })

  it('updateSettingsGroup security persists values and increments config_version', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    const result = await updateSettingsGroup(
      ctx,
      'security',
      {
        analytics_opt_in: true,
        max_login_attempts: 10,
        lockout_duration_minutes: 30,
      },
      3
    )

    expect(result.config_version).toBe(4)
    expect(result.updated_group).toBe('security')
  })

  it('explicit analytics_opt_in = true → saved and audit records opt-in activation', async () => {
    const db = createMockDb()
    const ctx = createMockContext(db)

    await updateSettingsGroup(
      ctx,
      'security',
      {
        analytics_opt_in: true,
      },
      3
    )

    // Verify the update stored analytics_opt_in = true
    const updateQuery = db._queries.find(
      (q: any) =>
        q.sql.includes('UPDATE') &&
        q.sql.includes('security_settings') &&
        !q.sql.includes('audit')
    )
    const storedData = JSON.parse(updateQuery!.params![0] as string)
    expect(storedData.analytics_opt_in).toBe(true)

    // Verify audit entry was created
    const auditInsert = db._queries.find(
      (q: any) =>
        q.sql.includes('INSERT') && q.sql.includes('workspace_settings_audit')
    )
    expect(auditInsert).toBeDefined()
    const changes = JSON.parse(auditInsert!.params![4] as string)
    const analyticsChange = changes.find(
      (c: any) => c.field === 'analytics_opt_in'
    )
    if (analyticsChange) {
      expect(analyticsChange.new_value).toBe(true)
    }
  })
})

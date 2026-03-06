/**
 * Audit Diff — Unit Tests
 *
 * File: tests/unit/audit-diff.test.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Tests the computeSettingsDiff utility function for:
 * - Changed fields detection
 * - Unchanged field exclusion
 * - Payment credential redaction
 * - Null transitions
 * - Array changes
 * - Nested object changes
 * - Empty diffs
 */

import { describe, expect, it } from 'vitest'

import { computeSettingsDiff } from '../../apps/api/src/modules/workspace-settings/workspace-settings.service'

describe('computeSettingsDiff', () => {
  it('detects changed fields and excludes unchanged', () => {
    const diff = computeSettingsDiff(
      'general',
      { app_name: 'Old Name', timezone: 'UTC', date_format: 'YYYY-MM-DD' },
      { app_name: 'New Name', timezone: 'UTC', date_format: 'DD/MM/YYYY' }
    )

    expect(diff).toHaveLength(2)
    expect(diff).toContainEqual({
      field: 'app_name',
      old_value: 'Old Name',
      new_value: 'New Name',
    })
    expect(diff).toContainEqual({
      field: 'date_format',
      old_value: 'YYYY-MM-DD',
      new_value: 'DD/MM/YYYY',
    })
    // timezone unchanged — should not be in diff
    expect(diff.find((d) => d.field === 'timezone')).toBeUndefined()
  })

  it('records null → value transition', () => {
    const diff = computeSettingsDiff(
      'branding',
      { logo_url: null },
      { logo_url: 'https://cdn.example.com/logo.png' }
    )

    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({
      field: 'logo_url',
      old_value: null,
      new_value: 'https://cdn.example.com/logo.png',
    })
  })

  it('records value → null transition', () => {
    const diff = computeSettingsDiff(
      'branding',
      { logo_url: 'https://cdn.example.com/logo.png' },
      { logo_url: null }
    )

    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({
      field: 'logo_url',
      old_value: 'https://cdn.example.com/logo.png',
      new_value: null,
    })
  })

  it('redacts payment credential fields to [REDACTED]', () => {
    const diff = computeSettingsDiff(
      'payment',
      {
        use_custom_payment_gateway: true,
        encrypted_api_key: 'v1:old:encrypted:value',
        encrypted_secret_key: 'v1:old:encrypted:secret',
      },
      {
        use_custom_payment_gateway: true,
        encrypted_api_key: 'v1:new:encrypted:value',
        encrypted_secret_key: 'v1:new:encrypted:secret',
      },
      ['encrypted_api_key', 'encrypted_secret_key']
    )

    const apiKeyDiff = diff.find((d) => d.field === 'encrypted_api_key')
    const secretKeyDiff = diff.find((d) => d.field === 'encrypted_secret_key')

    expect(apiKeyDiff).toEqual({
      field: 'encrypted_api_key',
      old_value: '[REDACTED]',
      new_value: '[REDACTED]',
    })
    expect(secretKeyDiff).toEqual({
      field: 'encrypted_secret_key',
      old_value: '[REDACTED]',
      new_value: '[REDACTED]',
    })
  })

  it('redacts null → value for credential fields', () => {
    const diff = computeSettingsDiff(
      'payment',
      { encrypted_api_key: null },
      { encrypted_api_key: 'v1:new:encrypted:value' },
      ['encrypted_api_key']
    )

    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({
      field: 'encrypted_api_key',
      old_value: null,
      new_value: '[REDACTED]',
    })
  })

  it('redacts value → null for credential fields', () => {
    const diff = computeSettingsDiff(
      'payment',
      { encrypted_api_key: 'v1:old:encrypted:value' },
      { encrypted_api_key: null },
      ['encrypted_api_key']
    )

    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({
      field: 'encrypted_api_key',
      old_value: '[REDACTED]',
      new_value: null,
    })
  })

  it('detects array changes (supported_languages add/remove)', () => {
    const diff = computeSettingsDiff(
      'language',
      { supported_languages: ['ar', 'en'] },
      { supported_languages: ['ar', 'en', 'fr'] }
    )

    expect(diff).toHaveLength(1)
    expect(diff[0].field).toBe('supported_languages')
    expect(diff[0].old_value).toEqual(['ar', 'en'])
    expect(diff[0].new_value).toEqual(['ar', 'en', 'fr'])
  })

  it('detects nested object changes (seo_metadata)', () => {
    const diff = computeSettingsDiff(
      'branding',
      {
        seo_metadata: { title: 'Old Title', description: 'Old Desc' },
      },
      {
        seo_metadata: { title: 'New Title', description: 'Old Desc' },
      }
    )

    expect(diff).toHaveLength(1)
    expect(diff[0].field).toBe('seo_metadata')
  })

  it('returns empty diff when old === new', () => {
    const settings = {
      app_name: 'Test',
      timezone: 'UTC',
      date_format: 'YYYY-MM-DD',
    }
    const diff = computeSettingsDiff('general', settings, { ...settings })
    expect(diff).toHaveLength(0)
  })

  it('only redacted fields changed → diff contains [REDACTED] entries', () => {
    const diff = computeSettingsDiff(
      'payment',
      {
        use_custom_payment_gateway: true,
        encrypted_api_key: 'old-value',
      },
      {
        use_custom_payment_gateway: true,
        encrypted_api_key: 'new-value',
      },
      ['encrypted_api_key']
    )

    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({
      field: 'encrypted_api_key',
      old_value: '[REDACTED]',
      new_value: '[REDACTED]',
    })
    // gateway toggle unchanged — should not appear
    expect(diff.find((d) => d.field === 'use_custom_payment_gateway')).toBeUndefined()
  })

  it('handles new fields appearing (undefined → value)', () => {
    const diff = computeSettingsDiff(
      'general',
      { app_name: 'Test' },
      { app_name: 'Test', session_timeout_minutes: 45 }
    )

    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({
      field: 'session_timeout_minutes',
      old_value: null,
      new_value: 45,
    })
  })

  it('handles fields being removed (value → undefined)', () => {
    const diff = computeSettingsDiff(
      'general',
      { app_name: 'Test', session_timeout_minutes: 45 },
      { app_name: 'Test' }
    )

    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({
      field: 'session_timeout_minutes',
      old_value: 45,
      new_value: null,
    })
  })
})

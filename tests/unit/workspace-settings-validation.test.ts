/**
 * Workspace Settings Validation — Unit Tests
 *
 * File: tests/unit/workspace-settings-validation.test.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Tests all 5 Zod schemas with valid/invalid inputs, edge cases,
 * and cross-field refinements.
 */

import { describe, expect, it } from 'vitest'

import {
  auditCursorSchema,
  auditQuerySchema,
  brandingSettingsSchema,
  generalSettingsSchema,
  languageSettingsSchema,
  paymentSettingsSchema,
  securitySettingsSchema,
  settingsGroupSchema,
  updateSettingsRequestSchema,
} from '../../apps/api/src/modules/workspace-settings/workspace-settings.validation'

// =========================================================================
// General Settings Schema
// =========================================================================

describe('generalSettingsSchema', () => {
  const validGeneral = {
    app_name: 'Riyadh University',
    timezone: 'Asia/Riyadh',
    date_format: 'DD/MM/YYYY',
    session_timeout_minutes: 30,
  }

  it('accepts valid general settings', () => {
    const result = generalSettingsSchema.safeParse(validGeneral)
    expect(result.success).toBe(true)
  })

  it('accepts without optional session_timeout_minutes', () => {
    const { session_timeout_minutes, ...required } = validGeneral
    const result = generalSettingsSchema.safeParse(required)
    expect(result.success).toBe(true)
  })

  // app_name
  it('rejects empty app_name', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      app_name: '',
    })
    expect(result.success).toBe(false)
  })

  it('accepts app_name at 255 characters', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      app_name: 'a'.repeat(255),
    })
    expect(result.success).toBe(true)
  })

  it('rejects app_name over 255 characters', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      app_name: 'a'.repeat(256),
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing app_name', () => {
    const { app_name, ...rest } = validGeneral
    const result = generalSettingsSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  // timezone
  it('accepts valid IANA timezone Asia/Riyadh', () => {
    const result = generalSettingsSchema.safeParse(validGeneral)
    expect(result.success).toBe(true)
  })

  it('accepts valid IANA timezone America/New_York', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      timezone: 'America/New_York',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid IANA timezone UTC', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      timezone: 'UTC',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid timezone string', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      timezone: 'Invalid/Zone',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing timezone', () => {
    const { timezone, ...rest } = validGeneral
    const result = generalSettingsSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  // date_format
  it('accepts all valid date_format values', () => {
    const formats = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY']
    for (const fmt of formats) {
      const result = generalSettingsSchema.safeParse({
        ...validGeneral,
        date_format: fmt,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid date_format', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      date_format: 'YYYY/MM/DD',
    })
    expect(result.success).toBe(false)
  })

  // session_timeout_minutes bounds
  it('rejects session_timeout_minutes of 4 (below min 5)', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      session_timeout_minutes: 4,
    })
    expect(result.success).toBe(false)
  })

  it('accepts session_timeout_minutes of 5', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      session_timeout_minutes: 5,
    })
    expect(result.success).toBe(true)
  })

  it('accepts session_timeout_minutes of 480', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      session_timeout_minutes: 480,
    })
    expect(result.success).toBe(true)
  })

  it('rejects session_timeout_minutes of 481 (above max 480)', () => {
    const result = generalSettingsSchema.safeParse({
      ...validGeneral,
      session_timeout_minutes: 481,
    })
    expect(result.success).toBe(false)
  })
})

// =========================================================================
// Language Settings Schema
// =========================================================================

describe('languageSettingsSchema', () => {
  const validLanguage = {
    default_language: 'ar',
    supported_languages: ['ar', 'en'],
  }

  it('accepts valid language settings', () => {
    const result = languageSettingsSchema.safeParse(validLanguage)
    expect(result.success).toBe(true)
  })

  it('accepts valid ISO 639-1 codes', () => {
    const codes = ['ar', 'en', 'fr', 'es']
    for (const code of codes) {
      const result = languageSettingsSchema.safeParse({
        default_language: code,
        supported_languages: [code],
      })
      expect(result.success).toBe(true)
    }
  })

  // T021 — Cross-field validation
  it('rejects default_language NOT in supported_languages', () => {
    const result = languageSettingsSchema.safeParse({
      default_language: 'fr',
      supported_languages: ['ar', 'en'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        'default_language must be included in supported_languages'
      )
    }
  })

  it('rejects empty supported_languages array', () => {
    const result = languageSettingsSchema.safeParse({
      default_language: 'ar',
      supported_languages: [],
    })
    expect(result.success).toBe(false)
  })

  it('accepts adding new language to supported list', () => {
    const result = languageSettingsSchema.safeParse({
      default_language: 'ar',
      supported_languages: ['ar', 'en', 'es'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts supported_languages with duplicates (handled gracefully)', () => {
    const result = languageSettingsSchema.safeParse({
      default_language: 'ar',
      supported_languages: ['ar', 'ar', 'en'],
    })
    // Duplicates are accepted (deduplication is an application concern)
    expect(result.success).toBe(true)
  })
})

// =========================================================================
// Branding Settings Schema
// =========================================================================

describe('brandingSettingsSchema', () => {
  it('accepts valid branding settings with all fields', () => {
    const result = brandingSettingsSchema.safeParse({
      logo_url: 'https://cdn.example.com/logo.png',
      favicon_url: 'https://cdn.example.com/favicon.ico',
      primary_color: '#1E40AF',
      secondary_color: '#9333EA',
      email_template_branding: {
        header_logo_url: 'https://cdn.example.com/email-logo.png',
        footer_text: 'University Footer',
      },
      certificate_template_branding: {
        logo_url: 'https://cdn.example.com/cert-logo.png',
        signature_url: 'https://cdn.example.com/sig.png',
        institution_name: 'Riyadh University',
      },
      seo_metadata: {
        title: 'Riyadh University Online',
        description: 'Premier online learning platform',
        og_image_url: 'https://cdn.example.com/og.png',
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty branding settings object (all fields optional)', () => {
    const result = brandingSettingsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  // T027 — Hex colors
  it('accepts valid hex colors (#1E40AF, #9333EA, #1E40AF80)', () => {
    expect(brandingSettingsSchema.safeParse({ primary_color: '#1E40AF' }).success).toBe(true)
    expect(brandingSettingsSchema.safeParse({ primary_color: '#9333EA' }).success).toBe(true)
    expect(brandingSettingsSchema.safeParse({ primary_color: '#1E40AF80' }).success).toBe(true)
  })

  it('rejects invalid color values', () => {
    expect(brandingSettingsSchema.safeParse({ primary_color: '#GGG' }).success).toBe(false)
    expect(brandingSettingsSchema.safeParse({ primary_color: 'rgb(1,2,3)' }).success).toBe(false)
    expect(brandingSettingsSchema.safeParse({ primary_color: 'blue' }).success).toBe(false)
  })

  // URLs
  it('accepts valid URLs for logo_url and favicon_url', () => {
    const result = brandingSettingsSchema.safeParse({
      logo_url: 'https://example.com/logo.png',
      favicon_url: 'https://example.com/fav.ico',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid URLs', () => {
    const result = brandingSettingsSchema.safeParse({
      logo_url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  // SEO metadata
  it('rejects seo_metadata title > 60 chars', () => {
    const result = brandingSettingsSchema.safeParse({
      seo_metadata: {
        title: 'a'.repeat(61),
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects seo_metadata description > 160 chars', () => {
    const result = brandingSettingsSchema.safeParse({
      seo_metadata: {
        description: 'a'.repeat(161),
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts seo_metadata with valid title and description lengths', () => {
    const result = brandingSettingsSchema.safeParse({
      seo_metadata: {
        title: 'a'.repeat(60),
        description: 'a'.repeat(160),
      },
    })
    expect(result.success).toBe(true)
  })

  it('validates nested email_template_branding', () => {
    const result = brandingSettingsSchema.safeParse({
      email_template_branding: {
        header_logo_url: 'https://cdn.example.com/logo.png',
        footer_text: 'Some footer',
      },
    })
    expect(result.success).toBe(true)
  })

  it('validates nested certificate_template_branding', () => {
    const result = brandingSettingsSchema.safeParse({
      certificate_template_branding: {
        logo_url: 'https://cdn.example.com/logo.png',
        signature_url: 'https://cdn.example.com/sig.png',
        institution_name: 'Test Uni',
      },
    })
    expect(result.success).toBe(true)
  })
})

// =========================================================================
// Payment Settings Schema
// =========================================================================

describe('paymentSettingsSchema', () => {
  it('accepts valid payment settings with credentials', () => {
    const result = paymentSettingsSchema.safeParse({
      use_custom_payment_gateway: true,
      gateway_provider: 'moyasar',
      api_key: 'pk_live_abc123',
      secret_key: 'sk_live_xyz789',
    })
    expect(result.success).toBe(true)
  })

  // T029 — Sentinel validation
  it('accepts api_key as string (will be encrypted)', () => {
    const result = paymentSettingsSchema.safeParse({
      use_custom_payment_gateway: true,
      api_key: 'pk_live_new',
    })
    expect(result.success).toBe(true)
  })

  it('accepts api_key as null (clear credential)', () => {
    const result = paymentSettingsSchema.safeParse({
      use_custom_payment_gateway: true,
      api_key: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts api_key omitted (keep existing)', () => {
    const result = paymentSettingsSchema.safeParse({
      use_custom_payment_gateway: true,
    })
    expect(result.success).toBe(true)
  })

  it('applies same sentinel semantics to secret_key', () => {
    expect(
      paymentSettingsSchema.safeParse({
        use_custom_payment_gateway: true,
        secret_key: 'sk_live_new',
      }).success
    ).toBe(true)

    expect(
      paymentSettingsSchema.safeParse({
        use_custom_payment_gateway: true,
        secret_key: null,
      }).success
    ).toBe(true)
  })

  it('accepts use_custom_payment_gateway = false regardless of credentials', () => {
    const result = paymentSettingsSchema.safeParse({
      use_custom_payment_gateway: false,
    })
    expect(result.success).toBe(true)
  })

  it('requires use_custom_payment_gateway boolean', () => {
    const result = paymentSettingsSchema.safeParse({
      gateway_provider: 'stripe',
    })
    expect(result.success).toBe(false)
  })
})

// =========================================================================
// Security Settings Schema
// =========================================================================

describe('securitySettingsSchema', () => {
  it('accepts valid security settings', () => {
    const result = securitySettingsSchema.safeParse({
      analytics_opt_in: true,
      max_login_attempts: 5,
      lockout_duration_minutes: 15,
      password_policy: {
        min_length: 8,
        require_uppercase: true,
        require_lowercase: true,
        require_numbers: true,
        require_special_chars: false,
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty security settings object (all fields optional)', () => {
    const result = securitySettingsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  // T032 — Bounds
  it('rejects max_login_attempts of 0', () => {
    const result = securitySettingsSchema.safeParse({ max_login_attempts: 0 })
    expect(result.success).toBe(false)
  })

  it('accepts max_login_attempts of 1', () => {
    const result = securitySettingsSchema.safeParse({ max_login_attempts: 1 })
    expect(result.success).toBe(true)
  })

  it('accepts max_login_attempts of 20', () => {
    const result = securitySettingsSchema.safeParse({ max_login_attempts: 20 })
    expect(result.success).toBe(true)
  })

  it('rejects max_login_attempts of 21', () => {
    const result = securitySettingsSchema.safeParse({ max_login_attempts: 21 })
    expect(result.success).toBe(false)
  })

  it('rejects lockout_duration_minutes of 0', () => {
    const result = securitySettingsSchema.safeParse({
      lockout_duration_minutes: 0,
    })
    expect(result.success).toBe(false)
  })

  it('accepts lockout_duration_minutes of 1', () => {
    const result = securitySettingsSchema.safeParse({
      lockout_duration_minutes: 1,
    })
    expect(result.success).toBe(true)
  })

  it('accepts lockout_duration_minutes of 1440', () => {
    const result = securitySettingsSchema.safeParse({
      lockout_duration_minutes: 1440,
    })
    expect(result.success).toBe(true)
  })

  it('rejects lockout_duration_minutes of 1441', () => {
    const result = securitySettingsSchema.safeParse({
      lockout_duration_minutes: 1441,
    })
    expect(result.success).toBe(false)
  })

  it('accepts password_policy as null', () => {
    const result = securitySettingsSchema.safeParse({ password_policy: null })
    expect(result.success).toBe(true)
  })

  it('validates password_policy min_length bounds', () => {
    expect(
      securitySettingsSchema.safeParse({
        password_policy: { min_length: 0 },
      }).success
    ).toBe(false)

    expect(
      securitySettingsSchema.safeParse({
        password_policy: { min_length: 1 },
      }).success
    ).toBe(true)

    expect(
      securitySettingsSchema.safeParse({
        password_policy: { min_length: 128 },
      }).success
    ).toBe(true)

    expect(
      securitySettingsSchema.safeParse({
        password_policy: { min_length: 129 },
      }).success
    ).toBe(false)
  })
})

// =========================================================================
// Settings Group Schema
// =========================================================================

describe('settingsGroupSchema', () => {
  it('accepts valid group names', () => {
    const groups = ['general', 'language', 'branding', 'payment', 'security']
    for (const g of groups) {
      expect(settingsGroupSchema.safeParse(g).success).toBe(true)
    }
  })

  it('rejects invalid group names', () => {
    expect(settingsGroupSchema.safeParse('invalid').success).toBe(false)
    expect(settingsGroupSchema.safeParse('').success).toBe(false)
    expect(settingsGroupSchema.safeParse('GENERAL').success).toBe(false)
  })
})

// =========================================================================
// Update Settings Request Schema
// =========================================================================

describe('updateSettingsRequestSchema', () => {
  it('requires config_version', () => {
    const result = updateSettingsRequestSchema.safeParse({
      settings: { app_name: 'test' },
    })
    expect(result.success).toBe(false)
  })

  it('requires config_version to be a positive integer', () => {
    expect(
      updateSettingsRequestSchema.safeParse({
        config_version: 0,
        settings: {},
      }).success
    ).toBe(false)

    expect(
      updateSettingsRequestSchema.safeParse({
        config_version: -1,
        settings: {},
      }).success
    ).toBe(false)

    expect(
      updateSettingsRequestSchema.safeParse({
        config_version: 1.5,
        settings: {},
      }).success
    ).toBe(false)

    expect(
      updateSettingsRequestSchema.safeParse({
        config_version: 1,
        settings: {},
      }).success
    ).toBe(true)
  })
})

// =========================================================================
// Audit Query Schema
// =========================================================================

describe('auditQuerySchema', () => {
  it('accepts valid audit query with defaults', () => {
    const result = auditQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(20)
    }
  })

  it('accepts optional group filter', () => {
    const result = auditQuerySchema.safeParse({ group: 'general' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid group filter', () => {
    const result = auditQuerySchema.safeParse({ group: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects limit below 1', () => {
    const result = auditQuerySchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects limit above 100', () => {
    const result = auditQuerySchema.safeParse({ limit: 101 })
    expect(result.success).toBe(false)
  })
})

// =========================================================================
// Audit Cursor Schema
// =========================================================================

describe('auditCursorSchema', () => {
  it('accepts valid cursor with ISO datetime and UUID', () => {
    const result = auditCursorSchema.safeParse({
      created_at: '2026-02-28T10:30:00.000Z',
      id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid datetime', () => {
    const result = auditCursorSchema.safeParse({
      created_at: 'not-a-date',
      id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID', () => {
    const result = auditCursorSchema.safeParse({
      created_at: '2026-02-28T10:30:00.000Z',
      id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

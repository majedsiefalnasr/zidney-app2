/**
 * Workspace Settings — Zod Validation Schemas
 *
 * File: apps/api/src/modules/workspace-settings/workspace-settings.validation.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Five Zod schemas for settings groups, plus request/query schemas.
 *
 * Guardian Audit Conditions:
 * ✓ Use Set<string> for IANA timezone cache
 * ✓ Add defensive min_length bounds for password policy
 * ✓ Validate decoded audit cursor with Zod (datetime + UUID)
 * ✓ Cache IANA timezone list at module load for performance
 *
 * Constitutional Compliance:
 * ✓ Zod is the single validation authority
 * ✓ No HTTP logic — pure validation
 * ✓ No DB imports
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// IANA Timezone Cache (Set<string> per guardian audit)
// ---------------------------------------------------------------------------

/** Cached IANA timezone set — loaded once at module init for performance */
const IANA_TIMEZONES: Set<string> = new Set([
  ...Intl.supportedValuesOf('timeZone'),
  'UTC', // UTC is a valid IANA timezone but not always in supportedValuesOf
])

// ---------------------------------------------------------------------------
// Shared Primitives
// ---------------------------------------------------------------------------

const hexColorRegex = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/

const hexColorSchema = z
  .string()
  .regex(
    hexColorRegex,
    'Must be a valid hex color (e.g., #1E40AF or #1E40AF80)'
  )

const urlSchema = z.string().url('Must be a valid URL')

const optionalUrl = z.union([urlSchema, z.null()]).optional()

const optionalHexColor = z.union([hexColorSchema, z.null()]).optional()

// ---------------------------------------------------------------------------
// Date Format Enum
// ---------------------------------------------------------------------------

export const DATE_FORMATS = [
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'DD-MM-YYYY',
  'DD.MM.YYYY',
] as const

export const dateFormatSchema = z.enum(DATE_FORMATS)

// ---------------------------------------------------------------------------
// Settings Group Enum
// ---------------------------------------------------------------------------

export const SETTINGS_GROUPS = [
  'general',
  'language',
  'branding',
  'payment',
  'security',
] as const

export const settingsGroupSchema = z.enum(SETTINGS_GROUPS)

// ---------------------------------------------------------------------------
// General Settings Schema
// ---------------------------------------------------------------------------

export const generalSettingsSchema = z.object({
  app_name: z
    .string()
    .min(1, 'app_name is required and must not be empty')
    .max(255, 'app_name must not exceed 255 characters'),
  timezone: z.string().refine((tz: string) => IANA_TIMEZONES.has(tz), {
    message: 'Must be a valid IANA timezone identifier',
  }),
  date_format: dateFormatSchema,
  session_timeout_minutes: z
    .number()
    .int('session_timeout_minutes must be an integer')
    .min(5, 'session_timeout_minutes must be at least 5')
    .max(480, 'session_timeout_minutes must not exceed 480')
    .optional(),
})

// ---------------------------------------------------------------------------
// Language Settings Schema
// ---------------------------------------------------------------------------

export const languageSettingsSchema = z
  .object({
    default_language: z
      .string()
      .min(2, 'default_language must be a valid ISO 639-1 code')
      .max(10, 'default_language must not exceed 10 characters'),
    supported_languages: z
      .array(z.string().min(2).max(10))
      .min(1, 'supported_languages must contain at least one language'),
  })
  .refine(
    (data: { default_language: string; supported_languages: string[] }) =>
      data.supported_languages.includes(data.default_language),
    {
      message: 'default_language must be included in supported_languages',
      path: ['default_language'],
    }
  )

/**
 * INTERNAL-ONLY schema — includes language_status for service-layer reads.
 *
 * language_status is managed exclusively by the workspace-settings service
 * and the DRAIN worker. It MUST NOT be included in any client-facing API
 * response schema or request validation.
 *
 * Used only when reading settings from DB to populate TranslationOperationContext.
 */
export const languageSettingsInternalSchema = languageSettingsSchema.and(
  z.object({
    language_status: z.record(z.enum(['active', 'removing'])).optional(),
  })
)

// ---------------------------------------------------------------------------
// Branding Settings Schema
// ---------------------------------------------------------------------------

export const emailTemplateBrandingSchema = z
  .object({
    header_logo_url: optionalUrl,
    footer_text: z.union([z.string().max(500), z.null()]).optional(),
  })
  .optional()
  .nullable()

export const certificateTemplateBrandingSchema = z
  .object({
    logo_url: optionalUrl,
    signature_url: optionalUrl,
    institution_name: z.union([z.string().max(255), z.null()]).optional(),
  })
  .optional()
  .nullable()

export const seoMetadataSchema = z
  .object({
    title: z
      .union([
        z.string().max(60, 'SEO title must not exceed 60 characters'),
        z.null(),
      ])
      .optional(),
    description: z
      .union([
        z.string().max(160, 'SEO description must not exceed 160 characters'),
        z.null(),
      ])
      .optional(),
    og_image_url: optionalUrl,
  })
  .optional()
  .nullable()

export const brandingSettingsSchema = z.object({
  logo_url: optionalUrl,
  favicon_url: optionalUrl,
  primary_color: optionalHexColor,
  secondary_color: optionalHexColor,
  email_template_branding: emailTemplateBrandingSchema,
  certificate_template_branding: certificateTemplateBrandingSchema,
  seo_metadata: seoMetadataSchema,
})

// ---------------------------------------------------------------------------
// Payment Settings Schema
// ---------------------------------------------------------------------------

export const paymentSettingsSchema = z.object({
  use_custom_payment_gateway: z.boolean(),
  gateway_provider: z.union([z.string(), z.null()]).optional(),
  // Sentinel pattern: omit → keep, null → clear, string → encrypt & replace
  api_key: z.union([z.string(), z.null()]).optional(),
  secret_key: z.union([z.string(), z.null()]).optional(),
})

// ---------------------------------------------------------------------------
// Security Settings Schema
// ---------------------------------------------------------------------------

/** Guardian audit: add defensive min_length bounds for password policy */
export const passwordPolicySchema = z
  .object({
    min_length: z
      .number()
      .int()
      .min(1, 'min_length must be at least 1')
      .max(128, 'min_length must not exceed 128')
      .optional(),
    require_uppercase: z.boolean().optional(),
    require_lowercase: z.boolean().optional(),
    require_numbers: z.boolean().optional(),
    require_special_chars: z.boolean().optional(),
  })
  .optional()
  .nullable()

export const securitySettingsSchema = z.object({
  analytics_opt_in: z.boolean().optional(),
  max_login_attempts: z
    .number()
    .int('max_login_attempts must be an integer')
    .min(1, 'max_login_attempts must be at least 1')
    .max(20, 'max_login_attempts must not exceed 20')
    .optional(),
  lockout_duration_minutes: z
    .number()
    .int('lockout_duration_minutes must be an integer')
    .min(1, 'lockout_duration_minutes must be at least 1')
    .max(1440, 'lockout_duration_minutes must not exceed 1440')
    .optional(),
  password_policy: passwordPolicySchema,
})

// ---------------------------------------------------------------------------
// Update Settings Request Schema
// ---------------------------------------------------------------------------

export const updateSettingsRequestSchema = z.object({
  config_version: z
    .number()
    .int('config_version must be a positive integer')
    .positive('config_version must be a positive integer'),
  settings: z.record(z.unknown()),
})

// ---------------------------------------------------------------------------
// Audit Query Schema
// ---------------------------------------------------------------------------

/** Guardian audit: validate decoded audit cursor with Zod */
export const auditCursorSchema = z.object({
  created_at: z
    .string()
    .datetime({ message: 'Cursor created_at must be a valid ISO datetime' }),
  id: z.string().uuid('Cursor id must be a valid UUID'),
})

export const auditQuerySchema = z.object({
  group: settingsGroupSchema.optional(),
  limit: z
    .number()
    .int()
    .min(1, 'limit must be at least 1')
    .max(100, 'limit must not exceed 100')
    .default(20),
  cursor: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Schema Map (group name → Zod schema)
// ---------------------------------------------------------------------------

export const SETTINGS_SCHEMA_MAP: Record<
  string,
  {
    safeParse: (data: unknown) => {
      success: boolean
      data?: unknown
      error?: {
        issues: Array<{ path: Array<string | number>; message: string }>
      }
    }
  }
> = {
  general: generalSettingsSchema,
  language: languageSettingsSchema,
  branding: brandingSettingsSchema,
  payment: paymentSettingsSchema,
  security: securitySettingsSchema,
}

// ---------------------------------------------------------------------------
// Exported types from schemas
// ---------------------------------------------------------------------------

export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>
export type LanguageSettingsInput = z.infer<typeof languageSettingsSchema>
export type BrandingSettingsInput = z.infer<typeof brandingSettingsSchema>
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>
export type SecuritySettingsInput = z.infer<typeof securitySettingsSchema>
export type UpdateSettingsRequestInput = z.infer<
  typeof updateSettingsRequestSchema
>
export type AuditQueryInput = z.infer<typeof auditQuerySchema>

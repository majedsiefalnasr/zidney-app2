/**
 * Workspace Settings — TypeScript Type Definitions
 *
 * File: apps/api/src/modules/workspace-settings/workspace-settings.types.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Pure type definitions — no runtime code, no imports from framework or DB.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure type definitions only
 * ✓ No DB imports — types are layer-agnostic
 * ✓ No framework dependencies
 */

// ---------------------------------------------------------------------------
// Settings Group Union
// ---------------------------------------------------------------------------

/** Valid settings group identifiers */
export type SettingsGroup =
  | 'general'
  | 'language'
  | 'branding'
  | 'payment'
  | 'security'

// ---------------------------------------------------------------------------
// General Settings
// ---------------------------------------------------------------------------

/** Accepted date format patterns */
export type DateFormat =
  | 'YYYY-MM-DD'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'DD-MM-YYYY'
  | 'DD.MM.YYYY'

export interface GeneralSettings {
  app_name: string
  timezone: string
  date_format: DateFormat
  session_timeout_minutes?: number
}

// ---------------------------------------------------------------------------
// Language Settings
// ---------------------------------------------------------------------------

export interface LanguageSettings {
  default_language: string
  supported_languages: string[]
  /**
   * Internal-only field tracking per-language removal state.
   * 'removing' → async DRAIN job is in progress for this language.
   * This field is set/cleared by workspace-settings service and worker.
   * It MUST NOT be exposed to client-facing API responses.
   */
  language_status?: Record<string, 'active' | 'removing'>
}

// ---------------------------------------------------------------------------
// Branding Settings
// ---------------------------------------------------------------------------

export interface EmailTemplateBranding {
  header_logo_url?: string | null
  footer_text?: string | null
}

export interface CertificateTemplateBranding {
  logo_url?: string | null
  signature_url?: string | null
  institution_name?: string | null
}

export interface SeoMetadata {
  title?: string | null
  description?: string | null
  og_image_url?: string | null
}

export interface BrandingSettings {
  logo_url?: string | null
  favicon_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  email_template_branding?: EmailTemplateBranding | null
  certificate_template_branding?: CertificateTemplateBranding | null
  seo_metadata?: SeoMetadata | null
}

// ---------------------------------------------------------------------------
// Payment Settings
// ---------------------------------------------------------------------------

/** Stored payment settings (DB shape — contains encrypted credentials) */
export interface PaymentSettings {
  use_custom_payment_gateway: boolean
  gateway_provider?: string | null
  encrypted_api_key?: string | null
  encrypted_secret_key?: string | null
}

/** Inbound payment settings from client (plaintext credentials) */
export interface PaymentSettingsInput {
  use_custom_payment_gateway: boolean
  gateway_provider?: string | null
  api_key?: string | null
  secret_key?: string | null
}

/** Payment settings in API response (credentials replaced with booleans) */
export interface PaymentSettingsResponse {
  use_custom_payment_gateway: boolean
  gateway_provider: string | null
  has_api_key: boolean
  has_secret_key: boolean
}

// ---------------------------------------------------------------------------
// Security Settings
// ---------------------------------------------------------------------------

export interface PasswordPolicy {
  min_length?: number
  require_uppercase?: boolean
  require_lowercase?: boolean
  require_numbers?: boolean
  require_special_chars?: boolean
}

export interface SecuritySettings {
  analytics_opt_in?: boolean
  max_login_attempts?: number
  lockout_duration_minutes?: number
  password_policy?: PasswordPolicy | null
}

// ---------------------------------------------------------------------------
// Aggregate Workspace Settings
// ---------------------------------------------------------------------------

/** Full workspace settings as stored in DB */
export interface WorkspaceSettings {
  id: string
  singleton_key: string
  config_version: number
  general_settings: GeneralSettings
  language_settings: LanguageSettings
  branding_settings: BrandingSettings
  payment_settings: PaymentSettings
  security_settings: SecuritySettings
  created_at: Date
  updated_at: Date
}

/** Workspace settings as returned in API response (payment credentials stripped) */
export interface WorkspaceSettingsResponse {
  config_version: number
  general_settings: GeneralSettings
  language_settings: LanguageSettings
  branding_settings: BrandingSettings
  payment_settings: PaymentSettingsResponse
  security_settings: SecuritySettings
  updated_at: string
}

// ---------------------------------------------------------------------------
// Update Request
// ---------------------------------------------------------------------------

/** Request body for PUT /settings/:group */
export interface UpdateSettingsRequest<T = Record<string, unknown>> {
  config_version: number
  settings: T
}

// ---------------------------------------------------------------------------
// Audit Types
// ---------------------------------------------------------------------------

/** Single field change in a settings diff */
export interface AuditDiffEntry {
  field: string
  old_value: unknown
  new_value: unknown
}

/** Workspace settings audit record */
export interface WorkspaceSettingsAuditEntry {
  id: string
  workspace_id: string
  user_id: string
  settings_group: SettingsGroup
  config_version: number
  changes: AuditDiffEntry[]
  request_id: string
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

/** Audit query filters */
export interface AuditQueryFilters {
  group?: SettingsGroup
  limit: number
  cursor?: string
}

/** Decoded cursor for audit pagination */
export interface AuditCursor {
  created_at: string
  id: string
}

/** Paginated audit result */
export interface PaginatedAuditResult {
  items: WorkspaceSettingsAuditEntry[]
  nextCursor: string | null
}

/** Update result returned from service */
export interface UpdateSettingsResult {
  config_version: number
  updated_group: SettingsGroup
  updated_at: string
}

/** Fields that must be redacted in audit logs */
export const PAYMENT_REDACTED_FIELDS: ReadonlySet<string> = new Set([
  'encrypted_api_key',
  'encrypted_secret_key',
])

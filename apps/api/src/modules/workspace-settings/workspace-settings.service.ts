/**
 * Workspace Settings — Business Logic Service
 *
 * File: apps/api/src/modules/workspace-settings/workspace-settings.service.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Core business logic for workspace settings: retrieval with defaults,
 * group-level updates with optimistic locking, audit diff computation,
 * payment credential encryption, and audit trail querying.
 *
 * Constitutional Compliance:
 * ✓ All DB access through tenant pool from request context
 * ✓ All writes within database transactions
 * ✓ Structured logging with correlation_id + workspace_slug
 * ✓ No console.log — uses @zidney/logger
 * ✓ Server-authoritative timestamps
 */

import { createLogger } from '@zidney/logger'

import { encrypt } from './encryption.service'
import {
  SettingsNotFoundError,
  SettingsValidationError,
} from './workspace-settings.errors'
import * as repository from './workspace-settings.repository'
import type {
  AuditDiffEntry,
  AuditQueryFilters,
  GeneralSettings,
  PaginatedAuditResult,
  PaymentSettings,
  PaymentSettingsInput,
  PaymentSettingsResponse,
  SecuritySettings,
  SettingsGroup,
  UpdateSettingsResult,
  WorkspaceSettingsResponse,
} from './workspace-settings.types'
import { PAYMENT_REDACTED_FIELDS } from './workspace-settings.types'
import {
  SETTINGS_SCHEMA_MAP,
  auditQuerySchema,
} from './workspace-settings.validation'

const logger = createLogger('workspace-settings')

// ---------------------------------------------------------------------------
// DB Client interface (matches pg Pool/PoolClient)
// ---------------------------------------------------------------------------

interface DbClient {
  query: <T = any>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>
}

/** Request context passed from route handler */
export interface SettingsRequestContext {
  db: DbClient
  workspace_id: string
  workspace_slug: string
  user_id: string
  correlation_id: string
  ip_address: string | null
  user_agent: string | null
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const GENERAL_DEFAULTS = {
  session_timeout_minutes: 30,
} as const

const SECURITY_DEFAULTS = {
  analytics_opt_in: false,
  max_login_attempts: 5,
  lockout_duration_minutes: 15,
} as const

// ---------------------------------------------------------------------------
// T014: Audit Diff Computation
// ---------------------------------------------------------------------------

/**
 * Compute field-level diff between old and new JSONB values.
 *
 * @param group - Settings group name (for context)
 * @param oldValues - Previous settings values
 * @param newValues - New settings values
 * @param redactedFields - Fields to redact (e.g., encrypted credentials)
 * @returns Array of { field, old_value, new_value } for changed fields only
 */
export function computeSettingsDiff(
  _group: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  redactedFields: string[] = []
): AuditDiffEntry[] {
  const redactedSet = new Set(redactedFields)
  const diff: AuditDiffEntry[] = []

  // Get all unique keys from both objects
  const allKeys = new Set([
    ...Object.keys(oldValues),
    ...Object.keys(newValues),
  ])

  for (const key of allKeys) {
    const oldVal = oldValues[key]
    const newVal = newValues[key]

    // Skip if values are equal
    if (deepEqual(oldVal, newVal)) {
      continue
    }

    // Redact sensitive fields
    if (redactedSet.has(key)) {
      diff.push({
        field: key,
        old_value:
          oldVal !== undefined && oldVal !== null ? '[REDACTED]' : null,
        new_value:
          newVal !== undefined && newVal !== null ? '[REDACTED]' : null,
      })
    } else {
      diff.push({
        field: key,
        old_value: oldVal !== undefined ? oldVal : null,
        new_value: newVal !== undefined ? newVal : null,
      })
    }
  }

  return diff
}

/** Deep equality check for values (including arrays and nested objects) */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a === undefined || b === undefined) return false
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((val, i) => deepEqual(val, b[i]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const aKeys = Object.keys(aObj)
    const bKeys = Object.keys(bObj)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]))
  }

  return false
}

// ---------------------------------------------------------------------------
// T011: Get Workspace Settings
// ---------------------------------------------------------------------------

/**
 * Retrieve workspace settings with defaults applied for missing optional fields.
 * Payment credentials are stripped — replaced with has_api_key/has_secret_key booleans.
 *
 * @throws SettingsNotFoundError if no settings row exists
 */
export async function getWorkspaceSettings(
  ctx: SettingsRequestContext
): Promise<WorkspaceSettingsResponse> {
  const row = await repository.getSettings(ctx.db)

  if (!row) {
    throw new SettingsNotFoundError()
  }

  logger.info('Workspace settings retrieved', {
    workspace_slug: ctx.workspace_slug,
    correlation_id: ctx.correlation_id,
    config_version: row.config_version,
  })

  // Apply defaults for missing optional fields
  const generalSettings: GeneralSettings = {
    ...row.general_settings,
    session_timeout_minutes:
      row.general_settings.session_timeout_minutes ??
      GENERAL_DEFAULTS.session_timeout_minutes,
  }

  // Validate critical fields
  if (!generalSettings.timezone || !generalSettings.date_format) {
    throw new SettingsValidationError(
      'Critical settings fields (timezone, date_format) are missing or corrupted.',
      {
        timezone: generalSettings.timezone ?? null,
        date_format: generalSettings.date_format ?? null,
      }
    )
  }

  const securitySettings: SecuritySettings = {
    ...row.security_settings,
    analytics_opt_in:
      row.security_settings.analytics_opt_in ??
      SECURITY_DEFAULTS.analytics_opt_in,
    max_login_attempts:
      row.security_settings.max_login_attempts ??
      SECURITY_DEFAULTS.max_login_attempts,
    lockout_duration_minutes:
      row.security_settings.lockout_duration_minutes ??
      SECURITY_DEFAULTS.lockout_duration_minutes,
  }

  // Strip payment credentials — replace with boolean sentinels
  const paymentResponse: PaymentSettingsResponse = {
    use_custom_payment_gateway:
      row.payment_settings.use_custom_payment_gateway ?? false,
    gateway_provider: row.payment_settings.gateway_provider ?? null,
    has_api_key: !!(
      row.payment_settings.encrypted_api_key &&
      row.payment_settings.encrypted_api_key.length > 0
    ),
    has_secret_key: !!(
      row.payment_settings.encrypted_secret_key &&
      row.payment_settings.encrypted_secret_key.length > 0
    ),
  }

  return {
    config_version: row.config_version,
    general_settings: generalSettings,
    language_settings: row.language_settings,
    branding_settings: row.branding_settings,
    payment_settings: paymentResponse,
    security_settings: securitySettings,
    updated_at:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  }
}

// ---------------------------------------------------------------------------
// T017: Update Settings Group
// ---------------------------------------------------------------------------

/**
 * Update a specific settings group with optimistic locking and audit trail.
 *
 * For payment group: applies sentinel pattern (omit→keep, null→clear, string→encrypt).
 * All operations within database transaction.
 *
 * @throws SettingsValidationError if input validation fails
 * @throws SettingsVersionConflictError if config_version mismatch
 * @throws EncryptionServiceUnavailableError if encryption fails for payment group
 */
export async function updateSettingsGroup(
  ctx: SettingsRequestContext,
  group: SettingsGroup,
  settings: Record<string, unknown>,
  configVersion: number
): Promise<UpdateSettingsResult> {
  // Validate input against appropriate Zod schema
  const schema = SETTINGS_SCHEMA_MAP[group]
  if (!schema) {
    throw new SettingsValidationError(`Unknown settings group: ${group}`)
  }

  const parseResult = schema.safeParse(settings)
  if (!parseResult.success) {
    const issues = parseResult.error?.issues ?? []
    const fieldErrors = issues
      .map(
        (issue: { path: (string | number)[]; message: string }) =>
          `${issue.path.join('.')}: ${issue.message}`
      )
      .join('; ')
    throw new SettingsValidationError(`Validation failed: ${fieldErrors}`, {
      issues: issues.map(
        (i: { path: (string | number)[]; message: string }) => ({
          path: i.path,
          message: i.message,
        })
      ),
    })
  }

  const validatedSettings = parseResult.data as Record<string, unknown>

  // Process within transaction
  await ctx.db.query('BEGIN')

  try {
    // Load current settings within transaction for diff computation
    const currentRow = await repository.getSettings(ctx.db)
    const currentGroupSettings = currentRow
      ? ((currentRow as any)[`${group}_settings`] as Record<string, unknown>)
      : {}

    // For payment group: apply sentinel pattern and encrypt credentials
    let dataToStore = { ...validatedSettings }
    if (group === 'payment') {
      dataToStore = processPaymentSettings(
        validatedSettings as unknown as PaymentSettingsInput,
        (currentGroupSettings || {}) as unknown as PaymentSettings
      )
    }

    // Compute diff with credential redaction
    const redactedFields =
      group === 'payment' ? Array.from(PAYMENT_REDACTED_FIELDS) : []
    const diff = computeSettingsDiff(
      group,
      currentGroupSettings || {},
      dataToStore,
      redactedFields
    )

    // Upsert with optimistic locking
    const { config_version: newVersion } = await repository.upsertSettings(
      ctx.db,
      group,
      dataToStore,
      configVersion
    )

    // Insert audit entry within same transaction
    if (diff.length > 0) {
      await repository.insertAuditEntry(ctx.db, {
        workspace_id: ctx.workspace_id,
        user_id: ctx.user_id,
        settings_group: group,
        config_version: newVersion,
        changes: diff,
        request_id: ctx.correlation_id,
        ip_address: ctx.ip_address,
        user_agent: ctx.user_agent,
      })
    }

    await ctx.db.query('COMMIT')

    logger.info('Workspace settings updated', {
      workspace_slug: ctx.workspace_slug,
      correlation_id: ctx.correlation_id,
      settings_group: group,
      config_version: newVersion,
    })

    return {
      config_version: newVersion,
      updated_group: group,
      updated_at: new Date().toISOString(),
    }
  } catch (err) {
    await ctx.db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// Payment Credential Processing
// ---------------------------------------------------------------------------

/**
 * Process payment settings with sentinel pattern (CL-003):
 * - Omit api_key/secret_key → keep existing encrypted value
 * - Send null → clear credential
 * - Send new string → encrypt and replace
 */
function processPaymentSettings(
  input: PaymentSettingsInput,
  current: PaymentSettings
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    use_custom_payment_gateway: input.use_custom_payment_gateway,
    gateway_provider:
      input.gateway_provider ?? current.gateway_provider ?? null,
  }

  // api_key sentinel processing
  if (input.api_key === undefined) {
    // Omitted → keep existing
    result.encrypted_api_key = current.encrypted_api_key ?? null
  } else if (input.api_key === null) {
    // Null → clear
    result.encrypted_api_key = null
  } else {
    // String → encrypt
    result.encrypted_api_key = encrypt(input.api_key)
  }

  // secret_key sentinel processing
  if (input.secret_key === undefined) {
    // Omitted → keep existing
    result.encrypted_secret_key = current.encrypted_secret_key ?? null
  } else if (input.secret_key === null) {
    // Null → clear
    result.encrypted_secret_key = null
  } else {
    // String → encrypt
    result.encrypted_secret_key = encrypt(input.secret_key)
  }

  return result
}

// ---------------------------------------------------------------------------
// T024: Get Settings Audit
// ---------------------------------------------------------------------------

/**
 * Retrieve paginated audit entries with optional group filter.
 */
export async function getSettingsAudit(
  ctx: SettingsRequestContext,
  filters: { group?: string; limit?: number; cursor?: string }
): Promise<PaginatedAuditResult> {
  // Validate query params
  const parseResult = auditQuerySchema.safeParse({
    group: filters.group || undefined,
    limit: filters.limit ? Number(filters.limit) : undefined,
    cursor: filters.cursor || undefined,
  })

  if (!parseResult.success) {
    throw new SettingsValidationError('Invalid audit query parameters', {
      issues: parseResult.error.issues.map(
        (i: { path: (string | number)[]; message: string }) => ({
          path: i.path,
          message: i.message,
        })
      ),
    })
  }

  const validatedFilters: AuditQueryFilters = {
    group: parseResult.data.group as SettingsGroup | undefined,
    limit: parseResult.data.limit,
    cursor: parseResult.data.cursor,
  }

  logger.info('Audit trail queried', {
    workspace_slug: ctx.workspace_slug,
    correlation_id: ctx.correlation_id,
    group: validatedFilters.group ?? 'all',
    limit: validatedFilters.limit,
  })

  return repository.getAuditEntries(ctx.db, ctx.workspace_id, validatedFilters)
}

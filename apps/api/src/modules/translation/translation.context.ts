/**
 * Translation Routes — Context Builder Utilities
 *
 * File: apps/api/src/modules/translation/translation.context.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Shared helper for building TranslationOperationContext from Hono context.
 * Reads workspace language settings (including internal language_status)
 * from workspace_settings table.
 */

import type { TranslationOperationContext } from '@zidney/domain-core'
import type { Context } from 'hono'
import { languageSettingsInternalSchema } from '../workspace-settings/workspace-settings.validation'

function getDefaultLanguageSettings() {
  return {
    default_language: 'en',
    supported_languages: ['en'],
    language_status: {},
  }
}

interface DbClient {
  query: <T = unknown>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>
}

/**
 * Build a TranslationOperationContext from the Hono request context.
 * Reads language settings from workspace_settings to populate
 * default_language, supported_languages, and language_status.
 *
 * Throws if settings row does not exist or is malformed.
 */
export async function buildTranslationContext(
  c: Context
): Promise<{ ctx: TranslationOperationContext; db: DbClient }> {
  const tenant = c.get('tenant')
  const staffUser = c.get('staff_user')
  const correlationId = c.get('correlationId') ?? 'unknown'
  const db: DbClient = tenant.pool

  // Fetch language settings from DB
  const settingsResult = await db.query<{
    language_settings: unknown
  }>(`SELECT language_settings FROM workspace_settings WHERE singleton_key = 'SETTINGS' LIMIT 1`)

  const rawSettings = settingsResult.rows[0]?.language_settings ?? getDefaultLanguageSettings()

  // Parse internal schema (includes language_status). If parsing fails, throw a clear error
  let parsed
  try {
    parsed = languageSettingsInternalSchema.parse(rawSettings)
  } catch (err) {
    throw new Error(`Invalid workspace language settings: ${(err as Error).message}`)
  }

  const ctx: TranslationOperationContext = {
    workspace_id: tenant.id,
    workspace_slug: tenant.slug,
    user_id: staffUser?.user_id ?? 'unknown',
    correlation_id: correlationId,
    default_language: parsed.default_language,
    supported_languages: parsed.supported_languages,
    language_status: parsed.language_status,
  }

  return { ctx, db }
}

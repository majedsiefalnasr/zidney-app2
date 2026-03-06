/**
 * Translation System — Domain Service
 *
 * File: packages/domain-core/src/translation/translation.service.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Stateless domain service functions for all translation operations.
 * Pure business logic — no HTTP routing, no framework dependencies.
 *
 * All DB access via injected DbClient (tenant pool from request/job context).
 * No module-level pool instantiation.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure domain functions
 * ✓ All DB access via injected db parameter (tenant pool from resolver context)
 * ✓ All writes transactional (caller opens/commits, or service opens own transaction)
 * ✓ Audit log inserted in same transaction as translation upsert (SC-004)
 * ✓ Structured logging via @zidney/logger — console.log forbidden
 * ✓ translated_value NEVER in logs
 * ✓ Server-authoritative timestamps (NOW() at DB level)
 * ✓ No cross-tenant joins
 */

import { createLogger } from '@zidney/logger'

import { isTranslatableEntityType, TRANSLATABLE_FIELDS } from './translatable-fields'
import { TRANSLATION_ERROR_CODES, TranslationError } from './translation.errors'
import type {
  ResolvedEntityTranslations,
  Translation,
  TranslationAuditEntry,
  TranslationOperationContext,
  TranslationUpsert,
} from './translation.types'

const logger = createLogger('translation-service')

// ---------------------------------------------------------------------------
// DB Client interface (matches pg PoolClient or Pool)
// ---------------------------------------------------------------------------

interface DbClient {
  query: <T = any>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// Entity Validator callback
// ---------------------------------------------------------------------------

/**
 * Injected callback — called by the service to verify entity existence.
 * Returns true if the entity exists in the tenant DB, false otherwise.
 * The API layer provides this to avoid cross-layer DB coupling.
 */
export type EntityValidator = (
  db: DbClient,
  entityType: string,
  entityId: string
) => Promise<boolean>

// ---------------------------------------------------------------------------
// T007: upsertTranslations
// ---------------------------------------------------------------------------

/**
 * Upsert one or more translations within a single atomic transaction.
 *
 * Validation order (all performed before any DB write):
 * 1. entity_type must be in TRANSLATABLE_FIELDS
 * 2. language_code must be in supported_languages
 * 3. language_code must NOT be the default_language
 * 4. language_status must NOT be 'removing' for this language_code
 * 5. field_name must be in TRANSLATABLE_FIELDS[entity_type]
 * 6. entity must exist (entityValidator callback)
 *
 * Transaction: all upserts + all audit inserts in one BEGIN/COMMIT block.
 *
 * @param db - Tenant DB client (from request context)
 * @param ctx - Workspace + request context
 * @param items - Array of upsert inputs (max 50 enforced at API layer)
 * @param entityValidator - Async callback to verify entity existence
 * @returns Array of saved Translation rows
 * @throws TranslationError for any validation failure
 */
export async function upsertTranslations(
  db: DbClient,
  ctx: TranslationOperationContext,
  items: TranslationUpsert[],
  entityValidator: EntityValidator
): Promise<Translation[]> {
  // -------------------------------------------------------------------------
  // Phase 1: Full validation BEFORE any DB writes (FR-029: fail all or save all)
  // -------------------------------------------------------------------------

  for (const item of items) {
    // 1. Entity type validation
    if (!isTranslatableEntityType(item.entity_type)) {
      throw new TranslationError(
        TRANSLATION_ERROR_CODES.UNKNOWN_ENTITY_TYPE,
        `Entity type '${item.entity_type}' is not registered in TRANSLATABLE_FIELDS.`
      )
    }

    // 2. Language code in supported_languages
    if (!ctx.supported_languages.includes(item.language_code)) {
      throw new TranslationError(
        TRANSLATION_ERROR_CODES.UNSUPPORTED_LANGUAGE,
        `Language '${item.language_code}' is not in the workspace supported languages.`
      )
    }

    // 3. Must not be default language
    if (item.language_code === ctx.default_language) {
      throw new TranslationError(
        TRANSLATION_ERROR_CODES.DEFAULT_LANGUAGE_WRITE,
        `Translations for the default language '${item.language_code}' must not be stored in the translations table.`
      )
    }

    // 4. Language must not be in 'removing' status
    if (ctx.language_status?.[item.language_code] === 'removing') {
      throw new TranslationError(
        TRANSLATION_ERROR_CODES.UNSUPPORTED_LANGUAGE,
        `Language '${item.language_code}' is currently being removed and cannot accept new translations.`
      )
    }

    // 5. Field name validation
    const validFields = TRANSLATABLE_FIELDS[
      item.entity_type as keyof typeof TRANSLATABLE_FIELDS
    ] as readonly string[]
    if (!validFields.includes(item.field_name)) {
      throw new TranslationError(
        TRANSLATION_ERROR_CODES.INVALID_FIELD_NAME,
        `Field '${item.field_name}' is not translatable for entity type '${item.entity_type}'.`
      )
    }
  }

  // 6. Entity existence validation (one check per distinct entity_type+entity_id pair)
  const uniqueEntities = [
    ...new Map(items.map((i) => [`${i.entity_type}:${i.entity_id}`, i])).values(),
  ]

  for (const item of uniqueEntities) {
    const exists = await entityValidator(db, item.entity_type, item.entity_id)
    if (!exists) {
      throw new TranslationError(
        TRANSLATION_ERROR_CODES.ENTITY_NOT_FOUND,
        `Entity '${item.entity_type}' with ID '${item.entity_id}' was not found.`
      )
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Write within a single transaction (FR-029)
  // -------------------------------------------------------------------------

  await db.query('BEGIN')

  try {
    const saved: Translation[] = []

    for (const item of items) {
      // Fetch previous value for audit (before upsert)
      const prevResult = await db.query<{ translated_value: string }>(
        `SELECT translated_value FROM translations
         WHERE entity_type = $1 AND entity_id = $2 AND field_name = $3 AND language_code = $4`,
        [item.entity_type, item.entity_id, item.field_name, item.language_code]
      )
      const previousValue = prevResult.rows[0]?.translated_value ?? null
      const action: 'created' | 'updated' = previousValue !== null ? 'updated' : 'created'

      // Upsert via composite unique constraint (Q4: HTTP 200 for both create/update)
      const upsertResult = await db.query<Translation>(
        `INSERT INTO translations (entity_type, entity_id, field_name, language_code, translated_value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ON CONSTRAINT translations_composite_unique
         DO UPDATE SET
           translated_value = EXCLUDED.translated_value,
           updated_at = NOW()
         RETURNING id, entity_type, entity_id, field_name, language_code,
                   translated_value, created_at, updated_at`,
        [
          item.entity_type,
          item.entity_id,
          item.field_name,
          item.language_code,
          item.translated_value,
        ]
      )

      const row = upsertResult.rows[0]
      if (!row) {
        throw new Error(
          `Upsert returned no row for ${item.entity_type}/${item.entity_id}/${item.field_name}/${item.language_code}`
        )
      }
      saved.push(row)

      // Insert audit log in same transaction (SC-004)
      await db.query(
        `INSERT INTO translation_audit_logs
           (workspace_id, entity_type, entity_id, field_name, language_code,
            action, previous_value, new_value, user_id, correlation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          ctx.workspace_id,
          item.entity_type,
          item.entity_id,
          item.field_name,
          item.language_code,
          action,
          previousValue,
          item.translated_value,
          ctx.user_id,
          ctx.correlation_id,
        ]
      )
    }

    await db.query('COMMIT')

    logger.info({
      event: 'translations_upserted',
      workspace_slug: ctx.workspace_slug,
      workspace_id: ctx.workspace_id,
      user_id: ctx.user_id,
      correlation_id: ctx.correlation_id,
      count: saved.length,
    })

    return saved
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// T007: resolveEntityTranslations
// ---------------------------------------------------------------------------

/**
 * Resolve all translatable fields for an entity in a given language with fallback.
 *
 * FR-007: If language_code === default_language → return base entity fields directly (no DB call).
 * FR-011: Translation absent → fall back to base entity value.
 * FR-012: Both translation and base value absent → return '' with warning log.
 *
 * @param db - Tenant DB client
 * @param ctx - Workspace context
 * @param entityType - Entity type
 * @param entityId - Entity UUID
 * @param languageCode - Requested language code
 * @param baseEntityFields - Base entity field values (from primary entity table) for fallback
 * @returns Resolved fields with fallback_fields list
 */
export async function resolveEntityTranslations(
  db: DbClient,
  ctx: TranslationOperationContext,
  entityType: string,
  entityId: string,
  languageCode: string,
  baseEntityFields: Record<string, string>
): Promise<ResolvedEntityTranslations> {
  const translatableFields = TRANSLATABLE_FIELDS[entityType as keyof typeof TRANSLATABLE_FIELDS]

  // FR-007: Default language short-circuit — return base fields without DB call
  if (languageCode === ctx.default_language) {
    const fields: Record<string, string> = {}
    for (const field of translatableFields) {
      fields[field] = baseEntityFields[field] ?? ''
    }
    return {
      entity_type: entityType,
      entity_id: entityId,
      language_code: languageCode,
      fields,
      fallback_fields: [],
    }
  }

  // Fetch all translation rows for this entity+language in one query
  const result = await db.query<{
    field_name: string
    translated_value: string
  }>(
    `SELECT field_name, translated_value
     FROM translations
     WHERE entity_type = $1 AND entity_id = $2 AND language_code = $3`,
    [entityType, entityId, languageCode]
  )

  const translationMap = new Map<string, string>()
  for (const row of result.rows) {
    translationMap.set(row.field_name, row.translated_value)
  }

  const fields: Record<string, string> = {}
  const fallback_fields: string[] = []

  for (const field of translatableFields) {
    if (translationMap.has(field)) {
      // Translation exists
      fields[field] = translationMap.get(field)!
    } else if (baseEntityFields[field] !== undefined) {
      // FR-011: Fall back to base entity value
      fields[field] = baseEntityFields[field]!
      fallback_fields.push(field)
    } else {
      // FR-012: Both absent — return '' + emit warning
      fields[field] = ''
      fallback_fields.push(field)
      logger.warn({
        event: 'translation_fallback_missing_default',
        workspace_slug: ctx.workspace_slug,
        workspace_id: ctx.workspace_id,
        correlation_id: ctx.correlation_id,
        entity_type: entityType,
        entity_id: entityId,
        field_name: field,
        language_code: languageCode,
      })
    }
  }

  return {
    entity_type: entityType,
    entity_id: entityId,
    language_code: languageCode,
    fields,
    fallback_fields,
  }
}

// ---------------------------------------------------------------------------
// T007: batchLoadTranslations
// ---------------------------------------------------------------------------

/**
 * Load all translations for multiple entities of the same type in a single query.
 * Prevents N+1 patterns (FR-037).
 *
 * @param db - Tenant DB client
 * @param entityType - Entity type (all IDs must be this type)
 * @param entityIds - Array of entity UUIDs (max 100)
 * @param languageCode - Target language code
 * @returns Map of entity_id → (field_name → translated_value)
 */
export async function batchLoadTranslations(
  db: DbClient,
  entityType: string,
  entityIds: string[],
  languageCode: string
): Promise<Map<string, Map<string, string>>> {
  if (entityIds.length === 0) {
    return new Map()
  }

  // Build parameterized ANY() array for entity IDs
  const placeholders = entityIds.map((_, i) => `$${i + 3}`).join(', ')

  const result = await db.query<{
    entity_id: string
    field_name: string
    translated_value: string
  }>(
    `SELECT entity_id, field_name, translated_value
     FROM translations
     WHERE entity_type = $1
       AND language_code = $2
       AND entity_id IN (${placeholders})`,
    [entityType, languageCode, ...entityIds]
  )

  const resultMap = new Map<string, Map<string, string>>()
  for (const row of result.rows) {
    if (!resultMap.has(row.entity_id)) {
      resultMap.set(row.entity_id, new Map())
    }
    resultMap.get(row.entity_id)!.set(row.field_name, row.translated_value)
  }

  return resultMap
}

// ---------------------------------------------------------------------------
// T007: listEntityTranslations
// ---------------------------------------------------------------------------

export interface ListTranslationsOptions {
  entityType: string
  entityId: string
  cursor?: string // Last seen translation id (keyset pagination)
  pageSize?: number // Default 20, max 50
}

export interface ListTranslationsResult {
  items: Translation[]
  next_cursor: string | null
  page_size: number
}

/**
 * List translation rows for an entity (management panel / Mode B).
 * Cursor-based keyset pagination anchored on id ASC.
 *
 * @param db - Tenant DB client
 * @param options - Pagination options
 * @returns Paginated list with next_cursor
 */
export async function listEntityTranslations(
  db: DbClient,
  options: ListTranslationsOptions
): Promise<ListTranslationsResult> {
  const pageSize = Math.min(options.pageSize ?? 20, 50)
  const fetchLimit = pageSize + 1 // Fetch one extra to detect next page

  let result: { rows: Translation[] }

  if (options.cursor) {
    result = await db.query<Translation>(
      `SELECT id, entity_type, entity_id, field_name, language_code,
              translated_value, created_at, updated_at
       FROM translations
       WHERE entity_type = $1
         AND entity_id = $2
         AND id > $3
       ORDER BY id ASC
       LIMIT $4`,
      [options.entityType, options.entityId, options.cursor, fetchLimit]
    )
  } else {
    result = await db.query<Translation>(
      `SELECT id, entity_type, entity_id, field_name, language_code,
              translated_value, created_at, updated_at
       FROM translations
       WHERE entity_type = $1
         AND entity_id = $2
       ORDER BY id ASC
       LIMIT $3`,
      [options.entityType, options.entityId, fetchLimit]
    )
  }

  const hasMore = result.rows.length > pageSize
  const items = hasMore ? result.rows.slice(0, pageSize) : result.rows
  const next_cursor = hasMore && items.length > 0 ? (items[items.length - 1]?.id ?? null) : null

  return { items, next_cursor, page_size: pageSize }
}

// ---------------------------------------------------------------------------
// T007: deleteEntityTranslations
// ---------------------------------------------------------------------------

/**
 * Delete all translation rows for an entity (entity cleanup on deletion).
 * Caller MUST have opened a transaction — this function does NOT commit.
 *
 * @param db - Tenant DB client (within an open transaction)
 * @param ctx - Context for audit logging
 * @param entityType - Entity type
 * @param entityId - Entity UUID to delete translations for
 * @returns Number of rows deleted
 */
export async function deleteEntityTranslations(
  db: DbClient,
  ctx: TranslationOperationContext,
  entityType: string,
  entityId: string
): Promise<number> {
  const result = await db.query<{
    id: string
    field_name: string
    language_code: string
    translated_value: string
  }>(
    `DELETE FROM translations
     WHERE entity_type = $1 AND entity_id = $2
     RETURNING id, field_name, language_code, translated_value`,
    [entityType, entityId]
  )

  const deletedRows = result.rows

  // Insert audit entries for each deleted translation (FR-031)
  for (const row of deletedRows) {
    await db.query(
      `INSERT INTO translation_audit_logs
         (workspace_id, entity_type, entity_id, field_name, language_code,
          action, previous_value, new_value, user_id, correlation_id)
       VALUES ($1, $2, $3, $4, $5, 'deleted', $6, NULL, $7, $8)`,
      [
        ctx.workspace_id,
        entityType,
        entityId,
        row.field_name,
        row.language_code,
        row.translated_value,
        ctx.user_id,
        ctx.correlation_id,
      ]
    )
  }

  return deletedRows.length
}

// ---------------------------------------------------------------------------
// T007: deleteLanguageTranslations (sync path — caller's transaction)
// ---------------------------------------------------------------------------

export interface DeletedTranslationRow {
  id: string
  entity_type: string
  entity_id: string
  field_name: string
  language_code: string
  translated_value: string
}

/**
 * Synchronous language removal — delete all translations for a language code.
 * Called only when count ≤ 10,000 (sync threshold per T018).
 * Caller MUST have opened a transaction — this function does NOT commit.
 *
 * Inserts audit entries for each deleted row (FR-035, reason='language_removed').
 *
 * @param db - Tenant DB client (within an open transaction)
 * @param ctx - Context for audit logging
 * @param languageCode - Language code to remove
 * @returns Array of deleted rows (for audit and return value)
 */
export async function deleteLanguageTranslations(
  db: DbClient,
  ctx: TranslationOperationContext,
  languageCode: string
): Promise<DeletedTranslationRow[]> {
  const result = await db.query<DeletedTranslationRow>(
    `DELETE FROM translations
     WHERE language_code = $1
     RETURNING id, entity_type, entity_id, field_name, language_code, translated_value`,
    [languageCode]
  )

  const deletedRows = result.rows

  // Insert audit entries in same transaction (FR-035)
  for (const row of deletedRows) {
    await db.query(
      `INSERT INTO translation_audit_logs
         (workspace_id, entity_type, entity_id, field_name, language_code,
          action, previous_value, new_value, user_id, correlation_id, reason)
       VALUES ($1, $2, $3, $4, $5, 'deleted', $6, NULL, $7, $8, 'language_removed')`,
      [
        ctx.workspace_id,
        row.entity_type,
        row.entity_id,
        row.field_name,
        row.language_code,
        row.translated_value,
        ctx.user_id,
        ctx.correlation_id,
      ]
    )
  }

  logger.info({
    event: 'language_translations_deleted_sync',
    workspace_slug: ctx.workspace_slug,
    workspace_id: ctx.workspace_id,
    user_id: ctx.user_id,
    correlation_id: ctx.correlation_id,
    language_code: languageCode,
    deleted_count: deletedRows.length,
  })

  return deletedRows
}

// ---------------------------------------------------------------------------
// Audit log query (for testing / diagnostic purposes)
// ---------------------------------------------------------------------------

/**
 * Fetch audit log entries for an entity (test helper + future API use).
 */
export async function getEntityAuditLog(
  db: DbClient,
  workspaceId: string,
  entityType: string,
  entityId: string,
  limit = 50
): Promise<TranslationAuditEntry[]> {
  const result = await db.query<TranslationAuditEntry>(
    `SELECT id, workspace_id, entity_type, entity_id, field_name, language_code,
            action, previous_value, new_value, user_id, correlation_id, reason, created_at
     FROM translation_audit_logs
     WHERE workspace_id = $1
       AND entity_type = $2
       AND entity_id = $3
     ORDER BY created_at ASC, id ASC
     LIMIT $4`,
    [workspaceId, entityType, entityId, limit]
  )

  return result.rows
}

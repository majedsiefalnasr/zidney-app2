/**
 * Translation — Data Access Layer (Repository)
 *
 * File: apps/api/src/modules/translation/translation.repository.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Database operations for the translation system.
 * All DB access uses the tenant pool from request/job context.
 * No module-level pool instantiation. No direct DB instantiation.
 *
 * Constitutional Compliance:
 * ✓ All DB access through tenant pool from request context (injected db)
 * ✓ No direct DB instantiation
 * ✓ No cross-tenant joins
 * ✓ Transactions managed by caller (service layer)
 * ✓ translated_value NEVER in logs
 * ✓ Keyset pagination on id ASC (P-M1: sortable, indexed)
 */

import type { Translation, TranslationAuditEntry } from '@zidney/domain-core'

// ---------------------------------------------------------------------------
// DB Client interface — matches pg PoolClient or Pool
// ---------------------------------------------------------------------------

interface DbClient {
  query: <T = any>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// Upsert single translation row
// ---------------------------------------------------------------------------

/**
 * Insert or update a single translation row.
 * Uses ON CONFLICT ON CONSTRAINT translations_composite_unique.
 * Returns the saved translation row.
 *
 * Caller is responsible for opening and committing a transaction.
 */
export async function insertOrUpdateTranslation(
  db: DbClient,
  entityType: string,
  entityId: string,
  fieldName: string,
  languageCode: string,
  translatedValue: string
): Promise<Translation> {
  const result = await db.query<Translation>(
    `INSERT INTO translations (entity_type, entity_id, field_name, language_code, translated_value)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ON CONSTRAINT translations_composite_unique
     DO UPDATE SET
       translated_value = EXCLUDED.translated_value,
       updated_at = NOW()
     RETURNING id, entity_type, entity_id, field_name, language_code,
               translated_value, created_at, updated_at`,
    [entityType, entityId, fieldName, languageCode, translatedValue]
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error(
      `Upsert returned no row for ${entityType}/${entityId}/${fieldName}/${languageCode}`
    )
  }
  return row
}

// ---------------------------------------------------------------------------
// Get existing translation value (for audit previous_value)
// ---------------------------------------------------------------------------

/**
 * Fetch the current translated_value for a specific translation key.
 * Returns null if no row exists.
 */
export async function getExistingTranslation(
  db: DbClient,
  entityType: string,
  entityId: string,
  fieldName: string,
  languageCode: string
): Promise<string | null> {
  const result = await db.query<{ translated_value: string }>(
    `SELECT translated_value FROM translations
     WHERE entity_type = $1 AND entity_id = $2 AND field_name = $3 AND language_code = $4`,
    [entityType, entityId, fieldName, languageCode]
  )
  return result.rows[0]?.translated_value ?? null
}

// ---------------------------------------------------------------------------
// Insert single audit log entry
// ---------------------------------------------------------------------------

/**
 * Insert one translation audit log entry.
 * All parameters except reason are mandatory.
 * Caller is responsible for transaction management.
 */
export async function insertAuditLogEntry(
  db: DbClient,
  workspaceId: string,
  entityType: string,
  entityId: string,
  fieldName: string,
  languageCode: string,
  action: 'created' | 'updated' | 'deleted',
  previousValue: string | null,
  newValue: string | null,
  userId: string,
  correlationId: string,
  reason?: string
): Promise<void> {
  await db.query(
    `INSERT INTO translation_audit_logs
       (workspace_id, entity_type, entity_id, field_name, language_code,
        action, previous_value, new_value, user_id, correlation_id, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      workspaceId,
      entityType,
      entityId,
      fieldName,
      languageCode,
      action,
      previousValue,
      newValue,
      userId,
      correlationId,
      reason ?? null,
    ]
  )
}

// ---------------------------------------------------------------------------
// Insert batch of audit log entries (worker DRAIN job)
// ---------------------------------------------------------------------------

/**
 * Insert multiple audit log entries for the worker DRAIN batch.
 * All entries share the same action='deleted' and reason='language_removed'.
 *
 * Uses row-valued INSERT to avoid N round-trips.
 * Caller is responsible for transaction management.
 *
 * @param entries - Array of deleted translation rows
 * @param workspaceId - Workspace ID for all entries
 * @param userId - Actor user ID
 * @param correlationId - Correlation ID / job ID
 */
export async function insertAuditLogBatch(
  db: DbClient,
  entries: Array<{
    entity_type: string
    entity_id: string
    field_name: string
    language_code: string
    previous_value: string
  }>,
  workspaceId: string,
  userId: string,
  correlationId: string
): Promise<void> {
  if (entries.length === 0) {
    return
  }

  // Build multi-row VALUES clause
  const valuePlaceholders: string[] = []
  const params: unknown[] = []
  let paramIdx = 1

  for (const entry of entries) {
    valuePlaceholders.push(
      `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, 'deleted', $${paramIdx++}, NULL, $${paramIdx++}, $${paramIdx++}, 'language_removed')`
    )
    params.push(
      workspaceId,
      entry.entity_type,
      entry.entity_id,
      entry.field_name,
      entry.language_code,
      entry.previous_value,
      userId,
      correlationId
    )
  }

  await db.query(
    `INSERT INTO translation_audit_logs
       (workspace_id, entity_type, entity_id, field_name, language_code,
        action, previous_value, new_value, user_id, correlation_id, reason)
     VALUES ${valuePlaceholders.join(', ')}`,
    params
  )
}

// ---------------------------------------------------------------------------
// List entity translations (cursor-paginated id ASC)
// ---------------------------------------------------------------------------

/**
 * List translation rows for an entity with keyset pagination on id ASC.
 *
 * @param cursor - Last seen id (exclusive lower bound). Null = first page.
 * @param fetchLimit - Number of rows to fetch (pageSize + 1 to detect next page)
 */
export async function listTranslationRows(
  db: DbClient,
  entityType: string,
  entityId: string,
  cursor: string | null,
  fetchLimit: number
): Promise<Translation[]> {
  if (cursor !== null) {
    const result = await db.query<Translation>(
      `SELECT id, entity_type, entity_id, field_name, language_code,
              translated_value, created_at, updated_at
       FROM translations
       WHERE entity_type = $1
         AND entity_id = $2
         AND id > $3
       ORDER BY id ASC
       LIMIT $4`,
      [entityType, entityId, cursor, fetchLimit]
    )
    return result.rows
  }

  const result = await db.query<Translation>(
    `SELECT id, entity_type, entity_id, field_name, language_code,
            translated_value, created_at, updated_at
     FROM translations
     WHERE entity_type = $1
       AND entity_id = $2
     ORDER BY id ASC
     LIMIT $3`,
    [entityType, entityId, fetchLimit]
  )
  return result.rows
}

// ---------------------------------------------------------------------------
// Query all translations for a single entity and language
// ---------------------------------------------------------------------------

/**
 * Fetch all translations for an entity in a given language.
 * Used by resolveEntityTranslations.
 */
export async function queryTranslationsForEntity(
  db: DbClient,
  entityType: string,
  entityId: string,
  languageCode: string
): Promise<Array<{ field_name: string; translated_value: string }>> {
  const result = await db.query<{
    field_name: string
    translated_value: string
  }>(
    `SELECT field_name, translated_value
     FROM translations
     WHERE entity_type = $1 AND entity_id = $2 AND language_code = $3`,
    [entityType, entityId, languageCode]
  )
  return result.rows
}

// ---------------------------------------------------------------------------
// Batch load translations (FR-037 — prevent N+1)
// ---------------------------------------------------------------------------

/**
 * Load translations for multiple entities in one query.
 * Returns flat rows; caller groups them by entity_id.
 */
export async function queryTranslationsBatch(
  db: DbClient,
  entityType: string,
  entityIds: string[],
  languageCode: string
): Promise<Array<{ entity_id: string; field_name: string; translated_value: string }>> {
  if (entityIds.length === 0) return []

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
  return result.rows
}

// ---------------------------------------------------------------------------
// Count translations for a language (threshold check for T018)
// ---------------------------------------------------------------------------

/**
 * Count total translation rows for a language code.
 * Used by workspace-settings service to decide sync vs async removal.
 * Threshold: 10,000 rows → sync; > 10,000 → async DRAIN job.
 */
export async function countTranslationsForLanguage(
  db: DbClient,
  languageCode: string
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM translations WHERE language_code = $1`,
    [languageCode]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

// ---------------------------------------------------------------------------
// Delete translations for a language (sync path — worker uses scan+delete)
// ---------------------------------------------------------------------------

/**
 * Delete all translations for a language code and return the deleted rows.
 * Used in the sync removal path (≤10,000 rows).
 * Caller MUST have opened a transaction.
 */
export async function deleteTranslationsByLanguage(
  db: DbClient,
  languageCode: string
): Promise<
  Array<{
    id: string
    entity_type: string
    entity_id: string
    field_name: string
    language_code: string
    translated_value: string
  }>
> {
  const result = await db.query<{
    id: string
    entity_type: string
    entity_id: string
    field_name: string
    language_code: string
    translated_value: string
  }>(
    `DELETE FROM translations WHERE language_code = $1
     RETURNING id, entity_type, entity_id, field_name, language_code, translated_value`,
    [languageCode]
  )
  return result.rows
}

// ---------------------------------------------------------------------------
// Coverage aggregation (DB side)
// ---------------------------------------------------------------------------

/**
 * Compute coverage statistics from DB.
 * Used by CoverageService when cache is cold.
 */
export async function aggregateCoverage(
  db: DbClient,
  entityType: string,
  languageCode: string
): Promise<{ total_entities: number; translated_count: number }> {
  const result = await db.query<{
    total_entities: string
    translated_count: string
  }>(
    `SELECT
       COUNT(DISTINCT entity_id)                                   AS total_entities,
       COUNT(*) FILTER (WHERE language_code = $1)                 AS translated_count
     FROM translations
     WHERE entity_type = $2`,
    [languageCode, entityType]
  )

  const row = result.rows[0]
  return {
    total_entities: parseInt(row?.total_entities ?? '0', 10),
    translated_count: parseInt(row?.translated_count ?? '0', 10),
  }
}

// ---------------------------------------------------------------------------
// Audit log retrieval
// ---------------------------------------------------------------------------

/**
 * Fetch audit log entries for an entity.
 * Returns up to `limit` rows ordered by created_at ASC, id ASC.
 */
export async function getAuditLogForEntity(
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

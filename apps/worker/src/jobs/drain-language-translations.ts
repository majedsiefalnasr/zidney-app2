/**
 * Drain Language Translations — Worker Job Handler
 *
 * File: apps/worker/src/jobs/drain-language-translations.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Asynchronously deletes all translation rows for a language code that was
 * removed from workspace supported_languages when the row count exceeded
 * the sync threshold (>10,000 rows).
 *
 * Execution Model:
 * - Iterates in batches (default 500 rows)
 * - ONE transaction per batch: DELETE RETURNING + audit INSERT
 * - On completion: removes language_status[language_code], updates settings,
 *   and invalidates coverage cache via SCAN
 *
 * Constitutional Compliance:
 * ✓ One DB transaction per batch (not mega-transaction) — SC-005 / T020 note
 * ✓ Idempotent — re-entrant from any point in iteration
 * ✓ Payload validated via Zod at handler entry
 * ✓ Structured logging — console.log forbidden
 * ✓ translated_value NEVER in logs
 * ✓ Redis SCAN for coverage invalidation — NEVER KEYS
 * ✓ Audit log insert in same transaction as DELETE
 * ✓ server-authoritative timestamps (DB NOW())
 */

import { invalidateWorkspaceCoverage } from '@zidney/domain-core'
import { createLogger } from '@zidney/logger'
import type { DrainLanguageTranslationsJob } from '@zidney/types/job-envelope'
import { z } from 'zod'

const logger = createLogger('drain-language-translations')

// ---------------------------------------------------------------------------
// Payload Zod validation schema (T020: parse at handler entry)
// ---------------------------------------------------------------------------

const DrainLanguageTranslationsPayloadSchema = z.object({
  workspace_slug: z.string().min(1),
  language_code: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code format'),
  batch_size: z.number().int().min(1).max(1000).default(500),
  initiated_by_user_id: z.string().min(1),
  attempt: z.number().int().min(0).default(0),
})

// ---------------------------------------------------------------------------
// DB Client interface
// ---------------------------------------------------------------------------

interface DbClient {
  query: <T = any>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// Redis interface (ioredis subset for SCAN support)
// ---------------------------------------------------------------------------

interface RedisClient {
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    time: number
  ): Promise<string | null>
  del(key: string | string[]): Promise<number>
  scan(
    cursor: string,
    matchOption: 'MATCH',
    pattern: string,
    countOption: 'COUNT',
    count: number
  ): Promise<[string, string[]]>
}

// ---------------------------------------------------------------------------
// T020: handleDrainLanguageTranslationsJob
// ---------------------------------------------------------------------------

/**
 * Process a DRAIN_LANGUAGE_TRANSLATIONS job.
 *
 * Each batch:
 * 1. BEGIN
 * 2. DELETE top-N rows for language_code RETURNING all columns
 * 3. INSERT audit log rows (one per deleted row, reason='language_removed')
 * 4. COMMIT
 *
 * When iteration is exhausted (no rows deleted in batch):
 * 5. Update workspace_settings: remove language_code from supported_languages,
 *    remove language_status[language_code]
 * 6. Invalidate coverage cache (Redis SCAN — NOT KEYS)
 *
 * @param job - Dequeued DrainLanguageTranslationsJob envelope
 * @param jobLogger - Pre-configured logger with correlation_id + job_id
 * @param db - Tenant-scoped DB pool client
 * @param redis - Optional Redis client for coverage cache invalidation
 */
export async function handleDrainLanguageTranslationsJob(
  job: DrainLanguageTranslationsJob,
  jobLogger: any,
  db: DbClient,
  redis?: RedisClient
): Promise<{ success: boolean; error?: Error; batches_processed?: number }> {
  // ---------------------------------------------------------------------------
  // Step 1: Validate payload (T020: Zod parse at handler entry)
  // ---------------------------------------------------------------------------
  if (job == null) {
    return { success: false, error: new Error('Job is null or undefined') }
  }

  const payloadParseResult = DrainLanguageTranslationsPayloadSchema.safeParse(
    job.payload
  )
  if (!payloadParseResult.success) {
    const msg = payloadParseResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ')

    jobLogger.error({
      event: 'drain_job_payload_invalid',
      workspace_id: job.workspace_id,
      correlation_id: job.request_id,
      job_id: job.job_id,
      error: msg,
    })

    return { success: false, error: new Error(`Invalid payload: ${msg}`) }
  }

  const { workspace_slug, language_code, batch_size, initiated_by_user_id } =
    payloadParseResult.data

  jobLogger.info({
    event: 'drain_job_started',
    workspace_id: job.workspace_id,
    workspace_slug,
    correlation_id: job.request_id,
    job_id: job.job_id,
    language_code,
    batch_size,
  })

  // ---------------------------------------------------------------------------
  // Step 2: Batch iteration loop
  // ---------------------------------------------------------------------------
  let batchesProcessed = 0
  let totalDeleted = 0
  let hasMore = true

  try {
    while (hasMore) {
      const batchStart = Date.now()

      // One transaction per batch (SC-005 / T020)
      await db.query('BEGIN')

      try {
        // DELETE top-N rows for this language_code (no ORDER BY needed — any N rows fine)
        const deleteResult = await db.query<{
          id: string
          entity_type: string
          entity_id: string
          field_name: string
          language_code: string
          translated_value: string
        }>(
          `DELETE FROM translations
           WHERE id IN (
             SELECT id FROM translations
             WHERE language_code = $1
             LIMIT $2
           )
           RETURNING id, entity_type, entity_id, field_name, language_code, translated_value`,
          [language_code, batch_size]
        )

        const deletedRows = deleteResult.rows

        if (deletedRows.length === 0) {
          // No more rows — drain complete
          await db.query('ROLLBACK')
          hasMore = false
          break
        }

        // Insert audit log entries in same transaction (one per deleted row)
        if (deletedRows.length > 0) {
          const valuePlaceholders: string[] = []
          const params: unknown[] = []
          let paramIdx = 1

          for (const row of deletedRows) {
            valuePlaceholders.push(
              `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, 'deleted', $${paramIdx++}, NULL, $${paramIdx++}, $${paramIdx++}, 'language_removed')`
            )
            params.push(
              job.workspace_id,
              row.entity_type,
              row.entity_id,
              row.field_name,
              row.language_code,
              row.translated_value,
              initiated_by_user_id,
              job.request_id
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

        await db.query('COMMIT')

        totalDeleted += deletedRows.length
        batchesProcessed++
        hasMore = deletedRows.length === batch_size // If fewer than batch_size, this was the last batch

        jobLogger.info({
          event: 'drain_batch',
          workspace_id: job.workspace_id,
          workspace_slug,
          correlation_id: job.request_id,
          job_id: job.job_id,
          language_code,
          batch_number: batchesProcessed,
          rows_deleted: deletedRows.length,
          total_deleted: totalDeleted,
          duration_ms: Date.now() - batchStart,
        })
      } catch (batchErr) {
        await db.query('ROLLBACK')
        throw batchErr
      }
    }

    // ---------------------------------------------------------------------------
    // Step 3: Post-drain cleanup
    // ---------------------------------------------------------------------------

    // Update workspace_settings: remove language_code from supported_languages + clear status
    await db.query(
      `UPDATE workspace_settings
       SET language_settings = jsonb_set(
           jsonb_set(
             language_settings,
             '{supported_languages}',
             (
               SELECT jsonb_agg(lang)
               FROM jsonb_array_elements_text(language_settings->'supported_languages') AS lang
               WHERE lang != $1
             )
           ),
           '{language_status}',
           (language_settings->'language_status') - $1
         ),
           updated_at = NOW()
       WHERE singleton_key = 'SETTINGS'`,
      [language_code]
    )

    // Invalidate all coverage cache keys for this workspace (SCAN-based)
    if (redis) {
      await invalidateWorkspaceCoverage(redis as any, job.workspace_id)
    }

    jobLogger.info({
      event: 'drain_complete',
      workspace_id: job.workspace_id,
      workspace_slug,
      correlation_id: job.request_id,
      job_id: job.job_id,
      language_code,
      total_deleted: totalDeleted,
      batches_processed: batchesProcessed,
    })

    return { success: true, batches_processed: batchesProcessed }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)

    jobLogger.error({
      event: 'drain_failed',
      workspace_id: job.workspace_id,
      workspace_slug,
      correlation_id: job.request_id,
      job_id: job.job_id,
      language_code,
      total_deleted: totalDeleted,
      batches_processed: batchesProcessed,
      error: errMsg,
    })

    return {
      success: false,
      error: err instanceof Error ? err : new Error(errMsg),
    }
  }
}

// ---------------------------------------------------------------------------
// Registration helper (for use in worker startup)
// ---------------------------------------------------------------------------

/**
 * Register the DRAIN handler with the worker's job processor.
 * Call this during worker initialization.
 *
 * Usage:
 *   import { registerJobHandler } from '../processor'
 *   import { createDrainJobHandler } from './drain-language-translations'
 *   registerJobHandler('DRAIN_LANGUAGE_TRANSLATIONS', createDrainJobHandler(tenantPoolMap, redis))
 */
export function createDrainJobHandler(
  tenantPoolMap: Map<string, any>,
  redis?: RedisClient
) {
  return async (
    job: DrainLanguageTranslationsJob,
    jobLogger: any
  ): Promise<{ success: boolean; error?: Error }> => {
    const db = tenantPoolMap.get(job.workspace_id)
    if (!db) {
      jobLogger.error({
        event: 'drain_tenant_pool_not_found',
        workspace_id: job.workspace_id,
        job_id: job.job_id,
      })
      return {
        success: false,
        error: new Error(
          `Tenant pool not found for workspace_id: ${job.workspace_id}`
        ),
      }
    }

    return handleDrainLanguageTranslationsJob(job, jobLogger, db, redis)
  }
}

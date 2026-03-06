/**
 * Translation Coverage Service
 *
 * File: packages/domain-core/src/translation/coverage.service.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Computes and caches translation coverage statistics per workspace/entity/language.
 *
 * Cache strategy (FR-039):
 * - Redis key: `coverage:{workspace_id}:{entity_type}:{language_code}`
 * - TTL: 300 seconds (5 min)
 * - Invalidation: on any upsert (specific key) or language removal (SCAN all workspace coverage keys)
 *
 * Constitutional Compliance:
 * ✓ Redis SCAN used for workspace-wide invalidation (NEVER KEYS)
 * ✓ Structured logging — console.log forbidden
 * ✓ getCoverage returns null for default language (no denominator issue)
 * ✓ Coverage denominator = TRANSLATABLE_FIELDS[entityType].length × distinct entity count
 */

import { createLogger } from '@zidney/logger'

import { isTranslatableEntityType, TRANSLATABLE_FIELDS } from './translatable-fields'
import type { TranslationCoverage } from './translation.types'

const logger = createLogger('coverage-service')

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
// Redis interface (ioredis subset)
// ---------------------------------------------------------------------------

export interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, expiryMode: 'EX', time: number): Promise<string | null>
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
// Cache key helpers
// ---------------------------------------------------------------------------

function coverageCacheKey(workspaceId: string, entityType: string, languageCode: string): string {
  return `coverage:${workspaceId}:${entityType}:${languageCode}`
}

const COVERAGE_CACHE_TTL_SECONDS = 300

// ---------------------------------------------------------------------------
// T008: getCoverage
// ---------------------------------------------------------------------------

/**
 * Get translation coverage for an entity type and language code.
 *
 * Returns null if languageCode === defaultLanguage (no translation needed).
 *
 * Coverage formula (Q5 clarification):
 *   numerator   = COUNT translations where (entity_type, language_code) match
 *   denominator = TRANSLATABLE_FIELDS[entityType].length × COUNT(DISTINCT entity_id) in translations table
 *
 * Redis cache is checked first (TTL 300s). On cache miss, DB is queried and result is cached.
 *
 * @param db - Tenant DB client
 * @param workspaceId - Workspace ID for cache key scoping
 * @param entityType - Entity type to compute coverage for
 * @param languageCode - Target language code
 * @param defaultLanguage - Workspace default language (short-circuit)
 * @param redis - Optional Redis client (cache skipped if not provided)
 * @returns TranslationCoverage or null for default language
 */
export async function getCoverage(
  db: DbClient,
  workspaceId: string,
  entityType: string,
  languageCode: string,
  defaultLanguage: string,
  redis?: RedisClient
): Promise<TranslationCoverage | null> {
  // Default language has no translations — coverage is not applicable
  if (languageCode === defaultLanguage) {
    return null
  }

  if (!isTranslatableEntityType(entityType)) {
    return null
  }

  const cacheKey = coverageCacheKey(workspaceId, entityType, languageCode)

  // --- Cache read ---
  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached !== null) {
        return JSON.parse(cached) as TranslationCoverage
      }
    } catch (err) {
      logger.warn({
        event: 'coverage_cache_read_error',
        workspace_id: workspaceId,
        entity_type: entityType,
        language_code: languageCode,
        error: err instanceof Error ? err.message : String(err),
      })
      // Fall through to DB
    }
  }

  // --- DB computation ---
  const fieldsForType = TRANSLATABLE_FIELDS[entityType as keyof typeof TRANSLATABLE_FIELDS]
  const fieldCount = fieldsForType.length

  // COUNT distinct entity IDs present in translations (denominator entity base)
  // Numerator = rows for this language
  const result = await db.query<{
    total_entities: string
    translated_count: string
  }>(
    `SELECT
       COUNT(DISTINCT entity_id)                                                             AS total_entities,
       COUNT(*) FILTER (WHERE language_code = $1)                                           AS translated_count
     FROM translations
     WHERE entity_type = $2`,
    [languageCode, entityType]
  )

  const row = result.rows[0]
  const totalEntities = parseInt(row?.total_entities ?? '0', 10)
  const translatedCount = parseInt(row?.translated_count ?? '0', 10)
  const maxPossible = fieldCount * totalEntities

  const coverage: TranslationCoverage = {
    entity_type: entityType,
    language_code: languageCode,
    total_entities: totalEntities,
    translated_count: translatedCount,
    coverage_percent:
      maxPossible > 0 ? Math.round((translatedCount / maxPossible) * 10000) / 100 : 0,
  }

  // --- Cache write ---
  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(coverage), 'EX', COVERAGE_CACHE_TTL_SECONDS)
    } catch (err) {
      logger.warn({
        event: 'coverage_cache_write_error',
        workspace_id: workspaceId,
        entity_type: entityType,
        language_code: languageCode,
        error: err instanceof Error ? err.message : String(err),
      })
      // Non-fatal — continue without cache
    }
  }

  return coverage
}

// ---------------------------------------------------------------------------
// T008: invalidateCoverage (single key)
// ---------------------------------------------------------------------------

/**
 * Invalidate the coverage cache for a specific (workspace, entity_type, language_code) triple.
 * Called after a successful translation upsert.
 *
 * @param redis - Redis client
 * @param workspaceId - Workspace ID
 * @param entityType - Entity type
 * @param languageCode - Language code
 */
export async function invalidateCoverage(
  redis: RedisClient,
  workspaceId: string,
  entityType: string,
  languageCode: string
): Promise<void> {
  const cacheKey = coverageCacheKey(workspaceId, entityType, languageCode)

  try {
    await redis.del(cacheKey)
    logger.info({
      event: 'coverage_cache_invalidated',
      workspace_id: workspaceId,
      entity_type: entityType,
      language_code: languageCode,
      key: cacheKey,
    })
  } catch (err) {
    // Non-fatal: log, do not bubble up
    logger.warn({
      event: 'coverage_cache_invalidate_error',
      workspace_id: workspaceId,
      entity_type: entityType,
      language_code: languageCode,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ---------------------------------------------------------------------------
// T008: invalidateWorkspaceCoverage (SCAN-based — never KEYS)
// ---------------------------------------------------------------------------

const SCAN_BATCH_SIZE = 100

/**
 * Invalidate ALL coverage cache keys for a workspace.
 * Used after language removal (sync or async DRAIN completion).
 *
 * Uses cursor-based SCAN iteration — NEVER the KEYS command.
 * Pattern: `coverage:{workspaceId}:*`
 *
 * @param redis - Redis client
 * @param workspaceId - Workspace ID
 */
export async function invalidateWorkspaceCoverage(
  redis: RedisClient,
  workspaceId: string
): Promise<void> {
  const pattern = `coverage:${workspaceId}:*`
  let cursor = '0'
  let totalDeleted = 0

  try {
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        SCAN_BATCH_SIZE
      )
      cursor = nextCursor

      if (keys.length > 0) {
        const deleted = await redis.del(keys)
        totalDeleted += deleted
      }
    } while (cursor !== '0')

    logger.info({
      event: 'workspace_coverage_cache_invalidated',
      workspace_id: workspaceId,
      pattern,
      total_deleted: totalDeleted,
    })
  } catch (err) {
    // Non-fatal: log warning, do not bubble up
    logger.warn({
      event: 'workspace_coverage_cache_invalidate_error',
      workspace_id: workspaceId,
      pattern,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Translation Route — POST /translations (Batch Upsert)
 *
 * File: apps/api/src/routes/backoffice/translations/post-upsert.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Handles translation upsert (single item or batch up to 50).
 * Validates request, calls domain service, invalidates cache on success.
 *
 * Middleware chain (applied at router level):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit(60) → authentication → rbacGuard(staff)
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to domain service
 * ✓ translated_value NEVER in error messages or logs
 * ✓ Standard error response envelope
 * ✓ Structured logging with correlation_id + workspace_slug
 */

import {
  type EntityValidator,
  invalidateCoverage,
  TranslationError,
  upsertTranslations,
} from '@zidney/domain-core'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

import { buildTranslationContext } from '../../../modules/translation/translation.context'
import { BatchUpsertSchema } from '../../../modules/translation/translation.validation'

const logger = createLogger('translation-routes')

/**
 * Entity validator callback for the backoffice context.
 * Checks entity existence in the tenant DB based on entity_type.
 */
const entityValidator: EntityValidator = async (db, entityType, entityId) => {
  const tableMap: Record<string, string> = {
    subject: 'subjects',
    category: 'categories',
    question: 'questions',
    exam: 'exams',
  }

  const tableName = tableMap[entityType]
  if (!tableName) return false

  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM ${tableName} WHERE id = $1) AS exists`,
    [entityId]
  )
  return result.rows[0]?.exists ?? false
}

/**
 * POST /translations
 * Upsert up to 50 translation items atomically.
 * Returns HTTP 200 for both creates and updates (Q4).
 */
export async function handlePostUpsert(c: Context): Promise<Response> {
  try {
    const { ctx, db } = await buildTranslationContext(c)
    const redis = c.get('tenant')?.redis

    // Parse + validate request body
    const body = await c.req.json()
    const parseResult = BatchUpsertSchema.safeParse(body)
    if (!parseResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors
              .map(
                (e: { path: Array<string | number>; message: string }) =>
                  `${e.path.join('.')}: ${e.message}`
              )
              .join('; '),
          },
        },
        422
      )
    }

    const { items } = parseResult.data

    const saved = await upsertTranslations(db, ctx, items, entityValidator)

    // Invalidate coverage cache for affected (entity_type, language_code) pairs
    if (redis) {
      const pairs = [
        ...new Map(
          items.map((i: { entity_type: string; language_code: string }) => [
            `${i.entity_type}:${i.language_code}`,
            i,
          ])
        ).values(),
      ]
      for (const pair of pairs as Array<{
        entity_type: string
        language_code: string
      }>) {
        await invalidateCoverage(redis, ctx.workspace_id, pair.entity_type, pair.language_code)
      }
    }

    logger.info({
      event: 'translation_upsert',
      workspace_slug: ctx.workspace_slug,
      workspace_id: ctx.workspace_id,
      correlation_id: ctx.correlation_id,
      user_id: ctx.user_id,
      count: saved.length,
    })

    return c.json(
      {
        success: true,
        data: { saved, count: saved.length },
        error: null,
      },
      200
    )
  } catch (err) {
    return handleTranslationError(c, err)
  }
}

/**
 * Shared error handler for translation routes.
 */
export function handleTranslationError(c: Context, err: unknown): Response {
  if (err instanceof TranslationError) {
    const status = err.httpStatus as 404 | 409 | 422
    return c.json(
      {
        success: false,
        data: null,
        error: { code: err.code, message: err.message },
      },
      status
    )
  }

  // Unexpected error — mask details from client
  logger.error({
    event: 'translation_route_error',
    error: err instanceof Error ? err.message : String(err),
  })

  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
    },
    500
  )
}

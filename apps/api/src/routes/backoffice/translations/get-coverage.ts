/**
 * Translation Route — GET /translations/coverage
 *
 * File: apps/api/src/routes/backoffice/translations/get-coverage.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Returns translation coverage stats for an entity type + language code.
 * Returns null body (HTTP 200, data: null) for default_language queries.
 * Redis cache is checked first (TTL 300s).
 */

import { getCoverage } from '@zidney/domain-core'
import type { Context } from 'hono'

import { buildTranslationContext } from '../../../modules/translation/translation.context'
import { GetCoverageQuerySchema } from '../../../modules/translation/translation.validation'
import { handleTranslationError } from './post-upsert'

/**
 * GET /translations/coverage?entity_type=...&language_code=...
 */
export async function handleGetCoverage(c: Context): Promise<Response> {
  try {
    const { ctx, db } = await buildTranslationContext(c)
    const redis = c.get('tenant')?.redis

    const queryParams = {
      entity_type: c.req.query('entity_type'),
      language_code: c.req.query('language_code'),
    }

    const parseResult = GetCoverageQuerySchema.safeParse(queryParams)
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

    const { entity_type, language_code } = parseResult.data

    const coverage = await getCoverage(
      db,
      ctx.workspace_id,
      entity_type,
      language_code,
      ctx.default_language,
      redis
    )

    return c.json(
      {
        success: true,
        data: coverage,
        error: null,
      },
      200
    )
  } catch (err) {
    return handleTranslationError(c, err)
  }
}

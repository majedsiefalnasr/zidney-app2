/**
 * Translation Route — GET /translations (List Entity Translations)
 *
 * File: apps/api/src/routes/backoffice/translations/get-translations.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Returns paginated list of translation rows for a given entity.
 * Cursor-based pagination anchored on id ASC.
 */

import { listEntityTranslations } from '@zidney/domain-core'
import type { Context } from 'hono'

import { buildTranslationContext } from '../../../modules/translation/translation.context'
import { GetTranslationsQuerySchema } from '../../../modules/translation/translation.validation'
import { handleTranslationError } from './post-upsert'

/**
 * GET /translations?entity_type=...&entity_id=...&cursor=...&page_size=...
 */
export async function handleGetTranslations(c: Context): Promise<Response> {
  try {
    const { db } = await buildTranslationContext(c)

    // Validate query parameters
    const queryParams = {
      entity_type: c.req.query('entity_type'),
      entity_id: c.req.query('entity_id'),
      cursor: c.req.query('cursor'),
      page_size: c.req.query('page_size'),
    }

    const parseResult = GetTranslationsQuerySchema.safeParse(queryParams)
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

    const { entity_type, entity_id, cursor, page_size } = parseResult.data

    const result = await listEntityTranslations(db, {
      entityType: entity_type,
      entityId: entity_id,
      cursor,
      pageSize: page_size,
    })

    return c.json(
      {
        success: true,
        data: result,
        error: null,
      },
      200
    )
  } catch (err) {
    return handleTranslationError(c, err)
  }
}

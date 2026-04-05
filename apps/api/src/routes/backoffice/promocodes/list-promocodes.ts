/**
 * List Promocodes — GET /promocodes
 *
 * File: apps/api/src/routes/backoffice/promocodes/list-promocodes.ts
 * Stage: STAGE_45_PROMOCODES
 */

import { randomUUID } from 'node:crypto'
import { promocodeService } from '@zidney/domain-core/promocodes'
import { createLogger } from '@zidney/logger'
import { listPromocodesQuerySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb } from './helpers'

const logger = createLogger('backoffice-promocodes-list')

export async function handleListPromocodes(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? randomUUID()
    c.set('request_id', requestId)

    const query = c.req.query()
    const parsed = listPromocodesQuerySchema.safeParse(query)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query params',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const _audit = buildAuditCtx(c)

    const { page, limit, ...filterFields } = parsed.data
    const filter = { ...filterFields, page, limit }

    logger.debug('List promocodes', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
    })

    const { rows, total } = await promocodeService.listPromocodes(db, filter)

    return c.json({
      success: true,
      data: { promocodes: rows, total, page: page ?? 1, limit: limit ?? 20 },
      error: null,
      request_id: requestId,
    })
  } catch (err) {
    const requestId = (c.get('request_id') as string | undefined) ?? null
    const workspaceSlug = c.get('workspace_slug')
    const userId = c.get('user_id')
    const safeError = err instanceof Error ? err : new Error(String(err))
    logger.error('Unhandled error in list-promocodes', {
      request_id: requestId,
      correlation_id: c.get('correlation_id'),
      workspace_slug: workspaceSlug,
      user_id: userId,
      workspace_id: c.get('workspace_id'),
      message: safeError.message,
      stack: safeError.stack,
      cause: safeError.cause,
    })
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        request_id: requestId,
      },
      500
    )
  }
}

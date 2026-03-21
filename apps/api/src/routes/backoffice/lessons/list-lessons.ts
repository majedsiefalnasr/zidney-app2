/**
 * Handler: GET /api/v1/backoffice/workspace/lessons
 *
 * File: apps/api/src/routes/backoffice/lessons/list-lessons.ts
 * Stage: STAGE_29_LESSONS
 *
 * Lists lessons with optional filters (subject_id, status, search) and
 * offset-based pagination. Returns paginated LessonRow array.
 */

import { listLessons } from '@zidney/domain-core/lessons'
import { createLogger } from '@zidney/logger'
import { listLessonsQuerySchema } from '@zidney/validation/backoffice/lessons.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, lessonsErrorResponse, successResponse } from './helpers'

const logger = createLogger('lessons-route:list')

export async function listLessonsHandler(c: Context): Promise<Response> {
  try {
    const parsed = listLessonsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return lessonsErrorResponse(c, parsed.error)

    const { page, limit, status, subject_id, search } = parsed.data
    const db = getDb(c)

    const result = await listLessons(db, { page, limit, status, subject_id, search })

    logger.info('Lessons listed', {
      correlation_id: buildAuditCtx(c).correlation_id,
      workspace_id: buildAuditCtx(c).workspace_id,
      total: result.total,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return lessonsErrorResponse(c, err)
  }
}

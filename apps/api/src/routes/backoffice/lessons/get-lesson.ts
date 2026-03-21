/**
 * Handler: GET /api/v1/backoffice/workspace/lessons/:id
 *
 * File: apps/api/src/routes/backoffice/lessons/get-lesson.ts
 * Stage: STAGE_29_LESSONS
 *
 * Returns a single lesson by ID.
 */

import { getLesson } from '@zidney/domain-core/lessons'
import { createLogger } from '@zidney/logger'
import { lessonParamsSchema } from '@zidney/validation/backoffice/lessons.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, lessonsErrorResponse, successResponse } from './helpers'

const logger = createLogger('lessons-route:get')

export async function getLessonHandler(c: Context): Promise<Response> {
  try {
    const parsed = lessonParamsSchema.safeParse(c.req.param())
    if (!parsed.success) return lessonsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const lesson = await getLesson(db, parsed.data.id)

    logger.info('Lesson fetched', {
      correlation_id: buildAuditCtx(c).correlation_id,
      workspace_id: buildAuditCtx(c).workspace_id,
      lesson_id: lesson.id,
    })

    return c.json(successResponse(lesson), 200)
  } catch (err) {
    return lessonsErrorResponse(c, err)
  }
}

/**
 * Handler: PATCH /api/v1/backoffice/workspace/lessons/:id
 *
 * File: apps/api/src/routes/backoffice/lessons/update-lesson.ts
 * Stage: STAGE_29_LESSONS
 *
 * Updates a lesson's fields or status.
 * Q7: Non-status fields on a DISABLED lesson → 422 LESSON_DISABLED
 *     (even when status: ENABLED is also present in the same payload).
 */

import { updateLesson } from '@zidney/domain-core/lessons'
import { createLogger } from '@zidney/logger'
import {
  lessonParamsSchema,
  updateLessonBodySchema,
} from '@zidney/validation/backoffice/lessons.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, lessonsErrorResponse, successResponse } from './helpers'

const logger = createLogger('lessons-route:update')

export async function updateLessonHandler(c: Context): Promise<Response> {
  try {
    const paramsParsed = lessonParamsSchema.safeParse(c.req.param())
    if (!paramsParsed.success) return lessonsErrorResponse(c, paramsParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateLessonBodySchema.safeParse(body)
    if (!bodyParsed.success) return lessonsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const updated = await updateLesson(db, paramsParsed.data.id, bodyParsed.data, audit)

    logger.info('Lesson updated via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      lesson_id: updated.id,
    })

    return c.json(successResponse(updated), 200)
  } catch (err) {
    return lessonsErrorResponse(c, err)
  }
}

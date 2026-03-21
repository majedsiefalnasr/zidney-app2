/**
 * Handler: DELETE /api/v1/backoffice/workspace/lessons/:id
 *
 * File: apps/api/src/routes/backoffice/lessons/delete-lesson.ts
 * Stage: STAGE_29_LESSONS
 *
 * Soft-deletes a lesson (sets status = DISABLED).
 * Returns 422 LESSON_ALREADY_DISABLED if already disabled (idempotency guard).
 */

import { deleteLesson } from '@zidney/domain-core/lessons'
import { createLogger } from '@zidney/logger'
import { lessonParamsSchema } from '@zidney/validation/backoffice/lessons.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, lessonsErrorResponse, successResponse } from './helpers'

const logger = createLogger('lessons-route:delete')

export async function deleteLessonHandler(c: Context): Promise<Response> {
  try {
    const parsed = lessonParamsSchema.safeParse(c.req.param())
    if (!parsed.success) return lessonsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await deleteLesson(db, parsed.data.id, audit)

    logger.info('Lesson deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      lesson_id: parsed.data.id,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return lessonsErrorResponse(c, err)
  }
}

/**
 * Handler: POST /api/v1/backoffice/workspace/lessons
 *
 * File: apps/api/src/routes/backoffice/lessons/create-lesson.ts
 * Stage: STAGE_29_LESSONS
 *
 * Creates a new lesson. Returns 201 with the created LessonRow.
 */

import { createLesson } from '@zidney/domain-core/lessons'
import { createLogger } from '@zidney/logger'
import { createLessonBodySchema } from '@zidney/validation/backoffice/lessons.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, lessonsErrorResponse, successResponse } from './helpers'

const logger = createLogger('lessons-route:create')

export async function createLessonHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createLessonBodySchema.safeParse(body)
    if (!parsed.success) return lessonsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const lesson = await createLesson(db, parsed.data, audit)

    logger.info('Lesson created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      lesson_id: lesson.id,
    })

    return c.json(successResponse(lesson), 201)
  } catch (err) {
    return lessonsErrorResponse(c, err)
  }
}

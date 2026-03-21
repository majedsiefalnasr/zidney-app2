/**
 * Handler: GET /api/v1/backoffice/workspace/lessons/runtime
 *
 * File: apps/api/src/routes/backoffice/lessons/get-active-lessons.ts
 * Stage: STAGE_29_LESSONS
 *
 * Returns all ENABLED lessons for a given subject_id.
 * This endpoint is license-only (no auth token required) — used by runtime
 * delivery surfaces to build lesson navigation menus.
 * subject_id query parameter is REQUIRED (activeLessonsQuerySchema).
 */

import { getActiveLessons } from '@zidney/domain-core/lessons'
import { createLogger } from '@zidney/logger'
import { activeLessonsQuerySchema } from '@zidney/validation/backoffice/lessons.schemas'
import type { Context } from 'hono'
import { getDb, lessonsErrorResponse, successResponse } from './helpers'

const logger = createLogger('lessons-route:active')

export async function getActiveLessonsHandler(c: Context): Promise<Response> {
  try {
    const parsed = activeLessonsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return lessonsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const lessons = await getActiveLessons(db, parsed.data.subject_id)

    logger.info('Active lessons fetched', {
      workspace_id: c.get('workspace_id') as string,
      subject_id: parsed.data.subject_id,
      count: lessons.length,
    })

    return c.json(successResponse(lessons), 200)
  } catch (err) {
    return lessonsErrorResponse(c, err)
  }
}

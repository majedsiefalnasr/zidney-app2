/**
 * Get Semester — GET /semesters/:id
 *
 * File: apps/api/src/routes/backoffice/semesters/get-semester.ts
 * Stage: STAGE_27_SEMESTERS
 */

import { getSemesterById } from '@zidney/domain-core/semesters'
import { createLogger } from '@zidney/logger'
import { semesterParamsSchema } from '@zidney/validation/backoffice/semesters.schemas'
import type { Context } from 'hono'
import { getDb, semestersErrorResponse, successResponse } from './helpers'

const logger = createLogger('semesters-route:get-semester')

export async function getSemesterHandler(c: Context) {
  try {
    const { id } = await semesterParamsSchema.parseAsync(c.req.param())

    logger.debug('Get semester', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      semester_id: id,
    })

    const semester = await getSemesterById(getDb(c), id)

    return c.json(successResponse(semester), 200)
  } catch (err) {
    return semestersErrorResponse(c, err)
  }
}

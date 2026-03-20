/**
 * Update Semester — PATCH /semesters/:id
 *
 * File: apps/api/src/routes/backoffice/semesters/update-semester.ts
 * Stage: STAGE_27_SEMESTERS
 */

import { updateSemester } from '@zidney/domain-core/semesters'
import { createLogger } from '@zidney/logger'
import {
  semesterParamsSchema,
  updateSemesterBodySchema,
} from '@zidney/validation/backoffice/semesters.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, semestersErrorResponse, successResponse } from './helpers'

const logger = createLogger('semesters-route:update-semester')

export async function updateSemesterHandler(c: Context) {
  try {
    const { id } = await semesterParamsSchema.parseAsync(c.req.param())
    const body = await updateSemesterBodySchema.parseAsync(await c.req.json())

    logger.debug('Update semester', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      semester_id: id,
    })

    const semester = await updateSemester(getDb(c), id, body, buildAuditCtx(c))

    return c.json(successResponse(semester), 200)
  } catch (err) {
    return semestersErrorResponse(c, err)
  }
}

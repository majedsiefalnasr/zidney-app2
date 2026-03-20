/**
 * Delete Semester — DELETE /semesters/:id
 *
 * File: apps/api/src/routes/backoffice/semesters/delete-semester.ts
 * Stage: STAGE_27_SEMESTERS
 */

import { deleteSemester } from '@zidney/domain-core/semesters'
import { createLogger } from '@zidney/logger'
import { semesterParamsSchema } from '@zidney/validation/backoffice/semesters.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, semestersErrorResponse, successResponse } from './helpers'

const logger = createLogger('semesters-route:delete-semester')

export async function deleteSemesterHandler(c: Context) {
  try {
    const { id } = await semesterParamsSchema.parseAsync(c.req.param())

    logger.debug('Delete semester', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      semester_id: id,
    })

    await deleteSemester(getDb(c), id, buildAuditCtx(c))

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return semestersErrorResponse(c, err)
  }
}

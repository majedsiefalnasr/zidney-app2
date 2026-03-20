/**
 * Create Semester — POST /semesters
 *
 * File: apps/api/src/routes/backoffice/semesters/create-semester.ts
 * Stage: STAGE_27_SEMESTERS
 */

import { createSemester } from '@zidney/domain-core/semesters'
import { createLogger } from '@zidney/logger'
import { createSemesterBodySchema } from '@zidney/validation/backoffice/semesters.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, semestersErrorResponse, successResponse } from './helpers'

const logger = createLogger('semesters-route:create-semester')

export async function createSemesterHandler(c: Context) {
  try {
    const body = await createSemesterBodySchema.parseAsync(await c.req.json())

    logger.debug('Create semester', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      name: body.name,
    })

    const semester = await createSemester(getDb(c), body, buildAuditCtx(c))

    return c.json(successResponse(semester), 201)
  } catch (err) {
    return semestersErrorResponse(c, err)
  }
}

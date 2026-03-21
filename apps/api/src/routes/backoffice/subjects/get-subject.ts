/**
 * Get Subject — GET /subjects/:id
 *
 * File: apps/api/src/routes/backoffice/subjects/get-subject.ts
 * Stage: STAGE_28_SUBJECTS
 */

import { getSubjectById } from '@zidney/domain-core/subjects'
import { createLogger } from '@zidney/logger'
import { subjectParamsSchema } from '@zidney/validation/backoffice/subjects.schemas'
import type { Context } from 'hono'
import { getDb, subjectsErrorResponse, successResponse } from './helpers'

const logger = createLogger('subjects-route:get-subject')

export async function getSubjectHandler(c: Context) {
  try {
    const params = await subjectParamsSchema.parseAsync(c.req.param())

    logger.debug('Get subject', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      subject_id: params.id,
    })

    const subject = await getSubjectById(getDb(c), params.id)

    return c.json(successResponse(subject), 200)
  } catch (err) {
    return subjectsErrorResponse(c, err)
  }
}

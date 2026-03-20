/**
 * Update Subject — PATCH /subjects/:id
 *
 * File: apps/api/src/routes/backoffice/subjects/update-subject.ts
 * Stage: STAGE_28_SUBJECTS
 */

import { updateSubject } from '@zidney/domain-core/subjects'
import { createLogger } from '@zidney/logger'
import {
  subjectParamsSchema,
  updateSubjectBodySchema,
} from '@zidney/validation/backoffice/subjects.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, subjectsErrorResponse, successResponse } from './helpers'

const logger = createLogger('subjects-route:update-subject')

export async function updateSubjectHandler(c: Context) {
  try {
    const params = await subjectParamsSchema.parseAsync(c.req.param())
    const body = await updateSubjectBodySchema.parseAsync(await c.req.json())

    logger.debug('Update subject', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      subject_id: params.id,
    })

    const subject = await updateSubject(getDb(c), { id: params.id, ...body }, buildAuditCtx(c))

    return c.json(successResponse(subject), 200)
  } catch (err) {
    return subjectsErrorResponse(c, err)
  }
}

/**
 * Create Subject — POST /subjects
 *
 * File: apps/api/src/routes/backoffice/subjects/create-subject.ts
 * Stage: STAGE_28_SUBJECTS
 */

import { createSubject } from '@zidney/domain-core/subjects'
import { createLogger } from '@zidney/logger'
import { createSubjectBodySchema } from '@zidney/validation/backoffice/subjects.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, subjectsErrorResponse, successResponse } from './helpers'

const logger = createLogger('subjects-route:create-subject')

export async function createSubjectHandler(c: Context) {
  try {
    const body = await createSubjectBodySchema.parseAsync(await c.req.json())

    logger.debug('Create subject', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      name: body.name,
    })

    const subject = await createSubject(getDb(c), body, buildAuditCtx(c))

    return c.json(successResponse(subject), 201)
  } catch (err) {
    return subjectsErrorResponse(c, err)
  }
}

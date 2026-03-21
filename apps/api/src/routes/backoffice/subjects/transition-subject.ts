/**
 * Transition Subject Status — POST /subjects/:id/transition
 *
 * File: apps/api/src/routes/backoffice/subjects/transition-subject.ts
 * Stage: STAGE_28_SUBJECTS
 */

import { transitionSubjectStatus } from '@zidney/domain-core/subjects'
import { createLogger } from '@zidney/logger'
import {
  subjectParamsSchema,
  transitionSubjectBodySchema,
} from '@zidney/validation/backoffice/subjects.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, subjectsErrorResponse, successResponse } from './helpers'

const logger = createLogger('subjects-route:transition-subject')

export async function transitionSubjectHandler(c: Context) {
  try {
    const params = await subjectParamsSchema.parseAsync(c.req.param())
    const body = await transitionSubjectBodySchema.parseAsync(await c.req.json())

    logger.debug('Transition subject status', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      subject_id: params.id,
      target_status: body.target_status,
      expected_current_status: body.expected_current_status,
    })

    const subject = await transitionSubjectStatus(
      getDb(c),
      {
        id: params.id,
        target_status: body.target_status,
        expected_current_status: body.expected_current_status,
      },
      buildAuditCtx(c)
    )

    return c.json(successResponse(subject), 200)
  } catch (err) {
    return subjectsErrorResponse(c, err)
  }
}

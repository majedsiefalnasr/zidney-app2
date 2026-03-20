/**
 * List Subjects — GET /subjects
 *
 * File: apps/api/src/routes/backoffice/subjects/list-subjects.ts
 * Stage: STAGE_28_SUBJECTS
 */

import { listSubjects } from '@zidney/domain-core/subjects'
import { createLogger } from '@zidney/logger'
import { listSubjectsQuerySchema } from '@zidney/validation/backoffice/subjects.schemas'
import type { Context } from 'hono'
import { getDb, subjectsErrorResponse, successResponse } from './helpers'

const logger = createLogger('subjects-route:list-subjects')

export async function listSubjectsHandler(c: Context) {
  try {
    const query = await listSubjectsQuerySchema.parseAsync(c.req.query())

    logger.debug('List subjects', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
      division_id: query.division_id,
      semester_id: query.semester_id,
    })

    const result = await listSubjects(getDb(c), {
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
      division_id: query.division_id,
      semester_id: query.semester_id,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return subjectsErrorResponse(c, err)
  }
}

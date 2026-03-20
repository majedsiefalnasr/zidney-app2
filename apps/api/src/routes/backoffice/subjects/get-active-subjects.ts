/**
 * Get Active Subjects — GET /subjects/runtime
 *
 * File: apps/api/src/routes/backoffice/subjects/get-active-subjects.ts
 * Stage: STAGE_28_SUBJECTS
 *
 * Returns only ACTIVE subjects regardless of any status query param.
 * Intended for runtime lookups (e.g. exam creation, assignment).
 */

import { listSubjects } from '@zidney/domain-core/subjects'
import { createLogger } from '@zidney/logger'
import { listSubjectsQuerySchema } from '@zidney/validation/backoffice/subjects.schemas'
import type { Context } from 'hono'
import { getDb, subjectsErrorResponse, successResponse } from './helpers'

const logger = createLogger('subjects-route:get-active-subjects')

export async function getActiveSubjectsHandler(c: Context) {
  try {
    // Parse query but discard any status field — status is forced to ACTIVE
    const raw = c.req.query()
    const { status: _ignoredStatus, ...rest } = raw
    const query = await listSubjectsQuerySchema.parseAsync(rest)

    logger.debug('Get active subjects (runtime)', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      page: query.page,
      limit: query.limit,
      division_id: query.division_id,
      semester_id: query.semester_id,
    })

    const result = await listSubjects(getDb(c), {
      page: query.page,
      limit: query.limit,
      status: 'ACTIVE',
      search: query.search,
      division_id: query.division_id,
      semester_id: query.semester_id,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return subjectsErrorResponse(c, err)
  }
}

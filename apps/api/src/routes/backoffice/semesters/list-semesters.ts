/**
 * List Semesters — GET /semesters
 *
 * File: apps/api/src/routes/backoffice/semesters/list-semesters.ts
 * Stage: STAGE_27_SEMESTERS
 */

import { listSemesters } from '@zidney/domain-core/semesters'
import { createLogger } from '@zidney/logger'
import { listSemestersQuerySchema } from '@zidney/validation/backoffice/semesters.schemas'
import type { Context } from 'hono'
import { getDb, semestersErrorResponse, successResponse } from './helpers'

const logger = createLogger('semesters-route:list-semesters')

export async function listSemestersHandler(c: Context) {
  try {
    const query = await listSemestersQuerySchema.parseAsync(c.req.query())

    logger.debug('List semesters', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    })

    const result = await listSemesters(getDb(c), {
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return semestersErrorResponse(c, err)
  }
}

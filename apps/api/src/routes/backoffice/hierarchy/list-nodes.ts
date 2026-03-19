import { listHierarchyNodes } from '@zidney/domain-core/hierarchy'
import { createLogger } from '@zidney/logger'
import { listHierarchyNodesQuerySchema } from '@zidney/validation/backoffice/hierarchy.schemas'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { getDb, hierarchyErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-hierarchy-list')

export async function listNodesHandler(c: Context<BackofficeEnv>) {
  try {
    const parsed = await listHierarchyNodesQuerySchema.parseAsync(c.req.query())
    const db = getDb(c)

    logger.debug('List hierarchy nodes request', {
      correlation_id: c.get('correlationId'),
      workspace_id: c.get('tenant')?.id,
      page: parsed.page,
      per_page: parsed.per_page,
      status: parsed.status,
    })

    const result = await listHierarchyNodes(db, parsed)
    return c.json(successResponse(result), 200)
  } catch (err) {
    return hierarchyErrorResponse(c, err)
  }
}

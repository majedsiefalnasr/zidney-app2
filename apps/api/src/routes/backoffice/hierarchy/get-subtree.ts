import { getHierarchySubtree } from '@zidney/domain-core/hierarchy'
import { createLogger } from '@zidney/logger'
import {
  hierarchyNodeParamsSchema,
  treeQuerySchema,
} from '@zidney/validation/backoffice/hierarchy.schemas'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, getDb, hierarchyErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-hierarchy-subtree')

export async function getSubtreeHandler(c: Context<BackofficeEnv>) {
  try {
    const params = await hierarchyNodeParamsSchema.parseAsync(c.req.param())
    const query = await treeQuerySchema.parseAsync(c.req.query())
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Get hierarchy subtree request', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      hierarchy_node_id: params.id,
      status: query.status,
    })

    const tree = await getHierarchySubtree(db, params.id, audit, query.status)
    return c.json(successResponse(tree), 200)
  } catch (err) {
    return hierarchyErrorResponse(c, err)
  }
}

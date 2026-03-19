import { deleteHierarchyNode } from '@zidney/domain-core/hierarchy'
import { createLogger } from '@zidney/logger'
import { hierarchyNodeParamsSchema } from '@zidney/validation/backoffice/hierarchy.schemas'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, getDb, hierarchyErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-hierarchy-delete')

export async function deleteNodeHandler(c: Context<BackofficeEnv>) {
  try {
    const params = await hierarchyNodeParamsSchema.parseAsync(c.req.param())
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Delete hierarchy node request', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      hierarchy_node_id: params.id,
    })

    const result = await deleteHierarchyNode(db, params.id, audit)
    return c.json(successResponse(result), 200)
  } catch (err) {
    return hierarchyErrorResponse(c, err)
  }
}

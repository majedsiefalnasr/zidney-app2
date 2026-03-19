import { getHierarchyNode } from '@zidney/domain-core/hierarchy'
import { createLogger } from '@zidney/logger'
import { hierarchyNodeParamsSchema } from '@zidney/validation/backoffice/hierarchy.schemas'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { getDb, hierarchyErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-hierarchy-get')

export async function getNodeHandler(c: Context<BackofficeEnv>) {
  try {
    const params = await hierarchyNodeParamsSchema.parseAsync(c.req.param())
    const db = getDb(c)

    logger.debug('Get hierarchy node request', {
      correlation_id: c.get('correlationId'),
      workspace_id: c.get('tenant')?.id,
      hierarchy_node_id: params.id,
    })

    const node = await getHierarchyNode(db, params.id)
    return c.json(successResponse(node), 200)
  } catch (err) {
    return hierarchyErrorResponse(c, err)
  }
}

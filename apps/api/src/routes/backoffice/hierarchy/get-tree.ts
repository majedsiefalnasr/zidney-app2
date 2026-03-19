import { getHierarchyTree } from '@zidney/domain-core/hierarchy'
import { createLogger } from '@zidney/logger'
import { treeQuerySchema } from '@zidney/validation/backoffice/hierarchy.schemas'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, getDb, hierarchyErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-hierarchy-tree')

export async function getTreeHandler(c: Context<BackofficeEnv>) {
  try {
    const parsed = await treeQuerySchema.parseAsync(c.req.query())
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Get hierarchy tree request', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      status: parsed.status,
    })

    const tree = await getHierarchyTree(db, audit, parsed.status)
    return c.json(successResponse(tree), 200)
  } catch (err) {
    return hierarchyErrorResponse(c, err)
  }
}

import { type UpdateHierarchyNodeInput, updateHierarchyNode } from '@zidney/domain-core/hierarchy'
import { createLogger } from '@zidney/logger'
import {
  hierarchyNodeParamsSchema,
  updateHierarchyNodeBodySchema,
} from '@zidney/validation/backoffice/hierarchy.schemas'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, getDb, hierarchyErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-hierarchy-update')

export async function updateNodeHandler(c: Context<BackofficeEnv>) {
  try {
    const params = await hierarchyNodeParamsSchema.parseAsync(c.req.param())
    const body = await c.req.json().catch(() => ({}))
    const parsed = await updateHierarchyNodeBodySchema.parseAsync(body)
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Update hierarchy node request', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      hierarchy_node_id: params.id,
    })

    const input: UpdateHierarchyNodeInput = {
      ...parsed,
      parent_id: 'parent_id' in parsed ? (parsed.parent_id ?? null) : undefined,
      description: 'description' in parsed ? (parsed.description ?? null) : undefined,
    }

    const node = await updateHierarchyNode(db, params.id, input, audit)
    return c.json(successResponse(node), 200)
  } catch (err) {
    return hierarchyErrorResponse(c, err)
  }
}

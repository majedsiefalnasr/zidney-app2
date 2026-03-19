import { type CreateHierarchyNodeInput, createHierarchyNode } from '@zidney/domain-core/hierarchy'
import { createLogger } from '@zidney/logger'
import { createHierarchyNodeBodySchema } from '@zidney/validation/backoffice/hierarchy.schemas'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, getDb, hierarchyErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-hierarchy-create')

export async function createNodeHandler(c: Context<BackofficeEnv>) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = await createHierarchyNodeBodySchema.parseAsync(body)
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Create hierarchy node request', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      parent_id: parsed.parent_id,
    })

    const input: CreateHierarchyNodeInput = {
      name: parsed.name,
      parent_id: parsed.parent_id ?? null,
      description: parsed.description ?? null,
      status: parsed.status,
    }

    const node = await createHierarchyNode(db, input, audit)
    return c.json(successResponse(node), 201)
  } catch (err) {
    return hierarchyErrorResponse(c, err)
  }
}

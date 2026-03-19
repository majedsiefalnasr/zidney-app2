/**
 * List Groups — GET /groups
 *
 * File: apps/api/src/routes/backoffice/groups/list-groups.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for listing groups with keyset pagination and filters.
 * Validates query parameters via listGroupsQuerySchema.
 */

import { type ListGroupsInput, listGroups } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import { listGroupsQuerySchema } from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-list')

/**
 * GET /groups
 *
 * Query params:
 *   - limit?: number (1-100, default 20)
 *   - cursor?: UUID|timestamp (keyset pagination token)
 *   - status?: 'ENABLED' | 'DISABLED' | 'all' (default 'all')
 *   - department_id?: UUID (filter by department)
 *
 * Returns: { success: true, data: { items, nextCursor, total }, error: null }
 */
export async function listGroupsHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate query parameters
    const queryParams = c.req.query()
    const parsed = await listGroupsQuerySchema.parseAsync(queryParams)

    logger.debug('List groups query', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      limit: parsed.limit,
      cursor: parsed.cursor,
      status: parsed.status,
      department_id: parsed.department_id,
    })

    // Build input for service layer
    const input: ListGroupsInput = {
      limit: parsed.limit,
      cursor: parsed.cursor || undefined,
      status: parsed.status === 'all' ? undefined : parsed.status,
      department_id: parsed.department_id || undefined,
    }

    // Get database client
    const db = getDb(c)

    // Call domain service
    const result = await listGroups(db, input)

    logger.info('Groups listed successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      count: result.items.length,
      total: result.total,
      has_next_page: !!result.nextCursor,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}

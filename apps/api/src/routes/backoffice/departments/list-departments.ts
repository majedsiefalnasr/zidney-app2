/**
 * List Departments — GET /departments
 *
 * File: apps/api/src/routes/backoffice/departments/list-departments.ts
 *
 * Handler for listing departments with keyset pagination and filters.
 * Validates query parameters via listDepartmentsQuerySchema.
 */

import { type ListDepartmentsInput, listDepartments } from '@zidney/domain-core/departments'
import { createLogger } from '@zidney/logger'
import { listDepartmentsQuerySchema } from '@zidney/validation/backoffice/departments.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, departmentErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('backoffice-departments-list')

/**
 * GET /departments
 *
 * Query params:
 *   - limit?: number (1-100, default 20)
 *   - cursor?: UUID (keyset pagination token)
 *   - status?: 'ENABLED' | 'DISABLED' | 'all' (default 'all')
 *   - division_id?: UUID (filter by division)
 *   - parent_id?: UUID | 'root' | null (filter by parent)
 *   - type?: 'MAIN' | 'SUB' | 'SIMPLE' (filter by type)
 *
 * Returns: { success: true, data: { items, nextCursor, total }, error: null }
 */
export async function listDepartmentsHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate query parameters
    const queryParams = c.req.query()
    const parsed = await listDepartmentsQuerySchema.parseAsync(queryParams)

    logger.debug('List departments query', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      limit: parsed.limit,
      cursor: parsed.cursor,
      status: parsed.status,
      division_id: parsed.division_id,
      parent_id: parsed.parent_id,
      type: parsed.type,
    })

    // Build input for service layer
    const input: ListDepartmentsInput = {
      limit: parsed.limit,
      cursor: parsed.cursor || undefined,
      filters: {
        status: parsed.status === 'all' ? undefined : parsed.status,
        division_id: parsed.division_id || undefined,
        parent_id: parsed.parent_id || undefined,
        type: parsed.type || undefined,
      },
    }

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    const result = await listDepartments(db, input, audit)

    logger.info('Departments listed successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      count: result.items.length,
      total: result.total,
      has_next_page: !!result.nextCursor,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return departmentErrorResponse(c, err)
  }
}

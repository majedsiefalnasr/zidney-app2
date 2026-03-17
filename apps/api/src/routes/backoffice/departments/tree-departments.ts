/**
 * Get Department Tree — GET /departments/tree
 *
 * File: apps/api/src/routes/backoffice/departments/tree-departments.ts
 *
 * Handler for retrieving the full department hierarchy tree.
 */

import { getDepartmentTree } from '@zidney/domain-core/departments'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'
import { buildAuditCtx, departmentErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('backoffice-departments-tree')

/**
 * GET /departments/tree
 *
 * Returns: 200 { success: true, data: [{ DepartmentTreeNode }, ...], error: null }
 *
 * Response structure:
 * Each node includes:
 *   - id: UUID
 *   - name: string
 *   - type: 'MAIN' | 'SUB' | 'SIMPLE'
 *   - status: 'ENABLED' | 'DISABLED'
 *   - parent_id: UUID | null (null = root)
 *   - division_id: UUID | null
 *   - children: [{ DepartmentTreeNode }, ...] (recursively nested)
 *
 * Note: Registration order is CRITICAL. This route must be registered BEFORE GET /departments/:id
 *       to avoid UUID parameter parsing conflict.
 */
export async function treeDepartmentsHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    logger.debug('Get department tree request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
    })

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    const tree = await getDepartmentTree(db, audit)

    logger.info('Department tree retrieved successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      root_nodes: tree.length,
    })

    return c.json(successResponse(tree), 200)
  } catch (err) {
    return departmentErrorResponse(c, err)
  }
}

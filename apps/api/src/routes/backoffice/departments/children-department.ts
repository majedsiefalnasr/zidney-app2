/**
 * Get Department Children — GET /departments/:id/children
 *
 * File: apps/api/src/routes/backoffice/departments/children-department.ts
 *
 * Handler for retrieving direct children of a department.
 * Validates path parameter via departmentChildrenParamsSchema.
 */

import { getDepartmentChildren } from '@zidney/domain-core/departments'
import { createLogger } from '@zidney/logger'
import { departmentChildrenParamsSchema } from '@zidney/validation/backoffice/departments.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, departmentErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('backoffice-departments-children')

/**
 * GET /departments/:id/children
 *
 * Path params:
 *   - id: UUID (required, parent department ID)
 *
 * Returns: 200 { success: true, data: [{ Department }, ...], error: null }
 *          404 if parent department not found
 *
 * Note: Results are sorted by created_at ASC, then id ASC.
 *       Returns empty array if parent has no children (no 404).
 */
export async function childrenDepartmentHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')
    const id = c.req.param('id')

    // Validate path parameter
    const parsed = await departmentChildrenParamsSchema.parseAsync({ id })

    logger.debug('Get department children request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      parent_id: parsed.id,
    })

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    const children = await getDepartmentChildren(db, parsed.id, audit)

    logger.info('Department children retrieved successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      parent_id: parsed.id,
      count: children.length,
    })

    return c.json(successResponse(children), 200)
  } catch (err) {
    return departmentErrorResponse(c, err)
  }
}

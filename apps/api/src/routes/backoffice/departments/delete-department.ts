/**
 * Delete Department — DELETE /departments/:id
 *
 * File: apps/api/src/routes/backoffice/departments/delete-department.ts
 *
 * Handler for deleting a department.
 * Validates path parameter via deleteDepartmentParamsSchema.
 */

import { deleteDepartment } from '@zidney/domain-core/departments'
import { createLogger } from '@zidney/logger'
import { deleteDepartmentParamsSchema } from '@zidney/validation/backoffice/departments.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, departmentErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('backoffice-departments-delete')

/**
 * DELETE /departments/:id
 *
 * Path params:
 *   - id: UUID (required)
 *
 * Returns: 200 { success: true, data: { id }, error: null }
 *          404 if department not found
 *          422 if has children, students, or staff assignments
 */
export async function deleteDepartmentHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')
    const id = c.req.param('id')

    // Validate path parameter
    const parsed = await deleteDepartmentParamsSchema.parseAsync({ id })

    logger.debug('Delete department request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      department_id: parsed.id,
    })

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    await deleteDepartment(db, parsed.id, audit)

    logger.info('Department deleted successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      department_id: parsed.id,
    })

    return c.json(successResponse({ id: parsed.id }), 200)
  } catch (err) {
    return departmentErrorResponse(c, err)
  }
}

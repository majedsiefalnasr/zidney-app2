/**
 * Get Department — GET /departments/:id
 *
 * File: apps/api/src/routes/backoffice/departments/get-department.ts
 *
 * Handler for retrieving a single department by ID.
 * Validates path parameter via getDepartmentParamsSchema.
 */

import { getDepartment } from '@zidney/domain-core/departments'
import { createLogger } from '@zidney/logger'
import { getDepartmentParamsSchema } from '@zidney/validation/backoffice/departments.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, departmentErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('backoffice-departments-get')

/**
 * GET /departments/:id
 *
 * Path params:
 *   - id: UUID (required)
 *
 * Returns: 200 { success: true, data: { Department }, error: null }
 *          404 if department not found
 */
export async function getDepartmentHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')
    const id = c.req.param('id')

    // Validate path parameter
    const parsed = await getDepartmentParamsSchema.parseAsync({ id })

    logger.debug('Get department request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      department_id: parsed.id,
    })

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    const department = await getDepartment(db, parsed.id, audit)

    logger.info('Department retrieved successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      department_id: department.id,
      name: department.name,
    })

    return c.json(successResponse(department), 200)
  } catch (err) {
    return departmentErrorResponse(c, err)
  }
}

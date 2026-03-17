/**
 * Update Department — PUT /departments/:id
 *
 * File: apps/api/src/routes/backoffice/departments/update-department.ts
 *
 * Handler for updating an existing department.
 * Validates path parameter via getDepartmentParamsSchema and body via updateDepartmentBodySchema.
 */

import { type UpdateDepartmentInput, updateDepartment } from '@zidney/domain-core/departments'
import { createLogger } from '@zidney/logger'
import {
  getDepartmentParamsSchema,
  updateDepartmentBodySchema,
} from '@zidney/validation/backoffice/departments.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, departmentErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('backoffice-departments-update')

/**
 * PUT /departments/:id
 *
 * Path params:
 *   - id: UUID (required)
 *
 * Body (all optional):
 *   - name?: string (1-255 characters)
 *   - type?: 'MAIN' | 'SUB' | 'SIMPLE'
 *   - parent_id?: UUID | null
 *   - division_id?: UUID | null
 *   - max_users?: number | null
 *   - description?: string (0-500 characters)
 *
 * Returns: 200 { success: true, data: { Department }, error: null }
 *          404 if department not found
 *          422 if cycle detected, div mismatch, etc.
 */
export async function updateDepartmentHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')
    const id = c.req.param('id')

    // Validate path parameter
    const pathParams = await getDepartmentParamsSchema.parseAsync({ id })

    // Parse and validate body
    const body = await c.req.json().catch(() => ({}))
    const parsed = await updateDepartmentBodySchema.parseAsync(body)

    logger.debug('Update department request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      department_id: pathParams.id,
      updates: Object.keys(parsed).filter((k) => parsed[k as keyof typeof parsed] !== undefined),
    })

    // Build input for service layer (only include provided fields)
    const input: UpdateDepartmentInput = {
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.type !== undefined && { type: parsed.type }),
      ...(parsed.parent_id !== undefined && { parent_id: parsed.parent_id }),
      ...(parsed.division_id !== undefined && { division_id: parsed.division_id }),
      ...(parsed.max_users !== undefined && { max_users: parsed.max_users }),
      ...(parsed.description !== undefined && { description: parsed.description }),
    }

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    const department = await updateDepartment(db, pathParams.id, input, audit)

    logger.info('Department updated successfully', {
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

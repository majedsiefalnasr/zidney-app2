/**
 * Create Department — POST /departments
 *
 * File: apps/api/src/routes/backoffice/departments/create-department.ts
 *
 * Handler for creating a new department.
 * Validates request body via createDepartmentBodySchema.
 */

import { type CreateDepartmentInput, createDepartment } from '@zidney/domain-core/departments'
import { createLogger } from '@zidney/logger'
import { createDepartmentBodySchema } from '@zidney/validation/backoffice/departments.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, departmentErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('backoffice-departments-create')

/**
 * POST /departments
 *
 * Body:
 *   - name: string (1-255 characters, required)
 *   - type: 'MAIN' | 'SUB' | 'SIMPLE' (required)
 *   - parent_id?: UUID (optional, null = root)
 *   - division_id?: UUID (optional, null = none)
 *   - max_users?: number (optional, null = unlimited)
 *   - description?: string (optional, 0-500 characters)
 *
 * Returns: 201 { success: true, data: { Department }, error: null }
 */
export async function createDepartmentHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Parse and validate body
    const body = await c.req.json().catch(() => ({}))
    const parsed = await createDepartmentBodySchema.parseAsync(body)

    logger.debug('Create department request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      name: parsed.name,
      type: parsed.type,
      parent_id: parsed.parent_id,
      division_id: parsed.division_id,
    })

    // Build input for service layer
    const input: CreateDepartmentInput = {
      name: parsed.name,
      type: parsed.type,
      parent_id: parsed.parent_id || undefined,
      division_id: parsed.division_id || undefined,
      max_users: parsed.max_users || undefined,
      description: parsed.description || undefined,
    }

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    const department = await createDepartment(db, input, audit)

    logger.info('Department created successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      department_id: department.id,
      name: department.name,
      type: department.type,
    })

    return c.json(successResponse(department), 201)
  } catch (err) {
    return departmentErrorResponse(c, err)
  }
}

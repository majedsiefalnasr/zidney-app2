/**
 * Staff Department Routes — GET, POST, DELETE /staff/:staffId/departments
 *
 * File: apps/api/src/routes/backoffice/departments/staff-departments.ts
 *
 * Handlers for managing staff-department assignments.
 * Validates path and body parameters via staffDepartmentsParamsSchema, assignStaffDepartmentBodySchema, removeStaffDepartmentParamsSchema.
 */

import {
  assignStaffDepartment,
  getStaffDepartments,
  removeStaffDepartment,
} from '@zidney/domain-core/departments'
import { createLogger } from '@zidney/logger'
import {
  assignStaffDepartmentBodySchema,
  removeStaffDepartmentParamsSchema,
  staffDepartmentsParamsSchema,
} from '@zidney/validation/backoffice/departments.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, departmentErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('backoffice-staff-departments')

// ---------------------------------------------------------------------------
// GET /staff/:staffId/departments
// ---------------------------------------------------------------------------

/**
 * GET /staff/:staffId/departments
 *
 * Path params:
 *   - staffId: UUID (required)
 *
 * Returns: 200 { success: true, data: [{ StaffDepartment }, ...], error: null }
 *
 * Note: Results are sorted by assigned_at ASC.
 *       Returns empty array if staff has no department assignments (no 404).
 */
export async function listStaffDepartmentsHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')
    const staffId = c.req.param('staffId')

    // Validate path parameter
    const parsed = await staffDepartmentsParamsSchema.parseAsync({ staffId })

    logger.debug('List staff departments request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: parsed.staffId,
    })

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    const assignments = await getStaffDepartments(db, parsed.staffId, audit)

    logger.info('Staff departments retrieved successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: parsed.staffId,
      count: assignments.length,
    })

    return c.json(successResponse(assignments), 200)
  } catch (err) {
    return departmentErrorResponse(c, err)
  }
}

// ---------------------------------------------------------------------------
// POST /staff/:staffId/departments
// ---------------------------------------------------------------------------

/**
 * POST /staff/:staffId/departments
 *
 * Path params:
 *   - staffId: UUID (required)
 *
 * Body:
 *   - department_id: UUID (required)
 *
 * Returns: 201 { success: true, data: { StaffDepartment }, error: null }
 *          422 if department disabled, division mismatch, etc.
 *
 * Note: Idempotent. If assignment already exists, returns 201 with existing row.
 */
export async function assignStaffDepartmentHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')
    const staffId = c.req.param('staffId')

    // Validate path parameter
    const pathParams = await staffDepartmentsParamsSchema.parseAsync({ staffId })

    // Parse and validate body
    const body = await c.req.json().catch(() => ({}))
    const bodyParsed = await assignStaffDepartmentBodySchema.parseAsync(body)

    logger.debug('Assign staff department request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: pathParams.staffId,
      department_id: bodyParsed.department_id,
    })

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    const assignment = await assignStaffDepartment(
      db,
      pathParams.staffId,
      bodyParsed.department_id,
      audit
    )

    logger.info('Staff department assigned successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: pathParams.staffId,
      department_id: bodyParsed.department_id,
    })

    return c.json(successResponse(assignment), 201)
  } catch (err) {
    return departmentErrorResponse(c, err)
  }
}

// ---------------------------------------------------------------------------
// DELETE /staff/:staffId/departments/:departmentId
// ---------------------------------------------------------------------------

/**
 * DELETE /staff/:staffId/departments/:departmentId
 *
 * Path params:
 *   - staffId: UUID (required)
 *   - departmentId: UUID (required)
 *
 * Returns: 200 { success: true, data: { staffId, departmentId }, error: null }
 *          404 if assignment not found
 *
 * Note: Idempotent. Returns 200 even if assignment doesn't exist.
 *       Actually, per service implementation: throws DEPT_STAFF_ASSIGNMENT_NOT_FOUND (404).
 *       To make truly idempotent, service should be updated. For now, follows strict contract.
 */
export async function removeStaffDepartmentHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')
    const staffId = c.req.param('staffId')
    const departmentId = c.req.param('departmentId')

    // Validate path parameters
    const parsed = await removeStaffDepartmentParamsSchema.parseAsync({
      staffId,
      departmentId,
    })

    logger.debug('Remove staff department request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: parsed.staffId,
      department_id: parsed.departmentId,
    })

    // Get database client
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Call domain service
    await removeStaffDepartment(db, parsed.staffId, parsed.departmentId, audit)

    logger.info('Staff department removed successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: parsed.staffId,
      department_id: parsed.departmentId,
    })

    return c.json(
      successResponse({
        staffId: parsed.staffId,
        departmentId: parsed.departmentId,
      }),
      200
    )
  } catch (err) {
    return departmentErrorResponse(c, err)
  }
}

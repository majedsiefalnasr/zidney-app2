/**
 * Remove Student from Group — DELETE /students/:studentId/group
 *
 * File: apps/api/src/routes/backoffice/groups/remove-student-group.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for removing a student's group assignment.
 */

import { removeStudentFromGroup } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import { studentGroupParamsSchema } from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-remove-student')

/**
 * DELETE /students/:studentId/group
 *
 * Path params:
 *   - studentId: UUID
 *
 * Returns: 200 { success: true, data: { removed: true }, error: null }
 *
 * Errors:
 *   - 404 STUDENT_NOT_FOUND
 *   - 404 GROUP_STUDENT_ASSIGNMENT_NOT_FOUND (student has no group)
 */
export async function removeStudentGroupHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate path params
    const params = await studentGroupParamsSchema.parseAsync(c.req.param())

    logger.debug('Remove student from group request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      student_id: params.studentId,
    })

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await removeStudentFromGroup(db, params.studentId, audit)

    logger.info('Student removed from group successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      student_id: params.studentId,
    })

    return c.json(successResponse({ removed: true }), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}

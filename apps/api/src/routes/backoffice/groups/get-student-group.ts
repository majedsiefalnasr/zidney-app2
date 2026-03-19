/**
 * Get Student Group — GET /students/:studentId/group
 *
 * File: apps/api/src/routes/backoffice/groups/get-student-group.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for fetching a student's current group assignment.
 * Returns data: null (not a 404) when the student has no group.
 */

import { getStudentGroup } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import { studentGroupParamsSchema } from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-get-student')

/**
 * GET /students/:studentId/group
 *
 * Path params:
 *   - studentId: UUID
 *
 * Returns:
 *   200 { success: true, data: { StudentGroupResult }, error: null } — when student has a group
 *   200 { success: true, data: null, error: null } — when student has no group assignment
 *
 * Errors:
 *   - 404 STUDENT_NOT_FOUND
 */
export async function getStudentGroupHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate path params
    const params = await studentGroupParamsSchema.parseAsync(c.req.param())

    logger.debug('Get student group request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      student_id: params.studentId,
    })

    const db = getDb(c)

    const result = await getStudentGroup(db, params.studentId)

    logger.info('Student group fetched', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      student_id: params.studentId,
      has_group: result !== null,
    })

    // result is null when student has no group — return 200 with data: null (not a 404)
    return c.json(successResponse(result), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}

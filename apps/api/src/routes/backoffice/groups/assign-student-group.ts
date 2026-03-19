/**
 * Assign Student to Group — PUT /students/:studentId/group
 *
 * File: apps/api/src/routes/backoffice/groups/assign-student-group.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for assigning (or re-assigning) a student to a group.
 * Idempotent — re-assigning to the same group is a no-op (200).
 * Uses SELECT FOR UPDATE on the groups row to prevent max_members race conditions.
 */

import { assignStudentToGroup, type StudentGroupResult } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import {
  assignStudentGroupBodySchema,
  studentGroupParamsSchema,
} from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-assign-student')

/**
 * PUT /students/:studentId/group
 *
 * Path params:
 *   - studentId: UUID
 *
 * Body:
 *   - group_id: UUID
 *
 * Returns: 200 { success: true, data: { StudentGroupResult }, error: null }
 *
 * Errors:
 *   - 404 GROUP_NOT_FOUND
 *   - 404 STUDENT_NOT_FOUND
 *   - 422 GROUP_MAX_MEMBERS_EXCEEDED
 *   - 422 GROUP_DIVISION_MISMATCH
 *   - 422 GROUP_DISABLED
 */
export async function assignStudentGroupHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate path params
    const params = await studentGroupParamsSchema.parseAsync(c.req.param())

    // Parse and validate body
    const body = await c.req.json().catch(() => ({}))
    const parsed = await assignStudentGroupBodySchema.parseAsync(body)

    logger.debug('Assign student to group request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      student_id: params.studentId,
      group_id: parsed.group_id,
    })

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result: StudentGroupResult = await assignStudentToGroup(
      db,
      params.studentId,
      parsed.group_id,
      audit
    )

    logger.info('Student assigned to group successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      student_id: params.studentId,
      group_id: result.group.id,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}

/**
 * Remove Staff from Group — DELETE /staff/:staffId/groups/:groupId
 *
 * File: apps/api/src/routes/backoffice/groups/remove-staff-group.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for removing a staff member from a single group.
 * Returns the remaining list of groups the staff member belongs to after removal.
 */

import { removeStaffFromGroup } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import { staffGroupDetailParamsSchema } from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-remove-staff')

/**
 * DELETE /staff/:staffId/groups/:groupId
 *
 * Path params:
 *   - staffId: UUID
 *   - groupId: UUID
 *
 * Returns: 200 { success: true, data: GroupRow[], error: null }
 *          (remaining groups the staff member belongs to)
 *
 * Errors:
 *   - 404 STAFF_NOT_FOUND
 *   - 404 GROUP_NOT_FOUND
 *   - 404 GROUP_STAFF_ASSIGNMENT_NOT_FOUND
 */
export async function removeStaffGroupHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate path params
    const params = await staffGroupDetailParamsSchema.parseAsync(c.req.param())

    logger.debug('Remove staff from group request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: params.staffId,
      group_id: params.groupId,
    })

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const groups = await removeStaffFromGroup(db, params.staffId, params.groupId, audit)

    logger.info('Staff removed from group successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: params.staffId,
      group_id: params.groupId,
      remaining_groups: groups.length,
    })

    return c.json(successResponse(groups), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}

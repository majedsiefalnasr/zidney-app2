/**
 * Assign Staff to Group — POST /staff/:staffId/groups
 *
 * File: apps/api/src/routes/backoffice/groups/assign-staff-group.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for assigning a staff member to a group.
 * Idempotent — assigning to an already-assigned group is a no-op.
 * Returns the full list of groups the staff member belongs to after assignment.
 */

import { assignStaffToGroup } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import {
  assignStaffGroupBodySchema,
  staffGroupParamsSchema,
} from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-assign-staff')

/**
 * POST /staff/:staffId/groups
 *
 * Path params:
 *   - staffId: UUID
 *
 * Body:
 *   - group_id: UUID
 *
 * Returns: 200 { success: true, data: GroupRow[], error: null }
 *          (full list of groups the staff member now belongs to)
 *
 * Errors:
 *   - 404 GROUP_NOT_FOUND
 *   - 404 STAFF_NOT_FOUND
 *   - 422 GROUP_DISABLED
 *   - 422 GROUP_DIVISION_MISMATCH
 */
export async function assignStaffGroupHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate path params
    const params = await staffGroupParamsSchema.parseAsync(c.req.param())

    // Parse and validate body
    const body = await c.req.json().catch(() => ({}))
    const parsed = await assignStaffGroupBodySchema.parseAsync(body)

    logger.debug('Assign staff to group request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: params.staffId,
      group_id: parsed.group_id,
    })

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const groups = await assignStaffToGroup(db, params.staffId, parsed.group_id, audit)

    logger.info('Staff assigned to group successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: params.staffId,
      group_id: parsed.group_id,
      total_groups: groups.length,
    })

    return c.json(successResponse(groups), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}

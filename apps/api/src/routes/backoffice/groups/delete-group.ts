/**
 * Delete Group — DELETE /groups/:id
 *
 * File: apps/api/src/routes/backoffice/groups/delete-group.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for soft-deleting a group.
 * Validates path parameters via getGroupParamsSchema.
 */

import { deleteGroup } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import { getGroupParamsSchema } from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-delete')

/**
 * DELETE /groups/:id
 *
 * Path params:
 *   - id: UUID (group ID)
 *
 * Returns: 200 { success: true, data: { deleted: true }, error: null }
 *          404 if group not found
 *          422 if group has enrolled students, exam targets, or ads targets
 */
export async function deleteGroupHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate path parameters
    const params = await getGroupParamsSchema.parseAsync(c.req.param())

    logger.debug('Delete group request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      group_id: params.id,
    })

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await deleteGroup(db, params.id, audit)

    logger.info('Group deleted successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      group_id: params.id,
    })

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}

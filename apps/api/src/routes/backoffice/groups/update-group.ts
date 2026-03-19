/**
 * Update Group — PATCH /groups/:id
 *
 * File: apps/api/src/routes/backoffice/groups/update-group.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for updating an existing group (partial update).
 * Validates path params and request body.
 */

import { type UpdateGroupInput, updateGroup } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import {
  getGroupParamsSchema,
  updateGroupBodySchema,
} from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-update')

/**
 * PATCH /groups/:id
 *
 * Path params:
 *   - id: UUID (group ID)
 *
 * Body (all fields optional):
 *   - name?: string (1-255 characters)
 *   - department_id?: UUID | null
 *   - max_members?: number | null
 *   - description?: string | null
 *   - status?: 'ENABLED' | 'DISABLED'
 *
 * Returns: 200 { success: true, data: { Group }, error: null }
 */
export async function updateGroupHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate path params
    const params = await getGroupParamsSchema.parseAsync(c.req.param())

    // Parse and validate body
    const body = await c.req.json().catch(() => ({}))
    const parsed = await updateGroupBodySchema.parseAsync(body)

    logger.debug('Update group request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      group_id: params.id,
      fields: Object.keys(parsed),
    })

    // Build input — only include fields that were provided
    const input: UpdateGroupInput = {
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.department_id !== undefined && { department_id: parsed.department_id }),
      ...(parsed.max_members !== undefined && { max_members: parsed.max_members }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.status !== undefined && { status: parsed.status }),
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const group = await updateGroup(db, params.id, input, audit)

    logger.info('Group updated successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      group_id: group.id,
    })

    return c.json(successResponse(group), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}

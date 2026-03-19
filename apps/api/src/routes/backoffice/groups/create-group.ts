/**
 * Create Group — POST /groups
 *
 * File: apps/api/src/routes/backoffice/groups/create-group.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for creating a new group.
 * Validates request body via createGroupBodySchema.
 */

import { type CreateGroupInput, createGroup } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import { createGroupBodySchema } from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-create')

/**
 * POST /groups
 *
 * Body:
 *   - name: string (1-255 characters, required)
 *   - department_id?: UUID (optional, null = global group)
 *   - max_members?: number (optional, null = unlimited)
 *   - description?: string (optional, 0-2000 characters)
 *
 * Returns: 201 { success: true, data: { Group }, error: null }
 */
export async function createGroupHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Parse and validate body
    const body = await c.req.json().catch(() => ({}))
    const parsed = await createGroupBodySchema.parseAsync(body)

    logger.debug('Create group request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      name: parsed.name,
      department_id: parsed.department_id,
    })

    // Build input for service layer
    const input: CreateGroupInput = {
      name: parsed.name,
      department_id: parsed.department_id || undefined,
      max_members: parsed.max_members ?? undefined,
      description: parsed.description || undefined,
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const group = await createGroup(db, input, audit)

    logger.info('Group created successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      group_id: group.id,
      name: group.name,
    })

    return c.json(successResponse(group), 201)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}

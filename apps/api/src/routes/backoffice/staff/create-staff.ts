/**
 * Create Staff — POST /staff
 *
 * File: apps/api/src/routes/backoffice/staff/create-staff.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 */

import { createStaff } from '@zidney/domain-core/staff'
import { createLogger } from '@zidney/logger'
import { createStaffBodySchema } from '@zidney/validation'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, staffErrorResponse } from './helpers'

const logger = createLogger('backoffice-staff-create')

export async function handleCreateStaff(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const body = await c.req.json().catch(() => ({}))
    const parsed = createStaffBodySchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input',
          },
        },
        422
      )
    }

    // Read staff_limit from workspace license context
    const license = c.get('license')
    const staffLimit: number = license?.staff_limit ?? 50

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Create staff request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
    })

    const record = await createStaff(
      db,
      { workspace_id: workspaceId, ...parsed.data },
      staffLimit,
      audit
    )

    return c.json({ success: true, data: record, error: null }, 201)
  } catch (err) {
    return staffErrorResponse(c, err)
  }
}

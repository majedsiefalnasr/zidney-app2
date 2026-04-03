/**
 * Disable Staff — PATCH /staff/:id/disable
 *
 * File: apps/api/src/routes/backoffice/staff/disable-staff.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 */

import { disableStaff } from '@zidney/domain-core/staff'
import { createLogger } from '@zidney/logger'
import { staffIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, staffErrorResponse } from './helpers'

const logger = createLogger('backoffice-staff-disable')

export async function handleDisableStaff(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const parsed = staffIdParamsSchema.safeParse({ id: c.req.param('id') })
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid id',
          },
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Disable staff request', {
      workspace_id: workspaceId,
      staff_id: parsed.data.id,
      correlation_id: correlationId,
    })

    const record = await disableStaff(db, workspaceId, parsed.data.id, audit)

    return c.json({ success: true, data: record, error: null }, 200)
  } catch (err) {
    return staffErrorResponse(c, err)
  }
}

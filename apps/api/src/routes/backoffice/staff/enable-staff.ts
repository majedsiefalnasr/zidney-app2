/**
 * Enable Staff — PATCH /staff/:id/enable
 *
 * File: apps/api/src/routes/backoffice/staff/enable-staff.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 */

import { enableStaff } from '@zidney/domain-core/staff'
import { createLogger } from '@zidney/logger'
import { staffIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, staffErrorResponse } from './helpers'

const logger = createLogger('backoffice-staff-enable')

export async function handleEnableStaff(c: Context) {
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
    const staffLimit = c.get('staff_limit') as number | null

    logger.debug('Enable staff request', {
      workspace_id: workspaceId,
      staff_id: parsed.data.id,
      correlation_id: correlationId,
    })

    const record = await enableStaff(db, workspaceId, parsed.data.id, staffLimit, audit)

    return c.json({ success: true, data: record, error: null }, 200)
  } catch (err) {
    return staffErrorResponse(c, err)
  }
}

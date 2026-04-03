/**
 * Update Staff — PUT /staff/:id
 *
 * File: apps/api/src/routes/backoffice/staff/update-staff.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 */

import { updateStaff } from '@zidney/domain-core/staff'
import { createLogger } from '@zidney/logger'
import { staffIdParamsSchema, updateStaffBodySchema } from '@zidney/validation'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, staffErrorResponse } from './helpers'

const logger = createLogger('backoffice-staff-update')

export async function handleUpdateStaff(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const requestId: string | null = (c.get('request_id') as string | undefined) ?? null

    const parsedParams = staffIdParamsSchema.safeParse({ id: c.req.param('id') })
    if (!parsedParams.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsedParams.error.issues[0]?.message ?? 'Invalid id',
          },
          request_id: requestId,
        },
        422
      )
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body is not valid JSON',
          },
          request_id: requestId,
        },
        400
      )
    }
    const parsedBody = updateStaffBodySchema.safeParse(body)
    if (!parsedBody.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsedBody.error.issues[0]?.message ?? 'Invalid input',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Update staff request', {
      workspace_id: workspaceId,
      user_id: c.get('user_id') as string | undefined,
      staff_id: parsedParams.data.id,
      correlation_id: correlationId,
    })

    const record = await updateStaff(db, workspaceId, parsedParams.data.id, parsedBody.data, audit)

    return c.json({ success: true, data: record, error: null }, 200)
  } catch (err) {
    return staffErrorResponse(c, err)
  }
}

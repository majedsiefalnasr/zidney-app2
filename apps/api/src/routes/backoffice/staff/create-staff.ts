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

    const requestId: string | null = (c.get('request_id') as string | undefined) ?? null

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
          request_id: requestId,
        },
        422
      )
    }

    // Read staff_limit from license enforcement middleware context
    const staffLimit = c.get('staff_limit') as number | null

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Create staff request', {
      workspace_id: workspaceId,
      user_id: c.get('user_id'),
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

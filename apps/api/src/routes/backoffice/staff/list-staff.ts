/**
 * List Staff — GET /staff
 *
 * File: apps/api/src/routes/backoffice/staff/list-staff.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 */

import { listStaff } from '@zidney/domain-core/staff'
import { createLogger } from '@zidney/logger'
import { staffListQuerySchema } from '@zidney/validation'
import type { Context } from 'hono'
import { getDb, staffErrorResponse } from './helpers'

const logger = createLogger('backoffice-staff-list')

export async function handleListStaff(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawQuery = c.req.query()
    const parsed = staffListQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query',
          },
        },
        422
      )
    }

    const db = getDb(c)

    logger.debug('List staff request', { workspace_id: workspaceId, correlation_id: correlationId })

    const result = await listStaff(db, { workspace_id: workspaceId, ...parsed.data })

    return c.json({ success: true, data: result, error: null }, 200)
  } catch (err) {
    return staffErrorResponse(c, err)
  }
}

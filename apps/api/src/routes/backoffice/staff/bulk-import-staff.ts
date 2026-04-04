/**
 * Bulk Import Staff — POST /staff/bulk-import
 *
 * File: apps/api/src/routes/backoffice/staff/bulk-import-staff.ts
 * Stage: STAGE_43_LIMIT_ENFORCEMENT
 */

import { bulkImportStaff } from '@zidney/domain-core/staff'
import { createLogger } from '@zidney/logger'
import { bulkImportStaffBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, staffErrorResponse } from './helpers'

const logger = createLogger('backoffice-staff-bulk-import')

export async function handleBulkImportStaff(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? null
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawBody = await c.req.json().catch(() => ({}))
    const parsed = bulkImportStaffBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
          request_id: requestId,
        },
        422
      )
    }

    const license = c.get('license')
    if (!license || license.status !== 'ACTIVE') {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'LICENSE_INACTIVE',
            message: 'Workspace license is not active',
          },
          request_id: requestId,
        },
        403
      )
    }

    const staffLimit = c.get('staff_limit') as number | null
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Bulk import staff request', {
      workspace_id: workspaceId,
      row_count: parsed.data.rows.length,
      correlation_id: correlationId,
    })

    const result = await bulkImportStaff(db, workspaceId, parsed.data.rows, staffLimit, audit)

    return c.json({ success: true, data: result, error: null, request_id: requestId }, 200)
  } catch (err) {
    return staffErrorResponse(c, err)
  }
}

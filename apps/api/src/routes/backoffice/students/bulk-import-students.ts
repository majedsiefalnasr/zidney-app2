/**
 * Bulk Import Students — POST /students/bulk-import
 *
 * File: apps/api/src/routes/backoffice/students/bulk-import-students.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 */

import { bulkImportStudents } from '@zidney/domain-core/students'
import { createLogger } from '@zidney/logger'
import { bulkImportBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, studentErrorResponse } from './helpers'

const logger = createLogger('backoffice-students-bulk-import')

export async function handleBulkImportStudents(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? null
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawBody = await c.req.json().catch(() => ({}))
    const parsed = bulkImportBodySchema.safeParse(rawBody)
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
    const studentLimit: number = license.student_limit
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Bulk import students request', {
      workspace_id: workspaceId,
      row_count: parsed.data.rows.length,
      division_id: parsed.data.division_id,
      correlation_id: correlationId,
    })

    const result = await bulkImportStudents(
      db,
      workspaceId,
      parsed.data.rows,
      studentLimit,
      parsed.data.division_id,
      audit
    )

    return c.json({ success: true, data: result, error: null, request_id: requestId }, 200)
  } catch (err) {
    return studentErrorResponse(c, err)
  }
}

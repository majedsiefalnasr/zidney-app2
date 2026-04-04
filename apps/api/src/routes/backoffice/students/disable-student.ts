/**
 * Disable Student — PATCH /students/:id/disable
 *
 * File: apps/api/src/routes/backoffice/students/disable-student.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 */

import { disableStudent } from '@zidney/domain-core/students'
import { createLogger } from '@zidney/logger'
import { studentIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, studentErrorResponse } from './helpers'

const logger = createLogger('backoffice-students-disable')

export async function handleDisableStudent(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const parsed = studentIdParamsSchema.safeParse({ id: c.req.param('id') })
    if (!parsed.success) {
      const requestId = (c.get('request_id') as string | undefined) ?? null
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid id',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Disable student request', {
      workspace_id: workspaceId,
      student_id: parsed.data.id,
      correlation_id: correlationId,
    })

    const record = await disableStudent(db, workspaceId, parsed.data.id, audit)

    return c.json({ success: true, data: record, error: null }, 200)
  } catch (err) {
    return studentErrorResponse(c, err)
  }
}

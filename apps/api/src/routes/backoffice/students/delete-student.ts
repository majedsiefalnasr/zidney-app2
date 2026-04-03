/**
 * Delete Student — DELETE /students/:id
 *
 * File: apps/api/src/routes/backoffice/students/delete-student.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 */

import { deleteStudent } from '@zidney/domain-core/students'
import { createLogger } from '@zidney/logger'
import { studentIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, studentErrorResponse } from './helpers'

const logger = createLogger('backoffice-students-delete')

export async function handleDeleteStudent(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const parsed = studentIdParamsSchema.safeParse({ id: c.req.param('id') })
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

    logger.debug('Delete student request', {
      workspace_id: workspaceId,
      student_id: parsed.data.id,
      correlation_id: correlationId,
    })

    await deleteStudent(db, workspaceId, parsed.data.id, audit)

    return c.json({ success: true, data: null, error: null }, 200)
  } catch (err) {
    return studentErrorResponse(c, err)
  }
}

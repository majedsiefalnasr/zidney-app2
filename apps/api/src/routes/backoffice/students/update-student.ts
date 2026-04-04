/**
 * Update Student — PATCH /students/:id
 *
 * File: apps/api/src/routes/backoffice/students/update-student.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 */

import { updateStudent } from '@zidney/domain-core/students'
import { createLogger } from '@zidney/logger'
import { studentIdParamsSchema, updateStudentBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, studentErrorResponse } from './helpers'

const logger = createLogger('backoffice-students-update')

export async function handleUpdateStudent(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const idParsed = studentIdParamsSchema.safeParse({ id: c.req.param('id') })
    if (!idParsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: idParsed.error.issues[0]?.message ?? 'Invalid id',
          },
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
          error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
        },
        400
      )
    }

    const parsed = updateStudentBodySchema.safeParse(body)
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

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Update student request', {
      workspace_id: workspaceId,
      student_id: idParsed.data.id,
      correlation_id: correlationId,
    })

    const record = await updateStudent(db, workspaceId, idParsed.data.id, parsed.data, audit)

    return c.json({ success: true, data: record, error: null }, 200)
  } catch (err) {
    return studentErrorResponse(c, err)
  }
}

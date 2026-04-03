/**
 * Create Student — POST /students
 *
 * File: apps/api/src/routes/backoffice/students/create-student.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 */

import { createStudent } from '@zidney/domain-core/students'
import { createLogger } from '@zidney/logger'
import { createStudentBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, studentErrorResponse } from './helpers'

const logger = createLogger('backoffice-students-create')

export async function handleCreateStudent(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

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

    const parsed = createStudentBodySchema.safeParse(body)
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

    const license = c.get('license')
    const studentLimit: number = license?.student_limit ?? 100

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Create student request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
    })

    const record = await createStudent(
      db,
      { workspace_id: workspaceId, ...parsed.data },
      audit,
      studentLimit
    )

    return c.json({ success: true, data: record, error: null }, 201)
  } catch (err) {
    return studentErrorResponse(c, err)
  }
}

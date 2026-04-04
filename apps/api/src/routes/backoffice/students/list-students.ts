/**
 * List Students — GET /students
 *
 * File: apps/api/src/routes/backoffice/students/list-students.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 */

import { listStudents } from '@zidney/domain-core/students'
import { createLogger } from '@zidney/logger'
import { studentListQuerySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, studentErrorResponse } from './helpers'

const logger = createLogger('backoffice-students-list')

export async function handleListStudents(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawQuery = c.req.query()
    const parsed = studentListQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
      const requestId = (c.get('request_id') as string | undefined) ?? null
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('List students request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
    })

    const result = await listStudents(db, { workspace_id: workspaceId, ...parsed.data }, audit)

    return c.json({ success: true, data: result, error: null }, 200)
  } catch (err) {
    return studentErrorResponse(c, err)
  }
}

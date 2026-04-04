/**
 * Update Student Subscription — PATCH /students/:id/subscription
 *
 * File: apps/api/src/routes/backoffice/students/update-student-subscription.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 */

import { updateStudentSubscriptionStatus } from '@zidney/domain-core/students'
import { createLogger } from '@zidney/logger'
import { studentIdParamsSchema, updateSubscriptionStatusBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, studentErrorResponse } from './helpers'

const logger = createLogger('backoffice-students-subscription')

export async function handleUpdateStudentSubscription(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? null
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const paramsParsed = studentIdParamsSchema.safeParse({ id: c.req.param('id') })
    if (!paramsParsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: paramsParsed.error.issues[0]?.message ?? 'Invalid id',
          },
          request_id: requestId,
        },
        422
      )
    }

    let rawBody: unknown
    try {
      rawBody = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
          request_id: requestId,
        },
        400
      )
    }
    const bodyParsed = updateSubscriptionStatusBodySchema.safeParse(rawBody)
    if (!bodyParsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: bodyParsed.error.issues[0]?.message ?? 'Invalid request body',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Update student subscription request', {
      workspace_id: workspaceId,
      student_id: paramsParsed.data.id,
      subscription_status: bodyParsed.data.subscription_status,
      correlation_id: correlationId,
    })

    const record = await updateStudentSubscriptionStatus(
      db,
      workspaceId,
      paramsParsed.data.id,
      { subscription_status: bodyParsed.data.subscription_status },
      audit
    )

    return c.json({ success: true, data: record, error: null }, 200)
  } catch (err) {
    return studentErrorResponse(c, err)
  }
}

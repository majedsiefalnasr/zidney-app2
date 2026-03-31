/**
 * Handler: POST /api/v1/backoffice/workspace/traditional-questions/:questionId/workflow/transition
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/transition-question.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Bridges RBAC permissions to workflow engine format (AD-002) before delegating to
 * the transitionQuestionStatus service function.
 */

import { transitionQuestionStatus } from '@zidney/domain-core/traditional-questions'
import { createLogger } from '@zidney/logger'
import {
  questionIdParamSchema,
  transitionQuestionBodySchema,
} from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import {
  buildAuditCtx,
  buildQuestionWorkflowPermissions,
  getDb,
  successResponse,
  traditionalQuestionsErrorResponse,
} from './helpers'

const logger = createLogger('traditional-questions-route:transition')

export async function transitionQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalQuestionsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = transitionQuestionBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalQuestionsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Bridge RBAC permissions to workflow engine permission tokens (AD-002)
    const rbacPerms = (c.get('rbacContext') as { permissions: string[] } | null)?.permissions ?? []
    const enginePermissions = buildQuestionWorkflowPermissions(rbacPerms)

    const result = await transitionQuestionStatus(
      db,
      paramParsed.data.questionId,
      bodyParsed.data.to,
      {
        ...audit,
        enginePermissions,
      }
    )

    logger.info('Traditional question status transitioned via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      to: bodyParsed.data.to,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}

/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-questions/:questionId/workflow/transition
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/transition-question.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 *
 * Bridges RBAC permissions to workflow engine format (AD-002) before delegating to
 * the transitionQuestionStatus service function.
 */

import { transitionQuestionStatus } from '@zidney/domain-core/mcq-questions'
import { createLogger } from '@zidney/logger'
import {
  questionIdParamSchema,
  transitionQuestionBodySchema,
} from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import {
  buildAuditCtx,
  buildQuestionWorkflowPermissions,
  getDb,
  mcqQuestionsErrorResponse,
  successResponse,
} from './helpers'

const logger = createLogger('mcq-questions-route:transition')

export async function transitionQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqQuestionsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = transitionQuestionBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqQuestionsErrorResponse(c, bodyParsed.error)

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

    logger.info('MCQ question status transitioned via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      to: bodyParsed.data.to,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}

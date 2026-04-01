/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-exams/:examId/workflow/transition
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/transition-exam.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Bridges RBAC permissions to workflow engine format (AD-002) before delegating to
 * the transitionExamStatus service function.
 */

import { transitionExamStatus } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import {
  examIdParamSchema,
  transitionExamBodySchema,
} from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import {
  buildAuditCtx,
  buildExamWorkflowPermissions,
  getDb,
  mcqExamsErrorResponse,
  successResponse,
} from './helpers'

const logger = createLogger('mcq-exams-route:transition')

export async function transitionExamHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = transitionExamBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Bridge RBAC permissions to workflow engine permission tokens (AD-002)
    const rbacPerms = (c.get('rbacContext') as { permissions: string[] } | null)?.permissions ?? []
    const enginePermissions = buildExamWorkflowPermissions(rbacPerms)

    const result = await transitionExamStatus(db, paramParsed.data.examId, bodyParsed.data.to, {
      ...audit,
      enginePermissions,
    })

    logger.info('MCQ exam status transitioned via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: paramParsed.data.examId,
      to: bodyParsed.data.to,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}

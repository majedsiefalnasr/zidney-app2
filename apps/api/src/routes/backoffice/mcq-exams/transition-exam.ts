/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-exams/:examId/workflow/transition
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/transition-exam.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *        STAGE_39_AUTO_SELECTION_ENGINE (T027 — publish-time criteria validation gate)
 *
 * Bridges RBAC permissions to workflow engine format (AD-002) before delegating to
 * the transitionExamStatus service function.
 */

import type { CriteriaBlockFilters } from '@zidney/domain-core'
import type { DbClient } from '@zidney/domain-core/mcq-exams'
import { getExam, transitionExamStatus, validateAutoCriteria } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import {
  examIdParamSchema,
  transitionExamBodySchema,
} from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import {
  buildAuditCtx,
  buildExamWorkflowPermissions,
  criteriaValidationErrorResponse,
  getDb,
  mcqExamsErrorResponse,
  successResponse,
} from './helpers'

const logger = createLogger('mcq-exams-route:transition')

/** Statuses that represent an "activating" transition requiring valid criteria. */
const PUBLISH_GATE_STATUSES = new Set(['UNDER_REVIEW', 'APPROVED', 'ENABLED'])

function buildFetchEligiblePoolForTransition(
  db: DbClient,
  workspaceId: string
): (
  _wid: string,
  examId: string,
  _blockId: string,
  filters: CriteriaBlockFilters,
  excludeIds: string[]
) => Promise<string[]> {
  return async (_wid, examId, _blockId, filters, excludeIds) => {
    const conditions: string[] = ['q.workspace_id = $1', 'q.exam_id = $2', 'q.deleted_at IS NULL']
    const params: unknown[] = [workspaceId, examId]
    let paramIdx = 3

    if (excludeIds.length > 0) {
      conditions.push(`q.id != ALL($${paramIdx++})`)
      params.push(excludeIds)
    }
    if (filters.lessonIds && filters.lessonIds.length > 0) {
      conditions.push(`q.lesson_id = ANY($${paramIdx++})`)
      params.push(filters.lessonIds)
    }
    if (filters.categoryValueIds && filters.categoryValueIds.length > 0) {
      conditions.push(`q.category_value_id = ANY($${paramIdx++})`)
      params.push(filters.categoryValueIds)
    }
    if (filters.tagIds && filters.tagIds.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM question_tags qt WHERE qt.question_id = q.id AND qt.tag_id = ANY($${paramIdx++}))`
      )
      params.push(filters.tagIds)
    }
    if (filters.basketIds && filters.basketIds.length > 0) {
      conditions.push(`q.basket_id = ANY($${paramIdx++})`)
      params.push(filters.basketIds)
    }
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      conditions.push(`q.category_id = ANY($${paramIdx++})`)
      params.push(filters.categoryIds)
    }
    if (filters.semesterId) {
      conditions.push(`q.semester_id = $${paramIdx++}`)
      params.push(filters.semesterId)
    }

    const sql = `SELECT q.id FROM questions q WHERE ${conditions.join(' AND ')} ORDER BY q.id`
    const res = await db.query(sql, params)
    return (res.rows as { id: string }[]).map((r) => r.id)
  }
}

export async function transitionExamHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = transitionExamBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)
    const examId = paramParsed.data.examId
    const targetStatus = bodyParsed.data.to

    // Stage 39: block activating transitions for AUTOMATIC exams with invalid criteria
    if (PUBLISH_GATE_STATUSES.has(targetStatus)) {
      const exam = await getExam(db, examId, audit)
      if (exam.selection_mode === 'AUTOMATIC') {
        const fetchEligiblePool = buildFetchEligiblePoolForTransition(db, audit.workspace_id)
        const validationResult = await validateAutoCriteria({
          workspaceId: audit.workspace_id,
          examId,
          totalQuestions: exam.total_questions,
          criteria: exam.criteria,
          fetchEligiblePool,
        })
        if (!validationResult.valid) {
          return criteriaValidationErrorResponse(c, validationResult)
        }
      }
    }

    // Bridge RBAC permissions to workflow engine permission tokens (AD-002)
    const rbacPerms = (c.get('rbacContext') as { permissions: string[] } | null)?.permissions ?? []
    const enginePermissions = buildExamWorkflowPermissions(rbacPerms)

    const result = await transitionExamStatus(db, examId, targetStatus, {
      ...audit,
      enginePermissions,
    })

    logger.info('MCQ exam status transitioned via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: examId,
      to: targetStatus,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}

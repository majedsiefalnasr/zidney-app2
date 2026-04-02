/**
 * Handler: PUT /api/v1/backoffice/workspace/mcq-exams/:examId/criteria
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/set-criteria.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *        STAGE_39_AUTO_SELECTION_ENGINE (T026 — criteria validation gate)
 */

import type { CriteriaBlockFilters } from '@zidney/domain-core'
import type { DbClient } from '@zidney/domain-core/mcq-exams'
import { getExam, setCriteria, validateAutoCriteria } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import type { SetCriteriaBody } from '@zidney/validation/backoffice/mcq-exams.schemas'
import {
  examIdParamSchema,
  setCriteriaBodySchema,
} from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import {
  buildAuditCtx,
  criteriaValidationErrorResponse,
  getDb,
  mcqExamsErrorResponse,
  successResponse,
} from './helpers'

const logger = createLogger('mcq-exams-route:set-criteria')

/**
 * Build a FetchEligiblePoolFn that queries the questions table with the
 * given filter combination, bound to the current workspace and DbClient.
 */
function buildFetchEligiblePool(
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
      conditions.push(`EXISTS (
        SELECT 1 FROM question_tags qt
        WHERE qt.question_id = q.id AND qt.tag_id = ANY($${paramIdx++})
      )`)
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

export async function setCriteriaHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = setCriteriaBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)
    const examId = paramParsed.data.examId

    // Map request payload to domain CriteriaEntry (including Stage 39 fields)
    const criteriaEntries = bodyParsed.data.criteria.map(
      (entry: SetCriteriaBody['criteria'][number]) => ({
        lesson_ids: entry.lessonIds ?? null,
        category_value_ids: entry.categoryValueIds ?? null,
        tag_ids: entry.tagIds ?? null,
        basket_ids: entry.basketIds ?? null,
        category_ids: entry.categoryIds ?? null,
        semester_id: entry.semesterId ?? null,
        percentage: entry.percentage ?? null,
        fixed_count: entry.fixedCount ?? null,
      })
    )

    // Stage 39: validate criteria for AUTOMATIC exams before persisting
    const exam = await getExam(db, examId, audit)
    if (exam.selection_mode === 'AUTOMATIC') {
      const fetchEligiblePool = buildFetchEligiblePool(db, audit.workspace_id)
      const validationResult = await validateAutoCriteria({
        workspaceId: audit.workspace_id,
        examId,
        totalQuestions: exam.total_questions,
        criteria: criteriaEntries,
        fetchEligiblePool,
      })
      if (!validationResult.valid) {
        return criteriaValidationErrorResponse(c, validationResult)
      }
    }

    const result = await setCriteria(db, examId, { criteria: criteriaEntries }, audit)

    logger.info('MCQ exam criteria set via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: examId,
      criteria_count: bodyParsed.data.criteria.length,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}

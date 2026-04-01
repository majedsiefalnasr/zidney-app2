/**
 * Handler: PUT /api/v1/backoffice/workspace/mcq-exams/:examId/criteria
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/set-criteria.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { setCriteria } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import {
  examIdParamSchema,
  setCriteriaBodySchema,
} from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-exams-route:set-criteria')

export async function setCriteriaHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = setCriteriaBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await setCriteria(
      db,
      paramParsed.data.examId,
      {
        criteria: bodyParsed.data.criteria.map(
          (entry: {
            lessonIds?: string[] | null
            categoryValueIds?: string[] | null
            tagIds?: string[] | null
            basketIds?: string[] | null
            percentage: number
          }) => ({
            lesson_ids: entry.lessonIds ?? null,
            category_value_ids: entry.categoryValueIds ?? null,
            tag_ids: entry.tagIds ?? null,
            basket_ids: entry.basketIds ?? null,
            percentage: entry.percentage,
          })
        ),
      },
      audit
    )

    logger.info('MCQ exam criteria set via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: paramParsed.data.examId,
      criteria_count: bodyParsed.data.criteria.length,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}

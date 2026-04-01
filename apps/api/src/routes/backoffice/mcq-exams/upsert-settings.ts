/**
 * Handler: PUT /api/v1/backoffice/workspace/mcq-exams/:examId/settings
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/upsert-settings.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { upsertSettings } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import {
  examIdParamSchema,
  upsertSettingsBodySchema,
} from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-exams-route:upsert-settings')

export async function upsertSettingsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = upsertSettingsBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const settings = await upsertSettings(
      db,
      paramParsed.data.examId,
      {
        allow_relax_mode: bodyParsed.data.allowRelaxMode,
        allow_chrono_mode: bodyParsed.data.allowChronoMode,
        allow_rush_mode: bodyParsed.data.allowRushMode,
        allow_review_answers: bodyParsed.data.allowReviewAnswers,
        allow_review_hints: bodyParsed.data.allowReviewHints,
        allow_result_effects: bodyParsed.data.allowResultEffects,
        show_results_after_submit: bodyParsed.data.showResultsAfterSubmit,
        show_correct_answers: bodyParsed.data.showCorrectAnswers,
        show_explanations: bodyParsed.data.showExplanations,
        enable_certificate: bodyParsed.data.enableCertificate,
        message_template_id: bodyParsed.data.messageTemplateId,
      },
      audit
    )

    logger.info('MCQ exam settings upserted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: paramParsed.data.examId,
    })

    return c.json(successResponse(settings), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}

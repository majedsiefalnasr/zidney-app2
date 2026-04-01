/**
 * Handler: PUT /api/v1/backoffice/workspace/traditional-exams/:examId/settings
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/upsert-settings.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { upsertSettings } from '@zidney/domain-core/traditional-exams'
import {
  examIdParamSchema,
  upsertSettingsBodySchema,
} from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

export async function upsertSettingsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = upsertSettingsBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)
    const { data } = bodyParsed

    const settings = await upsertSettings(
      db,
      paramParsed.data.examId,
      {
        show_question_score: data.showQuestionScore,
        show_correct_answers: data.showCorrectAnswers,
        shuffle_questions: data.shuffleQuestions,
        shuffle_answers: data.shuffleAnswers,
        allow_back_navigation: data.allowBackNavigation,
        show_progress_bar: data.showProgressBar,
        auto_submit_on_timeout: data.autoSubmitOnTimeout,
        require_camera: data.requireCamera,
        require_id_verification: data.requireIdVerification,
        enable_proctoring: data.enableProctoring,
        message_template_id: data.messageTemplateId ?? null,
      },
      audit
    )

    return c.json(successResponse(settings), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}

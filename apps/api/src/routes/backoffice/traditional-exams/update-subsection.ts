/**
 * Handler: PATCH /api/v1/backoffice/workspace/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/update-subsection.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { updateSubsection } from '@zidney/domain-core/traditional-exams'
import {
  subsectionIdParamSchema,
  updateSubsectionBodySchema,
} from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

export async function updateSubsectionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = subsectionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateSubsectionBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const subsection = await updateSubsection(
      db,
      paramParsed.data.examId,
      paramParsed.data.sectionId,
      paramParsed.data.subsectionId,
      { header_content: bodyParsed.data.headerContent },
      audit
    )

    return c.json(successResponse(subsection), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}

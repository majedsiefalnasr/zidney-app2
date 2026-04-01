/**
 * Handler: PATCH /api/v1/backoffice/workspace/traditional-exams/:examId/sections/:sectionId
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/update-section.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { updateSection } from '@zidney/domain-core/traditional-exams'
import {
  sectionIdParamSchema,
  updateSectionBodySchema,
} from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

export async function updateSectionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = sectionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateSectionBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const section = await updateSection(
      db,
      paramParsed.data.examId,
      paramParsed.data.sectionId,
      { header_content: bodyParsed.data.headerContent },
      audit
    )

    return c.json(successResponse(section), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}

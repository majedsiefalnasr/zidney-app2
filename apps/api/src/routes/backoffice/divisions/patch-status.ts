/**
 * Divisions Route — PATCH /divisions/:id/status (Update Division Status)
 *
 * File: apps/api/src/routes/backoffice/divisions/patch-status.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * RBAC: ACADEMIC_STRUCTURE can_edit
 */

import { updateDivisionStatus } from '@zidney/domain-core/divisions'
import { divisionParamsSchema, updateDivisionStatusBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, divisionErrorResponse, getDb } from './helpers'

export async function handleUpdateDivisionStatus(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const paramsResult = divisionParamsSchema.safeParse({ id: c.req.param('id') })
    if (!paramsResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: paramsResult.error.errors
              .map((e) => `${e.path.join('.')}: ${e.message}`)
              .join('; '),
          },
        },
        422
      )
    }

    const body = await c.req.json()
    const bodyResult = updateDivisionStatusBodySchema.safeParse(body)
    if (!bodyResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: bodyResult.error.errors
              .map((e) => `${e.path.join('.')}: ${e.message}`)
              .join('; '),
          },
        },
        422
      )
    }

    const division = await updateDivisionStatus(
      db,
      paramsResult.data.id,
      { status: bodyResult.data.status as 'ENABLED' | 'DISABLED' },
      audit
    )

    return c.json({ success: true, data: division, error: null }, 200)
  } catch (err) {
    return divisionErrorResponse(c, err)
  }
}

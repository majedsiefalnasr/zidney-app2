/**
 * Divisions Route — PUT /divisions/:id (Update Division)
 *
 * File: apps/api/src/routes/backoffice/divisions/put-update.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * RBAC: ACADEMIC_STRUCTURE can_edit
 */

import { updateDivision } from '@zidney/domain-core/divisions'
import { divisionParamsSchema, updateDivisionBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, divisionErrorResponse, getDb } from './helpers'

export async function handleUpdateDivision(c: Context<BackofficeEnv>): Promise<Response> {
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
    const bodyResult = updateDivisionBodySchema.safeParse(body)
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

    const division = await updateDivision(db, paramsResult.data.id, bodyResult.data, audit)

    return c.json({ success: true, data: division, error: null }, 200)
  } catch (err: unknown) {
    return divisionErrorResponse(c, err)
  }
}

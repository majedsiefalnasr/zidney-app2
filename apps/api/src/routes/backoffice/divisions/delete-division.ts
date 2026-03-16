/**
 * Divisions Route — DELETE /divisions/:id (Delete Division)
 *
 * File: apps/api/src/routes/backoffice/divisions/delete-division.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * RBAC: ACADEMIC_STRUCTURE can_delete
 */

import { deleteDivision } from '@zidney/domain-core/divisions'
import { deleteDivisionParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, divisionErrorResponse, getDb } from './helpers'

export async function handleDeleteDivision(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const parseResult = deleteDivisionParamsSchema.safeParse({ id: c.req.param('id') })
    if (!parseResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors
              .map((e: { path: string[]; message: string }) => `${e.path.join('.')}: ${e.message}`)
              .join('; '),
          },
        },
        422
      )
    }

    await deleteDivision(db, parseResult.data.id, audit)

    return c.json({ success: true, data: { deleted: true }, error: null }, 200)
  } catch (err: unknown) {
    return divisionErrorResponse(c, err)
  }
}

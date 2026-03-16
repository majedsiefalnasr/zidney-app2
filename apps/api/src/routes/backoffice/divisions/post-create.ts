/**
 * Divisions Route — POST /divisions (Create Division)
 *
 * File: apps/api/src/routes/backoffice/divisions/post-create.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * RBAC: ACADEMIC_STRUCTURE can_create
 */

import { createDivision } from '@zidney/domain-core/divisions'
import { createDivisionBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, divisionErrorResponse, getDb } from './helpers'

export async function handleCreateDivision(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const body = await c.req.json()
    const parseResult = createDivisionBodySchema.safeParse(body)
    if (!parseResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors
              .map((e) => `${e.path.join('.')}: ${e.message}`)
              .join('; '),
          },
        },
        422
      )
    }

    const division = await createDivision(db, parseResult.data, audit)

    return c.json({ success: true, data: division, error: null }, 201)
  } catch (err) {
    return divisionErrorResponse(c, err)
  }
}

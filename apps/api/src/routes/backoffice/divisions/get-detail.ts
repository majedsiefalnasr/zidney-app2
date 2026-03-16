/**
 * Divisions Route — GET /divisions/:id (Get Division Detail)
 *
 * File: apps/api/src/routes/backoffice/divisions/get-detail.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * RBAC: ACADEMIC_STRUCTURE can_view
 */

import { getDivisionById } from '@zidney/domain-core/divisions'
import { divisionParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { divisionErrorResponse, getDb } from './helpers'

export async function handleGetDivision(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c)

    const parseResult = divisionParamsSchema.safeParse({ id: c.req.param('id') })
    if (!parseResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'DIVISION_NOT_FOUND',
            message: 'Division not found.',
          },
        },
        404
      )
    }

    const division = await getDivisionById(db, parseResult.data.id)

    return c.json({ success: true, data: division, error: null }, 200)
  } catch (err) {
    return divisionErrorResponse(c, err)
  }
}

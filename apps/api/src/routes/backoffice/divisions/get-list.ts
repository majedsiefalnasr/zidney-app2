/**
 * Divisions Route — GET /divisions (List Divisions)
 *
 * File: apps/api/src/routes/backoffice/divisions/get-list.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Returns a paginated list of divisions with keyset cursor pagination.
 * Allows filtering by status (ENABLED | DISABLED | all).
 *
 * RBAC: ACADEMIC_STRUCTURE can_view
 */

import { listDivisions } from '@zidney/domain-core/divisions'
import { listDivisionsQuerySchema } from '@zidney/validation'
import type { Context } from 'hono'
import type { BackofficeEnv } from '../types'
import { buildAuditCtx, divisionErrorResponse, getDb } from './helpers'

export async function handleGetListDivisions(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c)
    void buildAuditCtx(c) // not needed for reads but validated here for symmetry

    const queryParams = {
      limit: c.req.query('limit'),
      cursor: c.req.query('cursor') ?? null,
      status: c.req.query('status') ?? 'all',
    }

    const parseResult = listDivisionsQuerySchema.safeParse(queryParams)
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

    const { limit, cursor, status } = parseResult.data

    const result = await listDivisions(db, { limit, cursor, status })

    return c.json({ success: true, data: result, error: null }, 200)
  } catch (err: unknown) {
    return divisionErrorResponse(c, err)
  }
}

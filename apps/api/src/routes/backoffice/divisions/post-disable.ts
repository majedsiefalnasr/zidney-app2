/**
 * Divisions Route — POST /divisions/disable (Bulk Disable Divisions)
 *
 * File: apps/api/src/routes/backoffice/divisions/post-disable.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Disables ALL non-default divisions, reassigns students and staff to the
 * default division, and sets workspace_settings.divisions_enabled = false.
 *
 * Requires explicit confirmation body: { confirm: "DISABLE_ALL" }
 * Operation runs in SERIALIZABLE isolation — see disableDivisions service.
 *
 * RBAC: ACADEMIC_STRUCTURE can_delete
 *
 * IMPORTANT: This route MUST be registered BEFORE /:id in the router
 * to avoid the "disable" path segment being matched as a UUID.
 */

import { disableDivisions } from '@zidney/domain-core/divisions'
import { disableDivisionsBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, divisionErrorResponse, getDb } from './helpers'

export async function handleDisableDivisions(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const body = await c.req.json()
    const parseResult = disableDivisionsBodySchema.safeParse(body)
    if (!parseResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
            message: 'Body must include { "confirm": "DISABLE_ALL" }',
          },
        },
        422
      )
    }

    const result = await disableDivisions(db, audit)

    return c.json({ success: true, data: result, error: null }, 200)
  } catch (err: unknown) {
    return divisionErrorResponse(c, err)
  }
}

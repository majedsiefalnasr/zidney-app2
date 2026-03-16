/**
 * Divisions Route — Staff Divisions CRUD
 *
 * File: apps/api/src/routes/backoffice/divisions/staff-divisions.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Handles three staff-division association endpoints:
 *
 *   GET  /staff/:staffId/divisions       — list a staff member's divisions
 *   POST /staff/:staffId/divisions       — assign a division to a staff member
 *   DELETE /staff/:staffId/divisions/:divisionId — remove assignment
 *
 * RBAC: ACADEMIC_STRUCTURE can_edit (for POST/DELETE), can_view (for GET)
 */

import {
  assignStaffDivision,
  getStaffDivisions,
  removeStaffDivision,
} from '@zidney/domain-core/divisions'
import {
  assignStaffDivisionBodySchema,
  removeStaffDivisionParamsSchema,
  staffDivisionsParamsSchema,
} from '@zidney/validation'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'
import { buildAuditCtx, divisionErrorResponse, getDb } from './helpers'

// ---------------------------------------------------------------------------
// GET /staff/:staffId/divisions
// ---------------------------------------------------------------------------

export async function handleGetStaffDivisions(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c)

    const paramsResult = staffDivisionsParamsSchema.safeParse({
      staffId: c.req.param('staffId'),
    })
    if (!paramsResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'STAFF_NOT_FOUND',
            message: 'Staff member not found.',
          },
        },
        404
      )
    }

    const assignments = await getStaffDivisions(db, paramsResult.data.staffId)

    return c.json({ success: true, data: { divisions: assignments }, error: null }, 200)
  } catch (err: unknown) {
    return divisionErrorResponse(c, err)
  }
}

// ---------------------------------------------------------------------------
// POST /staff/:staffId/divisions
// ---------------------------------------------------------------------------

export async function handleAssignStaffDivision(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const paramsResult = staffDivisionsParamsSchema.safeParse({
      staffId: c.req.param('staffId'),
    })
    if (!paramsResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: paramsResult.error.errors
              .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
              .join('; '),
          },
        },
        422
      )
    }

    const body = await c.req.json()
    const bodyResult = assignStaffDivisionBodySchema.safeParse(body)
    if (!bodyResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: bodyResult.error.errors
              .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
              .join('; '),
          },
        },
        422
      )
    }

    const assignment = await assignStaffDivision(
      db,
      paramsResult.data.staffId,
      bodyResult.data.division_id,
      audit
    )

    return c.json({ success: true, data: assignment, error: null }, 201)
  } catch (err: unknown) {
    return divisionErrorResponse(c, err)
  }
}

// ---------------------------------------------------------------------------
// DELETE /staff/:staffId/divisions/:divisionId
// ---------------------------------------------------------------------------

export async function handleRemoveStaffDivision(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const paramsResult = removeStaffDivisionParamsSchema.safeParse({
      staffId: c.req.param('staffId'),
      divisionId: c.req.param('divisionId'),
    })
    if (!paramsResult.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: paramsResult.error.errors
              .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
              .join('; '),
          },
        },
        422
      )
    }

    await removeStaffDivision(db, paramsResult.data.staffId, paramsResult.data.divisionId, audit)

    return c.json({ success: true, data: null, error: null }, 200)
  } catch (err: unknown) {
    return divisionErrorResponse(c, err)
  }
}

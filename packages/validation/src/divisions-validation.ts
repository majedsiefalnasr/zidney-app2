/**
 * Divisions Domain Validation Schemas
 *
 * File: packages/validation/src/divisions-validation.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Zod schemas for validating divisions-related API inputs.
 * No HTTP logic. No framework dependencies.
 * Pure validation schemas only.
 *
 * Constitutional Compliance:
 * ✓ Input validation layer
 * ✓ No business logic
 * ✓ No DB imports
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared Schemas
// ---------------------------------------------------------------------------

/** Division ID parameter (UUID path param) */
const divisionIdParamSchema = z.object({
  id: z.string().uuid('Invalid division ID format'),
})

// ---------------------------------------------------------------------------
// Division CRUD Schemas
// ---------------------------------------------------------------------------

/** POST /divisions — Create Division */
export const createDivisionBodySchema = z.object({
  name: z.string().min(1, 'Division name required').max(255, 'Division name too long').trim(),
  description: z.string().nullish().optional(),
})

/** PUT /divisions/:id — Update Division */
export const divisionParamsSchema = divisionIdParamSchema

export const updateDivisionBodySchema = z.object({
  name: z.string().min(1, 'Division name required').max(255, 'Division name too long').trim(),
  description: z.string().nullish().optional(),
})

/** PATCH /divisions/:id/status — Update Division Status */
export const updateDivisionStatusBodySchema = z.object({
  status: z.enum(['ENABLED', 'DISABLED'], {
    errorMap: () => ({ message: 'Status must be ENABLED or DISABLED' }),
  }),
})

// ---------------------------------------------------------------------------
// Staff-Division Schemas
// ---------------------------------------------------------------------------

/** POST /divisions/:divisionId/staff/:staffId — Assign Staff */
export const staffDivisionsParamsSchema = z.object({
  divisionId: z.string().uuid('Invalid division ID format'),
  staffId: z.string().uuid('Invalid staff ID format'),
})

export const assignStaffDivisionBodySchema = z.object({})

/** DELETE /divisions/:divisionId/staff/:staffId — Remove Staff Assignment */
export const removeStaffDivisionParamsSchema = z.object({
  divisionId: z.string().uuid('Invalid division ID format'),
  staffId: z.string().uuid('Invalid staff ID format'),
})

// ---------------------------------------------------------------------------
// System Operations
// ---------------------------------------------------------------------------

/** POST /divisions/post-disable — Disable All Divisions (System Operation) */
export const disableDivisionsBodySchema = z.object({
  confirm: z.enum(['DISABLE_ALL'], {
    errorMap: () => ({
      message: 'Destructive operation requires explicit confirmation: confirm="DISABLE_ALL"',
    }),
  }),
})

// ---------------------------------------------------------------------------
// Export for convenience
// ---------------------------------------------------------------------------

export type CreateDivisionInput = z.infer<typeof createDivisionBodySchema>
export type UpdateDivisionInput = z.infer<typeof updateDivisionBodySchema>
export type UpdateDivisionStatusInput = z.infer<typeof updateDivisionStatusBodySchema>
export type DisableDivisionsInput = z.infer<typeof disableDivisionsBodySchema>

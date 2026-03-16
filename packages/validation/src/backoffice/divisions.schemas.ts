/**
 * Divisions Validation Schemas — STAGE_22
 *
 * File: packages/validation/src/backoffice/divisions.schemas.ts
 *
 * Zod schemas for all divisions API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MAX_DIVISION_NAME_LENGTH = 100
const MAX_DIVISION_DESCRIPTION_LENGTH = 255
const MAX_PAGE_LIMIT = 100
const DEFAULT_PAGE_LIMIT = 20

// ---------------------------------------------------------------------------
// GET /divisions  — list query params
// ---------------------------------------------------------------------------

export const listDivisionsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PAGE_LIMIT))
    .pipe(
      z
        .number()
        .int()
        .min(1, 'limit must be at least 1')
        .max(MAX_PAGE_LIMIT, `limit must not exceed ${MAX_PAGE_LIMIT}`)
    ),
  cursor: z.string().uuid('cursor must be a valid UUID').optional().nullable(),
  status: z.enum(['all', 'ENABLED', 'DISABLED']).optional().default('all'),
})

export type ListDivisionsQuery = z.infer<typeof listDivisionsQuerySchema>

// ---------------------------------------------------------------------------
// GET /divisions/:id  — path params
// ---------------------------------------------------------------------------

export const divisionParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type DivisionParams = z.infer<typeof divisionParamsSchema>

// ---------------------------------------------------------------------------
// POST /divisions  — create body
// ---------------------------------------------------------------------------

export const createDivisionBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .max(MAX_DIVISION_NAME_LENGTH, `name must not exceed ${MAX_DIVISION_NAME_LENGTH} characters`)
    .trim(),
  description: z
    .string()
    .max(
      MAX_DIVISION_DESCRIPTION_LENGTH,
      `description must not exceed ${MAX_DIVISION_DESCRIPTION_LENGTH} characters`
    )
    .trim()
    .optional()
    .nullable(),
})

export type CreateDivisionBody = z.infer<typeof createDivisionBodySchema>

// ---------------------------------------------------------------------------
// PUT /divisions/:id  — update body
// ---------------------------------------------------------------------------

export const updateDivisionBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .max(MAX_DIVISION_NAME_LENGTH, `name must not exceed ${MAX_DIVISION_NAME_LENGTH} characters`)
    .trim(),
  description: z
    .string()
    .max(
      MAX_DIVISION_DESCRIPTION_LENGTH,
      `description must not exceed ${MAX_DIVISION_DESCRIPTION_LENGTH} characters`
    )
    .trim()
    .optional()
    .nullable(),
})

export type UpdateDivisionBody = z.infer<typeof updateDivisionBodySchema>

// ---------------------------------------------------------------------------
// PATCH /divisions/:id/status  — status body
// ---------------------------------------------------------------------------

export const updateDivisionStatusBodySchema = z.object({
  status: z.enum(['ENABLED', 'DISABLED'], {
    required_error: 'status is required',
    invalid_type_error: 'status must be ENABLED or DISABLED',
  }),
})

export type UpdateDivisionStatusBody = z.infer<typeof updateDivisionStatusBodySchema>

// ---------------------------------------------------------------------------
// DELETE /divisions/:id  — path params (reuses divisionParamsSchema)
// ---------------------------------------------------------------------------

// Same as divisionParamsSchema — aliased for clarity at the call site
export const deleteDivisionParamsSchema = divisionParamsSchema

export type DeleteDivisionParams = DivisionParams

// ---------------------------------------------------------------------------
// POST /divisions/disable  — bulk disable body
// ---------------------------------------------------------------------------

export const disableDivisionsBodySchema = z.object({
  confirm: z.literal('DISABLE_ALL', {
    required_error: 'confirm is required',
    invalid_type_error: 'confirm must be the literal string "DISABLE_ALL"',
  }),
})

export type DisableDivisionsBody = z.infer<typeof disableDivisionsBodySchema>

// ---------------------------------------------------------------------------
// GET /staff/:staffId/divisions  — get staff divisions path params
// ---------------------------------------------------------------------------

export const staffDivisionsParamsSchema = z.object({
  staffId: z.string().uuid('staffId must be a valid UUID'),
})

export type StaffDivisionsParams = z.infer<typeof staffDivisionsParamsSchema>

// ---------------------------------------------------------------------------
// POST /staff/:staffId/divisions  — assign staff division body
// ---------------------------------------------------------------------------

export const assignStaffDivisionBodySchema = z.object({
  division_id: z.string().uuid('division_id must be a valid UUID'),
})

export type AssignStaffDivisionBody = z.infer<typeof assignStaffDivisionBodySchema>

// ---------------------------------------------------------------------------
// DELETE /staff/:staffId/divisions/:divisionId  — remove staff division params
// ---------------------------------------------------------------------------

export const removeStaffDivisionParamsSchema = z.object({
  staffId: z.string().uuid('staffId must be a valid UUID'),
  divisionId: z.string().uuid('divisionId must be a valid UUID'),
})

export type RemoveStaffDivisionParams = z.infer<typeof removeStaffDivisionParamsSchema>

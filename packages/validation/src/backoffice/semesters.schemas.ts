/**
 * Semesters Validation Schemas — STAGE_27
 *
 * File: packages/validation/src/backoffice/semesters.schemas.ts
 *
 * Zod schemas for all semesters API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 255
const MAX_DESCRIPTION_LENGTH = 2000
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

// ISO date string validator (YYYY-MM-DD)
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format')

// ---------------------------------------------------------------------------
// T014 — List Semesters Query
// ---------------------------------------------------------------------------

export const listSemestersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PAGE))
    .pipe(z.number().int().min(1, 'page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_LIMIT))
    .pipe(
      z
        .number()
        .int()
        .min(1, 'limit must be at least 1')
        .max(MAX_LIMIT, `limit must not exceed ${MAX_LIMIT}`)
    ),
  status: z.enum(['ENABLED', 'DISABLED']).optional(),
  search: z.string().min(1).max(MAX_NAME_LENGTH).optional(),
})

export type ListSemestersQuery = z.infer<typeof listSemestersQuerySchema>

// ---------------------------------------------------------------------------
// T015 — Semester Path Params
// ---------------------------------------------------------------------------

export const semesterParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type SemesterParams = z.infer<typeof semesterParamsSchema>

// ---------------------------------------------------------------------------
// T016 — Create Semester Body
// ---------------------------------------------------------------------------

export const createSemesterBodySchema = z
  .object({
    name: z
      .string()
      .min(1, 'name is required')
      .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`)
      .transform((s) => s.trim()),
    description: z
      .string()
      .max(
        MAX_DESCRIPTION_LENGTH,
        `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
      )
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    start_date: isoDateString.optional().nullable(),
    end_date: isoDateString.optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.end_date >= data.start_date
      }
      return true
    },
    { message: 'end_date must be on or after start_date', path: ['end_date'] }
  )

export type CreateSemesterBody = z.infer<typeof createSemesterBodySchema>

// ---------------------------------------------------------------------------
// T017 — Update Semester Body (at least one field required)
// ---------------------------------------------------------------------------

export const updateSemesterBodySchema = z
  .object({
    name: z
      .string()
      .min(1, 'name cannot be empty')
      .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`)
      .transform((s) => s.trim())
      .optional(),
    description: z
      .string()
      .max(
        MAX_DESCRIPTION_LENGTH,
        `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
      )
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    start_date: isoDateString.optional().nullable(),
    end_date: isoDateString.optional().nullable(),
    status: z.enum(['ENABLED', 'DISABLED']).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      'description' in data ||
      'start_date' in data ||
      'end_date' in data ||
      data.status !== undefined,
    { message: 'At least one field must be provided' }
  )

export type UpdateSemesterBody = z.infer<typeof updateSemesterBodySchema>

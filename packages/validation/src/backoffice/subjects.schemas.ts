/**
 * Subjects Validation Schemas — STAGE_28
 *
 * File: packages/validation/src/backoffice/subjects.schemas.ts
 *
 * Zod schemas for all subjects API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 255
const MAX_CODE_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_LANGUAGE_LENGTH = 10
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

// ---------------------------------------------------------------------------
// T014 — List Subjects Query
// ---------------------------------------------------------------------------

export const listSubjectsQuerySchema = z.object({
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
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  search: z.string().min(1).max(MAX_NAME_LENGTH).optional(),
  division_id: z.string().uuid('division_id must be a valid UUID').optional(),
  semester_id: z.string().uuid('semester_id must be a valid UUID').optional(),
})

export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>

// ---------------------------------------------------------------------------
// T015 — Subject Path Params
// ---------------------------------------------------------------------------

export const subjectParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type SubjectParams = z.infer<typeof subjectParamsSchema>

// ---------------------------------------------------------------------------
// T016 — Create Subject Body
// ---------------------------------------------------------------------------

export const createSubjectBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`)
    .refine((s) => s.trim().length > 0, { message: 'name must not be only whitespace' })
    .transform((s) => s.trim()),
  code: z
    .string()
    .min(1, 'code must not be empty')
    .max(MAX_CODE_LENGTH, `code must not exceed ${MAX_CODE_LENGTH} characters`)
    .optional()
    .nullable(),
  division_id: z.string().uuid('division_id must be a valid UUID').optional().nullable(),
  semester_id: z.string().uuid('semester_id must be a valid UUID').optional().nullable(),
  is_multilanguage: z.boolean().optional(),
  default_language: z
    .string()
    .min(1, 'default_language is required')
    .max(MAX_LANGUAGE_LENGTH, `default_language must not exceed ${MAX_LANGUAGE_LENGTH} characters`),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`)
    .optional()
    .nullable(),
})

export type CreateSubjectBody = z.infer<typeof createSubjectBodySchema>

// ---------------------------------------------------------------------------
// T017 — Update Subject Body (at least one field required)
// ---------------------------------------------------------------------------

export const updateSubjectBodySchema = z
  .object({
    name: z
      .string()
      .min(1, 'name cannot be empty')
      .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`)
      .refine((s) => s.trim().length > 0, { message: 'name must not be only whitespace' })
      .transform((s) => s.trim())
      .optional(),
    code: z
      .string()
      .min(1, 'code must not be empty')
      .max(MAX_CODE_LENGTH, `code must not exceed ${MAX_CODE_LENGTH} characters`)
      .optional()
      .nullable(),
    division_id: z.string().uuid('division_id must be a valid UUID').optional().nullable(),
    semester_id: z.string().uuid('semester_id must be a valid UUID').optional().nullable(),
    is_multilanguage: z.boolean().optional(),
    default_language: z
      .string()
      .min(1, 'default_language cannot be empty')
      .max(
        MAX_LANGUAGE_LENGTH,
        `default_language must not exceed ${MAX_LANGUAGE_LENGTH} characters`
      )
      .optional(),
    description: z
      .string()
      .max(
        MAX_DESCRIPTION_LENGTH,
        `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
      )
      .optional()
      .nullable(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      'code' in data ||
      'division_id' in data ||
      'semester_id' in data ||
      data.is_multilanguage !== undefined ||
      data.default_language !== undefined ||
      'description' in data,
    { message: 'At least one field must be provided' }
  )

export type UpdateSubjectBody = z.infer<typeof updateSubjectBodySchema>

// ---------------------------------------------------------------------------
// T018 — Transition Subject Status Body
// ---------------------------------------------------------------------------

export const transitionSubjectBodySchema = z.object({
  target_status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'], {
    required_error: 'target_status is required',
    invalid_type_error: 'target_status must be one of: DRAFT, ACTIVE, ARCHIVED',
  }),
  expected_current_status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'], {
    required_error: 'expected_current_status is required',
    invalid_type_error: 'expected_current_status must be one of: DRAFT, ACTIVE, ARCHIVED',
  }),
})

export type TransitionSubjectBody = z.infer<typeof transitionSubjectBodySchema>

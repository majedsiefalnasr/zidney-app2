/**
 * Categories Validation Schemas
 *
 * File: packages/validation/src/backoffice/categories.schemas.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Zod schemas for all categories API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 255
const MAX_CODE_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 2000
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/** Maximum number of scope IDs per category (subjects or divisions). */
const MAX_SCOPE_IDS = 100

// ---------------------------------------------------------------------------
// Category Path Params
// ---------------------------------------------------------------------------

export const categoryIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>

// ---------------------------------------------------------------------------
// List Categories Query
// ---------------------------------------------------------------------------

export const listCategoriesQuerySchema = z.object({
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
  parent_id: z.string().uuid('parent_id must be a valid UUID').nullable().optional(),
  search: z.string().min(1).max(200).optional(),
})

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>

// ---------------------------------------------------------------------------
// Get Category Tree Query (no params — returns full forest)
// ---------------------------------------------------------------------------

export const getCategoryTreeQuerySchema = z.object({})

export type GetCategoryTreeQuery = z.infer<typeof getCategoryTreeQuerySchema>

// ---------------------------------------------------------------------------
// Scope Arrays (shared fragment)
// ---------------------------------------------------------------------------

const scopeIdsSchema = z
  .array(z.string().uuid('each scope ID must be a valid UUID'))
  .max(MAX_SCOPE_IDS, `must not exceed ${MAX_SCOPE_IDS} IDs`)

// ---------------------------------------------------------------------------
// Create Category Body
// ---------------------------------------------------------------------------

export const createCategoryBodySchema = z.object({
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
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`)
    .optional()
    .nullable(),
  parent_id: z.string().uuid('parent_id must be a valid UUID').optional().nullable(),
  subject_ids: scopeIdsSchema.optional(),
  division_ids: scopeIdsSchema.optional(),
})

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>

// ---------------------------------------------------------------------------
// Update Category Body (at least one field required)
// ---------------------------------------------------------------------------

export const updateCategoryBodySchema = z
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
    description: z
      .string()
      .max(
        MAX_DESCRIPTION_LENGTH,
        `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
      )
      .optional()
      .nullable(),
    parent_id: z.string().uuid('parent_id must be a valid UUID').optional().nullable(),
    status: z.enum(['ENABLED', 'DISABLED']).optional(),
    subject_ids: scopeIdsSchema.optional(),
    division_ids: scopeIdsSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.code !== undefined ||
      data.description !== undefined ||
      data.parent_id !== undefined ||
      data.status !== undefined ||
      data.subject_ids !== undefined ||
      data.division_ids !== undefined,
    { message: 'At least one field must be provided to update' }
  )

export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>

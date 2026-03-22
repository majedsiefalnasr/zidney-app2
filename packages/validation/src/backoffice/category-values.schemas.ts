/**
 * Category Values Validation Schemas
 *
 * File: packages/validation/src/backoffice/category-values.schemas.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * Zod schemas for all category values API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MAX_CODE_LENGTH = 100
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const MAX_SCOPE_IDS = 100
const MAX_TRANSLATIONS = 50
const MAX_TRANSLATION_VALUE_LENGTH = 2000
const MAX_LANGUAGE_CODE_LENGTH = 10
const MAX_FIELD_NAME_LENGTH = 100

// ---------------------------------------------------------------------------
// Category Value Path Params
// ---------------------------------------------------------------------------

export const categoryValueIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type CategoryValueIdParam = z.infer<typeof categoryValueIdParamSchema>

// ---------------------------------------------------------------------------
// Translation Item (shared fragment)
// ---------------------------------------------------------------------------

const translationItemSchema = z.object({
  language_code: z
    .string()
    .min(1, 'language_code is required')
    .max(
      MAX_LANGUAGE_CODE_LENGTH,
      `language_code must not exceed ${MAX_LANGUAGE_CODE_LENGTH} characters`
    ),
  field_name: z
    .string()
    .min(1, 'field_name is required')
    .max(MAX_FIELD_NAME_LENGTH, `field_name must not exceed ${MAX_FIELD_NAME_LENGTH} characters`),
  translated_value: z
    .string()
    .min(1, 'translated_value must not be empty')
    .max(
      MAX_TRANSLATION_VALUE_LENGTH,
      `translated_value must not exceed ${MAX_TRANSLATION_VALUE_LENGTH} characters`
    ),
})

// ---------------------------------------------------------------------------
// Scope Arrays (shared fragment)
// ---------------------------------------------------------------------------

const scopeIdsSchema = z
  .array(z.string().uuid('each scope ID must be a valid UUID'))
  .max(MAX_SCOPE_IDS, `must not exceed ${MAX_SCOPE_IDS} IDs`)

// ---------------------------------------------------------------------------
// List Category Values Query
// ---------------------------------------------------------------------------

export const listCategoryValuesQuerySchema = z.object({
  category_id: z.string().uuid('category_id must be a valid UUID'),
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
  status: z.enum(['COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED']).optional(),
  search: z.string().min(1).max(200).optional(),
  language: z.string().min(1).max(MAX_LANGUAGE_CODE_LENGTH).optional(),
  include_deleted: z
    .string()
    .optional()
    .transform((v) => v === 'true')
    .pipe(z.boolean()),
})

export type ListCategoryValuesQuery = z.infer<typeof listCategoryValuesQuerySchema>

// ---------------------------------------------------------------------------
// Create Category Value Body
// ---------------------------------------------------------------------------

export const createCategoryValueBodySchema = z.object({
  category_id: z.string().uuid('category_id must be a valid UUID'),
  code: z
    .string()
    .min(1, 'code is required')
    .max(MAX_CODE_LENGTH, `code must not exceed ${MAX_CODE_LENGTH} characters`)
    .refine((s) => s.trim().length > 0, { message: 'code must not be only whitespace' })
    .transform((s) => s.trim()),
  translations: z
    .array(translationItemSchema)
    .min(1, 'at least one translation is required')
    .max(MAX_TRANSLATIONS, `must not exceed ${MAX_TRANSLATIONS} translations`),
  subject_ids: scopeIdsSchema.optional(),
  division_ids: scopeIdsSchema.optional(),
})

export type CreateCategoryValueBody = z.infer<typeof createCategoryValueBodySchema>

// ---------------------------------------------------------------------------
// Update Category Value Body (at least one field required)
// ---------------------------------------------------------------------------

export const updateCategoryValueBodySchema = z
  .object({
    code: z
      .string()
      .min(1, 'code cannot be empty')
      .max(MAX_CODE_LENGTH, `code must not exceed ${MAX_CODE_LENGTH} characters`)
      .refine((s) => s.trim().length > 0, { message: 'code must not be only whitespace' })
      .transform((s) => s.trim())
      .optional(),
    status: z.enum(['COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED']).optional(),
    translations: z
      .array(translationItemSchema)
      .min(1, 'translations array must not be empty when provided')
      .max(MAX_TRANSLATIONS, `must not exceed ${MAX_TRANSLATIONS} translations`)
      .optional(),
    subject_ids: scopeIdsSchema.optional(),
    division_ids: scopeIdsSchema.optional(),
  })
  .refine(
    (data) =>
      data.code !== undefined ||
      data.status !== undefined ||
      data.translations !== undefined ||
      data.subject_ids !== undefined ||
      data.division_ids !== undefined,
    { message: 'At least one field must be provided to update' }
  )

export type UpdateCategoryValueBody = z.infer<typeof updateCategoryValueBodySchema>

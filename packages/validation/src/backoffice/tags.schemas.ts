/**
 * Tags Validation Schemas
 *
 * File: packages/validation/src/backoffice/tags.schemas.ts
 * Stage: STAGE_32_TAGS
 *
 * Zod schemas for all tags API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MAX_TAG_NAME_LENGTH = 255
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

const tagStatusSchema = z.enum(['ENABLED', 'DISABLED'])

const tagEntityTypeSchema = z.enum(['MCQ_QUESTION', 'TRADITIONAL_QUESTION', 'LIBRARY_FILE'])

// ---------------------------------------------------------------------------
// Path Params
// ---------------------------------------------------------------------------

export const tagIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type TagIdParam = z.infer<typeof tagIdParamSchema>

export const tagRelationIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type TagRelationIdParam = z.infer<typeof tagRelationIdParamSchema>

export const entityParamsSchema = z.object({
  entityType: tagEntityTypeSchema,
  entityId: z.string().uuid('entityId must be a valid UUID'),
})

export type EntityParams = z.infer<typeof entityParamsSchema>

// ---------------------------------------------------------------------------
// List Tags Query
// ---------------------------------------------------------------------------

export const listTagsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PAGE))
    .pipe(z.number().int().min(1, 'page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_LIMIT))
    .pipe(z.number().int().min(1).max(MAX_LIMIT, `limit must not exceed ${MAX_LIMIT}`)),
  status: tagStatusSchema.optional(),
  search: z
    .string()
    .max(MAX_TAG_NAME_LENGTH, `search must not exceed ${MAX_TAG_NAME_LENGTH} characters`)
    .optional(),
})

export type ListTagsQuery = z.infer<typeof listTagsQuerySchema>

// ---------------------------------------------------------------------------
// Create Tag Body
// ---------------------------------------------------------------------------

export const createTagBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .max(MAX_TAG_NAME_LENGTH, `name must not exceed ${MAX_TAG_NAME_LENGTH} characters`)
    .trim(),
})

export type CreateTagBody = z.infer<typeof createTagBodySchema>

// ---------------------------------------------------------------------------
// Update Tag Body
// ---------------------------------------------------------------------------

export const updateTagBodySchema = z
  .object({
    name: z
      .string()
      .min(1, 'name must not be empty')
      .max(MAX_TAG_NAME_LENGTH, `name must not exceed ${MAX_TAG_NAME_LENGTH} characters`)
      .trim()
      .optional(),
    status: tagStatusSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.status !== undefined, {
    message: 'At least one of name or status must be provided',
  })

export type UpdateTagBody = z.infer<typeof updateTagBodySchema>

// ---------------------------------------------------------------------------
// Delete Tag Query
// ---------------------------------------------------------------------------

export const deleteTagQuerySchema = z.object({
  cascade_delete: z
    .string()
    .optional()
    .transform((v) => v === 'true')
    .default('false'),
})

export type DeleteTagQuery = z.infer<typeof deleteTagQuerySchema>

// ---------------------------------------------------------------------------
// Create Tag Relation Body
// ---------------------------------------------------------------------------

export const createTagRelationBodySchema = z.object({
  tag_id: z.string().uuid('tag_id must be a valid UUID'),
  entity_type: tagEntityTypeSchema,
  entity_id: z.string().uuid('entity_id must be a valid UUID'),
})

export type CreateTagRelationBody = z.infer<typeof createTagRelationBodySchema>

// ---------------------------------------------------------------------------
// List Tag Entities Query
// ---------------------------------------------------------------------------

export const listTagEntitiesQuerySchema = z.object({
  entity_type: tagEntityTypeSchema.optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PAGE))
    .pipe(z.number().int().min(1, 'page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_LIMIT))
    .pipe(z.number().int().min(1).max(MAX_LIMIT, `limit must not exceed ${MAX_LIMIT}`)),
})

export type ListTagEntitiesQuery = z.infer<typeof listTagEntitiesQuerySchema>

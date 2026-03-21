/**
 * Lessons Validation Schemas
 *
 * File: packages/validation/src/backoffice/lessons.schemas.ts
 * Stage: STAGE_29_LESSONS
 *
 * Zod schemas for all lessons API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 *
 * Key distinction from subjects:
 *   - listLessonsQuerySchema: subject_id is OPTIONAL (full tenant-scoped list)
 *   - activeLessonsQuerySchema: subject_id is REQUIRED (runtime delivery endpoint)
 *   - updateLessonBodySchema: subject_id cannot be changed (lesson is immutably bound to its subject)
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

// ---------------------------------------------------------------------------
// List Lessons Query (backoffice — subject_id optional)
// ---------------------------------------------------------------------------

export const listLessonsQuerySchema = z.object({
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
  subject_id: z.string().uuid('subject_id must be a valid UUID').optional(),
})

export type ListLessonsQuery = z.infer<typeof listLessonsQuerySchema>

// ---------------------------------------------------------------------------
// Active Lessons Query (runtime endpoint — subject_id REQUIRED)
// ---------------------------------------------------------------------------

export const activeLessonsQuerySchema = z.object({
  subject_id: z.string().uuid('subject_id must be a valid UUID'),
})

export type ActiveLessonsQuery = z.infer<typeof activeLessonsQuerySchema>

// ---------------------------------------------------------------------------
// Lesson Path Params
// ---------------------------------------------------------------------------

export const lessonParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type LessonParams = z.infer<typeof lessonParamsSchema>

// ---------------------------------------------------------------------------
// Create Lesson Body
// ---------------------------------------------------------------------------

export const createLessonBodySchema = z.object({
  subject_id: z.string().uuid('subject_id must be a valid UUID'),
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
})

export type CreateLessonBody = z.infer<typeof createLessonBodySchema>

// ---------------------------------------------------------------------------
// Update Lesson Body (at least one field required; subject_id is immutable)
// ---------------------------------------------------------------------------

export const updateLessonBodySchema = z
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
    status: z.enum(['ENABLED', 'DISABLED']).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      'code' in data ||
      'description' in data ||
      data.status !== undefined,
    { message: 'At least one field must be provided' }
  )

export type UpdateLessonBody = z.infer<typeof updateLessonBodySchema>

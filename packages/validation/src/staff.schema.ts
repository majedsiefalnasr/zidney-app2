/**
 * Staff Validation Schemas — STAGE_41
 *
 * File: packages/validation/src/staff.schema.ts
 *
 * Zod schemas for all staff management API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// POST /staff — create staff body
// ---------------------------------------------------------------------------

export const createStaffBodySchema = z.object({
  email: z
    .string()
    .email('email must be a valid email address')
    .max(320, 'email must not exceed 320 characters')
    .toLowerCase()
    .describe('Staff email address'),
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(256, 'name must not exceed 256 characters')
    .describe('Full name'),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(128, 'password must not exceed 128 characters')
    .describe('Account password'),
  role_id: z
    .string()
    .uuid('role_id must be a valid UUID')
    .nullable()
    .optional()
    .describe('Optional role UUID'),
  division_ids: z
    .array(z.string().uuid('each division_id must be a valid UUID'))
    .optional()
    .describe('Optional array of division UUIDs'),
})

export type CreateStaffBody = z.infer<typeof createStaffBodySchema>

// ---------------------------------------------------------------------------
// PUT /staff/:id — update staff body
// ---------------------------------------------------------------------------

export const updateStaffBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'name must not be empty')
      .max(256, 'name must not exceed 256 characters')
      .optional()
      .describe('Full name of the staff member'),
    email: z
      .string()
      .email('email must be a valid email address')
      .max(320, 'email must not exceed 320 characters')
      .toLowerCase()
      .optional()
      .describe('Email address of the staff member'),
    division_ids: z
      .array(z.string().uuid('each division_id must be a valid UUID'))
      .optional()
      .describe('Array of division UUIDs to assign the staff member to'),
    role_id: z
      .string()
      .uuid('role_id must be a valid UUID')
      .nullable()
      .optional()
      .describe('UUID of the role to assign, or null to unset'),
  })
  .refine(
    (data: { name?: unknown; email?: unknown; division_ids?: unknown; role_id?: unknown }) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.division_ids !== undefined ||
      data.role_id !== undefined,
    { message: 'At least one field must be provided for update' }
  )

export type UpdateStaffBody = z.infer<typeof updateStaffBodySchema>

// ---------------------------------------------------------------------------
// GET /staff — list query params
// ---------------------------------------------------------------------------

export const staffListQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('page must be an integer')
    .min(1, 'page must be at least 1')
    .describe('Page number for pagination, defaults to 1')
    .optional()
    .default(1),
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(100, 'limit must not exceed 100')
    .describe('Number of items per page, defaults to 20, max 100')
    .optional()
    .default(20),
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
    .optional()
    .describe(
      'Filter by staff status (ACTIVE, INACTIVE, or SUSPENDED) — per database migration constraint'
    ),
  division_id: z
    .string()
    .uuid('division_id must be a valid UUID')
    .optional()
    .describe('UUID of the division to filter by'),
  search: z
    .string()
    .max(200, 'search must not exceed 200 characters')
    .optional()
    .describe('Search term to filter by name or email (max 200 characters)'),
})

export type StaffListQuery = z.infer<typeof staffListQuerySchema>

// ---------------------------------------------------------------------------
// Path params — /:id
// ---------------------------------------------------------------------------

export const staffIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID').describe('UUID of the staff member'),
})

export type StaffIdParams = z.infer<typeof staffIdParamsSchema>

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export const bulkImportStaffRowSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('email must be a valid email address')
    .max(320, 'email must not exceed 320 characters')
    .describe('Staff email address'),
  name: z
    .string()
    .trim()
    .min(1, 'name must not be empty')
    .max(256, 'name must not exceed 256 characters')
    .describe('Staff display name'),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(128, 'password must not exceed 128 characters')
    .describe('Staff password'),
  role_id: z
    .string()
    .uuid('role_id must be a valid UUID')
    .nullish()
    .describe('Optional role assignment'),
})

export type BulkImportStaffRow = z.infer<typeof bulkImportStaffRowSchema>

export const bulkImportStaffBodySchema = z.object({
  rows: z
    .array(bulkImportStaffRowSchema)
    .min(1, 'rows must contain at least one entry')
    .max(500, 'rows must not exceed 500 entries')
    .describe('Rows to import'),
})

export type BulkImportStaffBody = z.infer<typeof bulkImportStaffBodySchema>

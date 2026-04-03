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
    .toLowerCase(),
  name: z
    .string()
    .min(1, 'name is required')
    .max(256, 'name must not exceed 256 characters')
    .trim(),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(128, 'password must not exceed 128 characters'),
  role_id: z.string().uuid('role_id must be a valid UUID').nullable().optional(),
  division_ids: z.array(z.string().uuid('each division_id must be a valid UUID')).optional(),
})

export type CreateStaffBody = z.infer<typeof createStaffBodySchema>

// ---------------------------------------------------------------------------
// PUT /staff/:id — update staff body
// ---------------------------------------------------------------------------

export const updateStaffBodySchema = z
  .object({
    name: z
      .string()
      .min(1, 'name must not be empty')
      .max(256, 'name must not exceed 256 characters')
      .trim()
      .optional(),
    email: z
      .string()
      .email('email must be a valid email address')
      .max(320, 'email must not exceed 320 characters')
      .toLowerCase()
      .optional(),
    division_ids: z.array(z.string().uuid('each division_id must be a valid UUID')).optional(),
    role_id: z.string().uuid('role_id must be a valid UUID').nullable().optional(),
  })
  .refine(
    (data) =>
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
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1, 'page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
    .pipe(
      z.number().int().min(1, 'limit must be at least 1').max(100, 'limit must not exceed 100')
    ),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  division_id: z.string().uuid('division_id must be a valid UUID').optional(),
  search: z.string().max(200, 'search must not exceed 200 characters').optional(),
})

export type StaffListQuery = z.infer<typeof staffListQuerySchema>

// ---------------------------------------------------------------------------
// Path params — /:id
// ---------------------------------------------------------------------------

export const staffIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type StaffIdParams = z.infer<typeof staffIdParamsSchema>

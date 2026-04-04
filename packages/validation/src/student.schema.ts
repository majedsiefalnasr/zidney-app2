/**
 * Student Validation Schemas — STAGE_42_STUDENT_MANAGEMENT
 *
 * File: packages/validation/src/student.schema.ts
 *
 * Zod schemas for all student management API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const studentStatusSchema = z.enum(['ACTIVE', 'DISABLED'])
export const subscriptionStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED', 'NONE'])

// ---------------------------------------------------------------------------
// POST /students — create student body
// ---------------------------------------------------------------------------

export const createStudentBodySchema = z.object({
  email: z
    .string()
    .email('email must be a valid email address')
    .max(320, 'email must not exceed 320 characters')
    .toLowerCase()
    .describe('Student email address'),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(128, 'password must not exceed 128 characters')
    .describe('Account password'),
  division_id: z
    .string()
    .uuid('division_id must be a valid UUID')
    .describe('UUID of the division to assign the student to'),
  first_name: z
    .string()
    .trim()
    .min(1, 'first_name must not be empty')
    .max(128, 'first_name must not exceed 128 characters')
    .optional()
    .describe('Student first name'),
  last_name: z
    .string()
    .trim()
    .min(1, 'last_name must not be empty')
    .max(128, 'last_name must not exceed 128 characters')
    .optional()
    .describe('Student last name'),
  phone: z
    .string()
    .trim()
    .min(1, 'phone must not be empty')
    .max(32, 'phone must not exceed 32 characters')
    .optional()
    .describe('Phone number'),
  external_id: z
    .string()
    .trim()
    .min(1, 'external_id must not be empty')
    .max(64, 'external_id must not exceed 64 characters')
    .optional()
    .describe('Optional external/system identifier'),
  department_id: z
    .string()
    .uuid('department_id must be a valid UUID')
    .optional()
    .describe('UUID of the department to assign the student to'),
  group_id: z
    .string()
    .uuid('group_id must be a valid UUID')
    .optional()
    .describe('UUID of the group to assign the student to'),
  semester_id: z
    .string()
    .uuid('semester_id must be a valid UUID')
    .optional()
    .describe('UUID of the semester to assign the student to'),
})

export type CreateStudentBody = z.infer<typeof createStudentBodySchema>

// ---------------------------------------------------------------------------
// PATCH /students/:id — update student body
// ---------------------------------------------------------------------------

export const updateStudentBodySchema = z
  .object({
    email: z
      .string()
      .email('email must be a valid email address')
      .max(320, 'email must not exceed 320 characters')
      .toLowerCase()
      .optional()
      .describe('New email address'),
    first_name: z
      .string()
      .trim()
      .min(1, 'first_name must not be empty')
      .max(128, 'first_name must not exceed 128 characters')
      .optional()
      .describe('Updated first name'),
    last_name: z
      .string()
      .trim()
      .min(1, 'last_name must not be empty')
      .max(128, 'last_name must not exceed 128 characters')
      .optional()
      .describe('Updated last name'),
    phone: z
      .string()
      .trim()
      .min(1, 'phone must not be empty')
      .max(32, 'phone must not exceed 32 characters')
      .optional()
      .describe('Updated phone number'),
    external_id: z
      .string()
      .trim()
      .min(1, 'external_id must not be empty')
      .max(64, 'external_id must not exceed 64 characters')
      .optional()
      .describe('Updated external identifier'),
    division_id: z
      .string()
      .uuid('division_id must be a valid UUID')
      .optional()
      .describe('Updated division UUID'),
    department_id: z
      .string()
      .uuid('department_id must be a valid UUID')
      .nullable()
      .optional()
      .describe('Updated department UUID (null to unset)'),
    group_id: z
      .string()
      .uuid('group_id must be a valid UUID')
      .nullable()
      .optional()
      .describe('Updated group UUID (null to unset)'),
    semester_id: z
      .string()
      .uuid('semester_id must be a valid UUID')
      .nullable()
      .optional()
      .describe('Updated semester UUID (null to unset)'),
  })
  .refine(
    (data: {
      email?: unknown
      first_name?: unknown
      last_name?: unknown
      phone?: unknown
      external_id?: unknown
      division_id?: unknown
      department_id?: unknown
      group_id?: unknown
      semester_id?: unknown
    }) =>
      data.email !== undefined ||
      data.first_name !== undefined ||
      data.last_name !== undefined ||
      data.phone !== undefined ||
      data.external_id !== undefined ||
      data.division_id !== undefined ||
      data.department_id !== undefined ||
      data.group_id !== undefined ||
      data.semester_id !== undefined,
    { message: 'At least one field must be provided for update' }
  )

export type UpdateStudentBody = z.infer<typeof updateStudentBodySchema>

// ---------------------------------------------------------------------------
// PATCH /students/:id/subscription — update subscription body
// ---------------------------------------------------------------------------

export const updateSubscriptionStatusBodySchema = z.object({
  subscription_status: subscriptionStatusSchema.describe(
    'New subscription status — ACTIVE, SUSPENDED, EXPIRED, or NONE'
  ),
})

export type UpdateSubscriptionStatusBody = z.infer<typeof updateSubscriptionStatusBodySchema>

// ---------------------------------------------------------------------------
// GET /students — list query params
// ---------------------------------------------------------------------------

export const studentListQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('page must be an integer')
    .min(1, 'page must be at least 1')
    .optional()
    .default(1)
    .describe('Page number for pagination'),
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(100, 'limit must not exceed 100')
    .optional()
    .default(20)
    .describe('Items per page (max 100)'),
  status: studentStatusSchema.optional().describe('Filter by student status (ACTIVE or DISABLED)'),
  division_id: z
    .string()
    .uuid('division_id must be a valid UUID')
    .optional()
    .describe('Filter by division'),
  search: z
    .string()
    .max(200, 'search must not exceed 200 characters')
    .optional()
    .describe('Search by email, first_name, or last_name'),
})

export type StudentListQuery = z.infer<typeof studentListQuerySchema>

// ---------------------------------------------------------------------------
// Path params — /:id
// ---------------------------------------------------------------------------

export const studentIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID').describe('UUID of the student'),
})

export type StudentIdParams = z.infer<typeof studentIdParamsSchema>

// ---------------------------------------------------------------------------
// POST /students/bulk-import — bulk import body
// ---------------------------------------------------------------------------

export const bulkImportRowSchema = z.object({
  email: z
    .string()
    .email('email must be a valid email address')
    .max(320, 'email must not exceed 320 characters')
    .toLowerCase()
    .describe('Student email address'),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(128, 'password must not exceed 128 characters')
    .describe('Initial password for student login'),
  first_name: z
    .string()
    .trim()
    .min(1, 'first_name must not be empty')
    .max(128, 'first_name must not exceed 128 characters')
    .optional()
    .describe('Student first name'),
  last_name: z
    .string()
    .trim()
    .min(1, 'last_name must not be empty')
    .max(128, 'last_name must not exceed 128 characters')
    .optional()
    .describe('Student last name'),
  phone: z
    .string()
    .trim()
    .min(1, 'phone must not be empty')
    .max(32, 'phone must not exceed 32 characters')
    .optional()
    .describe('Student phone number'),
  external_id: z
    .string()
    .trim()
    .min(1, 'external_id must not be empty')
    .max(64, 'external_id must not exceed 64 characters')
    .optional()
    .describe('External identifier (e.g., from SIS system)'),
})

export type BulkImportRow = z.infer<typeof bulkImportRowSchema>

export const bulkImportBodySchema = z.object({
  division_id: z
    .string()
    .uuid('division_id must be a valid UUID')
    .describe('Division UUID to assign all imported students to'),
  rows: z
    .array(bulkImportRowSchema)
    .min(1, 'rows must contain at least one item')
    .max(500, 'rows must not exceed 500 items')
    .describe('Array of student rows to import'),
})

export type BulkImportBody = z.infer<typeof bulkImportBodySchema>

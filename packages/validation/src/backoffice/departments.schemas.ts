/**
 * Departments Validation Schemas — STAGE_23
 *
 * File: packages/validation/src/backoffice/departments.schemas.ts
 *
 * Zod schemas for all departments API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MAX_DEPARTMENT_NAME_LENGTH = 255
const MAX_DEPARTMENT_DESCRIPTION_LENGTH = 500
const MAX_PAGE_LIMIT = 100
const DEFAULT_PAGE_LIMIT = 20
const MIN_MAX_USERS = 1
const MAX_MAX_USERS = 10000

// ---------------------------------------------------------------------------
// GET /departments  — list query params
// ---------------------------------------------------------------------------

export const listDepartmentsQuerySchema = z.object({
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
  division_id: z.string().uuid('division_id must be a valid UUID').optional().nullable(),
  parent_id: z
    .enum(['root'])
    .optional()
    .or(z.string().uuid('parent_id must be a valid UUID or "root"'))
    .optional()
    .nullable(),
  type: z.enum(['MAIN', 'SUB', 'SIMPLE']).optional(),
})

export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>

// ---------------------------------------------------------------------------
// GET /departments/:id  — path params
// ---------------------------------------------------------------------------

export const getDepartmentParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type GetDepartmentParams = z.infer<typeof getDepartmentParamsSchema>

// ---------------------------------------------------------------------------
// POST /departments  — create body
// ---------------------------------------------------------------------------

export const createDepartmentBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .max(
      MAX_DEPARTMENT_NAME_LENGTH,
      `name must not exceed ${MAX_DEPARTMENT_NAME_LENGTH} characters`
    )
    .trim(),
  type: z.enum(['MAIN', 'SUB', 'SIMPLE'], {
    required_error: 'type is required',
    invalid_type_error: "type must be 'MAIN', 'SUB', or 'SIMPLE'",
  }),
  parent_id: z.string().uuid('parent_id must be a valid UUID').optional().nullable(),
  division_id: z.string().uuid('division_id must be a valid UUID').optional().nullable(),
  max_users: z
    .number()
    .int()
    .min(MIN_MAX_USERS, `max_users must be at least ${MIN_MAX_USERS}`)
    .max(MAX_MAX_USERS, `max_users must not exceed ${MAX_MAX_USERS}`)
    .optional()
    .nullable(),
  description: z
    .string()
    .max(
      MAX_DEPARTMENT_DESCRIPTION_LENGTH,
      `description must not exceed ${MAX_DEPARTMENT_DESCRIPTION_LENGTH} characters`
    )
    .trim()
    .optional()
    .nullable(),
})

export type CreateDepartmentBody = z.infer<typeof createDepartmentBodySchema>

// ---------------------------------------------------------------------------
// PUT /departments/:id  — update body
// ---------------------------------------------------------------------------

export const updateDepartmentBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .max(
      MAX_DEPARTMENT_NAME_LENGTH,
      `name must not exceed ${MAX_DEPARTMENT_NAME_LENGTH} characters`
    )
    .trim()
    .optional(),
  type: z.enum(['MAIN', 'SUB', 'SIMPLE']).optional(),
  parent_id: z.string().uuid('parent_id must be a valid UUID').optional().nullable(),
  division_id: z.string().uuid('division_id must be a valid UUID').optional().nullable(),
  max_users: z
    .number()
    .int()
    .min(MIN_MAX_USERS, `max_users must be at least ${MIN_MAX_USERS}`)
    .max(MAX_MAX_USERS, `max_users must not exceed ${MAX_MAX_USERS}`)
    .optional()
    .nullable(),
  description: z
    .string()
    .max(
      MAX_DEPARTMENT_DESCRIPTION_LENGTH,
      `description must not exceed ${MAX_DEPARTMENT_DESCRIPTION_LENGTH} characters`
    )
    .trim()
    .optional()
    .nullable(),
})

export type UpdateDepartmentBody = z.infer<typeof updateDepartmentBodySchema>

// ---------------------------------------------------------------------------
// DELETE /departments/:id  — path params
// ---------------------------------------------------------------------------

export const deleteDepartmentParamsSchema = getDepartmentParamsSchema

export type DeleteDepartmentParams = GetDepartmentParams

// ---------------------------------------------------------------------------
// GET /departments/:id/children  — path params
// ---------------------------------------------------------------------------

export const departmentChildrenParamsSchema = getDepartmentParamsSchema

export type DepartmentChildrenParams = GetDepartmentParams

// ---------------------------------------------------------------------------
// GET /departments/tree  — tree query (no required parameters)
// ---------------------------------------------------------------------------

export const departmentTreeQuerySchema = z.object({})

export type DepartmentTreeQuery = z.infer<typeof departmentTreeQuerySchema>

// ---------------------------------------------------------------------------
// GET /staff/:staffId/departments  — get staff departments path params
// ---------------------------------------------------------------------------

export const staffDepartmentsParamsSchema = z.object({
  staffId: z.string().uuid('staffId must be a valid UUID'),
})

export type StaffDepartmentsParams = z.infer<typeof staffDepartmentsParamsSchema>

// ---------------------------------------------------------------------------
// POST /staff/:staffId/departments  — assign staff department body
// ---------------------------------------------------------------------------

export const assignStaffDepartmentBodySchema = z.object({
  department_id: z.string().uuid('department_id must be a valid UUID'),
})

export type AssignStaffDepartmentBody = z.infer<typeof assignStaffDepartmentBodySchema>

// ---------------------------------------------------------------------------
// DELETE /staff/:staffId/departments/:departmentId  — remove staff department params
// ---------------------------------------------------------------------------

export const removeStaffDepartmentParamsSchema = z.object({
  staffId: z.string().uuid('staffId must be a valid UUID'),
  departmentId: z.string().uuid('departmentId must be a valid UUID'),
})

export type RemoveStaffDepartmentParams = z.infer<typeof removeStaffDepartmentParamsSchema>

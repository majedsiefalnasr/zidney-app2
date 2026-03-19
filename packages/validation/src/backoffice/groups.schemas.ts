/**
 * Groups Validation Schemas — STAGE_24
 *
 * File: packages/validation/src/backoffice/groups.schemas.ts
 *
 * Zod schemas for all groups API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MAX_GROUP_NAME_LENGTH = 255
const MAX_GROUP_DESCRIPTION_LENGTH = 2000
const MAX_PAGE_LIMIT = 100
const DEFAULT_PAGE_LIMIT = 20
const MIN_MAX_MEMBERS = 1
const MAX_MAX_MEMBERS = 100000

// ---------------------------------------------------------------------------
// GET /groups  — list query params
// ---------------------------------------------------------------------------

export const listGroupsQuerySchema = z.object({
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
  department_id: z.string().uuid('department_id must be a valid UUID').optional().nullable(),
})

export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>

// ---------------------------------------------------------------------------
// GET /groups/:id  — path params
// ---------------------------------------------------------------------------

export const getGroupParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type GetGroupParams = z.infer<typeof getGroupParamsSchema>

// ---------------------------------------------------------------------------
// POST /groups  — create body
// ---------------------------------------------------------------------------

export const createGroupBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .max(MAX_GROUP_NAME_LENGTH, `name must not exceed ${MAX_GROUP_NAME_LENGTH} characters`)
    .trim(),
  department_id: z.string().uuid('department_id must be a valid UUID').optional().nullable(),
  max_members: z
    .number()
    .int()
    .min(MIN_MAX_MEMBERS, `max_members must be at least ${MIN_MAX_MEMBERS}`)
    .max(MAX_MAX_MEMBERS, `max_members must not exceed ${MAX_MAX_MEMBERS}`)
    .optional()
    .nullable(),
  description: z
    .string()
    .max(
      MAX_GROUP_DESCRIPTION_LENGTH,
      `description must not exceed ${MAX_GROUP_DESCRIPTION_LENGTH} characters`
    )
    .trim()
    .optional()
    .nullable(),
})

export type CreateGroupBody = z.infer<typeof createGroupBodySchema>

// ---------------------------------------------------------------------------
// PATCH /groups/:id  — update body
// ---------------------------------------------------------------------------

export const updateGroupBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name cannot be empty')
    .max(MAX_GROUP_NAME_LENGTH, `name must not exceed ${MAX_GROUP_NAME_LENGTH} characters`)
    .trim()
    .optional(),
  department_id: z.string().uuid('department_id must be a valid UUID').optional().nullable(),
  max_members: z
    .number()
    .int()
    .min(MIN_MAX_MEMBERS, `max_members must be at least ${MIN_MAX_MEMBERS}`)
    .max(MAX_MAX_MEMBERS, `max_members must not exceed ${MAX_MAX_MEMBERS}`)
    .optional()
    .nullable(),
  description: z
    .string()
    .max(
      MAX_GROUP_DESCRIPTION_LENGTH,
      `description must not exceed ${MAX_GROUP_DESCRIPTION_LENGTH} characters`
    )
    .trim()
    .optional()
    .nullable(),
  status: z.enum(['ENABLED', 'DISABLED']).optional(),
})

export type UpdateGroupBody = z.infer<typeof updateGroupBodySchema>

// ---------------------------------------------------------------------------
// DELETE /groups/:id  — path params
// ---------------------------------------------------------------------------

export const deleteGroupParamsSchema = getGroupParamsSchema

export type DeleteGroupParams = GetGroupParams

// ---------------------------------------------------------------------------
// PUT /students/:studentId/group  — assign student to group body
// ---------------------------------------------------------------------------

export const assignStudentGroupBodySchema = z.object({
  group_id: z.string().uuid('group_id must be a valid UUID'),
})

export type AssignStudentGroupBody = z.infer<typeof assignStudentGroupBodySchema>

// ---------------------------------------------------------------------------
// PUT /students/:studentId/group  — path params
// ---------------------------------------------------------------------------

export const studentGroupParamsSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
})

export type StudentGroupParams = z.infer<typeof studentGroupParamsSchema>

// ---------------------------------------------------------------------------
// POST /staff/:staffId/groups  — assign staff to group body
// ---------------------------------------------------------------------------

export const assignStaffGroupBodySchema = z.object({
  group_id: z.string().uuid('group_id must be a valid UUID'),
})

export type AssignStaffGroupBody = z.infer<typeof assignStaffGroupBodySchema>

// ---------------------------------------------------------------------------
// Staff group path params
// ---------------------------------------------------------------------------

export const staffGroupParamsSchema = z.object({
  staffId: z.string().uuid('staffId must be a valid UUID'),
})

export type StaffGroupParams = z.infer<typeof staffGroupParamsSchema>

export const staffGroupDetailParamsSchema = z.object({
  staffId: z.string().uuid('staffId must be a valid UUID'),
  groupId: z.string().uuid('groupId must be a valid UUID'),
})

export type StaffGroupDetailParams = z.infer<typeof staffGroupDetailParamsSchema>

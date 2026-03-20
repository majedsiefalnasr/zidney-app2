/**
 * Teams Validation Schemas — STAGE_26
 *
 * File: packages/validation/src/backoffice/teams.schemas.ts
 *
 * Zod schemas for all teams API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 255
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_PAGE_LIMIT = 200
const DEFAULT_PAGE_LIMIT = 50
const MIN_MAX_MEMBERS = 1
const MAX_MAX_MEMBERS = 100000

// ---------------------------------------------------------------------------
// Team Type — List
// ---------------------------------------------------------------------------

export const listTeamTypesQuerySchema = z.object({
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
  cursor: z.string().optional(),
  status: z.enum(['ENABLED', 'DISABLED']).optional(),
})

export type ListTeamTypesQuery = z.infer<typeof listTeamTypesQuerySchema>

// ---------------------------------------------------------------------------
// Team Type — Path Params
// ---------------------------------------------------------------------------

export const teamTypeParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type TeamTypeParams = z.infer<typeof teamTypeParamsSchema>

// ---------------------------------------------------------------------------
// Team Type — Create
// ---------------------------------------------------------------------------

export const createTeamTypeBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`)
    .transform((s) => s.trim()),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`)
    .transform((s) => s.trim())
    .optional()
    .nullable(),
})

export type CreateTeamTypeBody = z.infer<typeof createTeamTypeBodySchema>

// ---------------------------------------------------------------------------
// Team Type — Update (at least one field required)
// ---------------------------------------------------------------------------

export const updateTeamTypeBodySchema = z
  .object({
    name: z
      .string()
      .min(1, 'name cannot be empty')
      .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`)
      .transform((s) => s.trim())
      .optional(),
    description: z
      .string()
      .max(
        MAX_DESCRIPTION_LENGTH,
        `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
      )
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    status: z.enum(['ENABLED', 'DISABLED']).optional(),
  })
  .refine((data) => data.name !== undefined || 'description' in data || data.status !== undefined, {
    message: 'At least one field (name, description, status) must be provided',
  })

export type UpdateTeamTypeBody = z.infer<typeof updateTeamTypeBodySchema>

// ---------------------------------------------------------------------------
// Team — List
// ---------------------------------------------------------------------------

export const listTeamsQuerySchema = z.object({
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
  cursor: z.string().optional(),
  status: z.enum(['ENABLED', 'DISABLED']).optional(),
  team_type_id: z.string().uuid('team_type_id must be a valid UUID').optional(),
})

export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>

// ---------------------------------------------------------------------------
// Team — Path Params
// ---------------------------------------------------------------------------

export const teamParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export type TeamParams = z.infer<typeof teamParamsSchema>

// ---------------------------------------------------------------------------
// Team — Create
// ---------------------------------------------------------------------------

export const createTeamBodySchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`)
    .transform((s) => s.trim()),
  team_type_id: z.string().uuid('team_type_id must be a valid UUID').optional().nullable(),
  max_members: z
    .number()
    .int()
    .min(MIN_MAX_MEMBERS, `max_members must be at least ${MIN_MAX_MEMBERS}`)
    .max(MAX_MAX_MEMBERS, `max_members must not exceed ${MAX_MAX_MEMBERS}`)
    .optional()
    .nullable(),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`)
    .transform((s) => s.trim())
    .optional()
    .nullable(),
})

export type CreateTeamBody = z.infer<typeof createTeamBodySchema>

// ---------------------------------------------------------------------------
// Team — Update (at least one field required)
// ---------------------------------------------------------------------------

export const updateTeamBodySchema = z
  .object({
    name: z
      .string()
      .min(1, 'name cannot be empty')
      .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`)
      .transform((s) => s.trim())
      .optional(),
    team_type_id: z.string().uuid('team_type_id must be a valid UUID').optional().nullable(),
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
        MAX_DESCRIPTION_LENGTH,
        `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
      )
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    status: z.enum(['ENABLED', 'DISABLED']).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      'team_type_id' in data ||
      'max_members' in data ||
      'description' in data ||
      data.status !== undefined,
    { message: 'At least one field must be provided' }
  )

export type UpdateTeamBody = z.infer<typeof updateTeamBodySchema>

// ---------------------------------------------------------------------------
// Team Members — List
// ---------------------------------------------------------------------------

export const listTeamMembersQuerySchema = z.object({
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
  cursor: z.string().optional(),
})

export type ListTeamMembersQuery = z.infer<typeof listTeamMembersQuerySchema>

// ---------------------------------------------------------------------------
// Staff Assignment — Path Params
// ---------------------------------------------------------------------------

export const teamMemberParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  staffId: z.string().uuid('staffId must be a valid UUID'),
})

export type TeamMemberParams = z.infer<typeof teamMemberParamsSchema>

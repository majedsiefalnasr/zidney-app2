/**
 * Hierarchy Validation Schemas — STAGE_25
 */

import { z } from 'zod'

const MAX_NAME_LENGTH = 255
const MAX_DESCRIPTION_LENGTH = 2000
const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

const statusSchema = z.enum(['ENABLED', 'DISABLED'])

export const hierarchyNodeParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export const createHierarchyNodeBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name must not be blank')
    .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`),
  parent_id: z.string().uuid('parent_id must be a valid UUID').optional().nullable(),
  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH, `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`)
    .optional()
    .nullable(),
  status: statusSchema.optional().default('ENABLED'),
})

export const updateHierarchyNodeBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name must not be blank')
    .max(MAX_NAME_LENGTH, `name must not exceed ${MAX_NAME_LENGTH} characters`)
    .optional(),
  parent_id: z.string().uuid('parent_id must be a valid UUID').optional().nullable(),
  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH, `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`)
    .optional()
    .nullable(),
  status: statusSchema.optional(),
})

export const listHierarchyNodesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  per_page: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
  status: statusSchema.optional(),
})

export const treeQuerySchema = z.object({
  status: statusSchema.optional(),
})

export type HierarchyNodeParams = z.infer<typeof hierarchyNodeParamsSchema>
export type CreateHierarchyNodeBody = z.infer<typeof createHierarchyNodeBodySchema>
export type UpdateHierarchyNodeBody = z.infer<typeof updateHierarchyNodeBodySchema>
export type ListHierarchyNodesQuery = z.infer<typeof listHierarchyNodesQuerySchema>
export type TreeQuery = z.infer<typeof treeQuerySchema>

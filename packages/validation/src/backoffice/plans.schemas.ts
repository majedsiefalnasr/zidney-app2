/**
 * Plans Validation Schemas (Backoffice)
 *
 * File: packages/validation/src/backoffice/plans.schemas.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { z } from 'zod'

export const planIdParamsSchema = z.object({
  id: z.string().uuid().describe('Plan ID'),
})

export type PlanIdParams = z.infer<typeof planIdParamsSchema>

export const createPlanBodySchema = z.object({
  name: z.string().min(1).max(255).describe('Plan name'),
  description: z.string().max(2000).optional().nullable().describe('Plan description'),
  price: z.number().min(0).describe('Price in USD'),
  billing_type: z.enum(['one-time', 'recurring']).describe('Billing type'),
  duration_days: z.number().int().positive().describe('Duration in days'),
  enabled_modules: z.array(z.string()).default([]).describe('Enabled course modules'),
})

export type CreatePlanBody = z.infer<typeof createPlanBodySchema>

export const updatePlanBodySchema = createPlanBodySchema.partial().extend({
  is_active: z.boolean().optional().describe('Whether the plan is active'),
})

export type UpdatePlanBody = z.infer<typeof updatePlanBodySchema>

export const listPlansQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).describe('Page number'),
  limit: z.coerce.number().int().positive().max(100).default(20).describe('Results per page'),
  is_active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
    .describe('Filter by active status'),
})

export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>

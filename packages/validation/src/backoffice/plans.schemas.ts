/**
 * Plans Validation Schemas (Backoffice)
 *
 * File: packages/validation/src/backoffice/plans.schemas.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { z } from 'zod'

export const planIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const createPlanBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().min(0),
  billing_type: z.enum(['one-time', 'recurring']),
  duration_days: z.number().int().positive(),
  enabled_modules: z.array(z.string()).default([]),
})

export const updatePlanBodySchema = createPlanBodySchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const listPlansQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  is_active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

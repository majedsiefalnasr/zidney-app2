/**
 * Subscriptions Validation Schemas (Backoffice)
 *
 * File: packages/validation/src/backoffice/subscriptions.schemas.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { z } from 'zod'

export const subscriptionIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const createSubscriptionBodySchema = z.object({
  student_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  started_at: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export const listSubscriptionsQuerySchema = z.object({
  student_id: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELED', 'PENDING']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

/**
 * Subscriptions Validation Schemas (Backoffice)
 *
 * File: packages/validation/src/backoffice/subscriptions.schemas.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { z } from 'zod'

export const subscriptionIdParamsSchema = z.object({
  id: z.string().uuid().describe('Subscription ID'),
})

export type SubscriptionIdParams = z.infer<typeof subscriptionIdParamsSchema>

export const createSubscriptionBodySchema = z.object({
  student_id: z.string().uuid().describe('Student ID'),
  plan_id: z.string().uuid().describe('Plan ID'),
  started_at: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .describe('Subscription start date'),
  notes: z.string().max(1000).optional().nullable().describe('Optional notes'),
})

export type CreateSubscriptionBody = z.infer<typeof createSubscriptionBodySchema>

export const listSubscriptionsQuerySchema = z.object({
  student_id: z.string().uuid().optional().describe('Filter by student ID'),
  status: z
    .enum(['ACTIVE', 'EXPIRED', 'CANCELED', 'PENDING'])
    .optional()
    .describe('Filter by subscription status'),
  page: z.coerce.number().int().positive().default(1).describe('Page number'),
  limit: z.coerce.number().int().positive().max(100).default(20).describe('Results per page'),
})

export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>

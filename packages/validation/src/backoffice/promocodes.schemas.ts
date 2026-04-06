/**
 * Promocodes Validation Schemas (Backoffice)
 *
 * File: packages/validation/src/backoffice/promocodes.schemas.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Input validation for all promocode management endpoints.
 * All schemas use Zod for runtime validation.
 *
 * Constitutional Compliance:
 * ✓ Pure validation — no HTTP logic
 * ✓ No framework dependencies
 * ✓ Type-safe inferred output types
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const promocodeTypeSchema = z.enum(['PERCENTAGE', 'FIXED', 'FREE_TRIAL'])

// ---------------------------------------------------------------------------
// Create promocode
// ---------------------------------------------------------------------------

export const createPromocodeBodySchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(100)
      .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with dashes/underscores only')
      .describe('Unique promocode string (uppercase)'),
    type: promocodeTypeSchema.describe('Discount type'),
    value: z
      .number()
      .positive()
      .optional()
      .nullable()
      .describe('Discount value (% or fixed amount)'),
    free_trial_days: z
      .number()
      .int()
      .positive()
      .optional()
      .nullable()
      .describe('Free trial duration in days (FREE_TRIAL type only)'),
    valid_from: z
      .string()
      .datetime({ offset: true })
      .describe('Promocode becomes valid at this timestamp'),
    valid_until: z
      .string()
      .datetime({ offset: true })
      .describe('Promocode expires at this timestamp'),
    usage_limit: z
      .number()
      .int()
      .positive()
      .optional()
      .nullable()
      .describe('Maximum total usages (null = unlimited)'),
    per_user_limit: z
      .number()
      .int()
      .positive()
      .optional()
      .nullable()
      .describe('Maximum usages per student (null = unlimited)'),
    applies_to_plan_ids: z
      .array(z.string().uuid())
      .optional()
      .nullable()
      .describe('Plans this code applies to (null = all plans)'),
    target_division_ids: z
      .array(z.string().uuid())
      .optional()
      .nullable()
      .describe('Restrict to students in these divisions (null = all)'),
    target_group_ids: z
      .array(z.string().uuid())
      .optional()
      .nullable()
      .describe('Restrict to students in these groups (null = all)'),
    is_stackable: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether this code can stack with other active codes'),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'PERCENTAGE') {
      if (data.value === undefined || data.value === null) {
        ctx.addIssue({
          path: ['value'],
          code: z.ZodIssueCode.custom,
          message: 'PERCENTAGE type requires a value',
        })
      } else if (data.value > 100) {
        ctx.addIssue({
          path: ['value'],
          code: z.ZodIssueCode.custom,
          message: 'PERCENTAGE value must be ≤ 100',
        })
      }
    }

    if (data.type === 'FIXED') {
      if (data.value === undefined || data.value === null) {
        ctx.addIssue({
          path: ['value'],
          code: z.ZodIssueCode.custom,
          message: 'FIXED type requires a value',
        })
      }
    }

    if (data.type === 'FREE_TRIAL') {
      if (data.free_trial_days === undefined || data.free_trial_days === null) {
        ctx.addIssue({
          path: ['free_trial_days'],
          code: z.ZodIssueCode.custom,
          message: 'FREE_TRIAL type requires free_trial_days',
        })
      }
      if (data.value !== undefined && data.value !== null) {
        ctx.addIssue({
          path: ['value'],
          code: z.ZodIssueCode.custom,
          message: 'FREE_TRIAL type must not have a value',
        })
      }
    }

    // valid_until must be after valid_from
    if (data.valid_from && data.valid_until) {
      if (new Date(data.valid_until) <= new Date(data.valid_from)) {
        ctx.addIssue({
          path: ['valid_until'],
          code: z.ZodIssueCode.custom,
          message: 'valid_until must be after valid_from',
        })
      }
    }
  })

export type CreatePromocodeBody = z.infer<typeof createPromocodeBodySchema>

// ---------------------------------------------------------------------------
// Promocode ID param
// ---------------------------------------------------------------------------

export const promocodeIdParamsSchema = z.object({
  id: z.string().uuid().describe('Promocode UUID'),
})

export type PromocodeIdParams = z.infer<typeof promocodeIdParamsSchema>

// ---------------------------------------------------------------------------
// Validate promocode (check if a code is valid for a student + plan)
// ---------------------------------------------------------------------------

export const validatePromocodeBodySchema = z.object({
  code: z.string().min(1).max(100).describe('Promocode string to validate'),
  student_id: z.string().uuid().describe('Student who wants to use the code'),
  plan_id: z.string().uuid().describe('Plan the student wants to subscribe to'),
})

export type ValidatePromocodeBody = z.infer<typeof validatePromocodeBodySchema>

// ---------------------------------------------------------------------------
// List promocodes query
// ---------------------------------------------------------------------------

export const listPromocodesQuerySchema = z.object({
  is_active: z
    .enum(['true', 'false'])
    .transform((v): boolean => v === 'true')
    .optional()
    .describe('Filter by is_active flag'),
  type: promocodeTypeSchema.optional().describe('Filter by discount type'),
  status: z
    .enum(['ACTIVE_NOW', 'EXPIRED', 'NOT_YET_VALID', 'INACTIVE'])
    .optional()
    .describe('Filter by computed status (server-side using DB NOW())'),
  page: z.coerce.number().int().positive().default(1).describe('Page number'),
  limit: z.coerce.number().int().positive().max(100).default(20).describe('Results per page'),
})

export type ListPromocodesQuery = z.infer<typeof listPromocodesQuerySchema>

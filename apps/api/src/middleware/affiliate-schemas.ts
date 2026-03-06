/**
 * Zod Validation Schemas: Affiliate System
 * Stage: STAGE_13_AFFILIATES
 * Purpose: API request validation schemas for affiliate endpoints
 */

import { z } from 'zod'

/**
 * Schema for creating an affiliate
 */
export const createAffiliateSchema = z.object({
  promo_code: z
    .string()
    .min(3, 'Promo code must be at least 3 characters')
    .max(50, 'Promo code must be at most 50 characters')
    .transform((val: unknown) => String(val).trim().toUpperCase())
    .refine(
      (val: unknown) => /^[A-Z0-9]+$/.test(String(val)),
      'Promo code must be uppercase alphanumeric'
    ),
  discount_percentage: z.string().refine((val: unknown) => {
    try {
      const num = parseFloat(String(val))
      return !Number.isNaN(num) && num >= 0 && num <= 100
    } catch {
      return false
    }
  }, 'Discount percentage must be between 0 and 100'),
  commission_percentage: z.string().refine((val: unknown) => {
    try {
      const num = parseFloat(String(val))
      return !Number.isNaN(num) && num >= 0 && num <= 100
    } catch {
      return false
    }
  }, 'Commission percentage must be between 0 and 100'),
  allow_with_other_discounts: z.boolean().default(false),
  usage_limit_total: z.number().int().nonnegative().nullable().optional(),
  usage_limit_per_client: z.number().int().nonnegative().nullable().optional(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  description: z.string().optional(),
})

/**
 * Schema for updating an affiliate (partial)
 */
export const updateAffiliateSchema = z.object({
  discount_percentage: z
    .string()
    .refine((val: unknown) => {
      try {
        const num = parseFloat(String(val))
        return !Number.isNaN(num) && num >= 0 && num <= 100
      } catch {
        return false
      }
    }, 'Discount percentage must be between 0 and 100')
    .optional(),
  commission_percentage: z
    .string()
    .refine((val: unknown) => {
      try {
        const num = parseFloat(String(val))
        return !Number.isNaN(num) && num >= 0 && num <= 100
      } catch {
        return false
      }
    }, 'Commission percentage must be between 0 and 100')
    .optional(),
  allow_with_other_discounts: z.boolean().optional(),
  usage_limit_total: z.number().int().nonnegative().nullable().optional(),
  usage_limit_per_client: z.number().int().nonnegative().nullable().optional(),
  description: z.string().optional(),
})

/**
 * Schema for promo code during license purchase
 */
export const promoCodeSchema = z.object({
  promo_code: z
    .string()
    .min(1, 'Promo code is required')
    .transform((val: unknown) => String(val).trim().toUpperCase()),
})

/**
 * Schema for list affiliates query parameters
 */
export const listAffiliatesSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  created_after: z.coerce.date().optional(),
  created_before: z.coerce.date().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export type CreateAffiliateRequest = z.infer<typeof createAffiliateSchema>
export type UpdateAffiliateRequest = z.infer<typeof updateAffiliateSchema>
export type PromoCodeRequest = z.infer<typeof promoCodeSchema>
export type ListAffiliatesRequest = z.infer<typeof listAffiliatesSchema>

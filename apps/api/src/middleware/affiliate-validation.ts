/**
 * Affiliate Request Validation Middleware
 * Stage: STAGE_13_AFFILIATES
 * Purpose: Parse and validate affiliate requests using Zod schemas
 *
 * Applies domain-level validation to ensure consistency.
 */

import {
  AffiliateErrorCode,
  AffiliateErrorMessages,
} from '@zidney/domain-core/affiliates/error-codes'
import { z } from 'zod'
import {
  createAffiliateSchema,
  listAffiliatesSchema,
  promoCodeSchema,
  updateAffiliateSchema,
} from './affiliate-schemas'

/**
 * Parse and validate create affiliate request
 */
export async function validateCreateAffiliateRequest(body: unknown) {
  try {
    return await createAffiliateSchema.parseAsync(body)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError
      const firstError = zodError.errors[0]
      throw {
        code: 'VALIDATION_ERROR',
        message: firstError.message,
        field: firstError.path.join('.'),
      }
    }
    throw error
  }
}

/**
 * Parse and validate update affiliate request
 */
export async function validateUpdateAffiliateRequest(body: unknown) {
  try {
    return await updateAffiliateSchema.parseAsync(body)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError
      const firstError = zodError.errors[0]
      throw {
        code: 'VALIDATION_ERROR',
        message: firstError.message,
        field: firstError.path.join('.'),
      }
    }
    throw error
  }
}

/**
 * Parse and validate promo code in license purchase
 */
export async function validatePromoCodeRequest(body: unknown) {
  try {
    return await promoCodeSchema.parseAsync(body)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError
      const firstError = zodError.errors[0]
      throw {
        code: 'VALIDATION_ERROR',
        message: firstError.message,
        field: firstError.path.join('.'),
      }
    }
    throw error
  }
}

/**
 * Parse and validate list affiliates query parameters
 */
export async function validateListAffiliatesRequest(query: unknown) {
  try {
    return await listAffiliatesSchema.parseAsync(query)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError
      const firstError = zodError.errors[0]
      throw {
        code: 'VALIDATION_ERROR',
        message: firstError.message,
        field: firstError.path.join('.'),
      }
    }
    throw error
  }
}

/**
 * Helper to map validation errors to affiliate error codes
 */
export function mapValidationErrorToAffiliateError(error: any): {
  code: string
  message: string
} {
  const message = error.message?.toLowerCase() || ''

  if (message.includes('discount') && message.includes('100')) {
    return {
      code: AffiliateErrorCode.AFFILIATE_INVALID_DISCOUNT_PERCENTAGE,
      message: AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_INVALID_DISCOUNT_PERCENTAGE],
    }
  }

  if (message.includes('commission') && message.includes('100')) {
    return {
      code: AffiliateErrorCode.AFFILIATE_INVALID_COMMISSION_PERCENTAGE,
      message: AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_INVALID_COMMISSION_PERCENTAGE],
    }
  }

  if (message.includes('promo_code') || message.includes('code')) {
    return {
      code: 'VALIDATION_ERROR',
      message: error.message || 'Invalid promo code format',
    }
  }

  return {
    code: 'VALIDATION_ERROR',
    message: error.message || 'Validation failed',
  }
}

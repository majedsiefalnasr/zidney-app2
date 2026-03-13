/**
 * Validation Logic: Affiliate System
 * Stage: STAGE_13_AFFILIATES
 * Purpose: Pure functions for affiliate validation (business rules)
 *
 * These are domain-level validators independent of HTTP/API concerns.
 * Reusable by API and Worker.
 */

import type { Affiliate, AffiliateValidationResult } from './types'

const PROMO_CODE_PATTERN = /^[A-Z0-9]{3,50}$/
const PROMO_CODE_MIN_LENGTH = 3
const PROMO_CODE_MAX_LENGTH = 50
/**
 * Validate promo code format
 * - Uppercase alphanumeric only (no automatic normalization)
 * - 3-50 characters
 * - No spaces or special characters
 *
 * Use normalizePromoCode() to convert input to uppercase before validation
 */
export function validatePromoCode(code: string | null | undefined): boolean {
  if (!code || typeof code !== 'string') {
    return false
  }

  const trimmed = code.trim()
  if (trimmed.length < PROMO_CODE_MIN_LENGTH || trimmed.length > PROMO_CODE_MAX_LENGTH) {
    return false
  }

  return PROMO_CODE_PATTERN.test(trimmed)
}

/**
 * Normalize promo code (trim + uppercase)
 */
export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase()
}
/**
 * Validate percentage is in valid range (0-100)
 * Supports numeric strings like "10", "10.5", "10.50"
 */
export function validatePercentageRange(percent: string | number | null | undefined): boolean {
  if (percent === null || percent === undefined) {
    return false
  }

  try {
    const str = String(percent).trim()

    // Validate format: only digits, optional decimal, and optional digits after decimal
    if (!/^\d+(\.\d+)?$/.test(str)) {
      return false
    }

    const p = parseFloat(str)
    return !Number.isNaN(p) && p >= 0 && p <= 100
  } catch {
    return false
  }
}

/**
 * Validate date range (start < end)
 */
export function validateDateRange(startDate: Date, endDate: Date): AffiliateValidationResult {
  if (!startDate || !endDate) {
    return {
      valid: false,
      error: 'Start date and end date are required',
    }
  }

  if (startDate >= endDate) {
    return {
      valid: false,
      error: 'Start date must be before end date',
      errorCode: 'AFFILIATE_INVALID_DATE_RANGE',
    }
  }

  return { valid: true }
}

/**
 * Validate usage limits (null allowed, or >= 0)
 */
export function validateUsageLimits(limit: number | null | undefined): boolean {
  if (limit === null || limit === undefined) {
    return true // NULL is allowed (unlimited)
  }

  if (typeof limit !== 'number') {
    return false
  }

  return limit >= 0 && Number.isInteger(limit)
}

/**
 * Check if affiliate is active
 */
export function checkAffiliateActive(affiliate: Affiliate): boolean {
  return affiliate.status === 'ACTIVE'
}

/**
 * Check if affiliate is within valid time window
 */
export function checkTemporalValidity(affiliate: Affiliate, now: Date = new Date()): boolean {
  return now >= affiliate.start_date && now < affiliate.end_date
}

/**
 * Check if current time falls within temporal range
 * Used by affiliate service for real-time validation
 */
export function validateCurrentTimeInRange(
  startDate: Date | string,
  endDate: Date | string,
  now: Date = new Date()
): boolean {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  const current = now.getTime()

  return current >= start.getTime() && current < end.getTime()
}

/**
 * Check if global usage limit is exceeded
 */
export function checkGlobalUsageLimit(affiliate: Affiliate): boolean {
  if (affiliate.usage_limit_total === null) {
    return true // No limit
  }

  return affiliate.usage_count < affiliate.usage_limit_total
}

/**
 * Global usage limit check - for use in affiliate service
 * Returns true if usage is acceptable, false if exceeded
 */
export function validateGlobalUsageLimit(usageCount: number, usageLimit: number | null): boolean {
  if (usageLimit === null || usageLimit === undefined) {
    return true // No limit set - always acceptable
  }
  return usageCount < usageLimit // Check if usage < limit
}

/**
 * Per-client usage limit check - for use in affiliate service
 * Returns true if client can use code, false if limit exceeded
 */
export function validatePerClientUsageLimit(
  currentClientUsageCount: number,
  usageLimitPerClient: number | null
): boolean {
  if (usageLimitPerClient === null || usageLimitPerClient === undefined) {
    return true // No per-client limit set - always acceptable
  }
  return currentClientUsageCount < usageLimitPerClient // Check if usage < limit
}

/**
 * Validate all affiliate fields together
 */
export function validateAffiliateData(data: {
  promo_code: string
  discount_percentage: string | number
  commission_percentage: string | number
  start_date: Date
  end_date: Date
  usage_limit_total?: number | null
  usage_limit_per_client?: number | null
}): AffiliateValidationResult {
  // Validate promo code
  if (!validatePromoCode(data.promo_code)) {
    return {
      valid: false,
      error: 'Invalid promo code format',
    }
  }

  // Validate discount percentage
  if (!validatePercentageRange(data.discount_percentage)) {
    return {
      valid: false,
      error: 'Discount percentage must be between 0 and 100',
      errorCode: 'AFFILIATE_INVALID_DISCOUNT_PERCENTAGE',
    }
  }

  // Validate commission percentage
  if (!validatePercentageRange(data.commission_percentage)) {
    return {
      valid: false,
      error: 'Commission percentage must be between 0 and 100',
      errorCode: 'AFFILIATE_INVALID_COMMISSION_PERCENTAGE',
    }
  }

  // Validate date range
  const dateResult = validateDateRange(data.start_date, data.end_date)
  if (!dateResult.valid) {
    return dateResult
  }

  // Validate usage limits
  if (
    !validateUsageLimits(data.usage_limit_total) ||
    !validateUsageLimits(data.usage_limit_per_client)
  ) {
    return {
      valid: false,
      error: 'Usage limits must be null or non-negative integers',
      errorCode: 'AFFILIATE_INVALID_USAGE_LIMITS',
    }
  }

  return { valid: true }
}

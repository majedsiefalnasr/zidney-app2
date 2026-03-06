/**
 * Affiliate Validation Logic (Pure Functions)
 * Stage: STAGE_13_AFFILIATES
 * Task: T022 - Affiliate Validation Logic Domain Functions
 * Purpose: Pure validation functions reusable by API and Worker
 */

import type { Affiliate } from './types'

/**
 * Check if affiliate is in ACTIVE status
 * Pure function - no side effects
 */
export function checkAffiliateActive(affiliate: Affiliate): boolean {
  return affiliate.status === 'ACTIVE'
}

/**
 * Check if current time falls within affiliate temporal window
 * Validates: start_date <= CURRENT_TIMESTAMP < end_date
 * Pure function - no side effects
 *
 * @param affiliate - Affiliate record
 * @param now - Current timestamp (defaults to Date.now())
 * @returns true if valid, false otherwise
 */
export function checkTemporalValidity(affiliate: Affiliate, now: Date = new Date()): boolean {
  const startTime = new Date(affiliate.start_date).getTime()
  const endTime = new Date(affiliate.end_date).getTime()
  const nowTime = now.getTime()

  // start_date <= now < end_date (exclusive upper bound)
  return nowTime >= startTime && nowTime < endTime
}

/**
 * Check if global usage limit has been reached
 * Pure function - no side effects
 *
 * Returns true if limit NOT exceeded (i.e., code is still usable)
 * Returns false if limit IS exceeded (code cannot be used)
 *
 * @param usageCount - Current usage count
 * @param usageLimit - Maximum usage limit (null = unlimited)
 * @returns true if usage acceptable, false if limit exceeded
 */
export function checkGlobalUsageLimit(usageCount: number, usageLimit: number | null): boolean {
  if (usageLimit === null || usageLimit === undefined) {
    // No limit set - always acceptable
    return true
  }
  // Limit set - check if current usage < limit
  return usageCount < usageLimit
}

/**
 * Check if per-client usage limit has been reached
 * Pure function - no side effects
 *
 * Returns true if limit NOT exceeded (i.e., client can still use code)
 * Returns false if limit IS exceeded (client cannot use code again)
 *
 * @param currentClientUsageCount - Number of times this client has used this affiliate code
 * @param usageLimitPerClient - Maximum uses per client (null = unlimited)
 * @returns true if client can use code, false if limit exceeded
 */
export function checkPerClientUsageLimit(
  currentClientUsageCount: number,
  usageLimitPerClient: number | null
): boolean {
  if (usageLimitPerClient === null || usageLimitPerClient === undefined) {
    // No per-client limit set - always acceptable
    return true
  }
  // Limit set - check if current usage < limit
  return currentClientUsageCount < usageLimitPerClient
}

/**
 * Comprehensive validation check for all affiliate criteria
 * Pure function - composes other checks
 *
 * @param affiliate - Affiliate record to validate
 * @param clientUsageCount - Number of times this client has used this code
 * @param now - Current timestamp
 * @returns Object with validation result and specific failure reason if invalid
 */
export function validateAffiliateEligibility(
  affiliate: Affiliate,
  clientUsageCount: number,
  now: Date = new Date()
): {
  valid: boolean
  failureReason?: string
} {
  // Check status
  if (!checkAffiliateActive(affiliate)) {
    return { valid: false, failureReason: 'AFFILIATE_CODE_INACTIVE' }
  }

  // Check temporal range
  if (!checkTemporalValidity(affiliate, now)) {
    return { valid: false, failureReason: 'AFFILIATE_CODE_EXPIRED' }
  }

  // Check global usage limit
  if (!checkGlobalUsageLimit(affiliate.usage_count, affiliate.usage_limit_total)) {
    return { valid: false, failureReason: 'AFFILIATE_USAGE_LIMIT_EXCEEDED' }
  }

  // Check per-client usage limit
  if (!checkPerClientUsageLimit(clientUsageCount, affiliate.usage_limit_per_client)) {
    return {
      valid: false,
      failureReason: 'AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED',
    }
  }

  return { valid: true }
}

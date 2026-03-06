/**
 * Error Codes: Affiliate System
 * Stage: STAGE_13_AFFILIATES
 * Purpose: Standard error codes for affiliate operations
 */

export enum AffiliateErrorCode {
  AFFILIATE_CODE_NOT_FOUND = 'AFFILIATE_CODE_NOT_FOUND',
  AFFILIATE_CODE_INACTIVE = 'AFFILIATE_CODE_INACTIVE',
  AFFILIATE_CODE_EXPIRED = 'AFFILIATE_CODE_EXPIRED',
  AFFILIATE_USAGE_LIMIT_EXCEEDED = 'AFFILIATE_USAGE_LIMIT_EXCEEDED',
  AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED = 'AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED',
  AFFILIATE_INVALID_DISCOUNT_PERCENTAGE = 'AFFILIATE_INVALID_DISCOUNT_PERCENTAGE',
  AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE = 'AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE',
  AFFILIATE_INVALID_COMMISSION_PERCENTAGE = 'AFFILIATE_INVALID_COMMISSION_PERCENTAGE',
  AFFILIATE_INVALID_DATE_RANGE = 'AFFILIATE_INVALID_DATE_RANGE',
  AFFILIATE_INVALID_USAGE_LIMITS = 'AFFILIATE_INVALID_USAGE_LIMITS',
}

export const AffiliateErrorMessages: Record<AffiliateErrorCode, string> = {
  [AffiliateErrorCode.AFFILIATE_CODE_NOT_FOUND]: 'Affiliate code not found or inactive',
  [AffiliateErrorCode.AFFILIATE_CODE_INACTIVE]: 'Affiliate code has been disabled',
  [AffiliateErrorCode.AFFILIATE_CODE_EXPIRED]: 'Affiliate code has expired',
  [AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_EXCEEDED]: 'Affiliate code has reached its usage limit',
  [AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED]:
    'Client has reached maximum uses for this code',
  [AffiliateErrorCode.AFFILIATE_INVALID_DISCOUNT_PERCENTAGE]:
    'Discount percentage must be between 0 and 100',
  [AffiliateErrorCode.AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE]: 'This promo code already exists',
  [AffiliateErrorCode.AFFILIATE_INVALID_COMMISSION_PERCENTAGE]:
    'Commission percentage must be between 0 and 100',
  [AffiliateErrorCode.AFFILIATE_INVALID_DATE_RANGE]: 'Start date must be before end date',
  [AffiliateErrorCode.AFFILIATE_INVALID_USAGE_LIMITS]: 'Usage limits must be null or non-negative',
}

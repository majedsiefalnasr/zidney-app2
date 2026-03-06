/**
 * Unit Tests: Affiliate Error Codes
 * Stage: STAGE_13_AFFILIATES
 * Task: T038
 */

import { describe, expect, it } from 'vitest'
import {
  AffiliateErrorCode,
  AffiliateErrorMessages,
} from '../../../packages/domain-core/src/affiliates/error-codes'

describe('Affiliate Error Codes', () => {
  it('should have all error codes defined', () => {
    expect(AffiliateErrorCode.AFFILIATE_CODE_NOT_FOUND).toBeDefined()
    expect(AffiliateErrorCode.AFFILIATE_CODE_INACTIVE).toBeDefined()
    expect(AffiliateErrorCode.AFFILIATE_CODE_EXPIRED).toBeDefined()
    expect(AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_EXCEEDED).toBeDefined()
    expect(AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED).toBeDefined()
    expect(AffiliateErrorCode.AFFILIATE_INVALID_DISCOUNT_PERCENTAGE).toBeDefined()
    expect(AffiliateErrorCode.AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE).toBeDefined()
  })

  it('should have error messages for all codes', () => {
    Object.values(AffiliateErrorCode).forEach((code) => {
      expect(AffiliateErrorMessages[code]).toBeDefined()
      expect(AffiliateErrorMessages[code]).toBeTruthy()
    })
  })

  it('should have human-readable messages', () => {
    expect(AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_CODE_NOT_FOUND]).toContain(
      'not found'
    )
    expect(AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_CODE_EXPIRED]).toContain('expired')
  })
})

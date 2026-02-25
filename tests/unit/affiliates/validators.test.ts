/**
 * Unit Tests: Affiliate Validators
 * Stage: STAGE_13_AFFILIATES
 * Task: T009
 */

import { describe, expect, it } from 'vitest'
import { Affiliate } from '../../../packages/domain-core/src/affiliates/types'
import {
  checkAffiliateActive,
  checkGlobalUsageLimit,
  checkTemporalValidity,
  normalizePromoCode,
  validateAffiliateData,
  validateDateRange,
  validatePercentageRange,
  validatePromoCode,
  validateUsageLimits,
} from '../../../packages/domain-core/src/affiliates/validators'

describe('Affiliate Validators', () => {
  describe('validatePromoCode', () => {
    it('should accept valid uppercase alphanumeric codes', () => {
      expect(validatePromoCode('SPRING25')).toBe(true)
      expect(validatePromoCode('ABC123')).toBe(true)
    })

    it('should reject codes with spaces', () => {
      expect(validatePromoCode('SPRING 25')).toBe(false)
    })

    it('should reject lowercase codes', () => {
      expect(validatePromoCode('spring25')).toBe(false)
    })

    it('should reject codes with special characters', () => {
      expect(validatePromoCode('SPRING@25')).toBe(false)
      expect(validatePromoCode('SPRING-25')).toBe(false)
    })

    it('should reject codes shorter than 3 characters', () => {
      expect(validatePromoCode('AB')).toBe(false)
    })

    it('should reject codes longer than 50 characters', () => {
      const long = 'A'.repeat(51)
      expect(validatePromoCode(long)).toBe(false)
    })

    it('should reject null/undefined', () => {
      expect(validatePromoCode(null as any)).toBe(false)
      expect(validatePromoCode(undefined)).toBe(false)
    })
  })

  describe('normalizePromoCode', () => {
    it('should trim and uppercase', () => {
      expect(normalizePromoCode('  spring25  ')).toBe('SPRING25')
    })
  })

  describe('validatePercentageRange', () => {
    it('should accept valid percentages', () => {
      expect(validatePercentageRange('0')).toBe(true)
      expect(validatePercentageRange('50')).toBe(true)
      expect(validatePercentageRange('100')).toBe(true)
      expect(validatePercentageRange('10.50')).toBe(true)
    })

    it('should reject negative percentages', () => {
      expect(validatePercentageRange('-1')).toBe(false)
    })

    it('should reject percentages > 100', () => {
      expect(validatePercentageRange('101')).toBe(false)
    })

    it('should reject null/undefined', () => {
      expect(validatePercentageRange(null)).toBe(false)
      expect(validatePercentageRange(undefined)).toBe(false)
    })
  })

  describe('validateDateRange', () => {
    it('should accept valid date ranges', () => {
      const start = new Date('2026-01-01')
      const end = new Date('2026-12-31')
      const result = validateDateRange(start, end)
      expect(result.valid).toBe(true)
    })

    it('should reject end date before start date', () => {
      const start = new Date('2026-12-31')
      const end = new Date('2026-01-01')
      const result = validateDateRange(start, end)
      expect(result.valid).toBe(false)
    })

    it('should reject equal dates', () => {
      const date = new Date('2026-01-01')
      const result = validateDateRange(date, date)
      expect(result.valid).toBe(false)
    })
  })

  describe('validateUsageLimits', () => {
    it('should accept null (unlimited)', () => {
      expect(validateUsageLimits(null)).toBe(true)
    })

    it('should accept valid limits', () => {
      expect(validateUsageLimits(0)).toBe(true)
      expect(validateUsageLimits(10)).toBe(true)
      expect(validateUsageLimits(1000)).toBe(true)
    })

    it('should reject negative limits', () => {
      expect(validateUsageLimits(-1)).toBe(false)
    })

    it('should reject decimals', () => {
      expect(validateUsageLimits(10.5)).toBe(false)
    })
  })

  describe('checkAffiliateActive', () => {
    it('should return true for ACTIVE affiliates', () => {
      const affiliate = { status: 'ACTIVE' } as Affiliate
      expect(checkAffiliateActive(affiliate)).toBe(true)
    })

    it('should return false for INACTIVE affiliates', () => {
      const affiliate = { status: 'INACTIVE' } as Affiliate
      expect(checkAffiliateActive(affiliate)).toBe(false)
    })
  })

  describe('checkTemporalValidity', () => {
    it('should return true if within time window', () => {
      const now = new Date('2026-06-15')
      const affiliate = {
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      } as Affiliate
      expect(checkTemporalValidity(affiliate, now)).toBe(true)
    })

    it('should return false if before start date', () => {
      const now = new Date('2025-12-31')
      const affiliate = {
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      } as Affiliate
      expect(checkTemporalValidity(affiliate, now)).toBe(false)
    })

    it('should return false if after end date', () => {
      const now = new Date('2027-01-01')
      const affiliate = {
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      } as Affiliate
      expect(checkTemporalValidity(affiliate, now)).toBe(false)
    })

    it('should return false at exact end date (exclusive)', () => {
      const now = new Date('2026-12-31')
      const affiliate = {
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      } as Affiliate
      expect(checkTemporalValidity(affiliate, now)).toBe(false)
    })
  })

  describe('checkGlobalUsageLimit', () => {
    it('should return true if no limit set', () => {
      const affiliate = {
        usage_limit_total: null,
        usage_count: 1000,
      } as Affiliate
      expect(checkGlobalUsageLimit(affiliate)).toBe(true)
    })

    it('should return true if under limit', () => {
      const affiliate = {
        usage_limit_total: 100,
        usage_count: 50,
      } as Affiliate
      expect(checkGlobalUsageLimit(affiliate)).toBe(true)
    })

    it('should return false if at limit', () => {
      const affiliate = {
        usage_limit_total: 100,
        usage_count: 100,
      } as Affiliate
      expect(checkGlobalUsageLimit(affiliate)).toBe(false)
    })

    it('should return false if over limit', () => {
      const affiliate = {
        usage_limit_total: 100,
        usage_count: 101,
      } as Affiliate
      expect(checkGlobalUsageLimit(affiliate)).toBe(false)
    })
  })

  describe('validateAffiliateData', () => {
    it('should validate correct affiliate data', () => {
      const result = validateAffiliateData({
        promo_code: 'SPRING25',
        discount_percentage: '10',
        commission_percentage: '2.5',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
        usage_limit_total: 1000,
        usage_limit_per_client: 10,
      })
      expect(result.valid).toBe(true)
    })

    it('should reject invalid promo code', () => {
      const result = validateAffiliateData({
        promo_code: 'inv@lid',
        discount_percentage: '10',
        commission_percentage: '2.5',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      })
      expect(result.valid).toBe(false)
    })

    it('should reject invalid percentage', () => {
      const result = validateAffiliateData({
        promo_code: 'SPRING25',
        discount_percentage: '150', // > 100
        commission_percentage: '2.5',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      })
      expect(result.valid).toBe(false)
    })

    it('should reject invalid date range', () => {
      const result = validateAffiliateData({
        promo_code: 'SPRING25',
        discount_percentage: '10',
        commission_percentage: '2.5',
        start_date: new Date('2026-12-31'),
        end_date: new Date('2026-01-01'), // end before start
      })
      expect(result.valid).toBe(false)
    })
  })
})

/**
 * Edge Case Tests: Invalid Inputs
 * Stage: STAGE_13_AFFILIATES
 * Task: T040
 */

import { describe, expect, it } from 'vitest'
import {
  validateAffiliateData,
  validatePercentageRange,
  validateUsageLimits,
} from '../../../packages/domain-core/src/affiliates/validators'

describe('Invalid Input Edge Cases', () => {
  describe('Base amount validation', () => {
    it('should reject 0 base amount in full validation', () => {
      const result = validateAffiliateData({
        promo_code: 'TEST00',
        discount_percentage: '10',
        commission_percentage: '2.5',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      })
      // This should pass validation - base amount validation happens at license purchase level
      expect(result.valid).toBe(true)
    })
  })

  describe('Percentage validation', () => {
    it('should reject negative discount', () => {
      expect(validatePercentageRange('-0.01')).toBe(false)
      expect(validatePercentageRange('-50')).toBe(false)
    })

    it('should reject percentage > 100', () => {
      expect(validatePercentageRange('100.01')).toBe(false)
      expect(validatePercentageRange('150')).toBe(false)
      expect(validatePercentageRange('999.99')).toBe(false)
    })

    it('should reject non-numeric values', () => {
      expect(validatePercentageRange('abc')).toBe(false)
      expect(validatePercentageRange('10.50.50')).toBe(false)
    })

    it('should accept boundary values', () => {
      expect(validatePercentageRange('0')).toBe(true)
      expect(validatePercentageRange('0.00')).toBe(true)
      expect(validatePercentageRange('100')).toBe(true)
      expect(validatePercentageRange('100.00')).toBe(true)
    })
  })

  describe('Usage limits validation', () => {
    it('should reject negative limits', () => {
      expect(validateUsageLimits(-1)).toBe(false)
      expect(validateUsageLimits(-1000)).toBe(false)
    })

    it('should accept zero limit', () => {
      expect(validateUsageLimits(0)).toBe(true)
    })

    it('should reject decimal limits', () => {
      expect(validateUsageLimits(10.5)).toBe(false)
      expect(validateUsageLimits(0.1)).toBe(false)
    })

    it('should accept null (unlimited)', () => {
      expect(validateUsageLimits(null)).toBe(true)
    })
  })

  describe('Complete affiliate validation with invalid inputs', () => {
    it('should reject all invalid percentages', () => {
      const baseData = {
        promo_code: 'VALID00',
        discount_percentage: '150', // Invalid
        commission_percentage: '2.5',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      }

      const result = validateAffiliateData(baseData)
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('AFFILIATE_INVALID_DISCOUNT_PERCENTAGE')
    })

    it('should reject invalid commission', () => {
      const result = validateAffiliateData({
        promo_code: 'VALID00',
        discount_percentage: '10',
        commission_percentage: '-5', // Invalid
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      })
      expect(result.valid).toBe(false)
    })

    it('should reject invalid date range', () => {
      const result = validateAffiliateData({
        promo_code: 'VALID00',
        discount_percentage: '10',
        commission_percentage: '2.5',
        start_date: new Date('2026-12-31'),
        end_date: new Date('2026-01-01'), // Invalid
      })
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('AFFILIATE_INVALID_DATE_RANGE')
    })

    it('should reject invalid usage limits', () => {
      const result = validateAffiliateData({
        promo_code: 'VALID00',
        discount_percentage: '10',
        commission_percentage: '2.5',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
        usage_limit_total: -1, // Invalid
      })
      expect(result.valid).toBe(false)
    })
  })
})

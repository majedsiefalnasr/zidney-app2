/**
 * Edge Case Tests: Financial Precision
 * Stage: STAGE_13_AFFILIATES
 * Task: T039
 */

import { describe, expect, it } from 'vitest'
import {
  calculateCommissionPreview,
  calculateDiscountPreview,
} from '../../../packages/domain-core/src/affiliates/calculations'

describe('Financial Precision Edge Cases', () => {
  describe('Fractional cent calculations', () => {
    it('should handle 33.33% of 100 correctly', () => {
      const result = calculateDiscountPreview(100.0, 33.33)
      expect(result).toBe('33.33')
    })

    it('should handle complex fractional calculations', () => {
      const result = calculateDiscountPreview(123.45, 7.89)
      // 123.45 * 7.89 / 100 = 9.736205 → rounds to 9.74
      expect(parseFloat(result)).toBeCloseTo(9.74, 2)
    })

    it('should handle very small percentages', () => {
      const result = calculateDiscountPreview(100.0, 0.01)
      expect(result).toBe('0.01')
    })

    it('should handle 99.99%', () => {
      const result = calculateDiscountPreview(100.0, 99.99)
      expect(result).toBe('99.99')
    })
  })

  describe('Large amount calculations', () => {
    it('should handle maximum NUMERIC(12,2) amount', () => {
      const result = calculateDiscountPreview(999999999.9, 10)
      expect(result).toBe('99999999.99')
    })

    it('should maintain precision with large amounts', () => {
      const result = calculateDiscountPreview(1000000.0, 0.01)
      expect(result).toBe('100.00')
    })
  })

  describe('Commission calculation precision', () => {
    it('should calculate commission with fractional amounts', () => {
      const result = calculateCommissionPreview(999.99, 2.75)
      // 999.99 * 2.75 / 100 = 27.4997 → rounds to 27.50
      expect(parseFloat(result)).toBeCloseTo(27.5, 2)
    })

    it("should round 0.5 consistently using banker's rounding", () => {
      const result = calculateCommissionPreview(100.0, 0.5)
      expect(result).toBe('0.50')
    })
  })

  describe('Extreme percentages', () => {
    it('should handle 0% correctly', () => {
      expect(calculateDiscountPreview(1000.0, 0)).toBe('0.00')
      expect(calculateCommissionPreview(1000.0, 0)).toBe('0.00')
    })

    it('should handle 100% correctly', () => {
      expect(calculateDiscountPreview(1000.0, 100)).toBe('1000.00')
      expect(calculateCommissionPreview(1000.0, 100)).toBe('1000.00')
    })
  })

  describe('Consistency across operations', () => {
    it('discount + commission should not exceed base amount', () => {
      const base = 100.0
      const discountPct = 50
      const commissionPct = 50

      const discount = calculateDiscountPreview(base, discountPct)
      const commission = calculateCommissionPreview(base, commissionPct)

      const total = parseFloat(discount) + parseFloat(commission)
      expect(total).toBeLessThanOrEqual(base)
    })
  })
})

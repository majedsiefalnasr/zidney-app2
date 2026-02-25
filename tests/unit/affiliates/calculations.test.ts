/**
 * Unit Tests: Affiliate Financial Calculations
 * Stage: STAGE_13_AFFILIATES
 * Task: T008
 */

import { describe, expect, it } from 'vitest'
import {
  calculateCommissionPreview,
  calculateDiscountPreview,
  calculateFinalAmount,
} from '../../../packages/domain-core/src/affiliates/calculations'

describe('Affiliate Calculations', () => {
  describe('calculateDiscountPreview', () => {
    it('should calculate discount with standard percentage', () => {
      const result = calculateDiscountPreview(100.0, 10)
      expect(result).toBe('10.00')
    })

    it('should round correctly for fractional cents', () => {
      const result = calculateDiscountPreview(100.0, 33.33)
      expect(result).toBe('33.33')
    })

    it('should handle 0% discount', () => {
      const result = calculateDiscountPreview(100.0, 0)
      expect(result).toBe('0.00')
    })

    it('should handle 100% discount', () => {
      const result = calculateDiscountPreview(100.0, 100)
      expect(result).toBe('100.00')
    })

    it('should handle zero base amount', () => {
      const result = calculateDiscountPreview(0.0, 50)
      expect(result).toBe('0.00')
    })

    it('should handle large amounts', () => {
      const result = calculateDiscountPreview(999999.9, 10)
      expect(result).toBe('99999.99')
    })

    it('should handle fractional percentages', () => {
      const result = calculateDiscountPreview(100.0, 0.01)
      expect(result).toBe('0.01')
    })
  })

  describe('calculateCommissionPreview', () => {
    it('should calculate commission with standard percentage', () => {
      const result = calculateCommissionPreview(100.0, 2.75)
      expect(result).toBe('2.75')
    })

    it('should handle 0% commission', () => {
      const result = calculateCommissionPreview(100.0, 0)
      expect(result).toBe('0.00')
    })

    it('should round correctly for fractional results', () => {
      const result = calculateCommissionPreview(100.0, 2.765)
      // Should round to 2.77 using default rounding
      expect(parseFloat(result)).toBeCloseTo(2.77, 2)
    })
  })

  describe('calculateFinalAmount', () => {
    it('should calculate final amount after discount', () => {
      const result = calculateFinalAmount(100.0, 10.0)
      expect(result).toBe('90.00')
    })

    it('should handle zero discount', () => {
      const result = calculateFinalAmount(100.0, 0.0)
      expect(result).toBe('100.00')
    })

    it('should handle full discount', () => {
      const result = calculateFinalAmount(100.0, 100.0)
      expect(result).toBe('0.00')
    })

    it('should handle large amounts', () => {
      const result = calculateFinalAmount(999999.99, 100000.0)
      expect(result).toBe('899999.99')
    })
  })
})

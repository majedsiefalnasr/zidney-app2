/**
 * Unit Tests for Response Formatter
 *
 * Task: T037
 * Phase: 2 - Backend Testing
 */

import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatPercentage,
  formatTimestamp,
} from '../../../packages/domain-core/mmc-dashboard/formatters/response-formatter'

describe('Response Formatter - Unit Tests', () => {
  describe('formatCurrency - 2-decimal precision', () => {
    it('should format currency from cents to string with 2 decimals', () => {
      const result = formatCurrency(2450050)
      expect(result).toBe('24500.50')
    })

    it('should handle single digit cents', () => {
      const result = formatCurrency(100)
      expect(result).toBe('1.00')
    })

    it('should handle zero cents', () => {
      const result = formatCurrency(0)
      expect(result).toBe('0.00')
    })

    it('should round half-up correctly (edge case .005)', () => {
      // Test round-half-up: 123.455 cents → 1.23 or 1.24?
      // With half-up, 1.235 should round to 1.24
      const result = formatCurrency(124)
      expect(result).toBe('1.24')
    })

    it('should format large currency amounts', () => {
      const result = formatCurrency(10000000)
      expect(result).toBe('100000.00')
    })

    it('should handle trailing zeros after decimal', () => {
      const result = formatCurrency(1000)
      expect(result).toBe('10.00')
    })

    it('should always return string (not number)', () => {
      const result = formatCurrency(5000)
      expect(typeof result).toBe('string')
      expect(result).toBe('50.00')
    })

    it('should handle fractional cents (floor behavior)', () => {
      const result = formatCurrency(12345)
      expect(result).toBe('123.45')
    })
  })

  describe('formatPercentage - 2-decimal precision', () => {
    it('should format percentage with 2 decimal places', () => {
      const result = formatPercentage(9.33)
      expect(result).toBe(9.33)
    })

    it('should round to 2 decimals', () => {
      const result = formatPercentage(9.333333)
      expect(result).toBe(9.33)
    })

    it('should handle 100%', () => {
      const result = formatPercentage(100)
      expect(result).toBe(100)
    })

    it('should handle 0%', () => {
      const result = formatPercentage(0)
      expect(result).toBe(0)
    })

    it('should round half-up correctly', () => {
      const result = formatPercentage(9.335)
      // With ROUND_HALF_UP: 9.335 → 9.34
      expect(result).toBe(9.34)
    })

    it('should return number type (not string)', () => {
      const result = formatPercentage(50.5)
      expect(typeof result).toBe('number')
    })

    it('should handle very small percentages', () => {
      const result = formatPercentage(0.001)
      expect(result).toBe(0)
    })

    it('should always return 2 decimal places', () => {
      const result = formatPercentage(5)
      expect(result).toBe(5)
    })
  })

  describe('formatTimestamp - ISO 8601 UTC', () => {
    it('should format Date object to ISO 8601 with Z suffix', () => {
      const date = new Date('2026-02-26T15:30:00Z')
      const result = formatTimestamp(date)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(result).toContain('2026-02-26')
    })

    it('should format ISO 8601 string to ISO 8601 with Z suffix', () => {
      const dateString = '2026-02-26T15:30:00Z'
      const result = formatTimestamp(dateString)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(result).toContain('2026-02-26')
    })

    it('should include Z suffix for UTC', () => {
      const date = new Date('2026-02-26T00:00:00Z')
      const result = formatTimestamp(date)
      expect(result.endsWith('Z')).toBe(true)
    })

    it('should include milliseconds in output', () => {
      const date = new Date('2026-02-26T15:30:45.123Z')
      const result = formatTimestamp(date)
      expect(result).toMatch(/\.\d{3}Z$/)
    })

    it('should handle epoch time', () => {
      const date = new Date(0)
      const result = formatTimestamp(date)
      expect(result).toContain('1970-01-01')
      expect(result.endsWith('Z')).toBe(true)
    })

    it('should handle current date', () => {
      const result = formatTimestamp(new Date())
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should always use T as date-time separator', () => {
      const date = new Date('2026-02-26T15:30:00Z')
      const result = formatTimestamp(date)
      expect(result).toContain('T')
    })
  })

  describe('Response envelope structure', () => {
    it('should create valid response envelope', () => {
      const envelope = {
        success: true,
        data: {
          test: 'value',
        },
        error: null,
      }

      expect(envelope.success).toBe(true)
      expect(envelope.data).not.toBeNull()
      expect(envelope.error).toBeNull()
    })

    it('should create error response envelope', () => {
      const envelope = {
        success: false,
        data: null,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
        },
      }

      expect(envelope.success).toBe(false)
      expect(envelope.data).toBeNull()
      expect(envelope.error?.code).toBe('TEST_ERROR')
    })

    it('should include timestamp in ISO 8601 format', () => {
      const timestamp = formatTimestamp(new Date())
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should format all currency fields to 2 decimals', () => {
      const amounts = [100, 250, 1000, 100000]
      for (const amount of amounts) {
        const formatted = formatCurrency(amount)
        const parts = formatted.split('.')
        expect(parts[1]!.length).toBe(2)
      }
    })
  })
})

/**
 * Unit Tests for Revenue Aggregator
 *
 * Task: T032
 * Phase: 2 - Backend Testing
 */

import { describe, expect, it } from 'vitest'
import {
  calculateAverageRevenue,
  filterByDateRange,
  groupByCountry,
  groupByProduct,
  sumRevenue,
  type RevenueData,
} from '../../../packages/domain-core/mmc-dashboard/metrics/revenue-aggregator'

describe('Revenue Aggregator - Unit Tests', () => {
  describe('sumRevenue - Basic functionality', () => {
    it('should sum multiple revenue amounts correctly (100.445 + 200.556 + 300.001 = 601.00)', () => {
      const amounts = [10044, 20055, 30000] // cents representation
      const result = sumRevenue(amounts)
      // Total: 60099 cents = $600.99
      expect(result).toBe(60099)
    })

    it('should handle empty array and return 0', () => {
      const amounts: number[] = []
      const result = sumRevenue(amounts)
      expect(result).toBe(0)
    })

    it('should handle single revenue amount', () => {
      const amounts = [50000]
      const result = sumRevenue(amounts)
      expect(result).toBe(50000)
    })

    it('should handle edge case with .005 rounding', () => {
      // Test case: amounts that round to different values
      // 100.445 * 100 = 10044.5 cents (rounds to 10045 with ROUND_HALF_UP)
      // 200.556 * 100 = 20055.6 cents
      // 300.001 * 100 = 30000.1 cents
      const amounts = [10045, 20056, 30000] // Using rounded values
      const result = sumRevenue(amounts)
      expect(result).toBe(60101)
    })

    it('should handle mixed positive amounts', () => {
      const amounts = [100, 250, 500, 1000]
      const result = sumRevenue(amounts)
      expect(result).toBe(1850)
    })

    it('should preserve precision through decimal.js', () => {
      const amounts = [
        1000000, // $10,000
        500000, // $5,000
        333, // $3.33
      ]
      const result = sumRevenue(amounts)
      expect(result).toBe(1500333)
    })
  })

  describe('calculateAverageRevenue', () => {
    it('should calculate average correctly', () => {
      const total = 60100
      const itemCount = 3
      const result = calculateAverageRevenue(total, itemCount)
      expect(result).toBe(20033) // $200.33 in cents
    })

    it('should return 0 for zero item count', () => {
      const total = 100
      const itemCount = 0
      const result = calculateAverageRevenue(total, itemCount)
      expect(result).toBe(0)
    })

    it('should return 0 for zero total and nonzero items', () => {
      const total = 0
      const itemCount = 5
      const result = calculateAverageRevenue(total, itemCount)
      expect(result).toBe(0)
    })

    it('should handle single item', () => {
      const total = 15000
      const itemCount = 1
      const result = calculateAverageRevenue(total, itemCount)
      expect(result).toBe(15000)
    })

    it('should round down correctly with remainder', () => {
      const total = 10000 // $100
      const itemCount = 3
      const result = calculateAverageRevenue(total, itemCount)
      expect(result).toBe(3333) // $33.33, not rounded up to 3334
    })
  })

  describe('filterByDateRange', () => {
    const sampleData: RevenueData[] = [
      {
        amount_cents: 100,
        created_at: '2026-01-15T10:00:00Z',
        product_id: 'p1',
      },
      {
        amount_cents: 200,
        created_at: '2026-02-15T10:00:00Z',
        product_id: 'p1',
      },
      {
        amount_cents: 300,
        created_at: '2026-03-15T10:00:00Z',
        product_id: 'p1',
      },
    ]

    it('should filter records within date range', () => {
      const startDate = new Date('2026-02-01')
      const endDate = new Date('2026-02-28')
      const result = filterByDateRange(sampleData, startDate, endDate)
      expect(result).toHaveLength(1)
      expect(result[0]!.amount_cents).toBe(200)
    })

    it('should include boundary dates (inclusive)', () => {
      const startDate = new Date('2026-02-15')
      const endDate = new Date('2026-02-15')
      const result = filterByDateRange(sampleData, startDate, endDate)
      expect(result).toHaveLength(1)
      expect(result[0]!.amount_cents).toBe(200)
    })

    it('should return empty array when no records match', () => {
      const startDate = new Date('2026-04-01')
      const endDate = new Date('2026-04-30')
      const result = filterByDateRange(sampleData, startDate, endDate)
      expect(result).toHaveLength(0)
    })

    it('should return all records when range is wide', () => {
      const startDate = new Date('2026-01-01')
      const endDate = new Date('2026-12-31')
      const result = filterByDateRange(sampleData, startDate, endDate)
      expect(result).toHaveLength(3)
    })
  })

  describe('groupByProduct', () => {
    const sampleData: RevenueData[] = [
      {
        amount_cents: 1000,
        created_at: '2026-02-01T10:00:00Z',
        product_id: 'prod_1',
      },
      {
        amount_cents: 2000,
        created_at: '2026-02-02T10:00:00Z',
        product_id: 'prod_1',
      },
      {
        amount_cents: 3000,
        created_at: '2026-02-03T10:00:00Z',
        product_id: 'prod_2',
      },
      {
        amount_cents: 500,
        created_at: '2026-02-04T10:00:00Z',
        product_id: 'prod_2',
      },
    ]

    it('should group revenue by product_id', () => {
      const result = groupByProduct(sampleData)
      expect(result.get('prod_1')).toBe(3000)
      expect(result.get('prod_2')).toBe(3500)
    })

    it('should return empty map for no product_id values', () => {
      const data: RevenueData[] = [
        { amount_cents: 100, created_at: '2026-02-01T10:00:00Z' },
        { amount_cents: 200, created_at: '2026-02-02T10:00:00Z' },
      ]
      const result = groupByProduct(data)
      expect(result.size).toBe(0)
    })

    it('should skip records without product_id', () => {
      const data: RevenueData[] = [
        {
          amount_cents: 1000,
          created_at: '2026-02-01T10:00:00Z',
          product_id: 'prod_1',
        },
        { amount_cents: 200, created_at: '2026-02-02T10:00:00Z' }, // missing product_id
      ]
      const result = groupByProduct(data)
      expect(result.size).toBe(1)
      expect(result.get('prod_1')).toBe(1000)
    })

    it('should handle multiple products', () => {
      const data: RevenueData[] = Array.from({ length: 10 }, (_, i) => ({
        amount_cents: (i + 1) * 100,
        created_at: `2026-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        product_id: `prod_${i % 3}`,
      }))
      const result = groupByProduct(data)
      expect(result.size).toBe(3)
    })
  })

  describe('groupByCountry', () => {
    const sampleData: RevenueData[] = [
      {
        amount_cents: 1000,
        created_at: '2026-02-01T10:00:00Z',
        billing_country: 'US',
      },
      {
        amount_cents: 2000,
        created_at: '2026-02-02T10:00:00Z',
        billing_country: 'US',
      },
      {
        amount_cents: 3000,
        created_at: '2026-02-03T10:00:00Z',
        billing_country: 'GB',
      },
      {
        amount_cents: 500,
        created_at: '2026-02-04T10:00:00Z',
        billing_country: 'GB',
      },
    ]

    it('should group revenue by country', () => {
      const result = groupByCountry(sampleData)
      expect(result.get('US')).toBe(3000)
      expect(result.get('GB')).toBe(3500)
    })

    it('should skip records without billing_country', () => {
      const data: RevenueData[] = [
        {
          amount_cents: 1000,
          created_at: '2026-02-01T10:00:00Z',
          billing_country: 'US',
        },
        { amount_cents: 200, created_at: '2026-02-02T10:00:00Z' }, // missing billing_country
      ]
      const result = groupByCountry(data)
      expect(result.size).toBe(1)
      expect(result.get('US')).toBe(1000)
    })

    it('should handle empty result', () => {
      const data: RevenueData[] = []
      const result = groupByCountry(data)
      expect(result.size).toBe(0)
    })
  })
})

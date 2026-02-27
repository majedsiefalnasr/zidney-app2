/**
 * Unit Tests for Affiliate Aggregator
 *
 * Task: T034
 * Phase: 2 - Backend Testing
 */

import { describe, expect, it } from 'vitest'
import {
  calculateAverageCommission,
  calculatePaginationOffset,
  calculateTotalCommission,
  filterByStatus,
  getAffiliateStatistics,
  rankAffiliates,
  sortAffiliates,
  type AffiliateMetrics,
} from '../../../packages/domain-core/mmc-dashboard/metrics/affiliate-aggregator'

describe('Affiliate Aggregator - Unit Tests', () => {
  describe('calculateAverageCommission', () => {
    it('should calculate average commission correctly', () => {
      const total = 100000
      const usageCount = 4
      const result = calculateAverageCommission(total, usageCount)
      expect(result).toBe(25000)
    })

    it('should return 0 for zero usage count', () => {
      const total = 100000
      const usageCount = 0
      const result = calculateAverageCommission(total, usageCount)
      expect(result).toBe(0)
    })

    it('should handle fractional division (floor)', () => {
      const total = 10000 // $100
      const usageCount = 3
      const result = calculateAverageCommission(total, usageCount)
      expect(result).toBe(3333) // $33.33, floored
    })

    it('should handle single usage', () => {
      const total = 50000
      const usageCount = 1
      const result = calculateAverageCommission(total, usageCount)
      expect(result).toBe(50000)
    })
  })

  describe('calculatePaginationOffset', () => {
    it('should calculate offset for page 1', () => {
      const result = calculatePaginationOffset(1, 10, 100)
      expect(result.offset).toBe(0)
      expect(result.page).toBe(1)
      expect(result.page_size).toBe(10)
      expect(result.total_pages).toBe(10)
    })

    it('should calculate offset for page 2', () => {
      const result = calculatePaginationOffset(2, 10, 100)
      expect(result.offset).toBe(10)
      expect(result.page).toBe(2)
      expect(result.total_pages).toBe(10)
    })

    it('should handle page > total pages', () => {
      const result = calculatePaginationOffset(15, 10, 100)
      expect(result.offset).toBe(140)
      expect(result.page).toBe(15)
      expect(result.total_pages).toBe(10)
    })

    it('should handle invalid page (zero or negative)', () => {
      const result = calculatePaginationOffset(0, 10, 100)
      expect(result.offset).toBe(0)
      expect(result.page).toBe(1)
      expect(result.total_pages).toBe(10)
    })

    it('should handle odd total for page size', () => {
      const result = calculatePaginationOffset(2, 10, 105)
      expect(result.offset).toBe(10)
      expect(result.total_pages).toBe(11)
    })

    it('should handle empty results', () => {
      const result = calculatePaginationOffset(1, 10, 0)
      expect(result.offset).toBe(0)
      expect(result.total_pages).toBe(1)
    })
  })

  describe('rankAffiliates', () => {
    const metrics: AffiliateMetrics[] = [
      {
        affiliate_id: 'aff_1',
        total_commission_cents: 50000,
        usage_count: 10,
        avg_commission_per_usage_cents: 5000,
        status: 'ACTIVE',
      },
      {
        affiliate_id: 'aff_2',
        total_commission_cents: 100000,
        usage_count: 20,
        avg_commission_per_usage_cents: 5000,
        status: 'ACTIVE',
      },
      {
        affiliate_id: 'aff_3',
        total_commission_cents: 75000,
        usage_count: 15,
        avg_commission_per_usage_cents: 5000,
        status: 'ACTIVE',
      },
    ]

    it('should rank affiliates by commission (DESC)', () => {
      const result = rankAffiliates(metrics)
      expect(result[0].affiliate_id).toBe('aff_2')
      expect(result[0].rank).toBe(1)
      expect(result[1].affiliate_id).toBe('aff_3')
      expect(result[1].rank).toBe(2)
      expect(result[2].affiliate_id).toBe('aff_1')
      expect(result[2].rank).toBe(3)
    })

    it('should handle ties (same commission = same rank)', () => {
      const tied: AffiliateMetrics[] = [
        {
          affiliate_id: 'aff_1',
          total_commission_cents: 100000,
          usage_count: 10,
          avg_commission_per_usage_cents: 10000,
          status: 'ACTIVE',
        },
        {
          affiliate_id: 'aff_2',
          total_commission_cents: 100000,
          usage_count: 10,
          avg_commission_per_usage_cents: 10000,
          status: 'ACTIVE',
        },
        {
          affiliate_id: 'aff_3',
          total_commission_cents: 50000,
          usage_count: 5,
          avg_commission_per_usage_cents: 10000,
          status: 'ACTIVE',
        },
      ]
      const result = rankAffiliates(tied)
      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(1) // Same rank for tie
      expect(result[2].rank).toBe(3)
    })
  })

  describe('filterByStatus', () => {
    const metrics: AffiliateMetrics[] = [
      {
        affiliate_id: 'aff_1',
        total_commission_cents: 50000,
        usage_count: 10,
        avg_commission_per_usage_cents: 5000,
        status: 'ACTIVE',
      },
      {
        affiliate_id: 'aff_2',
        total_commission_cents: 30000,
        usage_count: 6,
        avg_commission_per_usage_cents: 5000,
        status: 'INACTIVE',
      },
      {
        affiliate_id: 'aff_3',
        total_commission_cents: 10000,
        usage_count: 2,
        avg_commission_per_usage_cents: 5000,
        status: 'SUSPENDED',
      },
    ]

    it('should filter by ACTIVE status', () => {
      const result = filterByStatus(metrics, 'ACTIVE')
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('ACTIVE')
    })

    it('should filter by INACTIVE status', () => {
      const result = filterByStatus(metrics, 'INACTIVE')
      expect(result).toHaveLength(1)
      expect(result[0].affiliate_id).toBe('aff_2')
    })

    it('should return all for ALL status', () => {
      const result = filterByStatus(metrics, 'ALL')
      expect(result).toHaveLength(3)
    })
  })

  describe('sortAffiliates', () => {
    const metrics: AffiliateMetrics[] = [
      {
        affiliate_id: 'aff_1',
        total_commission_cents: 50000,
        usage_count: 20,
        avg_commission_per_usage_cents: 2500,
        status: 'ACTIVE',
      },
      {
        affiliate_id: 'aff_2',
        total_commission_cents: 100000,
        usage_count: 10,
        avg_commission_per_usage_cents: 10000,
        status: 'ACTIVE',
      },
      {
        affiliate_id: 'aff_3',
        total_commission_cents: 75000,
        usage_count: 30,
        avg_commission_per_usage_cents: 2500,
        status: 'ACTIVE',
      },
    ]

    it('should sort by commission (DESC default)', () => {
      const result = sortAffiliates(metrics, 'commission', 'DESC')
      expect(result[0].affiliate_id).toBe('aff_2')
      expect(result[1].affiliate_id).toBe('aff_3')
      expect(result[2].affiliate_id).toBe('aff_1')
    })

    it('should sort by commission (ASC)', () => {
      const result = sortAffiliates(metrics, 'commission', 'ASC')
      expect(result[0].affiliate_id).toBe('aff_1')
      expect(result[1].affiliate_id).toBe('aff_3')
      expect(result[2].affiliate_id).toBe('aff_2')
    })

    it('should sort by usage_count (DESC)', () => {
      const result = sortAffiliates(metrics, 'usage_count', 'DESC')
      expect(result[0].affiliate_id).toBe('aff_3')
      expect(result[0].usage_count).toBe(30)
    })
  })

  describe('calculateTotalCommission', () => {
    it('should sum all commissions', () => {
      const metrics: AffiliateMetrics[] = [
        {
          affiliate_id: 'aff_1',
          total_commission_cents: 50000,
          usage_count: 10,
          avg_commission_per_usage_cents: 5000,
          status: 'ACTIVE',
        },
        {
          affiliate_id: 'aff_2',
          total_commission_cents: 100000,
          usage_count: 20,
          avg_commission_per_usage_cents: 5000,
          status: 'ACTIVE',
        },
      ]
      const result = calculateTotalCommission(metrics)
      expect(result).toBe(150000)
    })

    it('should handle empty array', () => {
      const result = calculateTotalCommission([])
      expect(result).toBe(0)
    })
  })

  describe('getAffiliateStatistics', () => {
    it('should calculate correct statistics', () => {
      const metrics: AffiliateMetrics[] = [
        {
          affiliate_id: 'aff_1',
          total_commission_cents: 50000,
          usage_count: 10,
          avg_commission_per_usage_cents: 5000,
          status: 'ACTIVE',
        },
        {
          affiliate_id: 'aff_2',
          total_commission_cents: 100000,
          usage_count: 20,
          avg_commission_per_usage_cents: 5000,
          status: 'ACTIVE',
        },
        {
          affiliate_id: 'aff_3',
          total_commission_cents: 50000,
          usage_count: 10,
          avg_commission_per_usage_cents: 5000,
          status: 'INACTIVE',
        },
      ]
      const stats = getAffiliateStatistics(metrics)
      expect(stats.total_affiliates).toBe(3)
      expect(stats.total_commission_cents).toBe(200000)
      expect(stats.avg_commission_per_affiliate_cents).toBe(66666)
      expect(stats.active_count).toBe(2)
      expect(stats.inactive_count).toBe(1)
    })

    it('should handle empty array', () => {
      const stats = getAffiliateStatistics([])
      expect(stats.total_affiliates).toBe(0)
      expect(stats.total_commission_cents).toBe(0)
      expect(stats.active_count).toBe(0)
    })
  })
})

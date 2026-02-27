/**
 * Unit Tests for Geographic Aggregator
 *
 * Task: T035
 * Phase: 2 - Backend Testing
 */

import { describe, expect, it } from 'vitest'
import {
  calculateAvgRevenuePerLicense,
  enrichGeographicMetrics,
  getCountryName,
  getGeographicStatistics,
  getTopCountries,
  paginate,
  sortGeographic,
  type GeographicMetrics,
  type GeographicResult,
} from '../../../packages/domain-core/mmc-dashboard/metrics/geographic-aggregator'

describe('Geographic Aggregator - Unit Tests', () => {
  describe('getCountryName', () => {
    it('should resolve known country codes to names', () => {
      expect(getCountryName('US')).toBe('United States')
      expect(getCountryName('GB')).toBe('United Kingdom')
      expect(getCountryName('CA')).toBe('Canada')
      expect(getCountryName('JP')).toBe('Japan')
    })

    it('should return country code for unknown countries', () => {
      expect(getCountryName('XX')).toBe('XX')
      expect(getCountryName('ZZ')).toBe('ZZ')
    })

    it('should handle empty or null country codes', () => {
      expect(getCountryName('')).toBe('Unknown')
    })
  })

  describe('calculateAvgRevenuePerLicense', () => {
    it('should calculate average correctly', () => {
      const total = 100000 // $1000
      const licenseCount = 4
      const result = calculateAvgRevenuePerLicense(total, licenseCount)
      expect(result).toBe(25000) // $250
    })

    it('should return 0 for zero license count', () => {
      const total = 100000
      const licenseCount = 0
      const result = calculateAvgRevenuePerLicense(total, licenseCount)
      expect(result).toBe(0)
    })

    it('should handle fractional division (floor)', () => {
      const total = 10000 // $100
      const licenseCount = 3
      const result = calculateAvgRevenuePerLicense(total, licenseCount)
      expect(result).toBe(3333) // $33.33, floored
    })

    it('should handle single license', () => {
      const total = 50000
      const licenseCount = 1
      const result = calculateAvgRevenuePerLicense(total, licenseCount)
      expect(result).toBe(50000)
    })
  })

  describe('enrichGeographicMetrics', () => {
    it('should enrich metrics with country names and calculations', () => {
      const metrics: GeographicMetrics[] = [
        { country_code: 'US', total_revenue_cents: 100000, license_count: 4 },
        { country_code: 'GB', total_revenue_cents: 80000, license_count: 4 },
      ]
      const result = enrichGeographicMetrics(metrics)
      expect(result).toHaveLength(2)
      expect(result[0].country_name).toBe('United States')
      expect(result[0].avg_revenue_per_license_cents).toBe(25000)
      expect(result[1].country_name).toBe('United Kingdom')
      expect(result[1].avg_revenue_per_license_cents).toBe(20000)
    })

    it('should handle unknown country codes', () => {
      const metrics: GeographicMetrics[] = [
        { country_code: 'XX', total_revenue_cents: 100000, license_count: 5 },
      ]
      const result = enrichGeographicMetrics(metrics)
      expect(result[0].country_name).toBe('XX')
      expect(result[0].avg_revenue_per_license_cents).toBe(20000)
    })
  })

  describe('sortGeographic', () => {
    const metrics: GeographicResult[] = [
      {
        country_code: 'US',
        country_name: 'United States',
        total_revenue_cents: 100000,
        license_count: 50,
        avg_revenue_per_license_cents: 2000,
      },
      {
        country_code: 'GB',
        country_name: 'United Kingdom',
        total_revenue_cents: 80000,
        license_count: 40,
        avg_revenue_per_license_cents: 2000,
      },
      {
        country_code: 'CA',
        country_name: 'Canada',
        total_revenue_cents: 120000,
        license_count: 30,
        avg_revenue_per_license_cents: 4000,
      },
    ]

    it('should sort by revenue (DESC default)', () => {
      const result = sortGeographic(metrics, 'revenue', 'DESC')
      expect(result[0].country_code).toBe('CA')
      expect(result[1].country_code).toBe('US')
      expect(result[2].country_code).toBe('GB')
    })

    it('should sort by revenue (ASC)', () => {
      const result = sortGeographic(metrics, 'revenue', 'ASC')
      expect(result[0].country_code).toBe('GB')
      expect(result[1].country_code).toBe('US')
      expect(result[2].country_code).toBe('CA')
    })

    it('should sort by license_count (DESC)', () => {
      const result = sortGeographic(metrics, 'license_count', 'DESC')
      expect(result[0].country_code).toBe('US')
      expect(result[0].license_count).toBe(50)
    })

    it('should sort by avg_revenue_per_license (DESC)', () => {
      const result = sortGeographic(metrics, 'avg_revenue_per_license', 'DESC')
      expect(result[0].country_code).toBe('CA')
      expect(result[0].avg_revenue_per_license_cents).toBe(4000)
    })
  })

  describe('paginate', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      country_code: `C${i}`,
      country_name: `Country ${i}`,
      total_revenue_cents: (i + 1) * 10000,
      license_count: i + 1,
      avg_revenue_per_license_cents: 10000,
    }))

    it('should paginate first page', () => {
      const result = paginate(items, 1, 10)
      expect(result.items).toHaveLength(10)
      expect(result.total).toBe(25)
      expect(result.totalPages).toBe(3)
    })

    it('should paginate second page', () => {
      const result = paginate(items, 2, 10)
      expect(result.items).toHaveLength(10)
      expect(result.items[0].country_code).toBe('C10')
    })

    it('should paginate last page with remaining items', () => {
      const result = paginate(items, 3, 10)
      expect(result.items).toHaveLength(5)
      expect(result.items[0].country_code).toBe('C20')
    })

    it('should handle invalid page (zero)', () => {
      const result = paginate(items, 0, 10)
      expect(result.items).toHaveLength(10)
      expect(result.items[0].country_code).toBe('C0')
    })

    it('should handle page beyond total', () => {
      const result = paginate(items, 100, 10)
      expect(result.items).toHaveLength(0)
    })
  })

  describe('getGeographicStatistics', () => {
    it('should calculate correct statistics', () => {
      const metrics: GeographicResult[] = [
        {
          country_code: 'US',
          country_name: 'United States',
          total_revenue_cents: 100000,
          license_count: 50,
          avg_revenue_per_license_cents: 2000,
        },
        {
          country_code: 'GB',
          country_name: 'United Kingdom',
          total_revenue_cents: 80000,
          license_count: 40,
          avg_revenue_per_license_cents: 2000,
        },
      ]
      const stats = getGeographicStatistics(metrics)
      expect(stats.total_countries).toBe(2)
      expect(stats.total_revenue_cents).toBe(180000)
      expect(stats.total_licenses).toBe(90)
      expect(stats.avg_revenue_per_country_cents).toBe(90000)
      expect(stats.top_country.code).toBe('US')
    })

    it('should handle empty array', () => {
      const stats = getGeographicStatistics([])
      expect(stats.total_countries).toBe(0)
      expect(stats.total_revenue_cents).toBe(0)
      expect(stats.top_country).toBeNull()
    })
  })

  describe('getTopCountries', () => {
    it('should return top N countries by revenue', () => {
      const metrics: GeographicResult[] = [
        {
          country_code: 'US',
          country_name: 'United States',
          total_revenue_cents: 500000,
          license_count: 50,
          avg_revenue_per_license_cents: 10000,
        },
        {
          country_code: 'GB',
          country_name: 'United Kingdom',
          total_revenue_cents: 300000,
          license_count: 30,
          avg_revenue_per_license_cents: 10000,
        },
        {
          country_code: 'CA',
          country_name: 'Canada',
          total_revenue_cents: 200000,
          license_count: 20,
          avg_revenue_per_license_cents: 10000,
        },
        {
          country_code: 'AU',
          country_name: 'Australia',
          total_revenue_cents: 100000,
          license_count: 10,
          avg_revenue_per_license_cents: 10000,
        },
      ]
      const result = getTopCountries(metrics, 2)
      expect(result).toHaveLength(2)
      expect(result[0].country_code).toBe('US')
      expect(result[1].country_code).toBe('GB')
    })

    it('should handle default limit of 10', () => {
      const metrics: GeographicResult[] = Array.from(
        { length: 20 },
        (_, i) => ({
          country_code: `C${i}`,
          country_name: `Country ${i}`,
          total_revenue_cents: (20 - i) * 10000,
          license_count: i + 1,
          avg_revenue_per_license_cents: 10000,
        })
      )
      const result = getTopCountries(metrics)
      expect(result).toHaveLength(10)
    })
  })
})

/**
 * Unit Tests for License Aggregator
 *
 * Task: T033
 * Phase: 2 - Backend Testing
 */

import { describe, expect, it } from 'vitest'
import {
  aggregateLicenseCounts,
  calculateLicenseHealthScore,
  compareLicenseCounts,
  getLicenseSummary,
  type LicenseCount,
  type LicenseCounts,
} from '../../../packages/domain-core/mmc-dashboard/metrics/license-aggregator'

describe('License Aggregator - Unit Tests', () => {
  describe('aggregateLicenseCounts', () => {
    it('should group ACTIVE, SOFT_LOCKED, ARCHIVED counts correctly', () => {
      const records: LicenseCount[] = [
        { status: 'ACTIVE', count: 1200 },
        { status: 'SOFT_LOCKED', count: 35 },
        { status: 'ARCHIVED', count: 15 },
      ]

      const result = aggregateLicenseCounts(records)
      expect(result.total).toBe(1250)
      expect(result.active).toBe(1200)
      expect(result.soft_locked).toBe(35)
      expect(result.archived).toBe(15)
    })

    it('should handle empty array', () => {
      const records: LicenseCount[] = []
      const result = aggregateLicenseCounts(records)
      expect(result.total).toBe(0)
      expect(result.active).toBe(0)
      expect(result.soft_locked).toBe(0)
      expect(result.archived).toBe(0)
    })

    it('should handle missing status categories', () => {
      const records: LicenseCount[] = [{ status: 'ACTIVE', count: 100 }]
      const result = aggregateLicenseCounts(records)
      expect(result.total).toBe(100)
      expect(result.active).toBe(100)
      expect(result.soft_locked).toBe(0)
      expect(result.archived).toBe(0)
    })

    it('should handle multiple records for same status', () => {
      const records: LicenseCount[] = [
        { status: 'ACTIVE', count: 600 },
        { status: 'ACTIVE', count: 400 },
        { status: 'SOFT_LOCKED', count: 30 },
        { status: 'ARCHIVED', count: 10 },
      ]
      const result = aggregateLicenseCounts(records)
      expect(result.active).toBe(400) // Last one wins
      expect(result.total).toBe(1040)
    })

    it('should handle zero counts', () => {
      const records: LicenseCount[] = [
        { status: 'ACTIVE', count: 0 },
        { status: 'SOFT_LOCKED', count: 20 },
        { status: 'ARCHIVED', count: 0 },
      ]
      const result = aggregateLicenseCounts(records)
      expect(result.total).toBe(20)
      expect(result.active).toBe(0)
      expect(result.archived).toBe(0)
    })
  })

  describe('calculateLicenseHealthScore', () => {
    it('should return 100 for all active licenses', () => {
      const counts: LicenseCounts = {
        total: 1000,
        active: 1000,
        soft_locked: 0,
        archived: 0,
      }
      const score = calculateLicenseHealthScore(counts)
      expect(score).toBe(100)
    })

    it('should return 100 for zero total licenses', () => {
      const counts: LicenseCounts = {
        total: 0,
        active: 0,
        soft_locked: 0,
        archived: 0,
      }
      const score = calculateLicenseHealthScore(counts)
      expect(score).toBe(100)
    })

    it('should return 75 for mostly healthy (< 5% soft_locked)', () => {
      const counts: LicenseCounts = {
        total: 1000,
        active: 960,
        soft_locked: 30, // 3%
        archived: 10, // 1%
      }
      const score = calculateLicenseHealthScore(counts)
      expect(score).toBe(75)
    })

    it('should return 50 for workable state (< 15% soft_locked, < 5% archived)', () => {
      const counts: LicenseCounts = {
        total: 1000,
        active: 860,
        soft_locked: 120, // 12%
        archived: 20, // 2%
      }
      const score = calculateLicenseHealthScore(counts)
      expect(score).toBe(50)
    })

    it('should return 25 for problematic state', () => {
      const counts: LicenseCounts = {
        total: 1000,
        active: 700,
        soft_locked: 200, // 20%
        archived: 100, // 10%
      }
      const score = calculateLicenseHealthScore(counts)
      expect(score).toBe(25)
    })

    it('should return 0 for severe issues (> 25% locked or > 15% archived)', () => {
      const counts: LicenseCounts = {
        total: 1000,
        active: 500,
        soft_locked: 300, // 30%
        archived: 200, // 20%
      }
      const score = calculateLicenseHealthScore(counts)
      expect(score).toBe(0)
    })
  })

  describe('getLicenseSummary', () => {
    it('should calculate correct percentages', () => {
      const counts: LicenseCounts = {
        total: 1000,
        active: 800,
        soft_locked: 150,
        archived: 50,
      }
      const summary = getLicenseSummary(counts)
      expect(summary.total_licenses).toBe(1000)
      expect(summary.active_percent).toBe('80.0')
      expect(summary.soft_locked_percent).toBe('15.0')
      expect(summary.archived_percent).toBe('5.0')
    })

    it('should handle zero total', () => {
      const counts: LicenseCounts = {
        total: 0,
        active: 0,
        soft_locked: 0,
        archived: 0,
      }
      const summary = getLicenseSummary(counts)
      expect(summary.active_percent).toBe('0')
      expect(summary.health_score).toBe(100)
    })

    it('should calculate health score', () => {
      const counts: LicenseCounts = {
        total: 1000,
        active: 950,
        soft_locked: 30,
        archived: 20,
      }
      const summary = getLicenseSummary(counts)
      expect(summary.health_score).toBeGreaterThanOrEqual(0)
      expect(summary.health_score).toBeLessThanOrEqual(100)
    })
  })

  describe('compareLicenseCounts', () => {
    it('should calculate changes correctly', () => {
      const current: LicenseCounts = {
        total: 1100,
        active: 1050,
        soft_locked: 30,
        archived: 20,
      }
      const previous: LicenseCounts = {
        total: 1000,
        active: 950,
        soft_locked: 35,
        archived: 15,
      }

      const changes = compareLicenseCounts(current, previous)
      expect(changes.total_change).toBe(100)
      expect(changes.active_change).toBe(100)
      expect(changes.soft_locked_change).toBe(-5)
      expect(changes.archived_change).toBe(5)
    })

    it('should handle negative changes', () => {
      const current: LicenseCounts = {
        total: 900,
        active: 850,
        soft_locked: 30,
        archived: 20,
      }
      const previous: LicenseCounts = {
        total: 1000,
        active: 950,
        soft_locked: 35,
        archived: 15,
      }

      const changes = compareLicenseCounts(current, previous)
      expect(changes.total_change).toBe(-100)
      expect(changes.active_change).toBe(-100)
    })

    it('should handle zero changes', () => {
      const counts: LicenseCounts = {
        total: 1000,
        active: 950,
        soft_locked: 35,
        archived: 15,
      }

      const changes = compareLicenseCounts(counts, counts)
      expect(changes.total_change).toBe(0)
      expect(changes.active_change).toBe(0)
      expect(changes.soft_locked_change).toBe(0)
      expect(changes.archived_change).toBe(0)
    })
  })
})

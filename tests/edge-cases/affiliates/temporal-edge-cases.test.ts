/**
 * Edge Case Tests: Temporal Edge Cases
 * Stage: STAGE_13_AFFILIATES
 * Task: T041
 */

import { describe, expect, it } from 'vitest'
import type { Affiliate } from '../../../packages/domain-core/src/affiliates/types'
import { checkTemporalValidity } from '../../../packages/domain-core/src/affiliates/validators'

describe('Temporal Edge Cases', () => {
  describe('Exact boundary conditions', () => {
    it('should accept at exact start_date', () => {
      const startDate = new Date('2026-01-01T00:00:00Z')
      const affiliate = {
        start_date: startDate,
        end_date: new Date('2026-12-31T23:59:59Z'),
      } as Affiliate

      expect(checkTemporalValidity(affiliate, startDate)).toBe(true)
    })

    it('should reject at exact end_date (exclusive upper bound)', () => {
      const endDate = new Date('2026-12-31T00:00:00Z')
      const affiliate = {
        start_date: new Date('2026-01-01T00:00:00Z'),
        end_date: endDate,
      } as Affiliate

      expect(checkTemporalValidity(affiliate, endDate)).toBe(false)
    })

    it('should accept one second before end_date', () => {
      const endDate = new Date('2026-12-31T00:00:00Z')
      const oneSecondBefore = new Date(endDate.getTime() - 1000)
      const affiliate = {
        start_date: new Date('2026-01-01T00:00:00Z'),
        end_date: endDate,
      } as Affiliate

      expect(checkTemporalValidity(affiliate, oneSecondBefore)).toBe(true)
    })

    it('should reject one second after end_date', () => {
      const endDate = new Date('2026-12-31T00:00:00Z')
      const oneSecondAfter = new Date(endDate.getTime() + 1000)
      const affiliate = {
        start_date: new Date('2026-01-01T00:00:00Z'),
        end_date: endDate,
      } as Affiliate

      expect(checkTemporalValidity(affiliate, oneSecondAfter)).toBe(false)
    })
  })

  describe('Timezone handling', () => {
    it('should handle UTC timestamps consistently', () => {
      const affiliate = {
        start_date: new Date('2026-01-01T00:00:00Z'),
        end_date: new Date('2026-12-31T23:59:59Z'),
      } as Affiliate

      const midpoint = new Date('2026-06-15T12:00:00Z')
      expect(checkTemporalValidity(affiliate, midpoint)).toBe(true)
    })
  })

  describe('Very short time windows', () => {
    it('should handle 1-second window', () => {
      const start = new Date('2026-01-01T00:00:00Z')
      const end = new Date('2026-01-01T00:00:01Z')
      const affiliate = {
        start_date: start,
        end_date: end,
      } as Affiliate

      expect(checkTemporalValidity(affiliate, start)).toBe(true)
      expect(checkTemporalValidity(affiliate, end)).toBe(false)
    })

    it('should handle 1-millisecond window', () => {
      const start = new Date('2026-01-01T00:00:00.000Z')
      const end = new Date('2026-01-01T00:00:00.001Z')
      const affiliate = {
        start_date: start,
        end_date: end,
      } as Affiliate

      const inWindow = new Date('2026-01-01T00:00:00.0005Z')
      expect(checkTemporalValidity(affiliate, inWindow)).toBe(true)
    })
  })

  describe('Long-running codes', () => {
    it('should handle multi-year validity periods', () => {
      const affiliate = {
        start_date: new Date('2020-01-01T00:00:00Z'),
        end_date: new Date('2030-12-31T23:59:59Z'),
      } as Affiliate

      const now = new Date()
      expect(checkTemporalValidity(affiliate, now)).toBe(true)
    })
  })
})

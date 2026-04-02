/**
 * Auto-Selection: Seeded Shuffle Unit Tests
 *
 * Validates determinism, distribution quality, and edge cases
 * of the seededShuffle and selectFromPool primitives.
 *
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T012
 */

import { describe, expect, it } from 'vitest'
import {
  computePoolFingerprint,
  deriveSeedInt,
  resolveBlockCount,
  seededShuffle,
  selectFromPool,
} from '../../../src/attempts/auto-selection.selector'

const SAMPLE_IDS = Array.from({ length: 20 }, (_, i) => `q-${String(i + 1).padStart(3, '0')}`)

describe('deriveSeedInt', () => {
  it('returns consistent integers for the same seed string', () => {
    const a = deriveSeedInt('test-seed')
    const b = deriveSeedInt('test-seed')
    expect(a).toBe(b)
  })

  it('returns different integers for different seed strings', () => {
    expect(deriveSeedInt('seed-a')).not.toBe(deriveSeedInt('seed-b'))
  })

  it('returns a 32-bit unsigned integer (0 ≤ n < 2^32)', () => {
    const n = deriveSeedInt('arbitrary-seed-value')
    expect(n).toBeGreaterThanOrEqual(0)
    expect(n).toBeLessThan(4294967296)
  })
})

describe('seededShuffle', () => {
  it('returns a permutation of the same elements', () => {
    const shuffled = seededShuffle(SAMPLE_IDS, 'seed-x')
    expect([...shuffled].sort()).toEqual([...SAMPLE_IDS].sort())
  })

  it('returns identical results for the same seed and pool', () => {
    const first = seededShuffle(SAMPLE_IDS, 'deterministic-seed')
    const second = seededShuffle(SAMPLE_IDS, 'deterministic-seed')
    expect(first).toEqual(second)
  })

  it('returns different results for different seeds', () => {
    const a = seededShuffle(SAMPLE_IDS, 'seed-alpha')
    const b = seededShuffle(SAMPLE_IDS, 'seed-beta')
    // Extremely unlikely to produce identical shuffle for 20-element array
    expect(a).not.toEqual(b)
  })

  it('does not mutate the input array', () => {
    const original = [...SAMPLE_IDS]
    seededShuffle(SAMPLE_IDS, 'mutation-check-seed')
    expect(SAMPLE_IDS).toEqual(original)
  })

  it('handles a single-element array', () => {
    expect(seededShuffle(['q-only'], 'seed')).toEqual(['q-only'])
  })

  it('handles an empty array', () => {
    expect(seededShuffle([], 'seed')).toEqual([])
  })
})

describe('selectFromPool', () => {
  it('returns exactly the requested count', () => {
    const selected = selectFromPool(SAMPLE_IDS, 10, 'seed-s')
    expect(selected).toHaveLength(10)
  })

  it('returns all elements when count equals pool size', () => {
    const selected = selectFromPool(SAMPLE_IDS, SAMPLE_IDS.length, 'seed-full')
    expect([...selected].sort()).toEqual([...SAMPLE_IDS].sort())
  })

  it('is deterministic: same pool + seed yields same selection', () => {
    const a = selectFromPool(SAMPLE_IDS, 8, 'deterministic')
    const b = selectFromPool(SAMPLE_IDS, 8, 'deterministic')
    expect(a).toEqual(b)
  })

  it('produces no duplicate IDs in selected set', () => {
    const selected = selectFromPool(SAMPLE_IDS, 15, 'dedup-check-seed')
    const unique = new Set(selected)
    expect(unique.size).toBe(15)
  })

  it('throws when count > pool size', () => {
    expect(() => selectFromPool(SAMPLE_IDS, SAMPLE_IDS.length + 1, 'seed')).toThrow()
  })

  it('returns empty array for count 0', () => {
    const selected = selectFromPool(SAMPLE_IDS, 0, 'seed')
    expect(selected).toHaveLength(0)
  })
})

describe('computePoolFingerprint', () => {
  it('returns the same fingerprint regardless of input order', () => {
    const a = computePoolFingerprint(['q-001', 'q-003', 'q-002'])
    const b = computePoolFingerprint(['q-003', 'q-001', 'q-002'])
    expect(a).toBe(b)
  })

  it('returns a different fingerprint for different candidate sets', () => {
    const a = computePoolFingerprint(['q-001', 'q-002'])
    const b = computePoolFingerprint(['q-001', 'q-003'])
    expect(a).not.toBe(b)
  })

  it('handles empty pool', () => {
    expect(computePoolFingerprint([])).toBe('')
  })
})

describe('resolveBlockCount', () => {
  it('returns fixed count when fixed_count is provided', () => {
    expect(resolveBlockCount(100, null, 15)).toBe(15)
  })

  it('returns rounded percentage count when percentage is provided', () => {
    expect(resolveBlockCount(20, 50, null)).toBe(10)
  })

  it('rounds percentage-based count', () => {
    // 33% of 10 = 3.3 → rounds to 3
    expect(resolveBlockCount(10, 33, null)).toBe(3)
  })

  it('throws when neither percentage nor fixedCount is provided', () => {
    expect(() => resolveBlockCount(100, null, null)).toThrow()
  })
})

import { describe, expect, it } from 'vitest'
import { calculateP95, parseBenchmarkArgs } from '../../../scripts/architecture-health/benchmark'

describe('architecture-health performance budget harness', () => {
  it('defaults to a 20-run benchmark sample', () => {
    expect(parseBenchmarkArgs([]).runs).toBe(20)
  })

  it('calculates p95 from a deterministic sample set', () => {
    expect(calculateP95([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])).toBe(19)
  })
})

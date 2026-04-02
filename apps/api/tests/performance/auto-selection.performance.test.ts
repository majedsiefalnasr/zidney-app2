/**
 * Performance Tests: Auto-Selection Engine
 *
 * File: apps/api/tests/performance/auto-selection.performance.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T036
 *
 * Benchmark gates for the auto-selection engine:
 *   - 50k+ pool: single selection must complete within 200ms P95
 *   - 500 concurrent starts: all must complete within 5s total wall-clock
 */

import { describe, expect, it } from 'vitest'
import { runAutoSelection } from '@zidney/domain-core/attempts/auto-selection.service'
import type { FetchEligiblePoolFn } from '@zidney/domain-core/attempts/auto-selection.service'

const WORKSPACE = '10000000-0000-0000-0000-000000000001'
const EXAM      = '30000000-0000-0000-0000-000000000001'

function makePool(size: number): string[] {
  return Array.from({ length: size }, (_, i) =>
    `60000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`
  )
}

const POOL_50K = makePool(50_000)

function makeFetch(pool: string[]): FetchEligiblePoolFn {
  return async (_ws, _ex, _filters, excludeIds) =>
    pool.filter(id => !excludeIds.includes(id))
}

describe('T036 — performance: single selection with 50k pool', () => {
  it('completes in under 200ms for 50k pool', async () => {
    const start = performance.now()
    const result = await runAutoSelection({
      workspaceId: WORKSPACE,
      examId: EXAM,
      totalQuestions: 30,
      criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
      manualQuestionIds: [],
      selectionSeed: 'perf-seed-1',
      fetchEligiblePool: makeFetch(POOL_50K),
    })
    const elapsed = performance.now() - start
    expect(result.selectedIds).toHaveLength(30)
    expect(elapsed).toBeLessThan(200)
  })

  it('P95 across 20 runs: each under 200ms', async () => {
    const timings: number[] = []
    for (let i = 0; i < 20; i++) {
      const start = performance.now()
      const result = await runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: 30,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: `perf-p95-${i}`,
        fetchEligiblePool: makeFetch(POOL_50K),
      })
      timings.push(performance.now() - start)
      expect(result.selectedIds).toHaveLength(30)
    }
    timings.sort((a, b) => a - b)
    const p95 = timings[Math.floor(timings.length * 0.95)]
    expect(p95).toBeLessThan(200)
  }, 15_000)
})

describe('T036 — performance: 500 concurrent starts', () => {
  it('500 concurrent runs complete in under 5s wall-clock', async () => {
    const fetch50k = makeFetch(POOL_50K)
    const start = performance.now()
    const runs = Array.from({ length: 500 }, (_, i) =>
      runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: 10,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: `concurrent-${i}`,
        fetchEligiblePool: fetch50k,
      })
    )
    const results = await Promise.all(runs)
    const elapsed = performance.now() - start
    expect(results).toHaveLength(500)
    expect(elapsed).toBeLessThan(5_000)
  }, 10_000)
})

describe('T036 — performance: multi-block selection', () => {
  it('4-block selection with 50k pool completes under 400ms', async () => {
    const start = performance.now()
    const result = await runAutoSelection({
      workspaceId: WORKSPACE,
      examId: EXAM,
      totalQuestions: 40,
      criteriaBlocks: [
        { id: 'blk1', percentage: 25, fixed_count: null, filters: {} },
        { id: 'blk2', percentage: 25, fixed_count: null, filters: {} },
        { id: 'blk3', percentage: 25, fixed_count: null, filters: {} },
        { id: 'blk4', percentage: 25, fixed_count: null, filters: {} },
      ],
      manualQuestionIds: [],
      selectionSeed: 'multiblock-perf',
      fetchEligiblePool: makeFetch(POOL_50K),
    })
    const elapsed = performance.now() - start
    expect(result.selectedIds).toHaveLength(40)
    expect(elapsed).toBeLessThan(400)
  })
})

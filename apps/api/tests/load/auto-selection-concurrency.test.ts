/**
 * Load Tests: Auto-Selection Concurrency
 *
 * File: apps/api/tests/load/auto-selection-concurrency.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T035
 *
 * Runs 500 concurrent attempt-starts with mocked fetchEligiblePool (no DB).
 * Asserts that under concurrent load:
 *   - Each run returns exactly totalQuestions selectedIds
 *   - No duplicate IDs within a single run
 *   - Results are deterministic for the same seed
 */

import { describe, expect, it } from 'vitest'
import { runAutoSelection } from '@zidney/domain-core/attempts/auto-selection.service'
import type { FetchEligiblePoolFn } from '@zidney/domain-core/attempts/auto-selection.service'

const WORKSPACE = '10000000-0000-0000-0000-000000000001'
const EXAM      = '30000000-0000-0000-0000-000000000001'
const POOL_SIZE = 200
const TOTAL_Q   = 10
const CONCURRENCY = 500

function makePool(size: number): string[] {
  return Array.from({ length: size }, (_, i) =>
    `60000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`
  )
}

const FIXED_POOL = makePool(POOL_SIZE)

const fetchFn: FetchEligiblePoolFn = async (_ws, _ex, _filters, excludeIds) => {
  return FIXED_POOL.filter(id => !excludeIds.includes(id))
}

describe('T035 — load: 500 concurrent auto-selections', () => {
  it('all runs complete and return exactly totalQuestions IDs', async () => {
    const runs = Array.from({ length: CONCURRENCY }, (_, i) =>
      runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: TOTAL_Q,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: `seed-${i}`,
        fetchEligiblePool: fetchFn,
      })
    )

    const results = await Promise.all(runs)
    expect(results).toHaveLength(CONCURRENCY)
    for (const r of results) {
      expect(r.selectedIds).toHaveLength(TOTAL_Q)
    }
  }, 30_000)

  it('no run returns duplicate IDs within its own result', async () => {
    const runs = Array.from({ length: CONCURRENCY }, (_, i) =>
      runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: TOTAL_Q,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: `dedup-seed-${i}`,
        fetchEligiblePool: fetchFn,
      })
    )

    const results = await Promise.all(runs)
    for (const r of results) {
      const unique = new Set(r.selectedIds)
      expect(unique.size).toBe(r.selectedIds.length)
    }
  }, 30_000)

  it('same seed produces identical results across concurrent runs', async () => {
    const FIXED_SEED = 'fixed-seed-42'

    const runs = Array.from({ length: 10 }, () =>
      runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: TOTAL_Q,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: FIXED_SEED,
        fetchEligiblePool: fetchFn,
      })
    )

    const results = await Promise.all(runs)
    const first = results[0].selectedIds
    for (const r of results.slice(1)) {
      expect(r.selectedIds).toEqual(first)
    }
  }, 10_000)

  it('all results have valid fingerprint strings', async () => {
    const runs = Array.from({ length: 50 }, (_, i) =>
      runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: TOTAL_Q,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: `fp-seed-${i}`,
        fetchEligiblePool: fetchFn,
      })
    )

    const results = await Promise.all(runs)
    for (const r of results) {
      expect(typeof r.candidatePoolFingerprint).toBe('string')
      expect(r.candidatePoolFingerprint.length).toBeGreaterThan(0)
    }
  }, 15_000)
})

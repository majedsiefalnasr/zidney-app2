/**
 * Hybrid Selection — Merge & Uniqueness Unit Tests
 *
 * File: packages/domain-core/tests/unit/attempts/hybrid-selection.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T030
 *
 * Validates that runAutoSelection correctly handles hybrid (manual + auto)
 * scenarios: manual IDs excluded from pool, manual-first ordering, zero-auto
 * edge case, and uniqueness guarantees.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  AutoSelectionError,
  runAutoSelection,
  type AutoSelectionInput,
  type CriteriaBlock,
  type FetchEligiblePoolFn,
} from '../../../src/attempts/auto-selection.service'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePool(size: number, prefix = 'q'): string[] {
  return Array.from({ length: size }, (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`)
}

function makeBlock(
  id: string,
  opts: { fixedCount?: number; percentage?: number } = { fixedCount: 5 }
): CriteriaBlock {
  return {
    id,
    percentage: opts.percentage ?? null,
    fixed_count: opts.fixedCount ?? null,
    filters: {},
  }
}

function makeFetchFn(pools: Record<string, string[]>): FetchEligiblePoolFn {
  return vi.fn(async (_wid, _eid, blockId, _filters, excludeIds) => {
    const pool = pools[blockId] ?? makePool(20)
    return pool.filter((id) => !excludeIds.includes(id))
  })
}

const BASE: Omit<AutoSelectionInput, 'criteriaBlocks' | 'fetchEligiblePool' | 'manualQuestionIds' | 'totalQuestions'> = {
  workspaceId: 'ws-1',
  examId: 'exam-1',
  selectionSeed: 'hybrid-test-seed',
}

// ── Hybrid: manual IDs excluded from pool ────────────────────────────────────

describe('hybrid selection — manual exclusion', () => {
  it('manual IDs are excluded from the auto candidate pool', async () => {
    const pool = makePool(20)
    const manualIds = pool.slice(0, 5) // first 5 are manual
    const fetchFn: FetchEligiblePoolFn = vi.fn(async (_w, _e, _b, _f, excludeIds) => {
      return pool.filter((id) => !excludeIds.includes(id))
    })

    const result = await runAutoSelection({
      ...BASE,
      totalQuestions: 15,
      criteriaBlocks: [makeBlock('b1', { fixedCount: 10 })],
      manualQuestionIds: manualIds,
      fetchEligiblePool: fetchFn,
    })

    // Auto IDs must not overlap with manual IDs
    for (const id of result.selectedIds) {
      expect(manualIds).not.toContain(id)
    }
  })

  it('fetchEligiblePool is called with manual IDs in excludeIds', async () => {
    const pool = makePool(20)
    const manualIds = pool.slice(0, 3)
    const fetchFn: FetchEligiblePoolFn = vi.fn(async (_w, _e, _b, _f, excludeIds) => {
      return pool.filter((id) => !excludeIds.includes(id))
    })

    await runAutoSelection({
      ...BASE,
      totalQuestions: 10,
      criteriaBlocks: [makeBlock('b1', { fixedCount: 7 })],
      manualQuestionIds: manualIds,
      fetchEligiblePool: fetchFn,
    })

    const callArgs = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]
    if (!callArgs) throw new Error('fetchEligiblePool was not called')
    const excluded: string[] = callArgs[4]
    for (const id of manualIds) {
      expect(excluded).toContain(id)
    }
  })

  it('no duplicates between manual and auto IDs', async () => {
    const pool = makePool(30)
    const manualIds = pool.slice(0, 10)
    const fetchFn = makeFetchFn({ 'b1': pool })

    const result = await runAutoSelection({
      ...BASE,
      totalQuestions: 20,
      criteriaBlocks: [makeBlock('b1', { fixedCount: 10 })],
      manualQuestionIds: manualIds,
      fetchEligiblePool: fetchFn,
    })

    const allIds = [...manualIds, ...result.selectedIds]
    expect(new Set(allIds).size).toBe(allIds.length)
  })
})

// ── Hybrid: ordering (manual-first numbering) ─────────────────────────────────

describe('hybrid selection — manual-first ordering', () => {
  it('blockAssignments start at order = manualQuestionIds.length', async () => {
    const pool = makePool(20)
    const manualIds = pool.slice(0, 4)
    const fetchFn: FetchEligiblePoolFn = vi.fn(async (_w, _e, _b, _f, excludeIds) =>
      pool.filter((id) => !excludeIds.includes(id))
    )

    const result = await runAutoSelection({
      ...BASE,
      totalQuestions: 10,
      criteriaBlocks: [makeBlock('b1', { fixedCount: 6 })],
      manualQuestionIds: manualIds,
      fetchEligiblePool: fetchFn,
    })

    // First auto assignment order = 4 (offset by manual count)
    const orders = result.blockAssignments.map((a) => a.order).sort((a, b) => a - b)
    expect(orders[0]).toBe(4)
    expect(orders[orders.length - 1]).toBe(4 + result.blockAssignments.length - 1)
  })

  it('orders are contiguous starting at manualQuestionIds.length', async () => {
    const pool = makePool(25)
    const manualIds = pool.slice(0, 5)
    const fetchFn: FetchEligiblePoolFn = vi.fn(async (_w, _e, _b, _f, excludeIds) =>
      pool.filter((id) => !excludeIds.includes(id))
    )

    const result = await runAutoSelection({
      ...BASE,
      totalQuestions: 15,
      criteriaBlocks: [makeBlock('b1', { fixedCount: 10 })],
      manualQuestionIds: manualIds,
      fetchEligiblePool: fetchFn,
    })

    const expectedOrders = Array.from(
      { length: result.blockAssignments.length },
      (_, i) => i + 5
    )
    const actualOrders = result.blockAssignments.map((a) => a.order).sort((a, b) => a - b)
    expect(actualOrders).toEqual(expectedOrders)
  })
})

// ── Hybrid: zero-auto edge case ───────────────────────────────────────────────

describe('hybrid selection — zero-auto edge case', () => {
  it('block with zero resolved count is skipped without throwing', async () => {
    const fetchFn: FetchEligiblePoolFn = vi.fn().mockResolvedValue(makePool(10))
    // percentage → resolveBlockCount: Math.max(1, floor(0/100 * N)) = 1, not 0
    // Use fixed_count: 0 explicitly (non-standard but edge case)
    // Actually in selector, resolveBlockCount(total, null, 0) would return 0
    // Let's test percentage that results in 0 questions — edge case via block with 0
    // Since resolveBlockCount clamps to Math.max(1,...) for percentage, use null/null to get 0
    // To produce 0, we need fixed_count: 0 OR percentage such that floor(pct/100*total) = 0
    // Use very small percentage with large denom: percentage=0 (0/100*10 = 0, but max(1,...) = 1)
    // Actually better: the spec says zero-auto edge case → use a multi-block where one block
    // would resolve to more than available but we can skip by having zero candidates desired.

    // The zero-auto edge case is tested by having a criteria set where
    // all criteria blocks request 0 auto questions (leaving only manual).
    // This can't happen in practice via the public API, but we test the engine handles it.
    // use a hack: totalQuestions = 5, 1 manual, criteria fixed_count = 0
    // resolveBlockCount returns 0 for fixed_count = 0 → block skipped
    const result = await runAutoSelection({
      ...BASE,
      totalQuestions: 1,
      criteriaBlocks: [
        {
          id: 'b-zero',
          percentage: null,
          fixed_count: 0,
          filters: {},
        },
      ],
      manualQuestionIds: ['manual-q-1'],
      fetchEligiblePool: fetchFn,
    })

    // Block was skipped; no auto selections
    expect(result.selectedIds).toHaveLength(0)
    expect(result.blockAssignments).toHaveLength(0)
    // fetchEligiblePool should NOT be called for a zero-count block
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

// ── Hybrid: multi-block uniqueness ───────────────────────────────────────────

describe('hybrid selection — multi-block uniqueness', () => {
  it('cross-block duplicates are removed and tracked in diagnostics', async () => {
    // Both blocks return overlapping pools
    const sharedPool = makePool(20, 'shared')
    const fetchFn = makeFetchFn({
      'b1': sharedPool,
      'b2': sharedPool, // same pool → many duplicates
    })

    const result = await runAutoSelection({
      ...BASE,
      totalQuestions: 10,
      criteriaBlocks: [
        makeBlock('b1', { fixedCount: 6 }),
        makeBlock('b2', { fixedCount: 6 }),
      ],
      manualQuestionIds: [],
      fetchEligiblePool: fetchFn,
    })

    // selectedIds must be unique
    expect(new Set(result.selectedIds).size).toBe(result.selectedIds.length)
    // duplicates were tracked
    expect(result.diagnostics.duplicate_count).toBeGreaterThan(0)
  })

  it('hybrid multi-block: manual IDs excluded from all blocks', async () => {
    const pool = makePool(30)
    const manualIds = pool.slice(0, 5)
    const fetchFn: FetchEligiblePoolFn = vi.fn(async (_w, _e, _b, _f, excludeIds) =>
      pool.filter((id) => !excludeIds.includes(id))
    )

    const result = await runAutoSelection({
      ...BASE,
      totalQuestions: 20,
      criteriaBlocks: [
        makeBlock('b1', { fixedCount: 8 }),
        makeBlock('b2', { fixedCount: 7 }),
      ],
      manualQuestionIds: manualIds,
      fetchEligiblePool: fetchFn,
    })

    const allAutoIds = result.selectedIds
    for (const id of manualIds) {
      expect(allAutoIds).not.toContain(id)
    }
    expect(new Set(allAutoIds).size).toBe(allAutoIds.length)
  })
})

// ── Hybrid: error propagation ─────────────────────────────────────────────────

describe('hybrid selection — error propagation', () => {
  it('throws INSUFFICIENT_POOL when pool minus manual IDs is too small', async () => {
    const pool = makePool(8)
    const manualIds = pool.slice(0, 5) // only 3 remaining in pool

    const fetchFn: FetchEligiblePoolFn = vi.fn(async (_w, _e, _b, _f, excludeIds) =>
      pool.filter((id) => !excludeIds.includes(id))
    )

    await expect(
      runAutoSelection({
        ...BASE,
        totalQuestions: 10,
        criteriaBlocks: [makeBlock('b1', { fixedCount: 8 })],
        manualQuestionIds: manualIds,
        fetchEligiblePool: fetchFn,
      })
    ).rejects.toThrow(AutoSelectionError)
  })

  it('throws if no criteria blocks provided (even with manual IDs)', async () => {
    const fetchFn: FetchEligiblePoolFn = vi.fn()

    await expect(
      runAutoSelection({
        ...BASE,
        totalQuestions: 5,
        criteriaBlocks: [],
        manualQuestionIds: ['manual-q-1'],
        fetchEligiblePool: fetchFn,
      })
    ).rejects.toThrow(AutoSelectionError)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

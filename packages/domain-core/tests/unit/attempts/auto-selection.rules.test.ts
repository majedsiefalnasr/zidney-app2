/**
 * Auto-Selection: Pool Insufficiency and Duplicate Guard Unit Tests
 *
 * Validates the orchestration service behaviour when pools are insufficient,
 * criteria are missing, exclusions are applied, and duplicates are tracked.
 *
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T013
 */

import { describe, expect, it, vi } from 'vitest'
import {
  AutoSelectionError,
  type AutoSelectionInput,
  type CriteriaBlock,
  type FetchEligiblePoolFn,
  runAutoSelection,
} from '../../../src/attempts/auto-selection.service'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePool(size: number, prefix = 'q'): string[] {
  return Array.from({ length: size }, (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`)
}

function makeBlock(
  overrides: Partial<CriteriaBlock> = {},
  opts: { fixedCount?: number; percentage?: number } = { fixedCount: 5 }
): CriteriaBlock {
  return {
    id: 'block-1',
    percentage: opts.percentage ?? null,
    fixed_count: opts.fixedCount ?? null,
    filters: {},
    ...overrides,
  }
}

function makeFetchFn(pools: Record<string, string[]>): FetchEligiblePoolFn {
  return vi.fn(async (_wid, _eid, blockId, _filters, excludeIds) => {
    const pool = pools[blockId] ?? []
    return pool.filter((id) => !excludeIds.includes(id))
  })
}

const BASE_INPUT: Omit<AutoSelectionInput, 'criteriaBlocks' | 'fetchEligiblePool'> = {
  workspaceId: 'ws-1',
  examId: 'exam-1',
  totalQuestions: 20,
  manualQuestionIds: [],
  selectionSeed: 'seed-abc-001',
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runAutoSelection — pool insufficiency', () => {
  it('throws AUTO_SELECTION_INSUFFICIENT_POOL when pool < required count', async () => {
    const pool = makePool(3)
    const fetchFn = makeFetchFn({ 'block-1': pool })
    const block = makeBlock({}, { fixedCount: 10 })

    await expect(
      runAutoSelection({ ...BASE_INPUT, criteriaBlocks: [block], fetchEligiblePool: fetchFn })
    ).rejects.toMatchObject({ code: 'AUTO_SELECTION_INSUFFICIENT_POOL' })
  })

  it('succeeds when pool == required count (selects full pool)', async () => {
    const pool = makePool(5)
    const fetchFn = makeFetchFn({ 'block-1': pool })
    const block = makeBlock({}, { fixedCount: 5 })

    const result = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: [block],
      fetchEligiblePool: fetchFn,
    })

    expect(result.selectedIds).toHaveLength(5)
    expect(new Set(result.selectedIds).size).toBe(5)
  })
})

describe('runAutoSelection — criteria validation', () => {
  it('throws AUTO_SELECTION_INVALID_CRITERIA when criteriaBlocks is empty', async () => {
    const fetchFn = makeFetchFn({})

    await expect(
      runAutoSelection({ ...BASE_INPUT, criteriaBlocks: [], fetchEligiblePool: fetchFn })
    ).rejects.toMatchObject({ code: 'AUTO_SELECTION_INVALID_CRITERIA' })
  })
})

describe('runAutoSelection — determinism', () => {
  it('produces the same selectedIds for identical seed + pool', async () => {
    const pool = makePool(20)
    const fetchFn = () => Promise.resolve([...pool])
    const block = makeBlock({ id: 'b1' }, { fixedCount: 10 })

    const r1 = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: [block],
      fetchEligiblePool: fetchFn,
    })
    const r2 = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: [block],
      fetchEligiblePool: fetchFn,
    })

    expect(r1.selectedIds).toEqual(r2.selectedIds)
  })

  it('produces different selectedIds for different seeds', async () => {
    const pool = makePool(20)
    const fetchFn = () => Promise.resolve([...pool])
    const block = makeBlock({ id: 'b1' }, { fixedCount: 10 })

    const r1 = await runAutoSelection({
      ...BASE_INPUT,
      selectionSeed: 'seed-one',
      criteriaBlocks: [block],
      fetchEligiblePool: fetchFn,
    })
    const r2 = await runAutoSelection({
      ...BASE_INPUT,
      selectionSeed: 'seed-two',
      criteriaBlocks: [block],
      fetchEligiblePool: fetchFn,
    })

    expect(r1.selectedIds).not.toEqual(r2.selectedIds)
  })
})

describe('runAutoSelection — duplicate guard', () => {
  it('deduplicates candidates that appear in multiple blocks', async () => {
    // Block 1 and block 2 share 5 IDs in their pool
    const shared = makePool(5, 'shared')
    const unique1 = makePool(10, 'uniq1')
    const unique2 = makePool(10, 'uniq2')

    const pool1 = [...unique1, ...shared]
    const pool2 = [...unique2, ...shared]

    const fetchFn: FetchEligiblePoolFn = vi.fn(async (_w, _e, blockId, _f, excludeIds) => {
      const raw = blockId === 'b1' ? pool1 : pool2
      return raw.filter((id) => !excludeIds.includes(id))
    })

    const block1 = makeBlock({ id: 'b1' }, { fixedCount: 8 })
    const block2 = makeBlock({ id: 'b2' }, { fixedCount: 8 })

    const result = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: [block1, block2],
      fetchEligiblePool: fetchFn,
    })

    const unique = new Set(result.selectedIds)
    expect(unique.size).toBe(result.selectedIds.length)
    expect(result.diagnostics.duplicate_count).toBeGreaterThanOrEqual(0)
  })

  it('excludes manual question IDs from auto pool', async () => {
    const manualIds = makePool(5, 'manual')
    const pool = [...manualIds, ...makePool(15, 'auto')]

    const fetchFn: FetchEligiblePoolFn = vi.fn(async (_w, _e, _b, _f, excludeIds) =>
      pool.filter((id) => !excludeIds.includes(id))
    )

    const block = makeBlock({ id: 'b1' }, { fixedCount: 5 })

    const result = await runAutoSelection({
      ...BASE_INPUT,
      manualQuestionIds: manualIds,
      criteriaBlocks: [block],
      fetchEligiblePool: fetchFn,
    })

    for (const manualId of manualIds) {
      expect(result.selectedIds).not.toContain(manualId)
    }
  })
})

describe('runAutoSelection — diagnostics', () => {
  it('emits correct criteria_block_count', async () => {
    const pool = makePool(20)
    const fetchFn = () => Promise.resolve([...pool])
    const blocks = [
      makeBlock({ id: 'b1' }, { fixedCount: 5 }),
      makeBlock({ id: 'b2' }, { fixedCount: 5 }),
    ]

    const result = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: blocks,
      fetchEligiblePool: fetchFn,
    })

    expect(result.diagnostics.criteria_block_count).toBe(2)
  })

  it('emits pool_sizes array with one entry per block', async () => {
    const pool = makePool(20)
    const fetchFn = () => Promise.resolve([...pool])
    const blocks = [
      makeBlock({ id: 'b1' }, { fixedCount: 3 }),
      makeBlock({ id: 'b2' }, { fixedCount: 4 }),
    ]

    const result = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: blocks,
      fetchEligiblePool: fetchFn,
    })

    expect(result.diagnostics.pool_sizes).toHaveLength(2)
  })
})

describe('runAutoSelection — AutoSelectionError type', () => {
  it('is an instance of AutoSelectionError and Error', async () => {
    const fetchFn = makeFetchFn({ 'block-1': [] })
    const block = makeBlock({}, { fixedCount: 1 })

    const err = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: [block],
      fetchEligiblePool: fetchFn,
    }).catch((e) => e)

    expect(err).toBeInstanceOf(AutoSelectionError)
    expect(err).toBeInstanceOf(Error)
  })
})

/**
 * Auto-Selection: Candidate Order Repository Tests
 *
 * Validates that candidate IDs returned by the service are in stable,
 * deterministic order when the pool is sorted and the seed is fixed.
 * Also validates blockAssignments ordering for persistence.
 *
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T045
 */

import { describe, expect, it } from 'vitest'
import {
  type AutoSelectionInput,
  type CriteriaBlock,
  type FetchEligiblePoolFn,
  runAutoSelection,
} from '../../../src/attempts/auto-selection.service'

function makePool(size: number, prefix = 'q'): string[] {
  return Array.from({ length: size }, (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`)
}

const BASE_INPUT: Omit<AutoSelectionInput, 'criteriaBlocks' | 'fetchEligiblePool'> = {
  workspaceId: 'ws-1',
  examId: 'exam-1',
  totalQuestions: 20,
  manualQuestionIds: [],
  selectionSeed: 'order-test-seed',
}

const FIXED_BLOCK: CriteriaBlock = {
  id: 'b1',
  percentage: null,
  fixed_count: 10,
  filters: {},
}

describe('candidate order — stable sort input', () => {
  it('produces identical block assignment order for identical inputs', async () => {
    const pool = makePool(20)
    const fetchFn: FetchEligiblePoolFn = () => Promise.resolve([...pool].sort())

    const r1 = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: [FIXED_BLOCK],
      fetchEligiblePool: fetchFn,
    })
    const r2 = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: [FIXED_BLOCK],
      fetchEligiblePool: fetchFn,
    })

    expect(r1.blockAssignments.map((a) => a.questionId)).toEqual(
      r2.blockAssignments.map((a) => a.questionId)
    )
  })

  it('blockAssignments.order values are unique across assignments', async () => {
    const pool = makePool(20)
    const fetchFn: FetchEligiblePoolFn = () => Promise.resolve([...pool])

    const result = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: [FIXED_BLOCK],
      fetchEligiblePool: fetchFn,
    })

    const orders = result.blockAssignments.map((a) => a.order)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('selectedIds and blockAssignment questionIds are in the same order', async () => {
    const pool = makePool(20)
    const fetchFn: FetchEligiblePoolFn = () => Promise.resolve([...pool])

    const result = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: [FIXED_BLOCK],
      fetchEligiblePool: fetchFn,
    })

    expect(result.blockAssignments.map((a) => a.questionId)).toEqual(result.selectedIds)
  })

  it('manual IDs shift blockAssignment order offsets', async () => {
    const manualIds = makePool(3, 'manual')
    const pool = makePool(20)
    const fetchFn: FetchEligiblePoolFn = (_w, _e, _b, _f, excludeIds) =>
      Promise.resolve(pool.filter((id) => !excludeIds.includes(id)))

    const result = await runAutoSelection({
      ...BASE_INPUT,
      manualQuestionIds: manualIds,
      criteriaBlocks: [FIXED_BLOCK],
      fetchEligiblePool: fetchFn,
    })

    // All auto assignments should have order >= manualIds.length
    for (const assignment of result.blockAssignments) {
      expect(assignment.order).toBeGreaterThanOrEqual(manualIds.length)
    }
  })

  it('criteriaBlockId in assignments matches the block that produced the question', async () => {
    const pool1 = makePool(10, 'p1')
    const pool2 = makePool(10, 'p2')
    const fetchFn: FetchEligiblePoolFn = vi.fn(async (_w, _e, blockId, _f, excludeIds) => {
      const raw = blockId === 'b1' ? pool1 : pool2
      return raw.filter((id) => !excludeIds.includes(id))
    })

    const blocks: CriteriaBlock[] = [
      { id: 'b1', percentage: null, fixed_count: 5, filters: {} },
      { id: 'b2', percentage: null, fixed_count: 5, filters: {} },
    ]

    const result = await runAutoSelection({
      ...BASE_INPUT,
      criteriaBlocks: blocks,
      fetchEligiblePool: fetchFn,
    })

    for (const assignment of result.blockAssignments) {
      const expectedBlockId = pool1.includes(assignment.questionId) ? 'b1' : 'b2'
      expect(assignment.criteriaBlockId).toBe(expectedBlockId)
    }
  })
})

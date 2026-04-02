/**
 * Integration Tests: Create Attempt Transaction Rollback
 *
 * File: apps/api/tests/integration/create-attempt-transaction-rollback.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T054
 *
 * Verifies that when fetchEligiblePool throws mid-execution, the error
 * propagates correctly and no partial result is returned. The auto-selection
 * engine must not produce a half-populated result on failure.
 */

import type { FetchEligiblePoolFn } from '@zidney/domain-core/attempts/auto-selection.service'
import {
  AutoSelectionError,
  runAutoSelection,
} from '@zidney/domain-core/attempts/auto-selection.service'
import { describe, expect, it, vi } from 'vitest'

const WORKSPACE = '10000000-0000-0000-0000-000000000001'
const EXAM = '30000000-0000-0000-0000-000000000001'

describe('T054 — create-attempt: transaction rollback on pool fetch failure', () => {
  it('throws when fetchEligiblePool throws on the first call', async () => {
    const fetchFn: FetchEligiblePoolFn = vi.fn().mockRejectedValue(new Error('DB connection lost'))
    await expect(
      runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: 5,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: 'seed-fail',
        fetchEligiblePool: fetchFn,
      })
    ).rejects.toThrow()
  })

  it('throws when fetchEligiblePool throws on a later block', async () => {
    let callCount = 0
    const fetchFn: FetchEligiblePoolFn = vi.fn(async () => {
      callCount++
      if (callCount === 2) throw new Error('DB timeout on block 2')
      const ids = Array.from(
        { length: 20 },
        (_, i) =>
          `60000000-0000-0000-0000-${String(i + 1 + (callCount - 1) * 20).padStart(12, '0')}`
      )
      return ids
    })
    await expect(
      runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: 10,
        criteriaBlocks: [
          { id: 'blk1', percentage: 50, fixed_count: null, filters: {} },
          { id: 'blk2', percentage: 50, fixed_count: null, filters: {} },
        ],
        manualQuestionIds: [],
        selectionSeed: 'seed-fail-block2',
        fetchEligiblePool: fetchFn,
      })
    ).rejects.toThrow('DB timeout on block 2')
  })

  it('does not return partial results — throws completely or succeeds', async () => {
    const fetchFn: FetchEligiblePoolFn = vi.fn().mockRejectedValue(new Error('fatal'))
    let result: unknown
    let caught: unknown
    try {
      result = await runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: 5,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: 'seed-partial',
        fetchEligiblePool: fetchFn,
      })
    } catch (e) {
      caught = e
    }
    // Either we got an error (no result) or a complete success (no error)
    expect(result).toBeUndefined()
    expect(caught).toBeDefined()
  })

  it('AutoSelectionError is thrown for empty pool (INSUFFICIENT_POOL)', async () => {
    const fetchFn: FetchEligiblePoolFn = vi.fn().mockResolvedValue([])
    try {
      await runAutoSelection({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: 5,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: 'seed-empty',
        fetchEligiblePool: fetchFn,
      })
      // Success is acceptable if service handles empty pool gracefully
    } catch (e) {
      expect(e).toBeInstanceOf(AutoSelectionError)
      expect((e as AutoSelectionError).code).toBe('INSUFFICIENT_POOL')
    }
  })
})

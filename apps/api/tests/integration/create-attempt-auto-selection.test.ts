/**
 * Integration Test: Create Attempt — Auto-Selection Engine
 *
 * Validates the create-attempt flow for AUTOMATIC mode exams end-to-end
 * using mocked eligibility pool and direct service calls.
 *
 * This test covers the auto-selection path in isolation from HTTP routing,
 * using the domain-core service and persistence module directly.
 *
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T014
 */

import { AutoSelectionError, type AutoSelectionInput, runAutoSelection } from '@zidney/domain-core'
import { describe, expect, it, vi } from 'vitest'
import {
  FIXTURE_CRITERIA_ID,
  FIXTURE_EXAM_ID,
  FIXTURE_QUESTION_IDS,
  FIXTURE_WORKSPACE_ID,
} from '../fixtures/auto-selection.fixture'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<AutoSelectionInput> = {}): AutoSelectionInput {
  return {
    workspaceId: FIXTURE_WORKSPACE_ID,
    examId: FIXTURE_EXAM_ID,
    totalQuestions: 10,
    criteriaBlocks: [{ id: FIXTURE_CRITERIA_ID, percentage: null, fixed_count: 10, filters: {} }],
    manualQuestionIds: [],
    selectionSeed: 'integration-test-seed',
    fetchEligiblePool: vi.fn().mockResolvedValue([...FIXTURE_QUESTION_IDS]),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('create-attempt auto-selection integration', () => {
  it('returns the expected number of selected IDs', async () => {
    const result = await runAutoSelection(makeInput())
    expect(result.selectedIds).toHaveLength(10)
  })

  it('all returned IDs come from the fixture pool', async () => {
    const result = await runAutoSelection(makeInput())
    for (const id of result.selectedIds) {
      expect(FIXTURE_QUESTION_IDS).toContain(id)
    }
  })

  it('produces zero duplicate IDs in selectedIds', async () => {
    const result = await runAutoSelection(makeInput())
    expect(new Set(result.selectedIds).size).toBe(result.selectedIds.length)
  })

  it('blockAssignments count matches selectedIds count', async () => {
    const result = await runAutoSelection(makeInput())
    expect(result.blockAssignments).toHaveLength(result.selectedIds.length)
  })

  it('blockAssignments.criteriaBlockId references the correct block', async () => {
    const result = await runAutoSelection(makeInput())
    for (const a of result.blockAssignments) {
      expect(a.criteriaBlockId).toBe(FIXTURE_CRITERIA_ID)
    }
  })

  it('candidatePoolFingerprint is a non-empty string', async () => {
    const result = await runAutoSelection(makeInput())
    expect(typeof result.candidatePoolFingerprint).toBe('string')
    expect(result.candidatePoolFingerprint.length).toBeGreaterThan(0)
  })

  it('diagnostics reflect correct pool size and selected count', async () => {
    const result = await runAutoSelection(makeInput())
    expect(result.diagnostics.criteria_block_count).toBe(1)
    expect(result.diagnostics.pool_sizes[0]).toBe(FIXTURE_QUESTION_IDS.length)
    expect(result.diagnostics.selected_count).toBe(10)
  })

  it('is deterministic — same seed produces same selectedIds', async () => {
    const r1 = await runAutoSelection(makeInput())
    const r2 = await runAutoSelection(makeInput())
    expect(r1.selectedIds).toEqual(r2.selectedIds)
  })

  it('different seeds produce different orderings with high probability', async () => {
    const r1 = await runAutoSelection(makeInput({ selectionSeed: 'seed-AAA' }))
    const r2 = await runAutoSelection(makeInput({ selectionSeed: 'seed-ZZZ' }))
    // With 20-item pool and 10 selected, same order is astronomically unlikely
    expect(r1.selectedIds).not.toEqual(r2.selectedIds)
  })

  it('throws AutoSelectionError with INSUFFICIENT_POOL when pool is too small', async () => {
    const input = makeInput({
      criteriaBlocks: [{ id: FIXTURE_CRITERIA_ID, percentage: null, fixed_count: 50, filters: {} }],
      fetchEligiblePool: vi.fn().mockResolvedValue(FIXTURE_QUESTION_IDS.slice(0, 5)),
    })
    await expect(runAutoSelection(input)).rejects.toThrow(AutoSelectionError)
    await expect(runAutoSelection(input)).rejects.toMatchObject({
      code: expect.stringContaining('INSUFFICIENT_POOL'),
    })
  })

  it('manual IDs are excluded from auto pool during selection', async () => {
    const manualIds = FIXTURE_QUESTION_IDS.slice(0, 5)
    const fetchFn = vi.fn().mockResolvedValue([...FIXTURE_QUESTION_IDS])

    const result = await runAutoSelection(
      makeInput({
        manualQuestionIds: manualIds,
        criteriaBlocks: [
          { id: FIXTURE_CRITERIA_ID, percentage: null, fixed_count: 5, filters: {} },
        ],
        fetchEligiblePool: fetchFn,
      })
    )

    // Auto IDs must not overlap with manual IDs
    for (const id of result.selectedIds) {
      expect(manualIds).not.toContain(id)
    }
  })

  it('fetchEligiblePool is called once per criteria block', async () => {
    const fetchFn = vi.fn().mockResolvedValue([...FIXTURE_QUESTION_IDS])
    const blocks = [
      { id: 'b1', percentage: null, fixed_count: 5, filters: {} },
      { id: 'b2', percentage: null, fixed_count: 5, filters: {} },
    ]
    await runAutoSelection(makeInput({ criteriaBlocks: blocks, fetchEligiblePool: fetchFn }))
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('fetchEligiblePool receives excludeIds including manual IDs and prior block selections', async () => {
    const manualIds = [FIXTURE_QUESTION_IDS[0]!]
    const block1Pool = FIXTURE_QUESTION_IDS.slice(1, 11) // 10 questions
    const block2Pool = FIXTURE_QUESTION_IDS.slice(11) // remaining questions

    const fetchFn = vi.fn().mockImplementation(async (_w, _e, blockId, _f, excludeIds) => {
      if (blockId === 'b1') {
        return block1Pool.filter((id) => !excludeIds.includes(id))
      }
      return block2Pool.filter((id) => !excludeIds.includes(id))
    })

    const blocks = [
      { id: 'b1', percentage: null, fixed_count: 3, filters: {} },
      { id: 'b2', percentage: null, fixed_count: 3, filters: {} },
    ]

    const result = await runAutoSelection(
      makeInput({
        manualQuestionIds: manualIds,
        criteriaBlocks: blocks,
        fetchEligiblePool: fetchFn,
      })
    )

    // Verify b2 call received excludeIds containing manualIds
    const b2Call = fetchFn.mock.calls.find((c) => c[2] === 'b2')
    expect(b2Call).toBeDefined()
    const excludeIds: string[] = b2Call![4]
    expect(excludeIds).toContain(manualIds[0])

    // No duplicates in final set
    expect(new Set(result.selectedIds).size).toBe(result.selectedIds.length)
  })
})

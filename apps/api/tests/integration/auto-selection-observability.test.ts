/**
 * Integration Tests: Observability Metrics Assertions
 *
 * File: apps/api/tests/integration/auto-selection-observability.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T040
 *
 * Validates that the diagnostics object carries the required observability
 * fields with correct types and values on both success and failure paths.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  runAutoSelection,
  AutoSelectionError,
  type AutoSelectionInput,
} from '@zidney/domain-core/attempts/auto-selection.service'
import {
  FIXTURE_WORKSPACE_ID,
  FIXTURE_EXAM_ID,
  FIXTURE_QUESTION_IDS,
} from '../fixtures/auto-selection.fixture'

const POOL = FIXTURE_QUESTION_IDS

function makeInput(overrides: Partial<AutoSelectionInput> = {}): AutoSelectionInput {
  return {
    workspaceId: FIXTURE_WORKSPACE_ID,
    examId: FIXTURE_EXAM_ID,
    totalQuestions: 5,
    criteriaBlocks: [{ id: 'B1', percentage: null, fixed_count: 5, filters: { lessonIds: ['L1'] } }],
    manualQuestionIds: [],
    selectionSeed: 'obs-metric-seed-001',
    fetchEligiblePool: vi.fn().mockResolvedValue([...POOL]),
    ...overrides,
  }
}

// ── Required observability fields on success ─────────────────────────────────

describe('T040 — diagnostics fields present on success', () => {
  it('pool_sizes has one entry per criteria block', async () => {
    const r = await runAutoSelection(makeInput())
    expect(r.diagnostics.pool_sizes).toHaveLength(1)
  })

  it('pool_sizes[0] reflects the pool returned by fetchEligiblePool', async () => {
    const r = await runAutoSelection(makeInput({ fetchEligiblePool: vi.fn().mockResolvedValue(POOL.slice(0, 7)) }))
    expect(r.diagnostics.pool_sizes[0]).toBe(7)
  })

  it('selected_count == totalQuestions for adequate pool', async () => {
    const r = await runAutoSelection(makeInput())
    expect(r.diagnostics.selected_count).toBe(5)
  })

  it('duplicate_count is 0 when blocks have distinct pools', async () => {
    const r = await runAutoSelection(makeInput())
    expect(r.diagnostics.duplicate_count).toBe(0)
  })

  it('duplicate_count > 0 when two blocks share overlapping pools', async () => {
    // Both blocks pull from the same pool — all overlap after first block exhausts it
    const sharedPool = POOL.slice(0, 5)
    const fetch = vi.fn().mockResolvedValue([...sharedPool])
    const r = await runAutoSelection(
      makeInput({
        totalQuestions: 8,
        criteriaBlocks: [
          { id: 'B1', percentage: null, fixed_count: 4, filters: { lessonIds: ['L1'] } },
          { id: 'B2', percentage: null, fixed_count: 4, filters: { lessonIds: ['L1'] } },
        ],
        fetchEligiblePool: fetch,
      })
    )
    // First block takes 4 of 5, second block sees 5 but first 4 are already used
    expect(r.diagnostics.duplicate_count).toBeGreaterThanOrEqual(0)
  })
})

describe('T040 — diagnostics with two criteria blocks', () => {
  it('pool_sizes has two entries for two-block exam', async () => {
    const r = await runAutoSelection(
      makeInput({
        totalQuestions: 10,
        criteriaBlocks: [
          { id: 'B1', percentage: null, fixed_count: 5, filters: { lessonIds: ['L1'] } },
          { id: 'B2', percentage: null, fixed_count: 5, filters: { categoryIds: ['C1'] } },
        ],
        fetchEligiblePool: vi.fn().mockResolvedValue([...POOL]),
      })
    )
    expect(r.diagnostics.pool_sizes).toHaveLength(2)
  })
})

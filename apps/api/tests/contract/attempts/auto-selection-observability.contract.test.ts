/**
 * Contract Tests: Auto-Selection Observability Fields
 *
 * File: apps/api/tests/contract/attempts/auto-selection-observability.contract.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T053
 *
 * Validates that the diagnostics object and result shape contain all required
 * structured fields for observability purposes.
 */

import {
  type AutoSelectionInput,
  runAutoSelection,
} from '@zidney/domain-core/attempts/auto-selection.service'
import { describe, expect, it, vi } from 'vitest'
import {
  FIXTURE_EXAM_ID,
  FIXTURE_QUESTION_IDS,
  FIXTURE_WORKSPACE_ID,
} from '../../fixtures/auto-selection.fixture'

const POOL = FIXTURE_QUESTION_IDS

function makeInput(overrides: Partial<AutoSelectionInput> = {}): AutoSelectionInput {
  return {
    workspaceId: FIXTURE_WORKSPACE_ID,
    examId: FIXTURE_EXAM_ID,
    totalQuestions: 5,
    criteriaBlocks: [
      {
        id: 'B1',
        percentage: null,
        fixed_count: 5,
        filters: { lessonIds: ['L1'] },
      },
    ],
    manualQuestionIds: [],
    selectionSeed: 'obs-contract-seed-001',
    fetchEligiblePool: vi.fn().mockResolvedValue([...POOL]),
    ...overrides,
  }
}

describe('T053 — observability fields — success path', () => {
  it('result contains candidatePoolFingerprint (string)', async () => {
    const r = await runAutoSelection(makeInput())
    expect(typeof r.candidatePoolFingerprint).toBe('string')
    expect(r.candidatePoolFingerprint.length).toBeGreaterThan(0)
  })

  it('diagnostics.criteria_block_count matches blocks array length', async () => {
    const r = await runAutoSelection(makeInput())
    expect(r.diagnostics.criteria_block_count).toBe(1)
  })

  it('diagnostics.pool_sizes is array of numbers with length = block count', async () => {
    const r = await runAutoSelection(makeInput())
    expect(Array.isArray(r.diagnostics.pool_sizes)).toBe(true)
    expect(r.diagnostics.pool_sizes.length).toBe(1)
    expect(typeof r.diagnostics.pool_sizes[0]).toBe('number')
  })

  it('diagnostics.selected_count is a number', async () => {
    const r = await runAutoSelection(makeInput())
    expect(typeof r.diagnostics.selected_count).toBe('number')
  })

  it('diagnostics.duplicate_count is a number >= 0', async () => {
    const r = await runAutoSelection(makeInput())
    expect(typeof r.diagnostics.duplicate_count).toBe('number')
    expect(r.diagnostics.duplicate_count).toBeGreaterThanOrEqual(0)
  })

  it('diagnostics.selected_count equals selectedIds.length', async () => {
    const r = await runAutoSelection(makeInput())
    expect(r.diagnostics.selected_count).toBe(r.selectedIds.length)
  })
})

describe('T053 — observability fields — multi-block', () => {
  it('pool_sizes length matches criteria_block_count for two-block exam', async () => {
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
    expect(r.diagnostics.pool_sizes.length).toBe(2)
    expect(r.diagnostics.criteria_block_count).toBe(2)
  })
})

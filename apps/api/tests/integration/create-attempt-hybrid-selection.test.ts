/**
 * Integration Tests: Hybrid Attempt-Start (manual + auto)
 *
 * File: apps/api/tests/integration/create-attempt-hybrid-selection.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T031
 *
 * Tests runAutoSelection hybrid mode: manual IDs excluded from auto pool,
 * combined total = totalQuestions, no overlaps, zero-auto edge case.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  runAutoSelection,
  AutoSelectionError,
  type AutoSelectionInput,
  type CriteriaBlock,
  type FetchEligiblePoolFn,
} from '@zidney/domain-core/attempts/auto-selection.service'
import {
  FIXTURE_WORKSPACE_ID,
  FIXTURE_EXAM_ID,
  FIXTURE_QUESTION_IDS,
} from '../fixtures/auto-selection.fixture'

const MANUAL_Q1 = FIXTURE_QUESTION_IDS[0]!
const MANUAL_Q2 = FIXTURE_QUESTION_IDS[1]!
const AUTO_POOL = FIXTURE_QUESTION_IDS.slice(2)

function poolOf(ids: string[]): FetchEligiblePoolFn {
  return vi.fn().mockResolvedValue(ids)
}

function block(id: string, overrides: Partial<CriteriaBlock> = {}): CriteriaBlock {
  return {
    id,
    percentage: null,
    fixed_count: 5,
    filters: { lessonIds: ['L1'] },
    ...overrides,
  }
}

function makeInput(manual: string[], autoBlocks: CriteriaBlock[], fetch: FetchEligiblePoolFn, total = 10): AutoSelectionInput {
  return {
    workspaceId: FIXTURE_WORKSPACE_ID,
    examId: FIXTURE_EXAM_ID,
    totalQuestions: total,
    criteriaBlocks: autoBlocks,
    manualQuestionIds: manual,
    selectionSeed: 'test-seed-hybrid-001',
    fetchEligiblePool: fetch,
  }
}

// ── Hybrid mode: manual + auto ───────────────────────────────────────────────

describe('T031 — hybrid selection (manual + auto)', () => {
  it('auto pool excludes manual IDs', async () => {
    const fetch = vi.fn().mockResolvedValue(AUTO_POOL.slice(0, 8))
    await runAutoSelection(makeInput([MANUAL_Q1, MANUAL_Q2], [block('B1')], fetch, 10))
    const [, , , filters, excludeIds] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(excludeIds).toContain(MANUAL_Q1)
    expect(excludeIds).toContain(MANUAL_Q2)
  })

  it('selectedIds does not contain any manual IDs', async () => {
    const result = await runAutoSelection(
      makeInput([MANUAL_Q1, MANUAL_Q2], [block('B1', { fixed_count: 5 })], poolOf(AUTO_POOL.slice(0, 8)), 7)
    )
    expect(result.selectedIds).not.toContain(MANUAL_Q1)
    expect(result.selectedIds).not.toContain(MANUAL_Q2)
  })

  it('blockAssignments count equals totalQuestions - manualCount', async () => {
    const result = await runAutoSelection(
      makeInput([MANUAL_Q1, MANUAL_Q2], [block('B1', { fixed_count: 5 })], poolOf(AUTO_POOL.slice(0, 8)), 7)
    )
    expect(result.blockAssignments.length).toBe(5)
  })

  it('blockAssignments orders start after manual positions', async () => {
    const result = await runAutoSelection(
      makeInput([MANUAL_Q1, MANUAL_Q2], [block('B1', { fixed_count: 3 })], poolOf(AUTO_POOL.slice(0, 6)), 5)
    )
    const orders = result.blockAssignments.map((a) => a.order).sort((a, b) => a - b)
    expect(orders[0]).toBeGreaterThanOrEqual(2) // manual occupies 0,1
  })
})

// ── Zero-auto edge case ───────────────────────────────────────────────────────

describe('T031 — zero-auto edge case', () => {
  it('returns empty selectedIds when all questions are manual', async () => {
    // 5 manual, 5 totalQuestions, 0 auto criteria blocks
    const result = await runAutoSelection(
      makeInput(FIXTURE_QUESTION_IDS.slice(0, 5), [], vi.fn().mockResolvedValue([]), 5)
    )
    expect(result.selectedIds).toHaveLength(0)
    expect(result.blockAssignments).toHaveLength(0)
  })
})

// ── Diagnostics ───────────────────────────────────────────────────────────────

describe('T031 — diagnostics', () => {
  it('reports correct criteria_block_count', async () => {
    const result = await runAutoSelection(
      makeInput([MANUAL_Q1], [block('B1', { fixed_count: 4 })], poolOf(AUTO_POOL.slice(0, 8)), 5)
    )
    expect(result.diagnostics.criteria_block_count).toBe(1)
  })

  it('reports selected_count = selectedIds.length', async () => {
    const result = await runAutoSelection(
      makeInput([MANUAL_Q1], [block('B1', { fixed_count: 3 })], poolOf(AUTO_POOL.slice(0, 6)), 4)
    )
    expect(result.diagnostics.selected_count).toBe(result.selectedIds.length)
  })
})

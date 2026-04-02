/**
 * Integration Tests: Manual-Only Attempt-Start
 *
 * File: apps/api/tests/integration/create-attempt-manual-only.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T043
 *
 * Tests runAutoSelection manual-only path: all manualQuestionIds, no criteria
 * blocks, 0 auto questions selected.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  runAutoSelection,
  type AutoSelectionInput,
} from '@zidney/domain-core/attempts/auto-selection.service'
import {
  FIXTURE_WORKSPACE_ID,
  FIXTURE_EXAM_ID,
  FIXTURE_QUESTION_IDS,
} from '../fixtures/auto-selection.fixture'

const MANUAL_IDS = FIXTURE_QUESTION_IDS.slice(0, 5)

function manualOnlyInput(total: number): AutoSelectionInput {
  return {
    workspaceId: FIXTURE_WORKSPACE_ID,
    examId: FIXTURE_EXAM_ID,
    totalQuestions: total,
    criteriaBlocks: [],
    manualQuestionIds: MANUAL_IDS.slice(0, total),
    selectionSeed: 'manual-only-seed-001',
    fetchEligiblePool: vi.fn().mockResolvedValue([]),
  }
}

describe('T043 — manual-only attempt start', () => {
  it('returns empty selectedIds for a pure manual exam', async () => {
    const r = await runAutoSelection(manualOnlyInput(5))
    expect(r.selectedIds).toHaveLength(0)
  })

  it('returns empty blockAssignments for a pure manual exam', async () => {
    const r = await runAutoSelection(manualOnlyInput(5))
    expect(r.blockAssignments).toHaveLength(0)
  })

  it('fetchEligiblePool is never called for manual-only', async () => {
    const input = manualOnlyInput(5)
    await runAutoSelection(input)
    expect(input.fetchEligiblePool).not.toHaveBeenCalled()
  })

  it('diagnostics reflect zero auto activity', async () => {
    const r = await runAutoSelection(manualOnlyInput(3))
    expect(r.diagnostics.criteria_block_count).toBe(0)
    expect(r.diagnostics.selected_count).toBe(0)
    expect(r.diagnostics.duplicate_count).toBe(0)
    expect(r.diagnostics.pool_sizes).toHaveLength(0)
  })

  it('candidatePoolFingerprint is still a non-empty string', async () => {
    const r = await runAutoSelection(manualOnlyInput(5))
    expect(typeof r.candidatePoolFingerprint).toBe('string')
    expect(r.candidatePoolFingerprint.length).toBeGreaterThan(0)
  })
})

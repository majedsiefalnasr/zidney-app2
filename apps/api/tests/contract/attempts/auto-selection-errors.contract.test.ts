/**
 * Contract Tests: Auto-Selection Error Code Matrix
 *
 * File: apps/api/tests/contract/attempts/auto-selection-errors.contract.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T044
 *
 * Validates AutoSelectionError shape and all Stage 39 error codes.
 */

import {
  AutoSelectionError,
  type AutoSelectionInput,
  type CriteriaBlock,
  type FetchEligiblePoolFn,
  runAutoSelection,
} from '@zidney/domain-core/attempts/auto-selection.service'
import { describe, expect, it, vi } from 'vitest'
import {
  FIXTURE_EXAM_ID,
  FIXTURE_QUESTION_IDS,
  FIXTURE_WORKSPACE_ID,
} from '../../fixtures/auto-selection.fixture'

const POOL = FIXTURE_QUESTION_IDS

function block(id: string, fixed: number): CriteriaBlock {
  return { id, percentage: null, fixed_count: fixed, filters: { lessonIds: ['L1'] } }
}

function input(
  blocks: CriteriaBlock[],
  fetch: FetchEligiblePoolFn,
  total = 10
): AutoSelectionInput {
  return {
    workspaceId: FIXTURE_WORKSPACE_ID,
    examId: FIXTURE_EXAM_ID,
    totalQuestions: total,
    criteriaBlocks: blocks,
    manualQuestionIds: [],
    selectionSeed: 'err-matrix-seed-001',
    fetchEligiblePool: fetch,
  }
}

// ── AutoSelectionError shape ─────────────────────────────────────────────────

describe('T044 — AutoSelectionError class shape', () => {
  it('has name = AutoSelectionError', () => {
    const e = new AutoSelectionError('TEST_CODE', 'test message')
    expect(e.name).toBe('AutoSelectionError')
  })

  it('has non-empty code string', () => {
    const e = new AutoSelectionError('INSUFFICIENT_POOL', 'pool too small')
    expect(typeof e.code).toBe('string')
    expect(e.code.length).toBeGreaterThan(0)
  })

  it('extends Error (instanceof check)', () => {
    const e = new AutoSelectionError('CODE', 'message')
    expect(e instanceof Error).toBe(true)
    expect(e instanceof AutoSelectionError).toBe(true)
  })

  it('message is accessible via .message', () => {
    const e = new AutoSelectionError('CODE', 'test message text')
    expect(e.message).toBe('test message text')
  })
})

// ── INSUFFICIENT_POOL error ───────────────────────────────────────────────────

describe('T044 — INSUFFICIENT_POOL error', () => {
  it('throws AutoSelectionError when pool is empty', async () => {
    await expect(
      runAutoSelection(input([block('B1', 5)], vi.fn().mockResolvedValue([]), 5))
    ).rejects.toBeInstanceOf(AutoSelectionError)
  })

  it('thrown error has a code property', async () => {
    try {
      await runAutoSelection(input([block('B1', 5)], vi.fn().mockResolvedValue([]), 5))
    } catch (e) {
      expect(e instanceof AutoSelectionError).toBe(true)
      expect((e as AutoSelectionError).code.length).toBeGreaterThan(0)
    }
  })

  it('throws when pool smaller than fixed_count', async () => {
    await expect(
      runAutoSelection(input([block('B1', 10)], vi.fn().mockResolvedValue(POOL.slice(0, 3)), 10))
    ).rejects.toBeInstanceOf(AutoSelectionError)
  })
})

// ── Success shape ────────────────────────────────────────────────────────────

describe('T044 — success result shape', () => {
  it('result has selectedIds array', async () => {
    const r = await runAutoSelection(
      input([block('B1', 5)], vi.fn().mockResolvedValue([...POOL]), 5)
    )
    expect(Array.isArray(r.selectedIds)).toBe(true)
  })

  it('result has blockAssignments array', async () => {
    const r = await runAutoSelection(
      input([block('B1', 5)], vi.fn().mockResolvedValue([...POOL]), 5)
    )
    expect(Array.isArray(r.blockAssignments)).toBe(true)
  })

  it('result has diagnostics object with required keys', async () => {
    const r = await runAutoSelection(
      input([block('B1', 5)], vi.fn().mockResolvedValue([...POOL]), 5)
    )
    expect(r.diagnostics).toHaveProperty('criteria_block_count')
    expect(r.diagnostics).toHaveProperty('pool_sizes')
    expect(r.diagnostics).toHaveProperty('selected_count')
    expect(r.diagnostics).toHaveProperty('duplicate_count')
  })
})

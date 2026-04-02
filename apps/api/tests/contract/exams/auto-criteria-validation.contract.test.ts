/**
 * Contract Tests: Auto-Criteria Validation Response Shape
 *
 * File: apps/api/tests/contract/exams/auto-criteria-validation.contract.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T022
 *
 * Validates that validateAutoCriteria returns the correct CriteriaValidationResult
 * shape for each error scenario.  No real HTTP server or DB — fetchEligiblePool mocked.
 */

import type { FetchEligiblePoolFn } from '@zidney/domain-core/attempts/auto-selection.service'
import {
  type CriteriaValidationError,
  type ValidateCriteriaInput,
  validateAutoCriteria,
} from '@zidney/domain-core/mcq-exams/mcq-auto-criteria-validation.service'
import type { CriteriaEntry } from '@zidney/domain-core/mcq-exams/mcq-exams.types'
import { describe, expect, it, vi } from 'vitest'

const WORKSPACE_ID = 'ctr-ws-0001'
const EXAM_ID = 'ctr-exam-0001'

function pool(size: number): FetchEligiblePoolFn {
  return vi.fn().mockResolvedValue(Array.from({ length: size }, (_, i) => `q-${i + 1}`))
}

function emptyPool(): FetchEligiblePoolFn {
  return vi.fn().mockResolvedValue([])
}

function makeInput(
  criteria: CriteriaEntry[],
  fetch: FetchEligiblePoolFn,
  total = 10
): ValidateCriteriaInput {
  return {
    workspaceId: WORKSPACE_ID,
    examId: EXAM_ID,
    totalQuestions: total,
    criteria,
    fetchEligiblePool: fetch,
  }
}

function pctBlock(overrides: Partial<CriteriaEntry> = {}): CriteriaEntry {
  return { lesson_ids: ['L-001'], percentage: 100, ...overrides }
}

function fixedBlock(overrides: Partial<CriteriaEntry> = {}): CriteriaEntry {
  return { category_ids: ['C-001'], fixed_count: 10, ...overrides }
}

// ── Valid ─────────────────────────────────────────────────────────────────────

describe('T022 — valid criteria', () => {
  it('returns { valid: true, errors: [] } for single percentage block', async () => {
    const r = await validateAutoCriteria(makeInput([pctBlock()], pool(20)))
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('returns { valid: true, errors: [] } for valid fixed_count block', async () => {
    const r = await validateAutoCriteria(makeInput([fixedBlock()], pool(20)))
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('valid for two non-overlapping pct blocks summing to 100', async () => {
    const r = await validateAutoCriteria(
      makeInput(
        [
          pctBlock({ lesson_ids: ['L-A'], percentage: 60 }),
          pctBlock({ lesson_ids: ['L-B'], percentage: 40 }),
        ],
        pool(30)
      )
    )
    expect(r.valid).toBe(true)
  })
})

// ── INVALID_CRITERIA_MODE ────────────────────────────────────────────────────

describe('T022 — INVALID_CRITERIA_MODE', () => {
  it('errors when both percentage and fixed_count are set', async () => {
    const r = await validateAutoCriteria(
      makeInput([{ lesson_ids: ['L1'], percentage: 50, fixed_count: 5 }], pool())
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'INVALID_CRITERIA_MODE')).toBe(true)
  })

  it('errors when neither percentage nor fixed_count is set', async () => {
    const r = await validateAutoCriteria(makeInput([{ lesson_ids: ['L1'] }], pool()))
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'INVALID_CRITERIA_MODE')).toBe(true)
  })

  it('short-circuits — fetchEligiblePool not called on mode error', async () => {
    const fetchFn = pool()
    await validateAutoCriteria(makeInput([{ lesson_ids: ['L1'] }], fetchFn))
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('mode error produces exactly one error', async () => {
    const r = await validateAutoCriteria(makeInput([{ lesson_ids: ['L1'] }], pool()))
    expect(r.errors).toHaveLength(1)
  })
})

// ── CRITERIA_COUNT_MISMATCH ──────────────────────────────────────────────────

describe('T022 — CRITERIA_COUNT_MISMATCH', () => {
  it('errors when percentages do not sum to 100', async () => {
    const r = await validateAutoCriteria(
      makeInput(
        [
          pctBlock({ lesson_ids: ['L1'], percentage: 60 }),
          pctBlock({ lesson_ids: ['L2'], percentage: 30 }),
        ],
        pool(30)
      )
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'CRITERIA_COUNT_MISMATCH')).toBe(true)
  })

  it('errors when fixed_count sum < totalQuestions', async () => {
    const r = await validateAutoCriteria(
      makeInput(
        [
          fixedBlock({ category_ids: ['C1'], fixed_count: 3 }),
          fixedBlock({ category_ids: ['C2'], fixed_count: 4 }),
        ],
        pool(30),
        10
      )
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'CRITERIA_COUNT_MISMATCH')).toBe(true)
  })
})

// ── CRITERIA_OVERLAP_RISK ────────────────────────────────────────────────────

describe('T022 — CRITERIA_OVERLAP_RISK', () => {
  it('errors when two blocks share identical filter sets', async () => {
    const r = await validateAutoCriteria(
      makeInput(
        [
          pctBlock({ lesson_ids: ['X'], percentage: 50 }),
          pctBlock({ lesson_ids: ['X'], percentage: 50 }),
        ],
        pool(30)
      )
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'CRITERIA_OVERLAP_RISK')).toBe(true)
  })

  it('OVERLAP_RISK error has numeric blockIndex >= 1', async () => {
    const r = await validateAutoCriteria(
      makeInput(
        [
          pctBlock({ lesson_ids: ['X'], percentage: 50 }),
          pctBlock({ lesson_ids: ['X'], percentage: 50 }),
        ],
        pool(30)
      )
    )
    const err = r.errors.find((e) => e.code === 'CRITERIA_OVERLAP_RISK') as CriteriaValidationError
    expect(typeof err.blockIndex).toBe('number')
    expect(err.blockIndex!).toBeGreaterThanOrEqual(1)
  })
})

// ── UNDERSIZED_POOL ──────────────────────────────────────────────────────────

describe('T022 — UNDERSIZED_POOL', () => {
  it('errors when pool size < required count', async () => {
    const r = await validateAutoCriteria(
      makeInput(
        [fixedBlock({ fixed_count: 10 })],
        vi.fn().mockResolvedValue(['q1', 'q2', 'q3']),
        10
      )
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'UNDERSIZED_POOL')).toBe(true)
  })

  it('errors when pool is empty', async () => {
    const r = await validateAutoCriteria(
      makeInput([fixedBlock({ fixed_count: 5 })], emptyPool(), 5)
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'UNDERSIZED_POOL')).toBe(true)
  })

  it('UNDERSIZED_POOL error has blockIndex = 1 for the first block', async () => {
    const r = await validateAutoCriteria(
      makeInput([fixedBlock({ fixed_count: 10 })], emptyPool(), 10)
    )
    const err = r.errors.find((e) => e.code === 'UNDERSIZED_POOL') as CriteriaValidationError
    expect(err.blockIndex).toBe(1)
  })
})

// ── Shape invariants ─────────────────────────────────────────────────────────

describe('T022 — error shape invariants', () => {
  it('every error has non-empty code and message', async () => {
    const r = await validateAutoCriteria(
      makeInput([fixedBlock({ fixed_count: 10 })], emptyPool(), 10)
    )
    for (const e of r.errors) {
      expect(e.code.length).toBeGreaterThan(0)
      expect(e.message.length).toBeGreaterThan(0)
    }
  })

  it('valid = true paired with empty errors array', async () => {
    const r = await validateAutoCriteria(makeInput([pctBlock()], pool(20)))
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })
})

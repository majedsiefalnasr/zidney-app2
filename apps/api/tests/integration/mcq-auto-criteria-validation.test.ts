/**
 * Integration Tests: MCQ Auto-Criteria Validation
 *
 * File: apps/api/tests/integration/mcq-auto-criteria-validation.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T023
 *
 * Tests validateAutoCriteria with all four error conditions and multi-block
 * scenarios.  Uses mocked fetchEligiblePool — no real DB required.
 */

import type { FetchEligiblePoolFn } from '@zidney/domain-core/attempts/auto-selection.service'
import {
  type ValidateCriteriaInput,
  validateAutoCriteria,
} from '@zidney/domain-core/mcq-exams/mcq-auto-criteria-validation.service'
import type { CriteriaEntry } from '@zidney/domain-core/mcq-exams/mcq-exams.types'
import { describe, expect, it, vi } from 'vitest'

const WORKSPACE_ID = '10000000-0000-0000-0000-000000000001'
const EXAM_ID = '30000000-0000-0000-0000-000000000001'

const poolOf = (n: number): FetchEligiblePoolFn =>
  vi.fn().mockResolvedValue(Array.from({ length: n }, (_, i) => `q-${i}`))

const emptyPool = (): FetchEligiblePoolFn => vi.fn().mockResolvedValue([])

function input(
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

// ── Valid scenarios ───────────────────────────────────────────────────────────

describe('T023 — valid criteria', () => {
  it('accepts single 100% percentage block with adequate pool', async () => {
    const r = await validateAutoCriteria(
      input([{ lesson_ids: ['L1'], percentage: 100 }], poolOf(20))
    )
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('accepts two percentage blocks summing to 100', async () => {
    const r = await validateAutoCriteria(
      input(
        [
          { lesson_ids: ['L1'], percentage: 60 },
          { category_ids: ['C1'], percentage: 40 },
        ],
        poolOf(30)
      )
    )
    expect(r.valid).toBe(true)
  })

  it('accepts valid fixed_count block', async () => {
    const r = await validateAutoCriteria(
      input([{ category_ids: ['C1'], fixed_count: 5 }], poolOf(20), 5)
    )
    expect(r.valid).toBe(true)
  })
})

// ── INVALID_CRITERIA_MODE ─────────────────────────────────────────────────────

describe('T023 — INVALID_CRITERIA_MODE blocks save/publish', () => {
  it('blocks when both percentage and fixed_count set', async () => {
    const r = await validateAutoCriteria(
      input([{ lesson_ids: ['L1'], percentage: 50, fixed_count: 5 }], poolOf())
    )
    expect(r.valid).toBe(false)
    expect(r.errors[0]?.code).toBe('INVALID_CRITERIA_MODE')
  })

  it('blocks when neither percentage nor fixed_count set', async () => {
    const r = await validateAutoCriteria(input([{ lesson_ids: ['L1'] }], poolOf()))
    expect(r.valid).toBe(false)
    expect(r.errors[0]?.code).toBe('INVALID_CRITERIA_MODE')
  })

  it('does not call fetchEligiblePool on mode error', async () => {
    const fetch = poolOf()
    await validateAutoCriteria(input([{ lesson_ids: ['L1'] }], fetch))
    expect(fetch).not.toHaveBeenCalled()
  })
})

// ── CRITERIA_COUNT_MISMATCH ───────────────────────────────────────────────────

describe('T023 — CRITERIA_COUNT_MISMATCH blocks save/publish', () => {
  it('blocks when percentages do not sum to 100', async () => {
    const r = await validateAutoCriteria(
      input(
        [
          { lesson_ids: ['L1'], percentage: 60 },
          { lesson_ids: ['L2'], percentage: 30 },
        ],
        poolOf(30)
      )
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'CRITERIA_COUNT_MISMATCH')).toBe(true)
  })

  it('blocks when fixed totals do not equal totalQuestions', async () => {
    const r = await validateAutoCriteria(
      input([{ category_ids: ['C1'], fixed_count: 3 }], poolOf(30), 10)
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'CRITERIA_COUNT_MISMATCH')).toBe(true)
  })
})

// ── CRITERIA_OVERLAP_RISK ─────────────────────────────────────────────────────

describe('T023 — CRITERIA_OVERLAP_RISK blocks save/publish', () => {
  it('blocks when two blocks share identical filter sets', async () => {
    const r = await validateAutoCriteria(
      input(
        [
          { lesson_ids: ['L1'], percentage: 50 },
          { lesson_ids: ['L1'], percentage: 50 },
        ],
        poolOf(30)
      )
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'CRITERIA_OVERLAP_RISK')).toBe(true)
  })
})

// ── UNDERSIZED_POOL ───────────────────────────────────────────────────────────

describe('T023 — UNDERSIZED_POOL blocks save/publish', () => {
  it('blocks when pool smaller than required count', async () => {
    const r = await validateAutoCriteria(
      input(
        [{ category_ids: ['C1'], fixed_count: 10 }],
        vi.fn().mockResolvedValue(['q1', 'q2']),
        10
      )
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'UNDERSIZED_POOL')).toBe(true)
  })

  it('blocks when pool is empty', async () => {
    const r = await validateAutoCriteria(
      input([{ category_ids: ['C1'], fixed_count: 5 }], emptyPool(), 5)
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'UNDERSIZED_POOL')).toBe(true)
  })
})

// ── Multi-block mixed ─────────────────────────────────────────────────────────

describe('T023 — multi-block scenarios', () => {
  it('validates multiple criteria blocks independently', async () => {
    // First block valid, second block mode error
    const r = await validateAutoCriteria(
      input(
        [
          { lesson_ids: ['L-ok'], percentage: 100 },
          { category_ids: ['C-bad'], percentage: 50, fixed_count: 5 }, // invalid mode
        ],
        poolOf(30)
      )
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.code === 'INVALID_CRITERIA_MODE')).toBe(true)
  })
})

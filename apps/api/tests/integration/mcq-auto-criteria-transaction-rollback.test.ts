/**
 * Integration Tests: MCQ Auto-Criteria Transaction Rollback
 *
 * File: apps/api/tests/integration/mcq-auto-criteria-transaction-rollback.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T052
 *
 * Verifies that validateAutoCriteria returns a structured validation failure
 * without any partial-write side effects when criteria are invalid.
 * (Domain layer — no real DB transaction involved; guarantees the service
 * surface returns a clean failure, not a partial success.)
 */

import type { FetchEligiblePoolFn } from '@zidney/domain-core/attempts/auto-selection.service'
import { validateAutoCriteria } from '@zidney/domain-core/mcq-exams/mcq-auto-criteria-validation.service'
import type { CriteriaEntry } from '@zidney/domain-core/mcq-exams/mcq-exams.types'
import { describe, expect, it } from 'vitest'

const WORKSPACE = '10000000-0000-0000-0000-000000000001'
const EXAM = '30000000-0000-0000-0000-000000000001'

function makePool(size: number): FetchEligiblePoolFn {
  const ids = Array.from(
    { length: size },
    (_, i) => `60000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`
  )
  return async () => ids
}

describe('T052 — criteria validation: no partial state on failure', () => {
  it('returns valid=false with errors for INVALID_CRITERIA_MODE', async () => {
    const result = await validateAutoCriteria({
      workspaceId: WORKSPACE,
      examId: EXAM,
      totalQuestions: 10,
      criteria: [],
      fetchEligiblePool: makePool(50),
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
  })

  it('returns valid=false for mixed percentage+fixed criteria', async () => {
    const criteria: CriteriaEntry[] = [
      { lesson_ids: ['80000000-0000-0000-0000-000000000001'], percentage: 50 },
      { lesson_ids: ['80000000-0000-0000-0000-000000000002'], fixed_count: 5 },
    ]
    const result = await validateAutoCriteria({
      workspaceId: WORKSPACE,
      examId: EXAM,
      totalQuestions: 10,
      criteria,
      fetchEligiblePool: makePool(50),
    })
    expect(result.valid).toBe(false)
    expect(result.errors!.length).toBeGreaterThan(0)
  })

  it('errors array is non-empty on count mismatch', async () => {
    const criteria: CriteriaEntry[] = [
      { lesson_ids: ['80000000-0000-0000-0000-000000000001'], percentage: 60 },
      { lesson_ids: ['80000000-0000-0000-0000-000000000002'], percentage: 60 },
    ]
    const result = await validateAutoCriteria({
      workspaceId: WORKSPACE,
      examId: EXAM,
      totalQuestions: 10,
      criteria,
      fetchEligiblePool: makePool(50),
    })
    expect(result.valid).toBe(false)
    expect(result.errors!.some((e) => e.code === 'CRITERIA_COUNT_MISMATCH')).toBe(true)
  })

  it('no side-effect: calling validateAutoCriteria twice with same invalid input returns identical errors', async () => {
    const criteria: CriteriaEntry[] = []
    const [r1, r2] = await Promise.all([
      validateAutoCriteria({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: 10,
        criteria,
        fetchEligiblePool: makePool(50),
      }),
      validateAutoCriteria({
        workspaceId: WORKSPACE,
        examId: EXAM,
        totalQuestions: 10,
        criteria,
        fetchEligiblePool: makePool(50),
      }),
    ])
    expect(r1.valid).toBe(false)
    expect(r2.valid).toBe(false)
    expect(r1.errors!.map((e) => e.code)).toEqual(r2.errors!.map((e) => e.code))
  })

  it('valid result has no errors field or empty errors', async () => {
    const criteria: CriteriaEntry[] = [
      { lesson_ids: ['80000000-0000-0000-0000-000000000001'], percentage: 100 },
    ]
    const result = await validateAutoCriteria({
      workspaceId: WORKSPACE,
      examId: EXAM,
      totalQuestions: 5,
      criteria,
      fetchEligiblePool: makePool(50),
    })
    expect(result.valid).toBe(true)
    if (result.errors) {
      expect(result.errors).toHaveLength(0)
    }
  })
})

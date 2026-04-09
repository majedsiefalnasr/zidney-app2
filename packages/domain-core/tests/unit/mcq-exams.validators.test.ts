import { describe, expect, it } from 'vitest'
import {
  validateCriteriaMode,
  validateCriteriaSum,
  validateCriteriaTotalMatch,
  validatePassValue,
  validateTotalQuestions,
} from '../../src/mcq-exams/mcq-exams.validators'

describe('mcq-exams validators', () => {
  it('validatePassValue for PERCENTAGE and SCORE', () => {
    expect(validatePassValue('PERCENTAGE', 50).valid).toBe(true)
    expect(validatePassValue('PERCENTAGE', 0).valid).toBe(false)
    expect(validatePassValue('SCORE', 10).valid).toBe(true)
    expect(validatePassValue('SCORE', 0).valid).toBe(false)
  })

  it('validateCriteriaSum requires percentages sum to 100', () => {
    const ok = validateCriteriaSum({ criteria: [{ percentage: 50 }, { percentage: 50 }] } as any)
    expect(ok.valid).toBe(true)
    const bad = validateCriteriaSum({ criteria: [{ percentage: 30 }, { percentage: 40 }] } as any)
    expect(bad.valid).toBe(false)
  })

  it('validateTotalQuestions enforces positive integer', () => {
    expect(validateTotalQuestions(10).valid).toBe(true)
    expect(validateTotalQuestions(0).valid).toBe(false)
    expect(validateTotalQuestions(2.5).valid).toBe(false)
  })

  it('validateCriteriaMode enforces exclusive mode and ranges', () => {
    // empty
    expect(validateCriteriaMode([]).valid).toBe(false)

    // both set
    expect(validateCriteriaMode([{ percentage: 50, fixed_count: 1 }] as any).valid).toBe(false)

    // invalid percentage
    expect(validateCriteriaMode([{ percentage: 0 }] as any).valid).toBe(false)

    // valid fixed
    expect(validateCriteriaMode([{ fixed_count: 2 }] as any).valid).toBe(true)
  })

  it('validateCriteriaTotalMatch for percentage and fixed_count rules', () => {
    // percentage blocks sum 100
    const pctOk = validateCriteriaTotalMatch([{ percentage: 60 }, { percentage: 40 }] as any, 10)
    expect(pctOk.valid).toBe(true)

    const pctBad = validateCriteriaTotalMatch([{ percentage: 60 }, { percentage: 30 }] as any, 10)
    expect(pctBad.valid).toBe(false)

    // fixed_count sums to totalQuestions
    const fixedOk = validateCriteriaTotalMatch([{ fixed_count: 3 }, { fixed_count: 2 }] as any, 5)
    expect(fixedOk.valid).toBe(true)

    const fixedBad = validateCriteriaTotalMatch([{ fixed_count: 3 }, { fixed_count: 1 }] as any, 5)
    expect(fixedBad.valid).toBe(false)

    // mixed mode not allowed
    const mixed = validateCriteriaTotalMatch([{ percentage: 50 }, { fixed_count: 2 }] as any, 4)
    expect(mixed.valid).toBe(false)
  })
})

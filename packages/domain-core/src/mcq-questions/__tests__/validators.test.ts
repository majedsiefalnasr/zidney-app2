/**
 * MCQ Questions — Option Validators Unit Tests
 *
 * File: packages/domain-core/src/mcq-questions/__tests__/validators.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T035
 *
 * Tests validateOptionsForType() covering all 4 question types × valid/invalid configurations.
 */

import { describe, expect, it } from 'vitest'
import type { OptionInput } from '../mcq-questions.types'
import { validateOptionsForType } from '../mcq-questions.validators'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOption(overrides: Partial<OptionInput> = {}): OptionInput {
  return {
    content: 'Option content',
    is_correct: false,
    order_index: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Cross-type: duplicate order_index
// ---------------------------------------------------------------------------

describe('validateOptionsForType — duplicate order_index', () => {
  it('returns invalid when order_index values are duplicated', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 0 }),
    ]
    const result = validateOptionsForType('SINGLE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Duplicate order_index')
  })
})

// ---------------------------------------------------------------------------
// SINGLE
// ---------------------------------------------------------------------------

describe('validateOptionsForType — SINGLE', () => {
  it('valid: 2 options with exactly 1 correct', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 1 }),
    ]
    expect(validateOptionsForType('SINGLE', options)).toEqual({ valid: true })
  })

  it('valid: 4 options with exactly 1 correct', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 1 }),
      makeOption({ order_index: 2 }),
      makeOption({ order_index: 3 }),
    ]
    expect(validateOptionsForType('SINGLE', options)).toEqual({ valid: true })
  })

  it('invalid: fewer than 2 options', () => {
    const options: OptionInput[] = [makeOption({ order_index: 0, is_correct: true })]
    const result = validateOptionsForType('SINGLE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('at least 2')
  })

  it('invalid: 0 correct options', () => {
    const options: OptionInput[] = [makeOption({ order_index: 0 }), makeOption({ order_index: 1 })]
    const result = validateOptionsForType('SINGLE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('exactly 1 correct')
  })

  it('invalid: 2 correct options', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 1, is_correct: true }),
    ]
    const result = validateOptionsForType('SINGLE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('exactly 1 correct')
  })
})

// ---------------------------------------------------------------------------
// MULTIPLE
// ---------------------------------------------------------------------------

describe('validateOptionsForType — MULTIPLE', () => {
  it('valid: 3 options with 2 correct', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 1, is_correct: true }),
      makeOption({ order_index: 2 }),
    ]
    expect(validateOptionsForType('MULTIPLE', options)).toEqual({ valid: true })
  })

  it('valid: 4 options with 1 correct (minimum)', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 1 }),
      makeOption({ order_index: 2 }),
      makeOption({ order_index: 3 }),
    ]
    expect(validateOptionsForType('MULTIPLE', options)).toEqual({ valid: true })
  })

  it('invalid: fewer than 2 options', () => {
    const options: OptionInput[] = [makeOption({ order_index: 0, is_correct: true })]
    const result = validateOptionsForType('MULTIPLE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('at least 2')
  })

  it('invalid: 0 correct options', () => {
    const options: OptionInput[] = [makeOption({ order_index: 0 }), makeOption({ order_index: 1 })]
    const result = validateOptionsForType('MULTIPLE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('at least 1 correct')
  })
})

// ---------------------------------------------------------------------------
// TRUE_FALSE
// ---------------------------------------------------------------------------

describe('validateOptionsForType — TRUE_FALSE', () => {
  it('valid: exactly 2 options with 1 correct', () => {
    const options: OptionInput[] = [
      makeOption({ content: 'True', order_index: 0, is_correct: true }),
      makeOption({ content: 'False', order_index: 1 }),
    ]
    expect(validateOptionsForType('TRUE_FALSE', options)).toEqual({ valid: true })
  })

  it('invalid: 3 options', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 1 }),
      makeOption({ order_index: 2 }),
    ]
    const result = validateOptionsForType('TRUE_FALSE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('exactly 2 options')
  })

  it('invalid: 1 option', () => {
    const options: OptionInput[] = [makeOption({ order_index: 0, is_correct: true })]
    const result = validateOptionsForType('TRUE_FALSE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('exactly 2 options')
  })

  it('invalid: 2 options with 0 correct', () => {
    const options: OptionInput[] = [makeOption({ order_index: 0 }), makeOption({ order_index: 1 })]
    const result = validateOptionsForType('TRUE_FALSE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('exactly 1 correct')
  })

  it('invalid: 2 options with 2 correct', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 1, is_correct: true }),
    ]
    const result = validateOptionsForType('TRUE_FALSE', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('exactly 1 correct')
  })
})

// ---------------------------------------------------------------------------
// ARRANGEMENT
// ---------------------------------------------------------------------------

describe('validateOptionsForType — ARRANGEMENT', () => {
  it('valid: 3 options (is_correct ignored)', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0 }),
      makeOption({ order_index: 1 }),
      makeOption({ order_index: 2 }),
    ]
    expect(validateOptionsForType('ARRANGEMENT', options)).toEqual({ valid: true })
  })

  it('valid: 2 options (minimum boundary)', () => {
    const options: OptionInput[] = [makeOption({ order_index: 0 }), makeOption({ order_index: 1 })]
    expect(validateOptionsForType('ARRANGEMENT', options)).toEqual({ valid: true })
  })

  it('invalid: fewer than 2 options', () => {
    const options: OptionInput[] = [makeOption({ order_index: 0 })]
    const result = validateOptionsForType('ARRANGEMENT', options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('at least 2')
  })

  it('valid: is_correct values are ignored for ARRANGEMENT', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 1, is_correct: true }),
      makeOption({ order_index: 2, is_correct: false }),
    ]
    expect(validateOptionsForType('ARRANGEMENT', options)).toEqual({ valid: true })
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('validateOptionsForType — edge cases', () => {
  it('returns invalid for unknown question type', () => {
    const options: OptionInput[] = [
      makeOption({ order_index: 0, is_correct: true }),
      makeOption({ order_index: 1 }),
    ]
    const result = validateOptionsForType('UNKNOWN' as any, options)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Unknown question type')
  })
})

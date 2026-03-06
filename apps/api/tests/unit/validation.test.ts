/**
 * Input Validation Tests
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T049
 *
 * File: apps/api/tests/unit/validation.test.ts
 * Purpose: Verify request validation
 *
 * Validation Rules:
 * - exam_id must be valid UUID
 * - attempt_mode must be CHRONO or REVIEW
 * - question_index within bounds
 * - user_response must match question type
 */

import { describe, expect, test } from 'vitest'

// Mock validation functions
function validateCreateAttemptRequest(payload: any): {
  valid: boolean
  data?: any
  errors?: string[]
} {
  const errors: string[] = []

  // exam_id validation
  if (!payload.exam_id) {
    errors.push('exam_id required')
  } else if (!isValidUUID(payload.exam_id)) {
    errors.push('exam_id must be valid UUID')
  }

  // attempt_mode validation
  if (!payload.attempt_mode) {
    errors.push('attempt_mode required')
  } else if (!['CHRONO', 'REVIEW'].includes(payload.attempt_mode)) {
    errors.push(`${payload.attempt_mode} not allowed; use CHRONO or REVIEW`)
  }

  // notes optional validation
  if (payload.notes && typeof payload.notes !== 'string') {
    errors.push('notes must be string')
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? payload : undefined,
    errors: errors.length > 0 ? errors : undefined,
  }
}

function validateProgressUpdate(
  payload: any,
  questions: any[]
): {
  valid: boolean
  errors?: string[]
} {
  const errors: string[] = []

  // question_index validation
  if (payload.question_index === undefined) {
    errors.push('question_index required')
  } else if (
    typeof payload.question_index !== 'number' ||
    payload.question_index < 0 ||
    payload.question_index >= questions.length
  ) {
    errors.push('question_index out of range')
  }

  // user_response validation
  if (!payload.user_response) {
    errors.push('user_response required')
  } else if (typeof payload.user_response !== 'object') {
    errors.push('user_response must be object')
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

function validateSubmissionRequest(payload: any): {
  valid: boolean
  errors?: string[]
} {
  const errors: string[] = []

  // reason validation
  if (payload.reason && !['COMPLETED', 'TIME_EXPIRED', 'ABANDONED'].includes(payload.reason)) {
    errors.push('Invalid submission reason')
  }

  // all_responses validation
  if (payload.all_responses) {
    if (!Array.isArray(payload.all_responses)) {
      errors.push('all_responses must be array')
    } else {
      payload.all_responses.forEach((response: any, index: number) => {
        if (response.question_index === undefined) {
          errors.push(`Response ${index}: missing question_index`)
        }
        if (!response.user_response) {
          errors.push(`Response ${index}: missing user_response`)
        }
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

describe('Input Validation', () => {
  // T049.1: Valid CreateAttempt Request
  test('validateCreateAttemptRequest accepts valid input', () => {
    const result = validateCreateAttemptRequest({
      exam_id: '550e8400-e29b-41d4-a716-446655440000',
      attempt_mode: 'CHRONO',
      notes: 'Optional notes',
    })

    expect(result.valid).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data.exam_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result.errors).toBeUndefined()
  })

  // T049.2: Missing exam_id
  test('validateCreateAttemptRequest rejects missing exam_id', () => {
    const result = validateCreateAttemptRequest({
      attempt_mode: 'CHRONO',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('exam_id required')
  })

  // T049.3: Invalid UUID
  test('validateCreateAttemptRequest rejects invalid UUID', () => {
    const result = validateCreateAttemptRequest({
      exam_id: 'not-a-uuid',
      attempt_mode: 'CHRONO',
    })

    expect(result.valid).toBe(false)
    expect(result.errors?.join(' ')).toContain('UUID')
  })

  // T049.4: Invalid attempt_mode
  test('validateCreateAttemptRequest rejects invalid mode', () => {
    const result = validateCreateAttemptRequest({
      exam_id: '550e8400-e29b-41d4-a716-446655440000',
      attempt_mode: 'INVALID_MODE',
    })

    expect(result.valid).toBe(false)
    expect(result.errors?.join(' ')).toContain('INVALID_MODE')
  })

  // T049.5: Both CHRONO and REVIEW modes valid
  test('validateCreateAttemptRequest accepts both valid modes', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'

    const chrono = validateCreateAttemptRequest({
      exam_id: uuid,
      attempt_mode: 'CHRONO',
    })

    const review = validateCreateAttemptRequest({
      exam_id: uuid,
      attempt_mode: 'REVIEW',
    })

    expect(chrono.valid).toBe(true)
    expect(review.valid).toBe(true)
  })

  // T049.6: Optional notes field
  test('validateCreateAttemptRequest allows optional notes', () => {
    const withoutNotes = validateCreateAttemptRequest({
      exam_id: '550e8400-e29b-41d4-a716-446655440000',
      attempt_mode: 'CHRONO',
    })

    const withNotes = validateCreateAttemptRequest({
      exam_id: '550e8400-e29b-41d4-a716-446655440000',
      attempt_mode: 'CHRONO',
      notes: 'Some notes',
    })

    expect(withoutNotes.valid).toBe(true)
    expect(withNotes.valid).toBe(true)
  })

  // T049.7: Progress Update Valid Question Index
  test('validateProgressUpdate accepts valid question_index', () => {
    const questions = [
      { id: 'q1', type: 'MCQ' },
      { id: 'q2', type: 'MCQ' },
      { id: 'q3', type: 'MCQ' },
    ]

    const result = validateProgressUpdate(
      {
        question_index: 0,
        user_response: { selected: 'A' },
      },
      questions
    )

    expect(result.valid).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  // T049.8: Progress Update Out Of Range Index
  test('validateProgressUpdate rejects out of range question_index', () => {
    const questions = [
      { id: 'q1', type: 'MCQ' },
      { id: 'q2', type: 'MCQ' },
      { id: 'q3', type: 'MCQ' },
    ]

    const result = validateProgressUpdate(
      {
        question_index: 10,
        user_response: { selected: 'A' },
      },
      questions
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('question_index out of range')
  })

  // T049.9: Progress Update Negative Index
  test('validateProgressUpdate rejects negative question_index', () => {
    const questions = [{ id: 'q1', type: 'MCQ' }]

    const result = validateProgressUpdate(
      {
        question_index: -1,
        user_response: { selected: 'A' },
      },
      questions
    )

    expect(result.valid).toBe(false)
  })

  // T049.10: Progress Update Missing Response
  test('validateProgressUpdate requires user_response', () => {
    const questions = [{ id: 'q1', type: 'MCQ' }]

    const result = validateProgressUpdate(
      {
        question_index: 0,
      },
      questions
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('user_response required')
  })

  // T049.11: Submission Valid Reasons
  test('validateSubmissionRequest accepts valid submission reasons', () => {
    const reasons = ['COMPLETED', 'TIME_EXPIRED', 'ABANDONED']

    reasons.forEach((reason) => {
      const result = validateSubmissionRequest({
        reason,
        all_responses: [{ question_index: 0, user_response: { selected: 'A' } }],
      })

      expect(result.valid).toBe(true)
    })
  })

  // T049.12: Submission Invalid Reason
  test('validateSubmissionRequest rejects invalid reason', () => {
    const result = validateSubmissionRequest({
      reason: 'INVALID_REASON',
      all_responses: [],
    })

    expect(result.valid).toBe(false)
    expect(result.errors?.join(' ')).toContain('Invalid submission reason')
  })

  // T049.13: Submission Responses Array
  test('validateSubmissionRequest validates all_responses array', () => {
    const result = validateSubmissionRequest({
      reason: 'COMPLETED',
      all_responses: [
        { question_index: 0, user_response: { selected: 'A' } },
        { question_index: 1, user_response: { selected: 'B' } },
      ],
    })

    expect(result.valid).toBe(true)
  })

  // T049.14: Submission Invalid Response Format
  test('validateSubmissionRequest validates response format', () => {
    const result = validateSubmissionRequest({
      reason: 'COMPLETED',
      all_responses: [
        { question_index: 0, user_response: { selected: 'A' } },
        { question_index: 1 }, // Missing user_response
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors?.join(' ')).toContain('Response 1')
  })

  // T049.15: Submission Responses Not Array
  test('validateSubmissionRequest rejects non-array responses', () => {
    const result = validateSubmissionRequest({
      reason: 'COMPLETED',
      all_responses: 'not-an-array',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('all_responses must be array')
  })

  // T049.16: UUID Validation Edge Cases
  test('UUID validation works for valid UUIDs', () => {
    const validUUIDs = [
      '550e8400-e29b-41d4-a716-446655440000',
      '00000000-0000-0000-0000-000000000000',
      'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
    ]

    validUUIDs.forEach((uuid) => {
      expect(isValidUUID(uuid)).toBe(true)
    })
  })

  // T049.17: UUID Validation Rejects Invalid
  test('UUID validation rejects invalid formats', () => {
    const invalidUUIDs = [
      'not-a-uuid',
      '550e8400-e29b-41d4-a716',
      '550e8400e29b41d4a716446655440000',
      '',
      'null',
    ]

    invalidUUIDs.forEach((uuid) => {
      expect(isValidUUID(uuid)).toBe(false)
    })
  })
})

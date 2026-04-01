/**
 * MCQ Exams — Domain Validators
 *
 * File: packages/domain-core/src/mcq-exams/mcq-exams.validators.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Application-layer validation rules for MCQ exam business logic.
 * These complement database constraints and are used by the service layer.
 */

import type { McqExamPassType, SetCriteriaInput } from './mcq-exams.types'

export interface ValidationResult {
  valid: boolean
  reason?: string
}

/**
 * Validate pass_value is within acceptable range for the given pass_type.
 * - PERCENTAGE: 0 < value <= 100
 * - SCORE: value > 0
 */
export function validatePassValue(passType: McqExamPassType, passValue: number): ValidationResult {
  if (passType === 'PERCENTAGE') {
    if (passValue <= 0 || passValue > 100) {
      return {
        valid: false,
        reason: `PERCENTAGE pass_value must be > 0 and <= 100, got ${passValue}`,
      }
    }
  } else if (passType === 'SCORE') {
    if (passValue <= 0) {
      return { valid: false, reason: `SCORE pass_value must be > 0, got ${passValue}` }
    }
  }
  return { valid: true }
}

/**
 * Validate that auto criteria percentages sum to exactly 100.
 */
export function validateCriteriaSum(input: SetCriteriaInput): ValidationResult {
  if (input.criteria.length === 0) {
    return { valid: false, reason: 'At least one criteria entry is required' }
  }

  const sum = input.criteria.reduce((acc, c) => acc + c.percentage, 0)
  if (sum !== 100) {
    return { valid: false, reason: `Criteria percentages must sum to 100, got ${sum}` }
  }

  return { valid: true }
}

/**
 * Validate total_questions is a positive integer.
 */
export function validateTotalQuestions(totalQuestions: number): ValidationResult {
  if (totalQuestions <= 0 || !Number.isInteger(totalQuestions)) {
    return {
      valid: false,
      reason: `total_questions must be a positive integer, got ${totalQuestions}`,
    }
  }
  return { valid: true }
}

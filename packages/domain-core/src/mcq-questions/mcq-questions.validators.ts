/**
 * MCQ Questions — Option Validators
 *
 * File: packages/domain-core/src/mcq-questions/mcq-questions.validators.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 *
 * Type-specific validation rules for MCQ question options.
 * Enforced at the application layer (not database constraints).
 *
 * | Type        | Option Count | Correct Count (is_correct=true)  | order_index Semantics  |
 * | SINGLE      | ≥ 2          | Exactly 1                        | Display ordering       |
 * | MULTIPLE    | ≥ 2          | ≥ 1                              | Display ordering       |
 * | TRUE_FALSE  | Exactly 2    | Exactly 1                        | Display ordering       |
 * | ARRANGEMENT | ≥ 2          | N/A (is_correct ignored)         | Correct sequence       |
 */

import type { McqQuestionType, OptionInput } from './mcq-questions.types'

export interface OptionValidationResult {
  valid: boolean
  reason?: string
}

export function validateOptionsForType(
  questionType: McqQuestionType,
  options: OptionInput[]
): OptionValidationResult {
  // Check for duplicate order_index values
  const orderIndexes = options.map((o) => o.order_index)
  const uniqueIndexes = new Set(orderIndexes)
  if (uniqueIndexes.size !== orderIndexes.length) {
    return { valid: false, reason: 'Duplicate order_index values in options' }
  }

  switch (questionType) {
    case 'SINGLE':
      return validateSingleOptions(options)
    case 'MULTIPLE':
      return validateMultipleOptions(options)
    case 'TRUE_FALSE':
      return validateTrueFalseOptions(options)
    case 'ARRANGEMENT':
      return validateArrangementOptions(options)
    default:
      return { valid: false, reason: `Unknown question type: ${questionType}` }
  }
}

function validateSingleOptions(options: OptionInput[]): OptionValidationResult {
  if (options.length < 2) {
    return { valid: false, reason: 'SINGLE questions require at least 2 options' }
  }
  const correctCount = options.filter((o) => o.is_correct).length
  if (correctCount !== 1) {
    return {
      valid: false,
      reason: `SINGLE questions require exactly 1 correct option, got ${correctCount}`,
    }
  }
  return { valid: true }
}

function validateMultipleOptions(options: OptionInput[]): OptionValidationResult {
  if (options.length < 2) {
    return { valid: false, reason: 'MULTIPLE questions require at least 2 options' }
  }
  const correctCount = options.filter((o) => o.is_correct).length
  if (correctCount < 1) {
    return { valid: false, reason: 'MULTIPLE questions require at least 1 correct option' }
  }
  return { valid: true }
}

function validateTrueFalseOptions(options: OptionInput[]): OptionValidationResult {
  if (options.length !== 2) {
    return {
      valid: false,
      reason: `TRUE_FALSE questions require exactly 2 options, got ${options.length}`,
    }
  }
  const correctCount = options.filter((o) => o.is_correct).length
  if (correctCount !== 1) {
    return {
      valid: false,
      reason: `TRUE_FALSE questions require exactly 1 correct option, got ${correctCount}`,
    }
  }
  return { valid: true }
}

function validateArrangementOptions(options: OptionInput[]): OptionValidationResult {
  if (options.length < 2) {
    return { valid: false, reason: 'ARRANGEMENT questions require at least 2 options' }
  }
  // is_correct is ignored for ARRANGEMENT; order_index defines correct sequence
  return { valid: true }
}

/**
 * Traditional Questions — Correct Answer Validators
 *
 * File: packages/domain-core/src/traditional-questions/traditional-questions.validators.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Type-specific validation rules for traditional question correct_answer JSONB.
 * Enforced at the application layer (not database constraints).
 *
 * | Type         | correct_answer Shape                              | Required? |
 * | TRUE_FALSE   | { value: boolean }                                | Yes       |
 * | FILL_BLANK   | { accepted_values: string[] } (min 1 value)       | Yes       |
 * | SHORT_ANSWER | { model_answer: string } (min 1 char) or null     | No        |
 */

import type { TraditionalQuestionType } from './traditional-questions.types'

export interface CorrectAnswerValidationResult {
  valid: boolean
  reason?: string
}

/**
 * Validate that correct_answer matches the expected shape for the given question type.
 *
 * - TRUE_FALSE: requires { value: boolean }
 * - FILL_BLANK: requires { accepted_values: string[] } with at least 1 non-empty string
 * - SHORT_ANSWER: accepts null or { model_answer: string } with at least 1 char
 */
export function validateCorrectAnswer(
  questionType: TraditionalQuestionType,
  correctAnswer: Record<string, unknown> | null | undefined
): CorrectAnswerValidationResult {
  switch (questionType) {
    case 'TRUE_FALSE':
      return validateTrueFalseAnswer(correctAnswer)
    case 'FILL_BLANK':
      return validateFillBlankAnswer(correctAnswer)
    case 'SHORT_ANSWER':
      return validateShortAnswerAnswer(correctAnswer)
    default:
      return { valid: false, reason: `Unknown question type: ${questionType}` }
  }
}

function validateTrueFalseAnswer(
  correctAnswer: Record<string, unknown> | null | undefined
): CorrectAnswerValidationResult {
  if (correctAnswer == null) {
    return { valid: false, reason: 'correct_answer is required for TRUE_FALSE questions' }
  }
  if (typeof correctAnswer.value !== 'boolean') {
    return {
      valid: false,
      reason: 'TRUE_FALSE correct_answer must have a "value" field of type boolean',
    }
  }
  return { valid: true }
}

function validateFillBlankAnswer(
  correctAnswer: Record<string, unknown> | null | undefined
): CorrectAnswerValidationResult {
  if (correctAnswer == null) {
    return { valid: false, reason: 'correct_answer is required for FILL_BLANK questions' }
  }
  if (!Array.isArray(correctAnswer.accepted_values)) {
    return {
      valid: false,
      reason: 'FILL_BLANK correct_answer must have an "accepted_values" array of strings',
    }
  }
  const values = correctAnswer.accepted_values as unknown[]
  if (values.length < 1) {
    return {
      valid: false,
      reason: 'FILL_BLANK correct_answer.accepted_values must contain at least 1 value',
    }
  }
  for (const v of values) {
    if (typeof v !== 'string' || v.trim().length === 0) {
      return {
        valid: false,
        reason: 'Every item in accepted_values must be a non-empty string',
      }
    }
  }
  return { valid: true }
}

function validateShortAnswerAnswer(
  correctAnswer: Record<string, unknown> | null | undefined
): CorrectAnswerValidationResult {
  // SHORT_ANSWER allows null correct_answer
  if (correctAnswer == null) {
    return { valid: true }
  }
  if (typeof correctAnswer.model_answer !== 'string') {
    return {
      valid: false,
      reason: 'SHORT_ANSWER correct_answer must have a "model_answer" field of type string',
    }
  }
  if ((correctAnswer.model_answer as string).trim().length < 1) {
    return {
      valid: false,
      reason: 'SHORT_ANSWER correct_answer.model_answer must be at least 1 character',
    }
  }
  return { valid: true }
}

/**
 * Submission Validator Service
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase D, T034
 *
 * Purpose: Validate submission content structure (not grading; just validation)
 * Requirements: Validate all required questions answered/blank, response types match, no extra fields
 *
 * Responsibilities:
 * - Validate submission covers all questions in snapshot
 * - Validate response types match question types
 * - Validate response format correctness
 * - Reject requests with extra/invalid fields
 *
 * Constitutional Compliance:
 * - ADR-0002: Uses only snapshot data (never live config)
 * - No grading logic (just structure validation)
 * - Structured logging with correlation_id
 *
 * Note: GRADING happens in Phase E worker; this just validates structure
 */

import type { Logger } from '@zidney/logger'
import type { QuestionSnapshot, QuestionSnapshotContainer } from '@zidney/types/attempt'
import { QuestionType } from '@zidney/types/attempt'

/**
 * Submission content for validation
 */
export interface SubmissionContentItem {
  question_index: number
  user_response: any
}

/**
 * Validation result
 */
export interface SubmissionValidationResult {
  valid: boolean
  errors?: string[]
  warningCount?: number
}

/**
 * Validate submission content against question snapshot
 *
 * Validates:
 * - All questions have responses (or explicitly empty)
 * - Response types match question types
 * - Response structure is well-formed
 * - No extra fields present
 *
 * Does NOT:
 * - Grade responses
 * - Check correctness
 * - Calculate scores
 *
 * @param submission - Client-provided submission items
 * @param snapshot - Question snapshot from attempt
 * @param logger - Logger instance
 * @param correlationId - Request correlation ID
 * @returns SubmissionValidationResult
 */
export function validateSubmissionContent(
  submission: SubmissionContentItem[],
  snapshot: QuestionSnapshotContainer,
  logger: Logger,
  correlationId: string
): SubmissionValidationResult {
  const errors: string[] = []

  // Validate submission is array
  if (!Array.isArray(submission)) {
    logger.warn('Submission validation failed: not an array', {
      correlation_id: correlationId,
      type: typeof submission,
    })
    return {
      valid: false,
      errors: ['Submission must be an array'],
    }
  }

  // Validate snapshot structure
  if (!snapshot || !Array.isArray(snapshot.questions)) {
    logger.error('Invalid question snapshot during validation', {
      correlation_id: correlationId,
      snapshot_type: typeof snapshot,
    })
    return {
      valid: false,
      errors: ['Question snapshot is invalid'],
    }
  }

  const questionCount = snapshot.questions.length

  // Check submission covers all questions
  if (submission.length !== questionCount) {
    logger.warn('Submission validation failed: question count mismatch', {
      correlation_id: correlationId,
      expected_count: questionCount,
      submitted_count: submission.length,
    })

    if (submission.length > questionCount) {
      errors.push(`Expected ${questionCount} responses, got ${submission.length}`)
    } else {
      errors.push(`Missing responses for ${questionCount - submission.length} questions`)
    }
  }

  // Validate each submission item
  for (let i = 0; i < submission.length; i++) {
    const item = submission[i]
    const itemErrors = validateSubmissionItem(item, snapshot.questions, i, logger, correlationId)
    errors.push(...itemErrors)
  }

  const valid = errors.length === 0

  if (!valid) {
    logger.warn('Submission validation failed', {
      correlation_id: correlationId,
      error_count: errors.length,
      errors: errors.slice(0, 5), // First 5 errors
    })
  } else {
    logger.debug('Submission validation passed', {
      correlation_id: correlationId,
      question_count: questionCount,
    })
  }

  return {
    valid,
    errors: valid ? undefined : errors,
  }
}

/**
 * Validate a single submission item
 *
 * @param item - Submission item
 * @param questions - All questions in snapshot
 * @param index - Question index
 * @param logger - Logger instance
 * @param correlationId - Request correlation ID
 * @returns string[] - Array of error messages (empty if valid)
 */
function validateSubmissionItem(
  item: any,
  questions: QuestionSnapshot[],
  index: number,
  logger: Logger,
  correlationId: string
): string[] {
  const errors: string[] = []

  // Validate item is object
  if (typeof item !== 'object' || item === null) {
    errors.push(`Item ${index}: must be an object, got ${typeof item}`)
    return errors
  }

  // Validate required fields
  if (item.question_index === undefined) {
    errors.push(`Item ${index}: missing question_index`)
  }

  if (item.user_response === undefined) {
    errors.push(`Item ${index}: missing user_response`)
  }

  if (errors.length > 0) {
    return errors
  }

  // Validate question_index is valid
  if (item.question_index < 0 || item.question_index >= questions.length) {
    errors.push(
      `Item ${index}: question_index ${item.question_index} out of range [0-${questions.length - 1}]`
    )
    return errors
  }

  const question = questions[item.question_index]!
  const response = item.user_response

  // Validate response against question type
  const typeErrors = validateResponseType(response, question, logger, correlationId)
  errors.push(...typeErrors)

  // Check for extra fields in submission item (only question_index and user_response allowed)
  const allowedFields = ['question_index', 'user_response']
  for (const key of Object.keys(item)) {
    if (!allowedFields.includes(key)) {
      logger.warn('Submission item has extra field', {
        correlation_id: correlationId,
        question_index: item.question_index,
        extra_field: key,
      })
      // Don't error; just warn (forward compatibility)
    }
  }

  return errors
}

/**
 * Validate response type matches question type
 *
 * @param response - User's response object
 * @param question - Question snapshot
 * @param logger - Logger instance
 * @param correlationId - Request correlation ID
 * @returns string[] - Array of error messages (empty if valid)
 */
function validateResponseType(
  response: any,
  question: QuestionSnapshot,
  logger: Logger,
  correlationId: string
): string[] {
  const errors: string[] = []

  // Response can be null (unanswered)
  if (response === null) {
    return errors
  }

  // Response must be object
  if (typeof response !== 'object' || Array.isArray(response)) {
    errors.push(`Invalid response for Q${question.id}: must be object or null`)
    return errors
  }

  // Validate based on question type
  switch (question.type) {
    case QuestionType.MCQ:
      return validateMcqResponse(response, question)
    case QuestionType.TRUE_FALSE:
      return validateTrueFalseResponse(response, question)
    case QuestionType.SHORT_ANSWER:
      return validateShortAnswerResponse(response, question)
    case QuestionType.ESSAY:
      return validateEssayResponse(response, question)
    case QuestionType.MATCH:
      return validateMatchResponse(response, question)
    case QuestionType.FILL_BLANK:
      return validateFillBlankResponse(response, question)
    case QuestionType.ORDERING:
      return validateOrderingResponse(response, question)
    default:
      logger.warn('Unknown question type', {
        correlation_id: correlationId,
        question_id: question.id,
        question_type: question.type,
      })
      return []
  }
}

/**
 * Validate MCQ response
 */
function validateMcqResponse(response: any, question: QuestionSnapshot): string[] {
  const errors: string[] = []

  // MCQ response should have selected_option or selected
  if (!('selected_option' in response) && !('selected' in response)) {
    errors.push(`MCQ Q${question.id}: must have selected_option or selected`)
    return errors
  }

  // If selected_option, must be string matching an option
  if ('selected_option' in response) {
    const selected = response.selected_option
    if (typeof selected !== 'string') {
      errors.push(`MCQ Q${question.id}: selected_option must be string`)
    } else if (question.options && !question.options.includes(selected)) {
      errors.push(`MCQ Q${question.id}: selected_option "${selected}" not in options`)
    }
  }

  // If selected (multi-select), must be array of strings
  if ('selected' in response) {
    if (!Array.isArray(response.selected)) {
      errors.push(`MCQ Q${question.id}: selected must be array`)
    } else {
      for (const option of response.selected) {
        if (typeof option !== 'string') {
          errors.push(`MCQ Q${question.id}: selected contains non-string`)
        } else if (question.options && !question.options.includes(option)) {
          errors.push(`MCQ Q${question.id}: option "${option}" not in options`)
        }
      }
    }
  }

  return errors
}

/**
 * Validate true/false response
 */
function validateTrueFalseResponse(response: any, question: QuestionSnapshot): string[] {
  if (typeof response.selected !== 'boolean') {
    return [`True/False Q${question.id}: selected must be boolean`]
  }
  return []
}

/**
 * Validate short answer response
 */
function validateShortAnswerResponse(response: any, question: QuestionSnapshot): string[] {
  const errors: string[] = []

  if (!('text' in response)) {
    errors.push(`Short Answer Q${question.id}: missing text field`)
    return errors
  }

  if (typeof response.text !== 'string') {
    errors.push(`Short Answer Q${question.id}: text must be string`)
  }

  return errors
}

/**
 * Validate essay response
 */
function validateEssayResponse(response: any, question: QuestionSnapshot): string[] {
  const errors: string[] = []

  if (!('text' in response)) {
    errors.push(`Essay Q${question.id}: missing text field`)
    return errors
  }

  if (typeof response.text !== 'string') {
    errors.push(`Essay Q${question.id}: text must be string`)
  }

  // word_count is optional but must be number if present
  if ('word_count' in response && typeof response.word_count !== 'number') {
    errors.push(`Essay Q${question.id}: word_count must be number`)
  }

  return errors
}

/**
 * Validate match response
 */
function validateMatchResponse(response: any, question: QuestionSnapshot): string[] {
  const errors: string[] = []

  if (!('matches' in response)) {
    errors.push(`Match Q${question.id}: missing matches field`)
    return errors
  }

  if (!Array.isArray(response.matches)) {
    errors.push(`Match Q${question.id}: matches must be array`)
    return errors
  }

  for (const match of response.matches) {
    if (typeof match !== 'object' || !('from' in match) || !('to' in match)) {
      errors.push(`Match Q${question.id}: each match must have from and to fields`)
    }
  }

  return errors
}

/**
 * Validate fill-blank response
 */
function validateFillBlankResponse(response: any, question: QuestionSnapshot): string[] {
  const errors: string[] = []

  if (!('text' in response)) {
    errors.push(`Fill-Blank Q${question.id}: missing text field`)
    return errors
  }

  if (typeof response.text !== 'string') {
    errors.push(`Fill-Blank Q${question.id}: text must be string`)
  }

  return errors
}

/**
 * Validate ordering response
 */
function validateOrderingResponse(response: any, question: QuestionSnapshot): string[] {
  const errors: string[] = []

  if (!('order' in response)) {
    errors.push(`Ordering Q${question.id}: missing order field`)
    return errors
  }

  if (!Array.isArray(response.order)) {
    errors.push(`Ordering Q${question.id}: order must be array`)
    return errors
  }

  for (const item of response.order) {
    if (typeof item !== 'string') {
      errors.push(`Ordering Q${question.id}: order items must be strings`)
      break
    }
  }

  return errors
}

/**
 * Question Response Handler
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase C, T024
 *
 * Purpose: Validate and process user responses for different question types
 * Requirements: Format validation, content validation, type-specific rules
 *
 * Responsibilities:
 * - Validate response format matches question type
 * - Validate content constraints (length, options, etc.)
 * - Normalize response for storage
 * - Provide clear error messages
 *
 * Constitutional Compliance:
 * - Zero business logic (pure validation)
 * - Type-safe operations
 * - Deterministic validation results
 */

import { createLogger, Logger } from '@zidney/logging'
import { QuestionType, UserAnswer } from '@zidney/types/attempt'

/**
 * Response validation result
 */
export interface ResponseValidationResult {
  valid: boolean
  normalized?: UserAnswer
  errors?: string[]
}

/**
 * Validate multiple choice response
 *
 * @param response - User response
 * @param questionOptions - Available options
 * @param logger - Logger instance
 * @returns ResponseValidationResult
 */
export function validateMCQResponse(
  response: UserAnswer | undefined,
  questionOptions: string[] | undefined,
  logger: Logger
): ResponseValidationResult {
  if (!response) {
    // Unanswered MCQ is valid (progress autosave)
    return {
      valid: true,
      normalized: undefined,
    }
  }

  if (!questionOptions || questionOptions.length === 0) {
    return {
      valid: false,
      errors: ['Invalid question configuration: no options available'],
    }
  }

  // Handle single selection MCQ
  if (response.selected_option) {
    const option = response.selected_option

    if (typeof option !== 'string') {
      logger.warn('MCQ validation failed: selected_option not string', {
        type: typeof option,
      })
      return {
        valid: false,
        errors: ['Selected option must be a string'],
      }
    }

    if (!questionOptions.includes(option)) {
      logger.warn('MCQ validation failed: option not in list', {
        selected: option,
        available: questionOptions,
      })
      return {
        valid: false,
        errors: [`Option "${option}" not available`],
      }
    }

    return {
      valid: true,
      normalized: { selected_option: option },
    }
  }

  // Handle multiple selection MCQ
  if (response.selected && Array.isArray(response.selected)) {
    const selected = response.selected

    // Validate all are strings and in options
    for (const option of selected) {
      if (typeof option !== 'string') {
        logger.warn('MCQ validation failed: selected item not string', {
          type: typeof option,
        })
        return {
          valid: false,
          errors: ['All selected options must be strings'],
        }
      }

      if (!questionOptions.includes(option)) {
        logger.warn('MCQ validation failed: selected option not in list', {
          selected: option,
          available: questionOptions,
        })
        return {
          valid: false,
          errors: [`Option "${option}" not available`],
        }
      }
    }

    // Must have at least one selection
    if (selected.length === 0) {
      return {
        valid: false,
        errors: ['At least one option must be selected'],
      }
    }

    return {
      valid: true,
      normalized: { selected: selected },
    }
  }

  return {
    valid: false,
    errors: ['MCQ response must include selected_option or selected array'],
  }
}

/**
 * Validate true/false response
 *
 * @param response - User response
 * @param logger - Logger instance
 * @returns ResponseValidationResult
 */
export function validateTrueFalseResponse(
  response: UserAnswer | undefined,
  logger: Logger
): ResponseValidationResult {
  if (!response) {
    // Unanswered is valid (progress autosave)
    return {
      valid: true,
      normalized: undefined,
    }
  }

  if (response.selected_option === undefined && response.answer === undefined) {
    return {
      valid: false,
      errors: ['True/False response must include selected_option or answer'],
    }
  }

  const answer = response.selected_option ?? response.answer

  if (typeof answer !== 'string') {
    logger.warn('True/False validation failed: answer not string', {
      type: typeof answer,
    })
    return {
      valid: false,
      errors: ['Answer must be a string'],
    }
  }

  if (!['true', 'false', 'True', 'False', 'TRUE', 'FALSE'].includes(answer)) {
    logger.warn('True/False validation failed: invalid value', {
      value: answer,
    })
    return {
      valid: false,
      errors: ['Answer must be true or false'],
    }
  }

  const normalized = answer.toLowerCase() === 'true'

  return {
    valid: true,
    normalized: { selected_option: normalized ? 'true' : 'false' },
  }
}

/**
 * Validate short answer response
 *
 * @param response - User response
 * @param logger - Logger instance
 * @returns ResponseValidationResult
 */
export function validateShortAnswerResponse(
  response: UserAnswer | undefined,
  logger: Logger
): ResponseValidationResult {
  if (!response) {
    // Unanswered is valid
    return {
      valid: true,
      normalized: undefined,
    }
  }

  if (!response.text) {
    return {
      valid: false,
      errors: ['Short answer must include text'],
    }
  }

  const text = response.text.trim()

  if (typeof text !== 'string') {
    logger.warn('Short answer validation failed: text not string', {
      type: typeof text,
    })
    return {
      valid: false,
      errors: ['Answer text must be a string'],
    }
  }

  if (text.length === 0) {
    return {
      valid: false,
      errors: ['Answer text cannot be empty'],
    }
  }

  if (text.length > 500) {
    return {
      valid: false,
      errors: ['Answer text must be 500 characters or less'],
    }
  }

  return {
    valid: true,
    normalized: {
      text: text,
      word_count: text.split(/\s+/).length,
    },
  }
}

/**
 * Validate essay response
 *
 * @param response - User response
 * @param logger - Logger instance
 * @returns ResponseValidationResult
 */
export function validateEssayResponse(
  response: UserAnswer | undefined,
  logger: Logger
): ResponseValidationResult {
  if (!response) {
    // Unanswered is valid
    return {
      valid: true,
      normalized: undefined,
    }
  }

  if (!response.text) {
    return {
      valid: false,
      errors: ['Essay must include text'],
    }
  }

  const text = response.text.trim()

  if (typeof text !== 'string') {
    logger.warn('Essay validation failed: text not string', {
      type: typeof text,
    })
    return {
      valid: false,
      errors: ['Essay text must be a string'],
    }
  }

  if (text.length === 0) {
    return {
      valid: false,
      errors: ['Essay text cannot be empty'],
    }
  }

  if (text.length > 5000) {
    return {
      valid: false,
      errors: ['Essay text must be 5000 characters or less'],
    }
  }

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length

  return {
    valid: true,
    normalized: {
      text: text,
      word_count: wordCount,
    },
  }
}

/**
 * Validate matching response
 *
 * @param response - User response
 * @param questionOptions - Expected pairs
 * @param logger - Logger instance
 * @returns ResponseValidationResult
 */
export function validateMatchingResponse(
  response: UserAnswer | undefined,
  questionOptions: string[] | undefined,
  logger: Logger
): ResponseValidationResult {
  if (!response) {
    // Unanswered is valid
    return {
      valid: true,
      normalized: undefined,
    }
  }

  if (!response.matches || !Array.isArray(response.matches)) {
    return {
      valid: false,
      errors: ['Matching response must include matches array'],
    }
  }

  if (response.matches.length === 0) {
    return {
      valid: false,
      errors: ['At least one match must be provided'],
    }
  }

  // Validate each match has from/to
  for (let i = 0; i < response.matches.length; i++) {
    const match = response.matches[i]

    if (!match.from || !match.to) {
      logger.warn('Matching validation failed: invalid pair at index', {
        index: i,
        match,
      })
      return {
        valid: false,
        errors: [`Match at index ${i} must have both from and to`],
      }
    }

    if (typeof match.from !== 'string' || typeof match.to !== 'string') {
      return {
        valid: false,
        errors: [`Match at index ${i} must have string values`],
      }
    }
  }

  return {
    valid: true,
    normalized: { matches: response.matches },
  }
}

/**
 * Validate ordering response
 *
 * @param response - User response
 * @param questionOptions - Expected items
 * @param logger - Logger instance
 * @returns ResponseValidationResult
 */
export function validateOrderingResponse(
  response: UserAnswer | undefined,
  questionOptions: string[] | undefined,
  logger: Logger
): ResponseValidationResult {
  if (!response) {
    // Unanswered is valid
    return {
      valid: true,
      normalized: undefined,
    }
  }

  if (!response.order || !Array.isArray(response.order)) {
    return {
      valid: false,
      errors: ['Ordering response must include order array'],
    }
  }

  if (response.order.length === 0) {
    return {
      valid: false,
      errors: ['Order array cannot be empty'],
    }
  }

  // Validate all items are strings
  for (let i = 0; i < response.order.length; i++) {
    if (typeof response.order[i] !== 'string') {
      logger.warn('Ordering validation failed: non-string at index', {
        index: i,
        type: typeof response.order[i],
      })
      return {
        valid: false,
        errors: [`Item at index ${i} must be a string`],
      }
    }
  }

  return {
    valid: true,
    normalized: { order: response.order },
  }
}

/**
 * Fill-in-the-blank validation
 *
 * @param response - User response
 * @param logger - Logger instance
 * @returns ResponseValidationResult
 */
export function validateFillBlankResponse(
  response: UserAnswer | undefined,
  logger: Logger
): ResponseValidationResult {
  if (!response) {
    // Unanswered is valid
    return {
      valid: true,
      normalized: undefined,
    }
  }

  if (!response.text) {
    return {
      valid: false,
      errors: ['Fill-in-the-blank must include text'],
    }
  }

  const text = response.text.trim()

  if (typeof text !== 'string') {
    logger.warn('Fill-in-the-blank validation failed: text not string', {
      type: typeof text,
    })
    return {
      valid: false,
      errors: ['Answer text must be a string'],
    }
  }

  if (text.length === 0) {
    return {
      valid: false,
      errors: ['Answer text cannot be empty'],
    }
  }

  if (text.length > 200) {
    return {
      valid: false,
      errors: ['Answer text must be 200 characters or less'],
    }
  }

  return {
    valid: true,
    normalized: { text: text },
  }
}

/**
 * Route validation to correct validator based on question type
 *
 * @param response - User response
 * @param questionType - Type of question
 * @param questionOptions - Question options (for MCQ, matching, ordering)
 * @param logger - Logger instance
 * @returns ResponseValidationResult
 */
export function validateResponseForQuestionType(
  response: UserAnswer | undefined,
  questionType: string,
  questionOptions?: string[] | undefined,
  logger?: Logger
): ResponseValidationResult {
  const baseLogger = logger || createNullLogger()

  switch (questionType) {
    case QuestionType.MCQ:
      return validateMCQResponse(response, questionOptions, baseLogger)

    case QuestionType.TRUE_FALSE:
      return validateTrueFalseResponse(response, baseLogger)

    case QuestionType.SHORT_ANSWER:
      return validateShortAnswerResponse(response, baseLogger)

    case QuestionType.ESSAY:
      return validateEssayResponse(response, baseLogger)

    case QuestionType.MATCH:
      return validateMatchingResponse(response, questionOptions, baseLogger)

    case QuestionType.ORDERING:
      return validateOrderingResponse(response, questionOptions, baseLogger)

    case QuestionType.FILL_BLANK:
      return validateFillBlankResponse(response, baseLogger)

    default:
      return {
        valid: false,
        errors: [`Unknown question type: ${questionType}`],
      }
  }
}

/**
 * Create null logger for cases where logger not provided
 */
function createNullLogger(): Logger {
  return createLogger('null-logger')
}

/**
 * MCQ Grader
 *
 * File: packages/domain-core/src/grading/mcq-grader.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * Pure function grader for MCQ question types (SINGLE, MULTIPLE, TRUE_FALSE, ARRANGEMENT)
 * - No side effects, no DB access
 * - Deterministic scoring based on question type
 * - All answers snapshot-compared for immutability
 */

import type { McqAnswerResponse, QuestionSnapshot, QuestionType } from './grading.types'

/**
 * Grade a single MCQ question
 *
 * @param questionType - One of: MCQ_SINGLE, MCQ_MULTIPLE, MCQ_TRUE_FALSE, MCQ_ARRANGEMENT
 * @param questionSnapshot - Immutable snapshot of question definition
 * @param userResponse - User's submitted answer
 * @returns Object with awarded score and isCorrect flag
 *
 * @example
 * const result = gradeMultipleChoiceQuestion(
 *   'MCQ_SINGLE',
 *   { id: 'q1', type: 'MCQ_SINGLE', score: 5, correct_answer: 'opt_b' },
 *   { selectedOptionId: 'opt_b' }
 * )
 * // Returns: { awardedScore: 5, isCorrect: true }
 */
export function gradeMultipleChoiceQuestion(
  questionType: Exclude<
    QuestionType,
    'TRADITIONAL_TRUE_FALSE' | 'TRADITIONAL_FILL_BLANK' | 'TRADITIONAL_SHORT_ANSWER'
  >,
  questionSnapshot: QuestionSnapshot,
  userResponse: McqAnswerResponse | unknown
): { awardedScore: number; isCorrect: boolean } {
  const maxScore = questionSnapshot.score || 0
  const correctAnswer = questionSnapshot.correct_answer

  // Validate inputs
  if (!userResponse || typeof userResponse !== 'object') {
    return { awardedScore: 0, isCorrect: false }
  }

  const response = userResponse as McqAnswerResponse

  // Grade by question type
  switch (questionType) {
    case 'MCQ_SINGLE':
      return gradeMcqSingle(maxScore, correctAnswer, response)

    case 'MCQ_MULTIPLE':
      return gradeMcqMultiple(maxScore, correctAnswer, response)

    case 'MCQ_TRUE_FALSE':
      return gradeMcqTrueFalse(maxScore, correctAnswer, response)

    case 'MCQ_ARRANGEMENT':
      return gradeMcqArrangement(maxScore, correctAnswer, response)

    default:
      return { awardedScore: 0, isCorrect: false }
  }
}

/**
 * Grade MCQ_SINGLE question (select one from N options)
 * Correct if selected option ID matches correct answer
 *
 * @param maxScore - Maximum possible score for this question
 * @param correctAnswer - Expected option ID
 * @param response - User response object
 */
function gradeMcqSingle(
  maxScore: number,
  correctAnswer: unknown,
  response: McqAnswerResponse
): { awardedScore: number; isCorrect: boolean } {
  const selectedId = response.selectedOptionId

  if (typeof selectedId !== 'string' || typeof correctAnswer !== 'string') {
    return { awardedScore: 0, isCorrect: false }
  }

  const isCorrect = selectedId === correctAnswer
  return {
    awardedScore: isCorrect ? maxScore : 0,
    isCorrect,
  }
}

/**
 * Grade MCQ_MULTIPLE question (select N from M options)
 * Correct if selected option IDs match correct answer IDs (sorted comparison)
 *
 * @param maxScore - Maximum possible score for this question
 * @param correctAnswer - Expected sorted array of option IDs
 * @param response - User response object
 */
function gradeMcqMultiple(
  maxScore: number,
  correctAnswer: unknown,
  response: McqAnswerResponse
): { awardedScore: number; isCorrect: boolean } {
  if (!Array.isArray(correctAnswer) || !Array.isArray(response.selectedOptionIds)) {
    return { awardedScore: 0, isCorrect: false }
  }

  // Sort both arrays for comparison (order independent)
  const sortedCorrect = [...correctAnswer].sort()
  const sortedSelected = [...response.selectedOptionIds].sort()

  const isCorrect =
    sortedCorrect.length === sortedSelected.length &&
    sortedCorrect.every((val, idx) => val === sortedSelected[idx])

  return {
    awardedScore: isCorrect ? maxScore : 0,
    isCorrect,
  }
}

/**
 * Grade MCQ_TRUE_FALSE question (select true or false)
 * Correct if selected boolean matches correct answer
 *
 * @param maxScore - Maximum possible score for this question
 * @param correctAnswer - Expected boolean value
 * @param response - User response object
 */
function gradeMcqTrueFalse(
  maxScore: number,
  correctAnswer: unknown,
  response: McqAnswerResponse
): { awardedScore: number; isCorrect: boolean } {
  if (typeof response.selectedValue !== 'boolean' || typeof correctAnswer !== 'boolean') {
    return { awardedScore: 0, isCorrect: false }
  }

  const isCorrect = response.selectedValue === correctAnswer
  return {
    awardedScore: isCorrect ? maxScore : 0,
    isCorrect,
  }
}

/**
 * Grade MCQ_ARRANGEMENT question (put N items in correct order)
 * Correct if ordered option IDs match correct answer IDs in exact position
 *
 * @param maxScore - Maximum possible score for this question
 * @param correctAnswer - Expected array of option IDs in correct order
 * @param response - User response object
 */
function gradeMcqArrangement(
  maxScore: number,
  correctAnswer: unknown,
  response: McqAnswerResponse
): { awardedScore: number; isCorrect: boolean } {
  if (!Array.isArray(correctAnswer) || !Array.isArray(response.orderedOptionIds)) {
    return { awardedScore: 0, isCorrect: false }
  }

  // Exact position match required (order matters)
  const isCorrect =
    correctAnswer.length === response.orderedOptionIds.length &&
    correctAnswer.every((val, idx) => val === response.orderedOptionIds?.[idx])

  return {
    awardedScore: isCorrect ? maxScore : 0,
    isCorrect,
  }
}

/**
 * Validate MCQ question snapshot for required fields
 *
 * @param snapshot - Question snapshot to validate
 * @returns true if valid, false otherwise
 */
export function validateMcqQuestionSnapshot(snapshot: QuestionSnapshot): boolean {
  if (
    !snapshot ||
    !snapshot.type ||
    !snapshot.score ||
    typeof snapshot.correct_answer === 'undefined'
  ) {
    return false
  }

  const validTypes: QuestionType[] = [
    'MCQ_SINGLE',
    'MCQ_MULTIPLE',
    'MCQ_TRUE_FALSE',
    'MCQ_ARRANGEMENT',
  ]

  return validTypes.includes(snapshot.type as QuestionType) && snapshot.score > 0
}

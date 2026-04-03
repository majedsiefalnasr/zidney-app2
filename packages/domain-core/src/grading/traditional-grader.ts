/**
 * Traditional Grader
 *
 * File: packages/domain-core/src/grading/traditional-grader.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * Pure function grader for Traditional question types (TRADITIONAL_TRUE_FALSE, TRADITIONAL_FILL_BLANK, TRADITIONAL_SHORT_ANSWER)
 * - No side effects, no DB access
 * - Deterministic scoring based on question type
 * - Case normalization optional for FILL_BLANK per config
 * - SHORT_ANSWER is self-evaluated by learner (not auto-graded)
 */

import type {
  GradingConfigSnapshot,
  QuestionSnapshot,
  QuestionType,
  TraditionalAnswerResponse,
} from './grading.types'

/**
 * Grade a single Traditional question
 *
 * @param questionType - One of: TRADITIONAL_TRUE_FALSE, TRADITIONAL_FILL_BLANK, TRADITIONAL_SHORT_ANSWER
 * @param questionSnapshot - Immutable snapshot of question definition
 * @param userResponse - User's submitted answer
 * @param configSnapshot - Grading config (for normalize_case flag)
 * @returns Object with awarded score and isCorrect flag
 *
 * @example
 * const result = gradeTraditionalQuestion(
 *   'TRADITIONAL_FILL_BLANK',
 *   { id: 'q2', type: 'TRADITIONAL_FILL_BLANK', score: 3, correct_answer: 'Paris' },
 *   { textAnswer: 'paris' },
 *   { questions: [], pass_type: 'PERCENTAGE', pass_value: 50, total_possible_score: 100, normalize_case: true }
 * )
 * // Returns: { awardedScore: 3, isCorrect: true } (case normalized)
 */
export function gradeTraditionalQuestion(
  questionType: Extract<
    QuestionType,
    'TRADITIONAL_TRUE_FALSE' | 'TRADITIONAL_FILL_BLANK' | 'TRADITIONAL_SHORT_ANSWER'
  >,
  questionSnapshot: QuestionSnapshot,
  userResponse: TraditionalAnswerResponse | unknown,
  configSnapshot: GradingConfigSnapshot
): { awardedScore: number; isCorrect: boolean } {
  const maxScore = questionSnapshot.score || 0
  const correctAnswer = questionSnapshot.correct_answer

  // Validate inputs
  if (!userResponse || typeof userResponse !== 'object') {
    return { awardedScore: 0, isCorrect: false }
  }

  const response = userResponse as TraditionalAnswerResponse

  // Grade by question type
  switch (questionType) {
    case 'TRADITIONAL_TRUE_FALSE':
      return gradeTraditionalTrueFalse(maxScore, correctAnswer, response)

    case 'TRADITIONAL_FILL_BLANK':
      return gradeTraditionalFillBlank(
        maxScore,
        correctAnswer,
        response,
        configSnapshot.normalize_case ?? false
      )

    case 'TRADITIONAL_SHORT_ANSWER':
      return gradeTraditionalShortAnswer(maxScore, response)

    default:
      return { awardedScore: 0, isCorrect: false }
  }
}

/**
 * Grade TRADITIONAL_TRUE_FALSE question (select true or false)
 * Correct if selected boolean matches correct answer
 *
 * @param maxScore - Maximum possible score for this question
 * @param correctAnswer - Expected boolean value
 * @param response - User response object
 */
function gradeTraditionalTrueFalse(
  maxScore: number,
  correctAnswer: unknown,
  response: TraditionalAnswerResponse
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
 * Grade TRADITIONAL_FILL_BLANK question (fill in text answer)
 * Correct if text answer matches correct answer (with optional case normalization)
 *
 * @param maxScore - Maximum possible score for this question
 * @param correctAnswer - Expected text answer
 * @param response - User response object
 * @param normalizeCase - If true, compare lowercase versions; if false, exact match
 */
function gradeTraditionalFillBlank(
  maxScore: number,
  correctAnswer: unknown,
  response: TraditionalAnswerResponse,
  normalizeCase: boolean
): { awardedScore: number; isCorrect: boolean } {
  const userAnswer = response.textAnswer
  const correctStr = String(correctAnswer)
  const userStr = String(userAnswer)

  if (!userStr || !correctStr) {
    return { awardedScore: 0, isCorrect: false }
  }

  let isCorrect: boolean

  if (normalizeCase) {
    // Case-insensitive comparison with whitespace trim
    isCorrect = userStr.trim().toLowerCase() === correctStr.trim().toLowerCase()
  } else {
    // Exact match (case-sensitive)
    isCorrect = userStr.trim() === correctStr.trim()
  }

  return {
    awardedScore: isCorrect ? maxScore : 0,
    isCorrect,
  }
}

/**
 * Grade TRADITIONAL_SHORT_ANSWER question (self-evaluated by learner)
 * NOT auto-graded. Learner flags whether they answered correctly.
 * Score awarded if learner indicates correct; otherwise 0.
 *
 * NOTE: This represents learner self-evaluation, not automatic verification.
 * The correct_answer is stored for admin review/override purposes.
 *
 * @param maxScore - Maximum possible score for this question
 * @param response - User response object (should contain selfFlag)
 */
function gradeTraditionalShortAnswer(
  maxScore: number,
  response: TraditionalAnswerResponse
): { awardedScore: number; isCorrect: boolean } {
  // If learner provided an explicit awarded score (e.g., from admin review), use it
  if (typeof response.awardedScore === 'number') {
    return {
      awardedScore: Math.min(response.awardedScore, maxScore),
      isCorrect: response.awardedScore > 0,
    }
  }

  // Otherwise, use self-flag to determine if they marked it correct
  const selfCorrected = response.selfFlag === true

  return {
    awardedScore: selfCorrected ? maxScore : 0,
    isCorrect: selfCorrected,
  }
}

/**
 * Validate Traditional question snapshot for required fields
 *
 * @param snapshot - Question snapshot to validate
 * @returns true if valid, false otherwise
 */
export function validateTraditionalQuestionSnapshot(snapshot: QuestionSnapshot): boolean {
  if (
    !snapshot ||
    !snapshot.type ||
    !snapshot.score ||
    typeof snapshot.correct_answer === 'undefined'
  ) {
    return false
  }

  const validTypes: QuestionType[] = [
    'TRADITIONAL_TRUE_FALSE',
    'TRADITIONAL_FILL_BLANK',
    'TRADITIONAL_SHORT_ANSWER',
  ]

  return validTypes.includes(snapshot.type as QuestionType) && snapshot.score > 0
}

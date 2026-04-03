/**
 * Score Aggregator
 *
 * File: packages/domain-core/src/grading/score-aggregator.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * Pure function to aggregate per-question scores into attempt-level result
 * - Sums awarded scores
 * - Computes percentage (to 2 decimal places)
 * - Determines pass/fail based on config pass_type and pass_value
 * - No side effects, no DB access
 */

import type { GradingConfigSnapshot, QuestionGradingResult } from './grading.types'

/**
 * Aggregate question results into attempt-level score and pass/fail verdict
 *
 * @param questionResults - Array of graded question results
 * @param configSnapshot - Grading configuration snapshot with pass rules
 * @returns Object with totalScore, percentage, passed flags
 *
 * @example
 * const aggregate = aggregateScores(
 *   [
 *     { questionScore: 5, awardedScore: 5, isCorrect: true, ... },
 *     { questionScore: 3, awardedScore: 0, isCorrect: false, ... },
 *   ],
 *   { pass_type: 'PERCENTAGE', pass_value: 50, total_possible_score: 8, ... }
 * )
 * // Returns: {
 * //   totalScore: 5,
 * //   totalPossibleScore: 8,
 * //   percentage: 62.5,
 * //   passed: true
 * // }
 */
export function aggregateScores(
  questionResults: QuestionGradingResult[],
  configSnapshot: GradingConfigSnapshot
): {
  totalScore: number
  totalPossibleScore: number
  percentage: number
  passed: boolean
} {
  // Sum awarded scores
  const totalScore = questionResults.reduce((sum, q) => sum + (q.awardedScore || 0), 0)

  // Get total possible score from config
  const totalPossibleScore = configSnapshot.total_possible_score || 0

  // Calculate percentage (to 2 decimal places)
  let percentage = 0
  if (totalPossibleScore > 0) {
    percentage = Math.round((totalScore / totalPossibleScore) * 10000) / 100
  }

  // Determine pass/fail based on pass_type
  const passed = evaluatePassRule(
    totalScore,
    percentage,
    configSnapshot.pass_type,
    configSnapshot.pass_value
  )

  return {
    totalScore,
    totalPossibleScore,
    percentage,
    passed,
  }
}

/**
 * Evaluate pass/fail based on pass_type and pass_value
 *
 * @param totalScore - Total awarded score
 * @param percentage - Calculated percentage (0-100)
 * @param passType - Either 'PERCENTAGE' or 'SCORE'
 * @param passValue - Threshold value (percentage or absolute score)
 * @returns true if passed, false otherwise
 *
 * @example
 * evaluatePassRule(75, 75.5, 'PERCENTAGE', 60) // true (75.5% >= 60%)
 * evaluatePassRule(45, 60, 'SCORE', 50) // false (45 < 50)
 */
export function evaluatePassRule(
  totalScore: number,
  percentage: number,
  passType: 'PERCENTAGE' | 'SCORE',
  passValue: number
): boolean {
  if (passType === 'PERCENTAGE') {
    return percentage >= passValue
  } else if (passType === 'SCORE') {
    return totalScore >= passValue
  }

  // Unknown pass_type defaults to false (fail)
  return false
}

/**
 * Validate grading config snapshot for aggregation
 *
 * @param snapshot - Config snapshot to validate
 * @returns true if valid, false otherwise
 */
export function validateGradingConfigSnapshot(snapshot: GradingConfigSnapshot): boolean {
  if (!snapshot) {
    return false
  }

  const validPassTypes = ['PERCENTAGE', 'SCORE']

  if (!validPassTypes.includes(snapshot.pass_type)) {
    return false
  }

  if (typeof snapshot.pass_value !== 'number' || snapshot.pass_value < 0) {
    return false
  }

  if (typeof snapshot.total_possible_score !== 'number' || snapshot.total_possible_score < 0) {
    return false
  }

  if (!Array.isArray(snapshot.questions) || snapshot.questions.length === 0) {
    return false
  }

  return true
}

/**
 * Grading Types
 *
 * File: packages/domain-core/src/grading/grading.types.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * Shared type definitions for the grading engine.
 */

/**
 * Drizzle transaction type alias for database operations
 */
export type DrizzleTransaction = any

/**
 * Input parameters for grading an attempt
 */
export interface GradeAttemptInput {
  attemptId: string
  workspaceId: string
}

/**
 * Per-question grading result
 */
export interface QuestionGradingResult {
  questionId: string
  questionType: QuestionType
  questionScore: number
  awardedScore: number
  isCorrect: boolean
  userResponse: unknown
  correctAnswerSnapshot: unknown
  gradingMetadata?: Record<string, unknown>
}

/**
 * Aggregate grading result for an attempt
 */
export interface GradeAttemptResult {
  gradingResultId: string
  totalScore: number
  totalPossibleScore: number
  percentage: number
  passed: boolean
  questionResults: QuestionGradingResult[]
  gradingVersion: string
  gradedAt: Date
}

/**
 * Grading configuration snapshot stored on attempt
 */
export interface GradingConfigSnapshot {
  questions: QuestionSnapshot[]
  pass_type: 'PERCENTAGE' | 'SCORE'
  pass_value: number
  total_possible_score: number
  normalize_case?: boolean
}

/**
 * Question snapshot stored at attempt start
 */
export interface QuestionSnapshot {
  id: string
  type: QuestionType
  score: number
  correct_answer: unknown
  question_category?: string
}

/**
 * Supported question types (7 total)
 */
export type QuestionType =
  | 'MCQ_SINGLE'
  | 'MCQ_MULTIPLE'
  | 'MCQ_TRUE_FALSE'
  | 'MCQ_ARRANGEMENT'
  | 'TRADITIONAL_TRUE_FALSE'
  | 'TRADITIONAL_FILL_BLANK'
  | 'TRADITIONAL_SHORT_ANSWER'

/**
 * MCQ answer response (varies by MCQ type)
 */
export interface McqAnswerResponse {
  selectedOptionId?: string // SINGLE
  selectedOptionIds?: string[] // MULTIPLE
  selectedValue?: boolean // TRUE_FALSE
  orderedOptionIds?: string[] // ARRANGEMENT
}

/**
 * Traditional answer response (varies by type)
 */
export interface TraditionalAnswerResponse {
  textAnswer?: string // FILL_BLANK
  selectedValue?: boolean // TRUE_FALSE
  rawAnswer?: string // SHORT_ANSWER
  selfFlag?: boolean // SHORT_ANSWER: self_correction_flag
  awardedScore?: number // SHORT_ANSWER: explicit score
}

/**
 * Grading engine version
 */
export const GRADING_VERSION = '1.0.0'

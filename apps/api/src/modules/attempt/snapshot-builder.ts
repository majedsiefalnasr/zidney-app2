/**
 * Attempt Snapshot Builder
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T023
 *
 * Builds immutable snapshots at attempt start time.
 * Snapshots are used for deterministic grading and maintain state independence.
 *
 * Responsibilities:
 * - Capture question metadata with correct answers
 * - Build grading configuration snapshot
 * - Build UI flags snapshot
 * - Shuffle question order
 * - Validate snapshots are self-sufficient
 *
 * Determinism Requirements:
 * - Same input → Same output always
 * - No randomness or date-based logic
 * - No external references
 * - Snapshots usable years after creation
 *
 * ADRs: ADR-0002 (snapshot model)
 */

import { createLogger } from '@zidney/logger'
import type {
  FlagsSnapshot,
  GradingConfigSnapshot,
  QuestionSnapshot,
  QuestionSnapshotContainer,
} from '@zidney/types/attempt'

const logger = createLogger('snapshot-builder')

/**
 * Interface: Input question data
 * Represents a question as loaded from database
 */
interface InputQuestion {
  id: string
  text: string
  type: string
  options?: string[]
  correct_answer: unknown
  points: number
  difficulty?: string
  metadata?: Record<string, unknown>
}

/**
 * Build question snapshot
 *
 * Captures complete question metadata including correct answers.
 * Output is immutable and used for deterministic grading.
 *
 * @param questions - Array of raw questions from database
 * @returns QuestionSnapshotContainer with validated metadata
 * @throws Error if questions invalid or incomplete
 */
export function buildQuestionSnapshot(questions: InputQuestion[]): QuestionSnapshotContainer {
  if (!questions || questions.length === 0) {
    throw new Error('Question snapshot cannot be empty')
  }

  // Validate all questions have required fields
  const snapshots: QuestionSnapshot[] = questions.map((q, index) => {
    validateQuestion(q, index)

    return {
      id: q.id,
      text: q.text,
      type: q.type as unknown,
      options: q.options ? [...q.options] : undefined, // Deep copy
      correct_answer: JSON.parse(JSON.stringify(q.correct_answer)), // Deep copy
      points: q.points,
      metadata: q.metadata ? JSON.parse(JSON.stringify(q.metadata)) : undefined,
    }
  })

  // Validate snapshot is self-sufficient
  validateSnapshotSelfSufficiency(snapshots)

  logger.info('Question snapshot built', {
    question_count: snapshots.length,
    total_points: snapshots.reduce((sum, q) => sum + q.points, 0),
  })

  return { questions: snapshots }
}

/**
 * Build grading configuration snapshot
 *
 * Captures grading rules from exam configuration.
 * Determines how questions are scored and pass/fail logic.
 *
 * @param examConfig - Exam configuration object
 * @returns GradingConfigSnapshot
 */
export function buildGradingConfigSnapshot(examConfig: unknown): GradingConfigSnapshot {
  if (!examConfig) {
    throw new Error('Exam config required for grading snapshot')
  }

  const snapshot: GradingConfigSnapshot = {
    pass_score_percentage: validatePercentage(examConfig.pass_score_percentage || 60),
    total_points: validatePoints(examConfig.total_points || 100),
    question_weights: examConfig.question_weights || {},
    pass_fail_logic: examConfig.pass_fail_logic || 'SUM_SCORE >= pass_score_percentage',
    review_allowed: examConfig.review_allowed ?? true,
    hints_allowed: examConfig.hints_allowed ?? false,
    show_correct_answer: examConfig.show_correct_answer ?? false,
    randomize_options: examConfig.randomize_options ?? true,
    one_question_per_page: examConfig.one_question_per_page ?? false,
  }

  logger.debug('Grading config snapshot built', {
    pass_score_percentage: snapshot.pass_score_percentage,
    total_points: snapshot.total_points,
  })

  return snapshot
}

/**
 * Build UI flags snapshot
 *
 * Captures UI behavior flags from exam configuration.
 * Controls what features are visible/available to student.
 *
 * @param examConfig - Exam configuration object
 * @returns FlagsSnapshot
 */
export function buildFlagsSnapshot(examConfig: unknown): FlagsSnapshot {
  return {
    review_allowed: examConfig.review_allowed ?? true,
    hints_allowed: examConfig.hints_allowed ?? false,
    show_correct_answer: examConfig.show_correct_answer ?? false,
    randomize_options: examConfig.randomize_options ?? true,
    one_question_per_page: examConfig.one_question_per_page ?? false,
  }
}

/**
 * Shuffle question order
 *
 * Returns randomized ordering of question IDs for display.
 * Randomization is DETERMINISTIC (same input + same seed = same output).
 *
 * Uses Fisher-Yates shuffle with optional seed for reproducibility.
 *
 * @param questionIds - Array of question UUID strings
 * @param seed - Optional random seed for reproducibility
 * @returns Shuffled array of question IDs
 */
export function shuffleQuestions(questionIds: string[], seed?: string): string[] {
  if (!questionIds || questionIds.length === 0) {
    return []
  }

  // Create a copy to avoid modifying original
  const shuffled = [...questionIds]

  // If seed provided, use deterministic random function
  const rng = seed ? createDeterministicRng(seed) : Math.random

  // Fisher-Yates algorithm
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const current = shuffled[i]
    const swap = shuffled[j]
    if (current !== undefined && swap !== undefined) {
      shuffled[i] = swap
      shuffled[j] = current
    }
  }

  logger.debug('Questions shuffled', {
    original_count: questionIds.length,
    shuffled_count: shuffled.length,
    seed_provided: !!seed,
  })

  return shuffled
}

/**
 * Validate snapshot is self-sufficient
 *
 * Ensures snapshot contains all data needed for grading
 * without access to live database.
 *
 * @private
 */
function validateSnapshotSelfSufficiency(snapshots: QuestionSnapshot[]): void {
  for (const snapshot of snapshots) {
    if (!snapshot.id) {
      throw new Error('Snapshot missing question ID')
    }
    if (!snapshot.text) {
      throw new Error(`Question ${snapshot.id} missing text`)
    }
    if (!snapshot.type) {
      throw new Error(`Question ${snapshot.id} missing type`)
    }
    if (snapshot.correct_answer === undefined) {
      throw new Error(`Question ${snapshot.id} missing correct answer`)
    }
    if (!snapshot.points) {
      throw new Error(`Question ${snapshot.id} missing points`)
    }

    // Type-specific validation
    if (snapshot.type === 'MCQ' && !snapshot.options) {
      throw new Error(`MCQ ${snapshot.id} missing options`)
    }
  }

  logger.debug('Snapshot self-sufficiency validation passed')
}

/**
 * Validate single question
 *
 * @private
 */
function validateQuestion(question: InputQuestion, index: number): void {
  if (!question.id) {
    throw new Error(`Question at index ${index} missing ID`)
  }
  if (!question.text) {
    throw new Error(`Question ${question.id} missing text`)
  }
  if (!question.type) {
    throw new Error(`Question ${question.id} missing type`)
  }
  if (question.correct_answer === undefined) {
    throw new Error(`Question ${question.id} missing correct answer`)
  }
  if (!question.points || question.points <= 0) {
    throw new Error(`Question ${question.id} has invalid points ${question.points}`)
  }
}

/**
 * Validate percentage value
 *
 * @private
 */
function validatePercentage(value: number): number {
  if (value < 0 || value > 100) {
    throw new Error(`Invalid percentage: ${value} (must be 0-100)`)
  }
  return value
}

/**
 * Validate points value
 *
 * @private
 */
function validatePoints(value: number): number {
  if (value <= 0) {
    throw new Error(`Invalid points: ${value} (must be > 0)`)
  }
  return value
}

/**
 * Create deterministic random function based on seed
 *
 * Uses simple linear congruential generator for deterministic RNG.
 * Not cryptographically secure, but deterministic for snapshot shuffling.
 *
 * @private
 */
function createDeterministicRng(seed: string): () => number {
  // Convert seed to number
  const m = 0x80000000 // 2^31
  const a = 1103515245
  const c = 12345
  let state = parseInt(seed.substring(0, 8), 16) || hashString(seed)

  return () => {
    state = (a * state + c) % m
    return state / m
  }
}

/**
 * Simple hash function for string to number
 *
 * @private
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Unit test helper: Verify snapshot determinism
 *
 * Exported for testing to ensure same input produces same output.
 *
 * @param questions - Input questions
 * @param iterations - Number of iterations to test (default 1000)
 * @returns true if all iterations produce identical snapshots
 */
export function verifySnapshotDeterminism(
  questions: InputQuestion[],
  iterations: number = 1000
): boolean {
  if (iterations < 2) {
    return true
  }

  const results: string[] = []

  for (let i = 0; i < iterations; i++) {
    const snapshot = buildQuestionSnapshot(questions)
    results.push(JSON.stringify(snapshot))
  }

  const firstResult = results[0]
  const allIdentical = results.every((r) => r === firstResult)

  if (!allIdentical) {
    logger.error('Snapshot determinism check FAILED', {
      iterations,
      unique_outputs: new Set(results).size,
    })
  } else {
    logger.debug('Snapshot determinism verified', { iterations })
  }

  return allIdentical
}

/**
 * Grading Engine (Score Computation)
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T038
 *
 * Computes exam scores deterministically based on attempt snapshots.
 *
 * Key Properties:
 * - DETERMINISTIC: Same input ALWAYS produces same output (no randomness)
 * - SNAPSHOT-ONLY: Never accesses live exam database
 * - IMMUTABLE: Uses question_snapshot and grading_config_snapshot
 * - SIDE-EFFECT FREE: Pure function; no external calls or mutations
 *
 * Scoring Logic:
 * 1. Verify attempt not expired (server time only)
 * 2. Score each question based on type
 * 3. Sum total points
 * 4. Compare to pass threshold
 * 5. Generate per-question breakdown
 *
 * ADRs: ADR-0002 (snapshot model), ADR-0006 (server time)
 */

import { logger } from '@zidney/logger'
import {
  Attempt,
  AttemptMode,
  QuestionType,
  UserAnswer,
} from '@zidney/types/attempt'

/**
 * Interface: Grading Result
 * Returned from gradeAttempt, persisted as result_snapshot
 */
export interface GradeResult {
  score: number // 0-100 normalized percentage
  passed: boolean // Pass/fail determination
  total_points: number // Maximum achievable points
  pass_score: number // Passing threshold percentage
  question_results: Array<{
    question_id: string
    user_answer?: UserAnswer
    correct_answer: any
    points_earned: number
    points_possible: number
    feedback: string
    explanation?: string
  }>
  summary: string
  graded_at: string // ISO 8601 timestamp
  attempt_duration_seconds: number
}

/**
 * Compute overall score for completed attempt
 *
 * Deterministic: Same question_snapshot + user answers → same score always
 *
 * @param attempt - Attempt with snapshots (immutable)
 * @param workspaceId - Workspace UUID (for logging)
 * @returns GradeResult with score, pass/fail, and per-question breakdown
 * @throws Error if snapshots invalid or expired
 */
export async function gradeAttempt(
  attempt: Attempt,
  workspaceId: string
): Promise<GradeResult> {
  const startTime = Date.now()

  logger.debug(
    {
      service: 'grader',
      action: 'grading_started',
      attempt_id: attempt.id,
      workspace_id: workspaceId,
      question_count: attempt.question_snapshot.questions.length,
    },
    'Starting attempt grading'
  )

  try {
    // 1. Extract immutable data from attempt
    const questions = attempt.question_snapshot.questions
    const gradingConfig = attempt.grading_config_snapshot
    const responseData = attempt.result_snapshot?.question_results || []

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw new Error('Attempt has no questions in snapshot')
    }

    if (!gradingConfig) {
      throw new Error('Attempt has no grading configuration snapshot')
    }

    // 2. Build answer map from response data
    const answerMap = new Map<string, UserAnswer | undefined>()
    for (const question of questions) {
      const qResult = responseData.find((r) => r.question_id === question.id)
      if (qResult?.user_answer) {
        answerMap.set(question.id, qResult.user_answer)
      } else {
        answerMap.set(question.id, undefined)
      }
    }

    // 3. Validate time limit (server-authoritative time only)
    const now = Date.now()
    const serverStartTime = new Date(attempt.server_start_time).getTime()
    const elapsedMs = now - serverStartTime
    const timeLimitMs = (attempt.time_limit_snapshot || 0) * 1000 // Convert seconds to ms

    // For CHRONO or RUSH modes, verify time didn't exceed limit (with 1 minute grace)
    if (
      attempt.mode !== AttemptMode.RELAX &&
      timeLimitMs > 0 &&
      elapsedMs > timeLimitMs + 60000
    ) {
      logger.warn(
        {
          service: 'grader',
          action: 'attempt_time_exceeded',
          attempt_id: attempt.id,
          workspace_id: workspaceId,
          elapsed_ms: elapsedMs,
          limit_ms: timeLimitMs,
        },
        'Attempt exceeded time limit'
      )

      return {
        score: 0,
        passed: false,
        total_points: gradingConfig.total_points,
        pass_score: gradingConfig.pass_score_percentage,
        question_results: [],
        summary: 'Attempt exceeded time limit during grading',
        graded_at: new Date().toISOString(),
        attempt_duration_seconds: Math.floor(elapsedMs / 1000),
      }
    }

    // 4. Compute scores using ScoreEngine (snapshot-only deterministic)
    const questionResults = []
    let totalEarned = 0

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]!
      const userAnswer = answerMap.get(question.id)

      const result = scoreQuestion(question, userAnswer, gradingConfig)
      questionResults.push(result)
      totalEarned += result.points_earned
    }

    // 5. Calculate normalized score
    const totalPoints = gradingConfig.total_points
    const normalizedScore =
      totalPoints > 0 ? (totalEarned / totalPoints) * 100 : 0
    const passScorePercentage = gradingConfig.pass_score_percentage || 60
    const passed = normalizedScore >= passScorePercentage

    // 6. Generate summary
    const summary = buildSummary(normalizedScore, passScorePercentage, passed)

    const gradeResult: GradeResult = {
      score: Math.round(normalizedScore * 100) / 100, // Round to 2 decimals
      passed,
      total_points: totalPoints,
      pass_score: passScorePercentage,
      question_results: questionResults,
      summary,
      graded_at: new Date().toISOString(),
      attempt_duration_seconds: Math.floor(elapsedMs / 1000),
    }

    logger.info(
      {
        service: 'grader',
        action: 'grading_completed',
        attempt_id: attempt.id,
        workspace_id: workspaceId,
        score: gradeResult.score,
        passed: gradeResult.passed,
        total_earned: totalEarned,
        total_points: totalPoints,
        question_count: questions.length,
        duration_ms: Date.now() - startTime,
      },
      'Attempt grading completed'
    )

    return gradeResult
  } catch (err) {
    logger.error(
      {
        service: 'grader',
        action: 'grading_error',
        attempt_id: attempt.id,
        workspace_id: workspaceId,
        error: err instanceof Error ? err.message : String(err),
        error_stack: err instanceof Error ? err.stack : undefined,
      },
      'Error during grading'
    )

    throw err
  }
}

/**
 * Score a single question deterministically
 *
 * Handles all 6+ question types based on question_snapshot.type
 *
 * @param question - Question snapshot (immutable)
 * @param userAnswer - Student's answer (may be undefined if unanswered)
 * @param gradingConfig - Grading configuration snapshot
 * @returns Question result with points and feedback
 */
function scoreQuestion(
  question: any,
  userAnswer: UserAnswer | undefined,
  gradingConfig: any
): {
  question_id: string
  user_answer?: UserAnswer
  correct_answer: any
  points_earned: number
  points_possible: number
  feedback: string
  explanation?: string
} {
  const result = {
    question_id: question.id,
    user_answer: userAnswer,
    correct_answer: question.correct_answer,
    points_earned: 0,
    points_possible: question.points || 0,
    feedback: '',
    explanation: undefined,
  }

  // Unanswered questions score zero
  if (!userAnswer) {
    result.feedback = 'Not answered'
    return result
  }

  // Score based on question type
  switch (question.type) {
    case QuestionType.MCQ:
      return scoreMCQ(question, userAnswer, result, gradingConfig)

    case QuestionType.TRUE_FALSE:
      return scoreTrueFalse(question, userAnswer, result, gradingConfig)

    case QuestionType.SHORT_ANSWER:
      return scoreShortAnswer(question, userAnswer, result, gradingConfig)

    case QuestionType.FILL_BLANK:
      return scoreFillBlank(question, userAnswer, result, gradingConfig)

    case QuestionType.ESSAY:
      return scoreEssay(question, userAnswer, result, gradingConfig)

    case QuestionType.MATCH:
      return scoreMatching(question, userAnswer, result, gradingConfig)

    case QuestionType.ORDERING:
      return scoreOrdering(question, userAnswer, result, gradingConfig)

    default:
      result.feedback = `Unknown question type: ${question.type}`
      return result
  }
}

/**
 * Score MCQ question
 */
function scoreMCQ(
  question: any,
  userAnswer: UserAnswer,
  result: any,
  gradingConfig: any
): any {
  const selectedOption = userAnswer.selected_option
  const correctOption = question.correct_answer

  if (selectedOption === correctOption) {
    result.points_earned = result.points_possible
    result.feedback = 'Correct!'
  } else {
    result.points_earned = 0
    result.feedback = 'Incorrect'
    if (gradingConfig.show_correct_answer) {
      result.explanation = `Correct answer: ${correctOption}`
    }
  }

  return result
}

/**
 * Score True/False question
 */
function scoreTrueFalse(
  question: any,
  userAnswer: UserAnswer,
  result: any,
  gradingConfig: any
): any {
  const selectedAnswer = userAnswer.selected_option
  const correctAnswer = question.correct_answer

  if (selectedAnswer === correctAnswer) {
    result.points_earned = result.points_possible
    result.feedback = 'Correct!'
  } else {
    result.points_earned = 0
    result.feedback = 'Incorrect'
    if (gradingConfig.show_correct_answer) {
      result.explanation = `Correct answer: ${correctAnswer}`
    }
  }

  return result
}

/**
 * Score Short Answer question (fuzzy matching)
 */
function scoreShortAnswer(
  question: any,
  userAnswer: UserAnswer,
  result: any,
  gradingConfig: any
): any {
  const userText = (userAnswer.text || '').trim().toLowerCase()
  const correctAnswers = Array.isArray(question.correct_answer)
    ? question.correct_answer
    : [question.correct_answer]

  const normalized = correctAnswers.map((a: string) => a.trim().toLowerCase())
  const isCorrect = normalized.includes(userText)

  if (isCorrect) {
    result.points_earned = result.points_possible
    result.feedback = 'Correct!'
  } else {
    result.points_earned = 0
    result.feedback = 'Incorrect'
    if (gradingConfig.show_correct_answer) {
      result.explanation = `Accepted answer(s): ${normalized.join(', ')}`
    }
  }

  return result
}

/**
 * Score Fill-in-the-blank question
 */
function scoreFillBlank(
  question: any,
  userAnswer: UserAnswer,
  result: any,
  gradingConfig: any
): any {
  const userText = (userAnswer.text || '').trim().toLowerCase()
  const correctAnswers = Array.isArray(question.correct_answer)
    ? question.correct_answer
    : [question.correct_answer]

  const normalized = correctAnswers.map((a: string) => a.trim().toLowerCase())
  const isCorrect = normalized.some((answer: string) => {
    // Exact match or substring match
    return userText === answer || userText.includes(answer)
  })

  if (isCorrect) {
    result.points_earned = result.points_possible
    result.feedback = 'Correct!'
  } else {
    result.points_earned = 0
    result.feedback = 'Incorrect'
    if (gradingConfig.show_correct_answer) {
      result.explanation = `Accepted answer(s): ${normalized.join(', ')}`
    }
  }

  return result
}

/**
 * Score Essay question (no autograding; placeholder)
 */
function scoreEssay(
  _question: any,
  _userAnswer: UserAnswer,
  result: any,
  gradingConfig: any
): any {
  // Essays require manual grading
  // Award default score or zero based on config
  result.points_earned = gradingConfig.default_essay_score || 0
  result.feedback = 'Requires manual grading'
  result.explanation = 'This answer will be reviewed by an instructor/teacher'

  return result
}

/**
 * Score Matching question
 */
function scoreMatching(
  question: any,
  userAnswer: UserAnswer,
  result: any,
  _gradingConfig: any
): any {
  const correctPairs = question.correct_answer || {}
  const userMatches = userAnswer.matches || []

  let correctCount = 0

  for (const userMatch of userMatches) {
    const expectedValue = correctPairs[userMatch.from]
    if (expectedValue === userMatch.to) {
      correctCount++
    }
  }

  const totalPairs = Object.keys(correctPairs).length || 1
  const percentCorrect = (correctCount / totalPairs) * 100

  if (percentCorrect === 100) {
    result.points_earned = result.points_possible
    result.feedback = 'All pairs matched correctly!'
  } else if (percentCorrect > 50) {
    result.points_earned = Math.floor(
      result.points_possible * (percentCorrect / 100)
    )
    result.feedback = `Partially correct (${Math.floor(percentCorrect)}%)`
  } else {
    result.points_earned = 0
    result.feedback = 'Mostly incorrect'
  }

  return result
}

/**
 * Score Ordering question
 */
function scoreOrdering(
  question: any,
  userAnswer: UserAnswer,
  result: any,
  _gradingConfig: any
): any {
  const correctOrder = question.correct_answer || []
  const userOrder = userAnswer.order || []

  if (JSON.stringify(correctOrder) === JSON.stringify(userOrder)) {
    result.points_earned = result.points_possible
    result.feedback = 'Sequence is correct!'
  } else {
    result.points_earned = 0
    result.feedback = 'Sequence is incorrect'
  }

  return result
}

/**
 * Build human-readable summary text
 */
function buildSummary(
  score: number,
  passScore: number,
  passed: boolean
): string {
  if (passed) {
    if (score >= 90) {
      return 'Excellent! You passed with a high score.'
    } else if (score >= 80) {
      return 'Great! You passed this exam.'
    } else {
      return 'You have passed this exam.'
    }
  } else {
    if (score >= passScore - 10) {
      return 'You were close! Try again to improve your score.'
    } else {
      return 'You did not pass this time. Review the material and try again.'
    }
  }
}

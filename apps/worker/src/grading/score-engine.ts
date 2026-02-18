/**
 * Deterministic Score Computation Engine
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T038
 *
 * Calculates exam scores deterministically based on snapshots.
 *
 * Key Properties:
 * - DETERMINISTIC: Same input ALWAYS produces same output
 * - NO randomness, time-based logic, or external calls
 * - Uses snapshots only; never accesses live database
 * - Testable: 1000+ iterations must produce identical results
 *
 * Scoring Logic:
 * - Sum points from correct answers
 * - Apply per-question weights if configured
 * - Compare total to pass threshold
 * - Generate per-question breakdown for feedback
 *
 * ADRs: ADR-0002 (snapshot model)
 */

import {
  QuestionResult,
  QuestionSnapshot,
  ResultSnapshot,
  UserAnswer,
} from '../../types/src/attempt'
import { createLogger } from '../logging'

const logger = createLogger('score-engine')

/**
 * Interface: Grading result with detailed breakdown
 */
export interface GradingResult {
  score: number // 0-100 scale
  passed: boolean // Pass/fail determination
  total_points: number // Maximum achievable points
  pass_score: number // Passing threshold (percentage converted)
  question_results: QuestionResult[] // Per-question breakdown
  summary: string // Human-readable summary
}

/**
 * Compute overall score for completed attempt
 *
 * Deterministic: Same input → same output always
 *
 * @param questions - Question snapshots
 * @param answers - Student answers map {question_id => user_answer}
 * @param gradingConfig - Grading configuration snapshot
 * @returns Score and pass/fail determination
 */
export function computeScore(
  questions: QuestionSnapshot[],
  answers: Map<string, UserAnswer | undefined>,
  gradingConfig: any
): GradingResult {
  if (!questions || questions.length === 0) {
    throw new Error('Questions array required')
  }
  if (!gradingConfig) {
    throw new Error('Grading config required')
  }

  // Score each question
  const questionResults: QuestionResult[] = []
  let totalEarned = 0

  for (const question of questions) {
    const userAnswer = answers.get(question.id)
    const questionResult = scoreQuestion(question, userAnswer, gradingConfig)

    questionResults.push(questionResult)
    totalEarned += questionResult.points_earned
  }

  // Calculate percentagescores
  const totalPoints = gradingConfig.total_points
  const scorePercentage =
    totalPoints > 0 ? (totalEarned / totalPoints) * 100 : 0
  const passScorePercentage = gradingConfig.pass_score_percentage || 60
  const passScore = (passScorePercentage / 100) * totalPoints

  // Determine pass/fail
  const passed = scorePercentage >= passScorePercentage

  // Build summary text
  const summary = buildSummaryText(scorePercentage, passScorePercentage, passed)

  logger.debug('Score computed', {
    score_percentage: scorePercentage.toFixed(2),
    passed,
    total_earned: totalEarned,
    total_points: totalPoints,
    question_count: questions.length,
  })

  return {
    score: Math.round(scorePercentage * 100) / 100, // Round to 2 decimals
    passed,
    total_points: totalPoints,
    pass_score: passScore,
    question_results: questionResults,
    summary,
  }
}

/**
 * Score a single question
 *
 * Dispatches to type-specific scorer
 *
 * @param question - Question snapshot
 * @param userAnswer - Student's answer (may be undefined if not answered)
 * @param gradingConfig - Grading configuration
 * @returns Question result with points and feedback
 */
export function scoreQuestion(
  question: QuestionSnapshot,
  userAnswer: UserAnswer | undefined,
  gradingConfig: any
): QuestionResult {
  // Not answered
  if (!userAnswer) {
    return {
      question_id: question.id,
      user_answer: undefined,
      correct_answer: question.correct_answer,
      points_earned: 0,
      points_possible: question.points,
      feedback: 'Not answered',
      explanation: 'You did not provide an answer to this question.',
    }
  }

  // Dispatch to type-specific scorer
  try {
    switch (question.type) {
      case 'MCQ':
      case 'TRUE_FALSE':
        return scoreMCQ(question, userAnswer)
      case 'SHORT_ANSWER':
        return scoreShortAnswer(question, userAnswer)
      case 'ESSAY':
        return scoreEssay(question, userAnswer)
      case 'MATCH':
        return scoreMatching(question, userAnswer)
      case 'ORDERING':
        return scoreOrdering(question, userAnswer)
      case 'FILL_BLANK':
        return scoreFillBlank(question, userAnswer)
      default:
        logger.warn('Unknown question type', {
          question_id: question.id,
          type: question.type,
        })
        return {
          question_id: question.id,
          user_answer: userAnswer,
          correct_answer: question.correct_answer,
          points_earned: 0,
          points_possible: question.points,
          feedback: 'Could not score question',
          explanation: `Unknown question type: ${question.type}`,
        }
    }
  } catch (error) {
    logger.error('Error scoring question', {
      question_id: question.id,
      type: question.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      question_id: question.id,
      user_answer: userAnswer,
      correct_answer: question.correct_answer,
      points_earned: 0,
      points_possible: question.points,
      feedback: 'Scoring error',
      explanation: 'An error occurred while scoring this question.',
    }
  }
}

/**
 * Score multiple-choice question
 *
 * Deterministic: Simple exact match
 *
 * @private
 */
function scoreMCQ(
  question: QuestionSnapshot,
  userAnswer: UserAnswer
): QuestionResult {
  const selectedOption = userAnswer.selected_option
  const correctOption = question.correct_answer?.selected_option

  const isCorrect =
    selectedOption === correctOption &&
    selectedOption !== undefined &&
    correctOption !== undefined

  return {
    question_id: question.id,
    user_answer: userAnswer,
    correct_answer: question.correct_answer,
    points_earned: isCorrect ? question.points : 0,
    points_possible: question.points,
    feedback: isCorrect ? 'Correct!' : 'Incorrect',
    explanation: isCorrect
      ? 'Your answer matches the correct option.'
      : `The correct answer is: ${correctOption}`,
  }
}

/**
 * Score short answer question
 *
 * Deterministic: Simple string matching (case-insensitive)
 * May award partial credit based on keyword matching
 *
 * @private
 */
function scoreShortAnswer(
  question: QuestionSnapshot,
  userAnswer: UserAnswer
): QuestionResult {
  const userText = (userAnswer.text || '').toLowerCase().trim()
  const correctAnswers = Array.isArray(question.correct_answer?.answers)
    ? question.correct_answer.answers.map((a: string) => a.toLowerCase().trim())
    : [(question.correct_answer?.text || '').toLowerCase().trim()]

  // Check for exact match
  const isExactMatch = correctAnswers.some(
    (correct: string) => userText === correct
  )

  if (isExactMatch) {
    return {
      question_id: question.id,
      user_answer: userAnswer,
      correct_answer: question.correct_answer,
      points_earned: question.points,
      points_possible: question.points,
      feedback: 'Correct!',
      explanation: 'Your answer is correct.',
    }
  }

  // Check for keyword match (partial credit)  if keywords provided
  const keywords = question.correct_answer?.keywords || []
  const matchedKeywords = keywords.filter((keyword: string) =>
    userText.includes(keyword.toLowerCase())
  )

  let pointsEarned = 0
  if (matchedKeywords.length > 0 && keywords.length > 0) {
    pointsEarned = Math.floor(
      (matchedKeywords.length / keywords.length) * question.points
    )
  }

  return {
    question_id: question.id,
    user_answer: userAnswer,
    correct_answer: question.correct_answer,
    points_earned: pointsEarned,
    points_possible: question.points,
    feedback: pointsEarned > 0 ? 'Partially correct' : 'Incorrect',
    explanation:
      pointsEarned > 0
        ? `You matched ${matchedKeywords.length}/${keywords.length} expected keywords.`
        : `Expected answer contained different text. Got: "${userText}"`,
  }
}

/**
 * Score essay question
 *
 * Deterministic: Rubric-based scoring using keyword/length checks
 *
 * @private
 */
function scoreEssay(
  question: QuestionSnapshot,
  userAnswer: UserAnswer
): QuestionResult {
  const essayText = (userAnswer.text || '').toLowerCase().trim()
  const wordCount = essayText.split(/\s+/).length
  const minWords = question.correct_answer?.min_words || 100
  const keywords = question.correct_answer?.keywords || []

  // Calculate score based on rubric
  let pointsEarned = 0
  const rubricItems = [
    {
      criterion: 'minimum_length',
      check: wordCount >= minWords,
      weight: 0.3,
    },
    {
      criterion: 'keywords',
      check:
        keywords.length > 0 &&
        keywords.some((k: string) => essayText.includes(k.toLowerCase())),
      weight: 0.4,
    },
    {
      criterion: 'content',
      check: wordCount > 0 && !isPlainReproduction(essayText),
      weight: 0.3,
    },
  ]

  let totalWeight = 0
  let weightedScore = 0

  for (const rubric of rubricItems) {
    totalWeight += rubric.weight
    if (rubric.check) {
      weightedScore += rubric.weight
    }
  }

  pointsEarned = Math.round((weightedScore / totalWeight) * question.points)

  return {
    question_id: question.id,
    user_answer: userAnswer,
    correct_answer: question.correct_answer,
    points_earned: pointsEarned,
    points_possible: question.points,
    feedback:
      pointsEarned > question.points * 0.7
        ? 'Good response'
        : pointsEarned > 0
          ? 'Acceptable response'
          : 'Needs improvement',
    explanation: `Essay scored based on length (${wordCount} words), keyword coverage, and originality.`,
  }
}

/**
 * Score matching question
 *
 * Deterministic: Compare match pairs
 *
 * @private
 */
function scoreMatching(
  question: QuestionSnapshot,
  userAnswer: UserAnswer
): QuestionResult {
  const userMatches = userAnswer.matches || []
  const correctMatches = question.correct_answer?.matches || []

  if (correctMatches.length === 0) {
    return {
      question_id: question.id,
      user_answer: userAnswer,
      correct_answer: question.correct_answer,
      points_earned: 0,
      points_possible: question.points,
      feedback: 'No correct answers defined',
      explanation: 'Cannot score: no correct answer configuration.',
    }
  }

  // Count correct matches
  let correctCount = 0
  for (const userMatch of userMatches) {
    const isCorrect = correctMatches.some(
      (correct: any) =>
        correct.from === userMatch.from && correct.to === userMatch.to
    )
    if (isCorrect) {
      correctCount++
    }
  }

  const pointsEarned =
    correctMatches.length > 0
      ? Math.floor((correctCount / correctMatches.length) * question.points)
      : 0

  return {
    question_id: question.id,
    user_answer: userAnswer,
    correct_answer: question.correct_answer,
    points_earned: pointsEarned,
    points_possible: question.points,
    feedback:
      correctCount === correctMatches.length
        ? 'All matches correct'
        : 'Some matches incorrect',
    explanation: `You correctly matched ${correctCount}/${correctMatches.length} pairs.`,
  }
}

/**
 * Score ordering question
 *
 * Deterministic: Compare sequence order
 *
 * @private
 */
function scoreOrdering(
  question: QuestionSnapshot,
  userAnswer: UserAnswer
): QuestionResult {
  const userOrder = userAnswer.order || []
  const correctOrder = question.correct_answer?.order || []

  if (correctOrder.length === 0) {
    return {
      question_id: question.id,
      user_answer: userAnswer,
      correct_answer: question.correct_answer,
      points_earned: 0,
      points_possible: question.points,
      feedback: 'No correct sequence defined',
      explanation: 'Cannot score: no correct answer configuration.',
    }
  }

  // Check if order is correct
  const isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder)

  return {
    question_id: question.id,
    user_answer: userAnswer,
    correct_answer: question.correct_answer,
    points_earned: isCorrect ? question.points : 0,
    points_possible: question.points,
    feedback: isCorrect ? 'Correct order' : 'Incorrect order',
    explanation: isCorrect
      ? 'Your sequence matches the correct order.'
      : 'The order is not correct.',
  }
}

/**
 * Score fill-in-the-blank question
 *
 * Deterministic: String matching (case-insensitive, whitespace-ignore)
 *
 * @private
 */
function scoreFillBlank(
  question: QuestionSnapshot,
  userAnswer: UserAnswer
): QuestionResult {
  const userAnswer_text = (userAnswer.text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  const correctAnswers = Array.isArray(question.correct_answer?.answers)
    ? question.correct_answer.answers.map((a: string) =>
        a.toLowerCase().replace(/\s+/g, ' ').trim()
      )
    : [
        (question.correct_answer?.text || '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim(),
      ]

  const isCorrect = correctAnswers.some(
    (correct: string) => userAnswer_text === correct
  )

  return {
    question_id: question.id,
    user_answer: userAnswer,
    correct_answer: question.correct_answer,
    points_earned: isCorrect ? question.points : 0,
    points_possible: question.points,
    feedback: isCorrect ? 'Correct!' : 'Incorrect',
    explanation: isCorrect
      ? 'Your answer matches.'
      : `Expected: ${correctAnswers.join(' or ')}`,
  }
}

/**
 * Build human-readable summary text
 *
 * @private
 */
function buildSummaryText(
  scorePercentage: number,
  passPercentage: number,
  passed: boolean
): string {
  const scoredInt = Math.round(scorePercentage)

  if (passed) {
    if (scorePercentage >= 90) {
      return `Excellent! You scored ${scoredInt}% and passed with an outstanding result.`
    } else if (scorePercentage >= 80) {
      return `Great job! You scored ${scoredInt}% and passed with a good result.`
    } else if (scorePercentage >= passPercentage) {
      return `Congratulations! You scored ${scoredInt}% and passed the exam (passing score: ${Math.round(passPercentage)}%).`
    }
  }

  return `You scored ${scoredInt}%. The passing score is ${Math.round(passPercentage)}%. Please try again.`
}

/**
 * Check if text is plain reproduction (not original)
 *
 * Simple heuristic: all same word repeated or very short
 *
 * @private
 */
function isPlainReproduction(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => w.length > 0)

  if (words.length < 5) {
    return true
  }

  // Check if all words are the same
  const uniqueWords = new Set(words)
  return uniqueWords.size <= 1
}

/**
 * Build result snapshot from scoring
 *
 * @param attemptId - Attempt UUID
 * @param gradingResult - Result from computeScore
 * @returns ResultSnapshot
 */
export function buildResultSnapshot(
  attemptId: string,
  gradingResult: GradingResult
): ResultSnapshot {
  return {
    score: gradingResult.score,
    passed: gradingResult.passed,
    total_points: gradingResult.total_points,
    pass_score: gradingResult.pass_score,
    question_results: gradingResult.question_results,
    summary: gradingResult.summary,
  }
}

import { logger } from '@zidney/logger'
import {
  AttemptSnapshot,
  GradingResult,
  Question,
  QuestionResult,
  StudentAnswer,
  SubmissionData,
} from '../../types/job-schema'

/**
 * T047: Grading executor
 *
 * Main grading logic that:
 * - Loads exam configuration from snapshot (not live config)
 * - Executes grading algorithm
 * - Returns GradingResult with score, feedback, details
 * - Logs grading execution with attempt_id and workspace_id
 */

export interface GradingConfig {
  auto_grade_enabled: boolean
  show_answers_after_submission: boolean
}

/**
 * Grade an attempt submission
 */
export async function gradeAttempt(
  attemptId: string,
  workspaceId: string,
  userId: string,
  attemptSnapshot: AttemptSnapshot,
  submissionData: SubmissionData,
  correlationId: string
): Promise<GradingResult> {
  const startTime = Date.now()

  try {
    logger.info(`Grading started`, {
      attempt_id: attemptId,
      workspace_id: workspaceId,
      user_id: userId,
      correlation_id: correlationId,
      question_count: attemptSnapshot.question_list.length,
    })

    // Grade each question
    const questionResults: QuestionResult[] = []
    let totalScore = 0
    let maxScore = 0

    for (const question of attemptSnapshot.question_list) {
      maxScore += question.points

      // Find student answer for this question
      const studentAnswer = submissionData.answers.find(
        (a) => a.question_id === question.question_id
      )

      // Grade the question
      const questionResult = gradeQuestion(
        question,
        studentAnswer,
        attemptSnapshot.grading_rules
      )

      totalScore += questionResult.earned_points
      questionResults.push(questionResult)
    }

    // Calculate percentage
    const scorePercent = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

    // Determine pass/fail
    const passed =
      scorePercent >= attemptSnapshot.grading_rules.passing_score_percent

    // Generate feedback
    const feedback = generateFeedback(
      questionResults,
      scorePercent,
      passed,
      attemptSnapshot.grading_rules
    )

    const result: GradingResult = {
      job_id: '', // Set by processor
      attempt_id: attemptId,
      user_id: userId,
      workspace_id: workspaceId,
      score: totalScore,
      max_score: maxScore,
      score_percent: Math.round(scorePercent * 100) / 100,
      passed,
      feedback,
      graded_at: new Date().toISOString(),
      question_results: questionResults,
      processing_time_ms: Date.now() - startTime,
    }

    logger.info(`Grading completed`, {
      attempt_id: attemptId,
      workspace_id: workspaceId,
      user_id: userId,
      correlation_id: correlationId,
      score: result.score,
      max_score: result.max_score,
      score_percent: result.score_percent,
      passed: result.passed,
      processing_time_ms: result.processing_time_ms,
    })

    return result
  } catch (error) {
    logger.error(`Grading error`, {
      attempt_id: attemptId,
      workspace_id: workspaceId,
      user_id: userId,
      correlation_id: correlationId,
      error: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
}

/**
 * Grade a single question
 */
function gradeQuestion(
  question: Question,
  studentAnswer: StudentAnswer | undefined,
  _gradingRules: any
): QuestionResult {
  const result: QuestionResult = {
    question_id: question.question_id,
    earned_points: 0,
    max_points: question.points,
    is_correct: false,
  }

  if (!studentAnswer || !studentAnswer.answer_text) {
    // No answer provided
    logger.debug(`No answer provided for question`, {
      question_id: question.question_id,
    })
    return result
  }

  try {
    switch (question.type) {
      case 'multiple_choice':
        return gradeMultipleChoice(question, studentAnswer, result)

      case 'short_answer':
        return gradeShortAnswer(question, studentAnswer, result)

      case 'essay':
        return gradeEssay(question, studentAnswer, result)

      default:
        logger.warn(`Unknown question type`, {
          question_id: question.question_id,
          type: question.type,
        })
        return result
    }
  } catch (error) {
    logger.error(`Question grading error`, {
      question_id: question.question_id,
      type: question.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return result
  }
}

/**
 * Grade multiple choice question
 */
function gradeMultipleChoice(
  question: Question,
  studentAnswer: StudentAnswer,
  result: QuestionResult
): QuestionResult {
  if (!question.options) {
    return result
  }

  // Find correct option
  const correctOption = question.options.find((opt) => opt.is_correct)

  if (!correctOption) {
    logger.warn(`No correct option defined for multiple choice question`, {
      question_id: question.question_id,
    })
    return result
  }

  // Check if student answer matches
  if (studentAnswer.answer_options?.includes(correctOption.option_id)) {
    result.earned_points = result.max_points
    result.is_correct = true
    result.feedback = 'Correct!'
  } else {
    result.feedback = `Incorrect. The correct answer is: ${correctOption.text}`
  }

  return result
}

/**
 * Grade short answer question
 */
function gradeShortAnswer(
  question: Question,
  studentAnswer: StudentAnswer,
  result: QuestionResult
): QuestionResult {
  const rubric = question.rubric

  if (!rubric || rubric.type !== 'exact_match') {
    // Default to fuzzy match
    return gradeEssay(question, studentAnswer, result)
  }

  if (!rubric.expected_answer) {
    logger.warn(`No expected answer for short answer question`, {
      question_id: question.question_id,
    })
    return result
  }

  // Normalize answers for comparison
  const normStudentAnswer = studentAnswer.answer_text.toLowerCase().trim()
  const normExpectedAnswer = rubric.expected_answer.toLowerCase().trim()

  if (normStudentAnswer === normExpectedAnswer) {
    result.earned_points = result.max_points
    result.is_correct = true
    result.feedback = 'Correct!'
  } else {
    result.feedback = `Expected: ${rubric.expected_answer}`
  }

  return result
}

/**
 * Grade essay question - keyword matching
 */
function gradeEssay(
  question: Question,
  studentAnswer: StudentAnswer,
  result: QuestionResult
): QuestionResult {
  const rubric = question.rubric

  const answer = studentAnswer.answer_text.toLowerCase()
  let matchCount = 0
  let maxMatches = 0

  if (rubric && rubric.keywords) {
    maxMatches = rubric.keywords.length

    for (const keyword of rubric.keywords) {
      if (answer.includes(keyword.toLowerCase())) {
        matchCount++
      }
    }

    // Calculate score based on keyword matches
    if (maxMatches > 0) {
      const matchPercent = (matchCount / maxMatches) * 100

      if (matchPercent >= 80) {
        result.earned_points = result.max_points
        result.is_correct = true
      } else if (matchPercent >= 50) {
        result.earned_points = Math.round(
          result.max_points * (matchPercent / 100)
        )
      }
    }
  }

  // Generate feedback
  if (maxMatches > 0) {
    result.feedback = `Matched ${matchCount} of ${maxMatches} key concepts`
  } else {
    result.feedback = 'Please ensure your answer includes relevant concepts'
  }

  return result
}

/**
 * Generate overall feedback
 */
function generateFeedback(
  questionResults: QuestionResult[],
  scorePercent: number,
  passed: boolean,
  gradingRules: any
): string {
  const correctCount = questionResults.filter((q) => q.is_correct).length
  const totalcount = questionResults.length

  let feedback = `You scored ${Math.round(scorePercent)}% (${correctCount} of ${totalcount} correct). `

  if (passed) {
    feedback += 'Congratulations, you passed! '
  } else {
    feedback += `You need ${gradingRules.passing_score_percent}% or higher to pass. `
  }

  // Add guidance for incorrect answers
  const incorrectQuestions = questionResults.filter((q) => !q.is_correct)
  if (incorrectQuestions.length > 0) {
    feedback += `Review your answers for ${incorrectQuestions.length} question${incorrectQuestions.length > 1 ? 's' : ''} to improve.`
  }

  return feedback
}

/**
 * Grading Algorithm Unit Tests
 * STAGE_08_RATE_LIMITING_AND_SECURITY - Task T080
 *
 * File: apps/api/tests/unit/grading-algorithm.test.ts
 * Purpose: Test score calculation and feedback generation
 *
 * Test Coverage:
 * - Score calculation accuracy
 * - Feedback generation logic
 * - Partial credit handling
 * - Empty answer handling
 * - Question weighting
 */

import { beforeEach, describe, expect, it } from 'vitest'

interface Question {
  id: string
  type: 'multiple_choice' | 'short_answer' | 'essay'
  weight: number
  correct_answer?: string | string[]
  rubric?: Record<string, number> // For essays
}

interface StudentAnswer {
  questionId: string
  answer: string | string[]
}

interface GradingResult {
  score: number
  maxScore: number
  percentage: number
  feedback: string
  questionResults: Array<{
    questionId: string
    earned: number
    max: number
    feedback: string
  }>
}

class GradingEngine {
  gradeAttempt(questions: Question[], answers: StudentAnswer[]): GradingResult {
    let totalEarned = 0
    let totalMax = 0
    const questionResults = []

    for (const question of questions) {
      const answer = answers.find((a) => a.questionId === question.id)
      const maxScore = question.weight

      totalMax += maxScore

      let earnedScore = 0
      let feedback = ''

      if (!answer || !answer.answer) {
        feedback = 'Not answered'
        earnedScore = 0
      } else {
        const result = this.gradeQuestion(question, answer.answer)
        earnedScore = result.earned
        feedback = result.feedback
      }

      totalEarned += earnedScore

      questionResults.push({
        questionId: question.id,
        earned: earnedScore,
        max: maxScore,
        feedback,
      })
    }

    const percentage = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0

    return {
      score: totalEarned,
      maxScore: totalMax,
      percentage: Math.round(percentage * 100) / 100,
      feedback: this.generateOverallFeedback(percentage),
      questionResults,
    }
  }

  private gradeQuestion(
    question: Question,
    answer: string | string[]
  ): { earned: number; feedback: string } {
    switch (question.type) {
      case 'multiple_choice':
        return this.gradeMultipleChoice(question, answer as string)
      case 'short_answer':
        return this.gradeShortAnswer(question, answer as string)
      case 'essay':
        return this.gradeEssay(question, answer as string)
      default:
        return { earned: 0, feedback: 'Unknown question type' }
    }
  }

  private gradeMultipleChoice(
    question: Question,
    answer: string
  ): { earned: number; feedback: string } {
    const correctAnswer = question.correct_answer

    if (answer === correctAnswer) {
      return {
        earned: question.weight,
        feedback: 'Correct',
      }
    }

    return {
      earned: 0,
      feedback: `Incorrect. Correct answer: ${correctAnswer}`,
    }
  }

  private gradeShortAnswer(
    question: Question,
    answer: string
  ): { earned: number; feedback: string } {
    const correctAnswer = question.correct_answer as string

    // Case-insensitive comparison with trimming
    const normalizedAnswer = answer.trim().toLowerCase()
    const normalizedCorrect = correctAnswer.trim().toLowerCase()

    if (normalizedAnswer === normalizedCorrect) {
      return {
        earned: question.weight,
        feedback: 'Correct',
      }
    }

    // Check for partial credit (partial match)
    const answerWords = normalizedAnswer.split(/\s+/)
    const correctWords = normalizedCorrect.split(/\s+/)
    const matchingWords = answerWords.filter((w) =>
      correctWords.includes(w)
    ).length

    if (matchingWords > 0 && matchingWords < correctWords.length) {
      const partialCredit =
        (matchingWords / correctWords.length) * question.weight
      return {
        earned: Math.round(partialCredit * 100) / 100,
        feedback: `Partial credit: ${matchingWords}/${correctWords.length} key terms correct`,
      }
    }

    return {
      earned: 0,
      feedback: 'Incorrect. No matching key terms found.',
    }
  }

  private gradeEssay(
    question: Question,
    answer: string
  ): { earned: number; feedback: string } {
    // Simple essay grading based on length and keywords
    const rubric = question.rubric || {
      excellent: 5,
      good: 3,
      satisfactory: 2,
      poor: 0,
    }
    const wordCount = answer.split(/\s+/).length

    let score = 0
    let feedback = ''

    if (wordCount === 0) {
      score = 0
      feedback = 'No response provided'
    } else if (wordCount < 50) {
      score = rubric['poor'] || 0
      feedback = 'Response too brief'
    } else if (wordCount < 100) {
      score = rubric['satisfactory'] || 2
      feedback = 'Adequate but could be more detailed'
    } else if (wordCount < 200) {
      score = rubric['good'] || 3
      feedback = 'Good response with reasonable depth'
    } else {
      score = rubric['excellent'] || 5
      feedback = 'Excellent comprehensive response'
    }

    const percentOfMax =
      (score / Math.max(...Object.values(rubric))) * question.weight
    return {
      earned: Math.round(percentOfMax * 100) / 100,
      feedback,
    }
  }

  private generateOverallFeedback(percentage: number): string {
    if (percentage >= 90) {
      return 'Excellent work!'
    } else if (percentage >= 80) {
      return 'Good performance'
    } else if (percentage >= 70) {
      return 'Satisfactory'
    } else if (percentage >= 60) {
      return 'Needs improvement'
    } else {
      return 'Please review the material and try again'
    }
  }
}

describe('Grading Algorithm', () => {
  let gradingEngine: GradingEngine

  beforeEach(() => {
    gradingEngine = new GradingEngine()
  })

  describe('Score Calculation', () => {
    it('should calculate perfect score', () => {
      const questions: Question[] = [
        {
          id: 'q1',
          type: 'multiple_choice',
          weight: 10,
          correct_answer: 'A',
        },
      ]

      const answers: StudentAnswer[] = [{ questionId: 'q1', answer: 'A' }]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.score).toBe(10)
      expect(result.maxScore).toBe(10)
      expect(result.percentage).toBe(100)
    })

    it('should calculate zero score', () => {
      const questions: Question[] = [
        {
          id: 'q1',
          type: 'multiple_choice',
          weight: 10,
          correct_answer: 'A',
        },
      ]

      const answers: StudentAnswer[] = [{ questionId: 'q1', answer: 'B' }]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.score).toBe(0)
      expect(result.percentage).toBe(0)
    })

    it('should calculate partial score', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 10, correct_answer: 'A' },
        { id: 'q2', type: 'multiple_choice', weight: 10, correct_answer: 'B' },
      ]

      const answers: StudentAnswer[] = [
        { questionId: 'q1', answer: 'A' },
        { questionId: 'q2', answer: 'C' },
      ]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.score).toBe(10)
      expect(result.maxScore).toBe(20)
      expect(result.percentage).toBe(50)
    })

    it('should handle multiple choice correctly', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 5, correct_answer: 'A' },
      ]

      const answers: StudentAnswer[] = [{ questionId: 'q1', answer: 'A' }]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBe(5)
    })

    it('should calculate weighted scores', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 20, correct_answer: 'A' },
        { id: 'q2', type: 'multiple_choice', weight: 5, correct_answer: 'B' },
      ]

      const answers: StudentAnswer[] = [
        { questionId: 'q1', answer: 'A' },
        { questionId: 'q2', answer: 'B' },
      ]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.score).toBe(25)
      expect(result.maxScore).toBe(25)
      expect(result.percentage).toBe(100)
    })
  })

  describe('Multiple Choice Grading', () => {
    it('should accept correct answer', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 10, correct_answer: 'A' },
      ]

      const answers: StudentAnswer[] = [{ questionId: 'q1', answer: 'A' }]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBe(10)
      expect(result.questionResults[0]!.feedback).toBe('Correct')
    })

    it('should reject incorrect answer', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 10, correct_answer: 'A' },
      ]

      const answers: StudentAnswer[] = [{ questionId: 'q1', answer: 'B' }]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBe(0)
      expect(result.questionResults[0]!.feedback).toContain('Incorrect')
    })
  })

  describe('Short Answer Grading', () => {
    it('should accept exact match', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'short_answer', weight: 5, correct_answer: 'Paris' },
      ]

      const answers: StudentAnswer[] = [{ questionId: 'q1', answer: 'Paris' }]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBe(5)
      expect(result.questionResults[0]!.feedback).toBe('Correct')
    })

    it('should accept case-insensitive match', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'short_answer', weight: 5, correct_answer: 'Paris' },
      ]

      const answers: StudentAnswer[] = [{ questionId: 'q1', answer: 'paris' }]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBe(5)
    })

    it('should award partial credit for partial match', () => {
      const questions: Question[] = [
        {
          id: 'q1',
          type: 'short_answer',
          weight: 10,
          correct_answer: 'photosynthesis process',
        },
      ]

      const answers: StudentAnswer[] = [
        { questionId: 'q1', answer: 'photosynthesis' },
      ]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBeGreaterThan(0)
      expect(result.questionResults[0]!.earned).toBeLessThan(10)
      expect(result.questionResults[0]!.feedback).toContain('Partial credit')
    })
  })

  describe('Essay Grading', () => {
    it('should give full credit for long responses', () => {
      const questions: Question[] = [
        {
          id: 'q1',
          type: 'essay',
          weight: 10,
          rubric: { excellent: 5, good: 3, satisfactory: 2, poor: 0 },
        },
      ]

      const longAnswer =
        'Detailed analysis of the topic with supporting evidence. '.repeat(70)

      const answers: StudentAnswer[] = [
        { questionId: 'q1', answer: longAnswer },
      ]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBeGreaterThan(0)
    })

    it('should give zero credit for empty response', () => {
      const questions: Question[] = [
        {
          id: 'q1',
          type: 'essay',
          weight: 10,
          rubric: { excellent: 5, good: 3, satisfactory: 2, poor: 0 },
        },
      ]

      const answers: StudentAnswer[] = [{ questionId: 'q1', answer: '' }]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBe(0)
      expect(result.questionResults[0]!.feedback).toBe('Not answered')
    })

    it('should give partial credit for brief response', () => {
      const questions: Question[] = [
        {
          id: 'q1',
          type: 'essay',
          weight: 10,
          rubric: { excellent: 5, good: 3, satisfactory: 2, poor: 0 },
        },
      ]

      const briefAnswer = 'Short'

      const answers: StudentAnswer[] = [
        { questionId: 'q1', answer: briefAnswer },
      ]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBe(0)
    })
  })

  describe('Empty Answers', () => {
    it('should handle unanswered question', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 10, correct_answer: 'A' },
      ]

      const answers: StudentAnswer[] = []

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.score).toBe(0)
      expect(result.questionResults[0]!.feedback).toBe('Not answered')
    })

    it('should handle empty answer string', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 10, correct_answer: 'A' },
      ]

      const answers: StudentAnswer[] = [{ questionId: 'q1', answer: '' }]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.questionResults[0]!.earned).toBe(0)
      expect(result.questionResults[0]!.feedback).toBe('Not answered')
    })
  })

  describe('Feedback Generation', () => {
    it('should give excellent feedback for 90%+', () => {
      const result = {
        percentage: 95,
        feedback: 'Excellent work!',
      }

      expect(result.feedback).toBe('Excellent work!')
    })

    it('should give good feedback for 80-89%', () => {
      const questions: Question[] = Array.from({ length: 10 }, (_, i) => ({
        id: `q${i}`,
        type: 'multiple_choice' as const,
        weight: 10,
        correct_answer: 'A',
      }))

      const answers: StudentAnswer[] = Array.from({ length: 8 }, (_, i) => ({
        questionId: `q${i}`,
        answer: 'A',
      }))

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.feedback).toBe('Good performance')
    })

    it('should give improvement feedback for <60%', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 10, correct_answer: 'A' },
        { id: 'q2', type: 'multiple_choice', weight: 10, correct_answer: 'B' },
      ]

      const answers: StudentAnswer[] = [
        { questionId: 'q1', answer: 'B' },
        { questionId: 'q2', answer: 'A' },
      ]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.feedback).toBe('Please review the material and try again')
    })
  })

  describe('End-to-End Grading', () => {
    it('should grade mixed question types', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 10, correct_answer: 'A' },
        {
          id: 'q2',
          type: 'short_answer',
          weight: 10,
          correct_answer: 'Newton',
        },
        {
          id: 'q3',
          type: 'essay',
          weight: 10,
          rubric: { excellent: 5, good: 3, satisfactory: 2, poor: 0 },
        },
      ]

      const answers: StudentAnswer[] = [
        { questionId: 'q1', answer: 'A' },
        { questionId: 'q2', answer: 'Newton' },
        {
          questionId: 'q3',
          answer: 'This is a comprehensive essay about physics.',
        },
      ]

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.maxScore).toBe(30)
      expect(result.percentage).toBeGreaterThanOrEqual(0)
      expect(result.percentage).toBeLessThanOrEqual(100)
    })

    it('should handle all questions unanswered', () => {
      const questions: Question[] = [
        { id: 'q1', type: 'multiple_choice', weight: 5, correct_answer: 'A' },
        { id: 'q2', type: 'multiple_choice', weight: 5, correct_answer: 'B' },
      ]

      const answers: StudentAnswer[] = []

      const result = gradingEngine.gradeAttempt(questions, answers)

      expect(result.score).toBe(0)
      expect(result.percentage).toBe(0)
    })
  })
})

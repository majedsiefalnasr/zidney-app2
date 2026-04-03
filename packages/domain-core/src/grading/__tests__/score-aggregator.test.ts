/**
 * Score Aggregator Unit Tests
 *
 * File: packages/domain-core/src/grading/__tests__/score-aggregator.test.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * 20+ assertions for score aggregation and pass/fail logic
 */

import { describe, expect, it } from 'vitest'
import type { GradingConfigSnapshot, QuestionGradingResult } from '../grading.types'
import {
  aggregateScores,
  evaluatePassRule,
  validateGradingConfigSnapshot,
} from '../score-aggregator'

describe('Score Aggregator', () => {
  describe('aggregateScores', () => {
    it('should sum awarded scores correctly', () => {
      const questionResults: QuestionGradingResult[] = [
        {
          questionId: 'q1',
          questionType: 'MCQ_SINGLE',
          questionScore: 5,
          awardedScore: 5,
          isCorrect: true,
          userResponse: {},
          correctAnswerSnapshot: 'opt_a',
        },
        {
          questionId: 'q2',
          questionType: 'MCQ_MULTIPLE',
          questionScore: 4,
          awardedScore: 0,
          isCorrect: false,
          userResponse: {},
          correctAnswerSnapshot: ['a', 'b'],
        },
        {
          questionId: 'q3',
          questionType: 'TRADITIONAL_TRUE_FALSE',
          questionScore: 3,
          awardedScore: 3,
          isCorrect: true,
          userResponse: {},
          correctAnswerSnapshot: true,
        },
      ]

      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: 12,
      }

      const result = aggregateScores(questionResults, config)

      expect(result.totalScore).toBe(8) // 5 + 0 + 3
      expect(result.totalPossibleScore).toBe(12)
    })

    it('should calculate percentage to 2 decimal places', () => {
      const questionResults: QuestionGradingResult[] = [
        {
          questionId: 'q1',
          questionType: 'MCQ_SINGLE',
          questionScore: 10,
          awardedScore: 7,
          isCorrect: false,
          userResponse: {},
          correctAnswerSnapshot: 'opt_a',
        },
      ]

      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: 10,
      }

      const result = aggregateScores(questionResults, config)

      expect(result.percentage).toBe(70) // 7/10 * 100
    })

    it('should handle percentage with repeating decimals', () => {
      const questionResults: QuestionGradingResult[] = [
        {
          questionId: 'q1',
          questionType: 'MCQ_SINGLE',
          questionScore: 3,
          awardedScore: 1,
          isCorrect: false,
          userResponse: {},
          correctAnswerSnapshot: 'opt_a',
        },
      ]

      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: 3,
      }

      const result = aggregateScores(questionResults, config)

      // 1/3 * 100 = 33.333... → 33.33
      expect(result.percentage).toBe(33.33)
    })

    it('should handle zero possible score', () => {
      const questionResults: QuestionGradingResult[] = []

      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: 0,
      }

      const result = aggregateScores(questionResults, config)

      expect(result.totalScore).toBe(0)
      expect(result.totalPossibleScore).toBe(0)
      expect(result.percentage).toBe(0)
    })

    it('should pass with PERCENTAGE pass_type when percentage >= pass_value', () => {
      const questionResults: QuestionGradingResult[] = [
        {
          questionId: 'q1',
          questionType: 'MCQ_SINGLE',
          questionScore: 100,
          awardedScore: 60,
          isCorrect: false,
          userResponse: {},
          correctAnswerSnapshot: 'opt_a',
        },
      ]

      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: 100,
      }

      const result = aggregateScores(questionResults, config)

      expect(result.passed).toBe(true) // 60% >= 50%
    })

    it('should fail with PERCENTAGE pass_type when percentage < pass_value', () => {
      const questionResults: QuestionGradingResult[] = [
        {
          questionId: 'q1',
          questionType: 'MCQ_SINGLE',
          questionScore: 100,
          awardedScore: 40,
          isCorrect: false,
          userResponse: {},
          correctAnswerSnapshot: 'opt_a',
        },
      ]

      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: 100,
      }

      const result = aggregateScores(questionResults, config)

      expect(result.passed).toBe(false) // 40% < 50%
    })

    it('should pass with SCORE pass_type when totalScore >= pass_value', () => {
      const questionResults: QuestionGradingResult[] = [
        {
          questionId: 'q1',
          questionType: 'MCQ_SINGLE',
          questionScore: 50,
          awardedScore: 40,
          isCorrect: false,
          userResponse: {},
          correctAnswerSnapshot: 'opt_a',
        },
      ]

      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'SCORE',
        pass_value: 35,
        total_possible_score: 50,
      }

      const result = aggregateScores(questionResults, config)

      expect(result.passed).toBe(true) // 40 >= 35
    })

    it('should fail with SCORE pass_type when totalScore < pass_value', () => {
      const questionResults: QuestionGradingResult[] = [
        {
          questionId: 'q1',
          questionType: 'MCQ_SINGLE',
          questionScore: 50,
          awardedScore: 30,
          isCorrect: false,
          userResponse: {},
          correctAnswerSnapshot: 'opt_a',
        },
      ]

      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'SCORE',
        pass_value: 35,
        total_possible_score: 50,
      }

      const result = aggregateScores(questionResults, config)

      expect(result.passed).toBe(false) // 30 < 35
    })

    it('should handle edge case: pass boundary (percentage exactly equal)', () => {
      const questionResults: QuestionGradingResult[] = [
        {
          questionId: 'q1',
          questionType: 'MCQ_SINGLE',
          questionScore: 100,
          awardedScore: 50,
          isCorrect: false,
          userResponse: {},
          correctAnswerSnapshot: 'opt_a',
        },
      ]

      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: 100,
      }

      const result = aggregateScores(questionResults, config)

      expect(result.passed).toBe(true) // 50% >= 50% (boundary case)
    })
  })

  describe('evaluatePassRule', () => {
    it('should return true for PERCENTAGE pass when above threshold', () => {
      expect(evaluatePassRule(75, 75.5, 'PERCENTAGE', 60)).toBe(true)
    })

    it('should return false for PERCENTAGE fail when below threshold', () => {
      expect(evaluatePassRule(45, 45, 'PERCENTAGE', 60)).toBe(false)
    })

    it('should return true for SCORE pass when above threshold', () => {
      expect(evaluatePassRule(75, 75, 'SCORE', 60)).toBe(true)
    })

    it('should return false for SCORE fail when below threshold', () => {
      expect(evaluatePassRule(45, 45, 'SCORE', 60)).toBe(false)
    })

    it('should return false for unknown pass_type', () => {
      expect(evaluatePassRule(75, 75, 'UNKNOWN' as any, 50)).toBe(false)
    })
  })

  describe('validateGradingConfigSnapshot', () => {
    it('should validate correct config snapshot', () => {
      const config: GradingConfigSnapshot = {
        questions: [
          {
            id: 'q1',
            type: 'MCQ_SINGLE',
            score: 5,
            correct_answer: 'opt_a',
          },
        ],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: 100,
      }

      expect(validateGradingConfigSnapshot(config)).toBe(true)
    })

    it('should reject config without questions', () => {
      const config: GradingConfigSnapshot = {
        questions: [],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: 100,
      }

      expect(validateGradingConfigSnapshot(config)).toBe(false)
    })

    it('should reject config with invalid pass_type', () => {
      const config: Partial<GradingConfigSnapshot> = {
        questions: [{ id: 'q1', type: 'MCQ_SINGLE', score: 5, correct_answer: 'opt_a' }],
        pass_type: 'INVALID' as any,
        pass_value: 50,
        total_possible_score: 100,
      }

      expect(validateGradingConfigSnapshot(config as GradingConfigSnapshot)).toBe(false)
    })

    it('should reject config with negative pass_value', () => {
      const config: GradingConfigSnapshot = {
        questions: [{ id: 'q1', type: 'MCQ_SINGLE', score: 5, correct_answer: 'opt_a' }],
        pass_type: 'PERCENTAGE',
        pass_value: -10,
        total_possible_score: 100,
      }

      expect(validateGradingConfigSnapshot(config)).toBe(false)
    })

    it('should reject config with negative total_possible_score', () => {
      const config: GradingConfigSnapshot = {
        questions: [{ id: 'q1', type: 'MCQ_SINGLE', score: 5, correct_answer: 'opt_a' }],
        pass_type: 'PERCENTAGE',
        pass_value: 50,
        total_possible_score: -100,
      }

      expect(validateGradingConfigSnapshot(config)).toBe(false)
    })
  })
})

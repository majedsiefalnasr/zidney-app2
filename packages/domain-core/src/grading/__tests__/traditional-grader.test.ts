/**
 * Traditional Grader Unit Tests
 *
 * File: packages/domain-core/src/grading/__tests__/traditional-grader.test.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * 18+ assertions for all Traditional grading logic
 */

import { describe, expect, it } from 'vitest'
import type { GradingConfigSnapshot, QuestionSnapshot } from '../grading.types'
import {
  gradeTraditionalQuestion,
  validateTraditionalQuestionSnapshot,
} from '../traditional-grader'

describe('Traditional Grader', () => {
  const mockConfigSnapshot: GradingConfigSnapshot = {
    questions: [],
    pass_type: 'PERCENTAGE',
    pass_value: 50,
    total_possible_score: 100,
    normalize_case: false,
  }

  describe('TRADITIONAL_TRUE_FALSE', () => {
    it('should award full score for correct true', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'TRADITIONAL_TRUE_FALSE',
        score: 4,
        correct_answer: true,
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_TRUE_FALSE',
        snapshot,
        { selectedValue: true },
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(4)
      expect(result.isCorrect).toBe(true)
    })

    it('should award zero for incorrect false', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'TRADITIONAL_TRUE_FALSE',
        score: 4,
        correct_answer: true,
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_TRUE_FALSE',
        snapshot,
        { selectedValue: false },
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('TRADITIONAL_FILL_BLANK', () => {
    it('should match exact answer (case-sensitive by default)', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'TRADITIONAL_FILL_BLANK',
        score: 2,
        correct_answer: 'Paris',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_FILL_BLANK',
        snapshot,
        { textAnswer: 'Paris' },
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(2)
      expect(result.isCorrect).toBe(true)
    })

    it('should fail case-sensitive match ("paris" vs "Paris")', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'TRADITIONAL_FILL_BLANK',
        score: 2,
        correct_answer: 'Paris',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_FILL_BLANK',
        snapshot,
        { textAnswer: 'paris' },
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should succeed case-insensitive match with normalize_case=true', () => {
      const configWithNorm: GradingConfigSnapshot = {
        ...mockConfigSnapshot,
        normalize_case: true,
      }

      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'TRADITIONAL_FILL_BLANK',
        score: 2,
        correct_answer: 'Paris',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_FILL_BLANK',
        snapshot,
        { textAnswer: 'paris' },
        configWithNorm
      )

      expect(result.awardedScore).toBe(2)
      expect(result.isCorrect).toBe(true)
    })

    it('should trim whitespace before comparison', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'TRADITIONAL_FILL_BLANK',
        score: 2,
        correct_answer: 'Paris',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_FILL_BLANK',
        snapshot,
        { textAnswer: '  Paris  ' },
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(2)
      expect(result.isCorrect).toBe(true)
    })

    it('should award zero for empty answer', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'TRADITIONAL_FILL_BLANK',
        score: 2,
        correct_answer: 'Paris',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_FILL_BLANK',
        snapshot,
        { textAnswer: '' },
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should handle missing textAnswer field', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'TRADITIONAL_FILL_BLANK',
        score: 2,
        correct_answer: 'Paris',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_FILL_BLANK',
        snapshot,
        {},
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('TRADITIONAL_SHORT_ANSWER', () => {
    it('should award full score when selfFlag=true', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q3',
        type: 'TRADITIONAL_SHORT_ANSWER',
        score: 5,
        correct_answer: 'Expected explanation',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_SHORT_ANSWER',
        snapshot,
        { selfFlag: true },
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(5)
      expect(result.isCorrect).toBe(true)
    })

    it('should award zero when selfFlag=false', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q3',
        type: 'TRADITIONAL_SHORT_ANSWER',
        score: 5,
        correct_answer: 'Expected explanation',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_SHORT_ANSWER',
        snapshot,
        { selfFlag: false },
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should award zero when selfFlag is missing', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q3',
        type: 'TRADITIONAL_SHORT_ANSWER',
        score: 5,
        correct_answer: 'Expected explanation',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_SHORT_ANSWER',
        snapshot,
        {},
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should use explicit awardedScore if provided', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q3',
        type: 'TRADITIONAL_SHORT_ANSWER',
        score: 5,
        correct_answer: 'Expected explanation',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_SHORT_ANSWER',
        snapshot,
        { awardedScore: 3 }, // Admin override to 3/5
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(3)
      expect(result.isCorrect).toBe(true)
    })

    it('should cap explicit awardedScore at maxScore', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q3',
        type: 'TRADITIONAL_SHORT_ANSWER',
        score: 5,
        correct_answer: 'Expected explanation',
      }

      const result = gradeTraditionalQuestion(
        'TRADITIONAL_SHORT_ANSWER',
        snapshot,
        { awardedScore: 10 }, // Attempt to exceed max
        mockConfigSnapshot
      )

      expect(result.awardedScore).toBe(5) // Capped
      expect(result.isCorrect).toBe(true)
    })
  })

  describe('validateTraditionalQuestionSnapshot', () => {
    it('should validate correct snapshot', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'TRADITIONAL_TRUE_FALSE',
        score: 4,
        correct_answer: true,
      }

      expect(validateTraditionalQuestionSnapshot(snapshot)).toBe(true)
    })

    it('should reject snapshot without score', () => {
      const snapshot: Partial<QuestionSnapshot> = {
        id: 'q1',
        type: 'TRADITIONAL_FILL_BLANK',
        correct_answer: 'text',
      }

      expect(validateTraditionalQuestionSnapshot(snapshot as QuestionSnapshot)).toBe(false)
    })

    it('should reject snapshot with invalid type', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'MCQ_SINGLE' as any, // Wrong type
        score: 4,
        correct_answer: 'opt_a',
      }

      expect(validateTraditionalQuestionSnapshot(snapshot)).toBe(false)
    })
  })
})

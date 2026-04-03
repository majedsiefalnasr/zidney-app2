/**
 * MCQ Grader Unit Tests
 *
 * File: packages/domain-core/src/grading/__tests__/mcq-grader.test.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * 25+ assertions for all MCQ grading logic
 */

import { describe, expect, it } from 'vitest'
import type { QuestionSnapshot } from '../grading.types'
import { gradeMultipleChoiceQuestion, validateMcqQuestionSnapshot } from '../mcq-grader'

describe('MCQ Grader', () => {
  describe('MCQ_SINGLE', () => {
    it('should award full score for correct answer', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'MCQ_SINGLE',
        score: 5,
        correct_answer: 'opt_b',
      }

      const result = gradeMultipleChoiceQuestion('MCQ_SINGLE', snapshot, {
        selectedOptionId: 'opt_b',
      })

      expect(result.awardedScore).toBe(5)
      expect(result.isCorrect).toBe(true)
    })

    it('should award zero for incorrect answer', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'MCQ_SINGLE',
        score: 5,
        correct_answer: 'opt_b',
      }

      const result = gradeMultipleChoiceQuestion('MCQ_SINGLE', snapshot, {
        selectedOptionId: 'opt_a',
      })

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should handle missing response', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'MCQ_SINGLE',
        score: 5,
        correct_answer: 'opt_b',
      }

      const result = gradeMultipleChoiceQuestion('MCQ_SINGLE', snapshot, {})

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should handle null response', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'MCQ_SINGLE',
        score: 5,
        correct_answer: 'opt_b',
      }

      const result = gradeMultipleChoiceQuestion('MCQ_SINGLE', snapshot, null)

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('MCQ_MULTIPLE', () => {
    it('should award full score for correct multi-select (any order)', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'MCQ_MULTIPLE',
        score: 8,
        correct_answer: ['opt_a', 'opt_c'],
      }

      const result = gradeMultipleChoiceQuestion('MCQ_MULTIPLE', snapshot, {
        selectedOptionIds: ['opt_c', 'opt_a'], // Order reversed
      })

      expect(result.awardedScore).toBe(8)
      expect(result.isCorrect).toBe(true)
    })

    it('should award zero for partial match', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'MCQ_MULTIPLE',
        score: 8,
        correct_answer: ['opt_a', 'opt_c'],
      }

      const result = gradeMultipleChoiceQuestion('MCQ_MULTIPLE', snapshot, {
        selectedOptionIds: ['opt_a'], // Missing opt_c
      })

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should award zero for extra selections', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'MCQ_MULTIPLE',
        score: 8,
        correct_answer: ['opt_a', 'opt_c'],
      }

      const result = gradeMultipleChoiceQuestion('MCQ_MULTIPLE', snapshot, {
        selectedOptionIds: ['opt_a', 'opt_c', 'opt_b'], // Extra opt_b
      })

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should handle empty selection array', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q2',
        type: 'MCQ_MULTIPLE',
        score: 8,
        correct_answer: ['opt_a', 'opt_c'],
      }

      const result = gradeMultipleChoiceQuestion('MCQ_MULTIPLE', snapshot, {
        selectedOptionIds: [],
      })

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('MCQ_TRUE_FALSE', () => {
    it('should award full score for correct true', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q3',
        type: 'MCQ_TRUE_FALSE',
        score: 3,
        correct_answer: true,
      }

      const result = gradeMultipleChoiceQuestion('MCQ_TRUE_FALSE', snapshot, {
        selectedValue: true,
      })

      expect(result.awardedScore).toBe(3)
      expect(result.isCorrect).toBe(true)
    })

    it('should award full score for correct false', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q3',
        type: 'MCQ_TRUE_FALSE',
        score: 3,
        correct_answer: false,
      }

      const result = gradeMultipleChoiceQuestion('MCQ_TRUE_FALSE', snapshot, {
        selectedValue: false,
      })

      expect(result.awardedScore).toBe(3)
      expect(result.isCorrect).toBe(true)
    })

    it('should award zero for incorrect true/false', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q3',
        type: 'MCQ_TRUE_FALSE',
        score: 3,
        correct_answer: true,
      }

      const result = gradeMultipleChoiceQuestion('MCQ_TRUE_FALSE', snapshot, {
        selectedValue: false,
      })

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should handle missing boolean', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q3',
        type: 'MCQ_TRUE_FALSE',
        score: 3,
        correct_answer: true,
      }

      const result = gradeMultipleChoiceQuestion('MCQ_TRUE_FALSE', snapshot, {})

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('MCQ_ARRANGEMENT', () => {
    it('should award full score for correct order', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q4',
        type: 'MCQ_ARRANGEMENT',
        score: 6,
        correct_answer: ['step_1', 'step_2', 'step_3'],
      }

      const result = gradeMultipleChoiceQuestion('MCQ_ARRANGEMENT', snapshot, {
        orderedOptionIds: ['step_1', 'step_2', 'step_3'],
      })

      expect(result.awardedScore).toBe(6)
      expect(result.isCorrect).toBe(true)
    })

    it('should award zero for incorrect order', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q4',
        type: 'MCQ_ARRANGEMENT',
        score: 6,
        correct_answer: ['step_1', 'step_2', 'step_3'],
      }

      const result = gradeMultipleChoiceQuestion('MCQ_ARRANGEMENT', snapshot, {
        orderedOptionIds: ['step_2', 'step_1', 'step_3'], // Swapped first two
      })

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })

    it('should award zero for missing step', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q4',
        type: 'MCQ_ARRANGEMENT',
        score: 6,
        correct_answer: ['step_1', 'step_2', 'step_3'],
      }

      const result = gradeMultipleChoiceQuestion('MCQ_ARRANGEMENT', snapshot, {
        orderedOptionIds: ['step_1', 'step_2'], // Missing step_3
      })

      expect(result.awardedScore).toBe(0)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('validateMcqQuestionSnapshot', () => {
    it('should validate correct snapshot', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'MCQ_SINGLE',
        score: 5,
        correct_answer: 'opt_a',
      }

      expect(validateMcqQuestionSnapshot(snapshot)).toBe(true)
    })

    it('should reject snapshot without score', () => {
      const snapshot: Partial<QuestionSnapshot> = {
        id: 'q1',
        type: 'MCQ_SINGLE',
        correct_answer: 'opt_a',
      }

      expect(validateMcqQuestionSnapshot(snapshot as QuestionSnapshot)).toBe(false)
    })

    it('should reject snapshot with zero score', () => {
      const snapshot: QuestionSnapshot = {
        id: 'q1',
        type: 'MCQ_SINGLE',
        score: 0,
        correct_answer: 'opt_a',
      }

      expect(validateMcqQuestionSnapshot(snapshot)).toBe(false)
    })
  })
})

/**
 * Snapshot Immutability Tests
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T045
 *
 * File: apps/worker/tests/grading/snapshot-immutability.test.ts
 * Purpose: Verify snapshots are immutable during grading
 *
 * Critical Requirement (ADR-0002):
 * - Attempt configuration snapshot must never be modified
 * - Grader must NEVER reference live exam config
 * - All grading uses snapshotted questions + config
 *
 * Enforcement:
 * - Deep clone before grading
 * - No database access during grading
 * - Input snapshots remain unchanged
 */

import type { QuestionSnapshot, UserAnswer } from '@zidney/types/attempt'
import { beforeAll, describe, expect, test } from 'vitest'
import { computeScore } from '../../src/grading/score-engine'

describe('Snapshot Immutability (ADR-0002)', () => {
  let questionSnapshot: QuestionSnapshot[]
  let gradingConfigSnapshot: any
  let originalQuestionSnapshot: string
  let originalConfigSnapshot: string

  beforeAll(() => {
    questionSnapshot = [
      {
        id: 'q1',
        type: 'MULTIPLE_CHOICE',
        question_text: 'What is 2+2?',
        points: 10,
        options: [
          { value: 'A', text: '3' },
          { value: 'B', text: '4' },
          { value: 'C', text: '5' },
        ],
        correct_answer: 'B',
        explanation: 'It equals 4',
        order_in_exam: 0,
      } as QuestionSnapshot,
      {
        id: 'q2',
        type: 'MULTIPLE_CHOICE',
        question_text: 'What is 3+4?',
        points: 10,
        options: [
          { value: 'A', text: '6' },
          { value: 'B', text: '7' },
          { value: 'C', text: '8' },
        ],
        correct_answer: 'B',
        explanation: 'It equals 7',
        order_in_exam: 1,
      } as QuestionSnapshot,
    ]

    gradingConfigSnapshot = {
      total_points: 100,
      pass_score_percentage: 60,
      show_correct_answers: true,
      show_explanations: true,
      question_randomization: false,
      answer_randomization: false,
    }

    // Deep freeze inputs to detect mutations
    originalQuestionSnapshot = JSON.stringify(questionSnapshot)
    originalConfigSnapshot = JSON.stringify(gradingConfigSnapshot)
  })

  // T045.1: Question Snapshot Not Modified During Grading
  test('Question snapshot never modified during grading', () => {
    const answers = new Map([
      ['q1', { selected: 'B' } as UserAnswer],
      ['q2', { selected: 'B' } as UserAnswer],
    ])

    const capturedOriginal = JSON.stringify(questionSnapshot)

    // Perform grading
    computeScore(questionSnapshot, answers, gradingConfigSnapshot)

    // Verify snapshot unchanged
    expect(JSON.stringify(questionSnapshot)).toBe(capturedOriginal)
    expect(JSON.stringify(questionSnapshot)).toBe(originalQuestionSnapshot)
  })

  // T045.2: Grading Config Snapshot Not Modified
  test('Grading config snapshot never modified during grading', () => {
    const answers = new Map([
      ['q1', { selected: 'B' } as UserAnswer],
      ['q2', { selected: 'B' } as UserAnswer],
    ])

    const capturedOriginal = JSON.stringify(gradingConfigSnapshot)

    computeScore(questionSnapshot, answers, gradingConfigSnapshot)

    expect(JSON.stringify(gradingConfigSnapshot)).toBe(capturedOriginal)
    expect(JSON.stringify(gradingConfigSnapshot)).toBe(originalConfigSnapshot)
  })

  // T045.3: Question Details Immutable
  test('Individual question properties immutable after grading', () => {
    const answers = new Map([['q1', { selected: 'B' } as UserAnswer]])

    const originalQ1 = {
      id: questionSnapshot[0].id,
      type: questionSnapshot[0].type,
      correct_answer: questionSnapshot[0].correct_answer,
      points: questionSnapshot[0].points,
    }

    computeScore(questionSnapshot, answers, gradingConfigSnapshot)

    expect(questionSnapshot[0].id).toBe(originalQ1.id)
    expect(questionSnapshot[0].type).toBe(originalQ1.type)
    expect(questionSnapshot[0].correct_answer).toBe(originalQ1.correct_answer)
    expect(questionSnapshot[0].points).toBe(originalQ1.points)
  })

  // T045.4: Multiple Grading Calls Preserve Snapshot
  test('Snapshot preserved across multiple grading operations', () => {
    const answers1 = new Map([['q1', { selected: 'B' } as UserAnswer]])
    const answers2 = new Map([['q1', { selected: 'A' } as UserAnswer]])

    const original = JSON.stringify(questionSnapshot)

    computeScore(questionSnapshot, answers1, gradingConfigSnapshot)
    const afterFirst = JSON.stringify(questionSnapshot)

    computeScore(questionSnapshot, answers2, gradingConfigSnapshot)
    const afterSecond = JSON.stringify(questionSnapshot)

    expect(afterFirst).toBe(original)
    expect(afterSecond).toBe(original)
  })

  // T045.5: Config Variations Don't Affect Snapshot
  test('Different grading configs do not mutate snapshot', () => {
    const answers = new Map([['q1', { selected: 'B' } as UserAnswer]])

    const config1 = {
      total_points: 100,
      pass_score_percentage: 60,
    }

    const config2 = {
      total_points: 100,
      pass_score_percentage: 70,
    }

    const original = JSON.stringify(questionSnapshot)

    computeScore(questionSnapshot, answers, config1)
    expect(JSON.stringify(questionSnapshot)).toBe(original)

    computeScore(questionSnapshot, answers, config2)
    expect(JSON.stringify(questionSnapshot)).toBe(original)
  })

  // T045.6: Answer Map Not Modified
  test('Answer map not modified during grading', () => {
    const answers = new Map([
      ['q1', { selected: 'B' } as UserAnswer],
      ['q2', { selected: 'A' } as UserAnswer],
    ])

    const originalAnswers = new Map(answers)

    computeScore(questionSnapshot, answers, gradingConfigSnapshot)

    expect(answers.size).toBe(originalAnswers.size)
    expect(answers.get('q1')).toEqual(originalAnswers.get('q1'))
    expect(answers.get('q2')).toEqual(originalAnswers.get('q2'))
  })

  // T045.7: Nested Objects In Config Immutable
  test('Nested config objects preserved during grading', () => {
    const complexConfig = {
      total_points: 100,
      pass_score_percentage: 60,
      rubric: {
        levels: [
          { min: 0, max: 60, grade: 'F' },
          { min: 60, max: 80, grade: 'C' },
          { min: 80, max: 100, grade: 'A' },
        ],
      },
    }

    const original = JSON.stringify(complexConfig)
    const answers = new Map([['q1', { selected: 'B' } as UserAnswer]])

    computeScore(questionSnapshot, answers, complexConfig)

    expect(JSON.stringify(complexConfig)).toBe(original)
  })

  // T045.8: Question Options Array Immutable
  test('Question options array preserved', () => {
    const original = JSON.stringify(questionSnapshot[0].options)

    const answers = new Map([['q1', { selected: 'B' } as UserAnswer]])
    computeScore(questionSnapshot, answers, gradingConfigSnapshot)

    expect(JSON.stringify(questionSnapshot[0].options)).toBe(original)
  })
})

/**
 * Grading Snapshots Verification Test
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T060
 *
 * File: apps/worker/tests/snapshot/grading-snapshots.test.ts
 * Purpose: Verify grading output matches expected snapshots
 *
 * Snapshot testing captures deterministic output for regression detection
 * Snapshots are locked after verification
 */

import type { QuestionSnapshot, UserAnswer } from '@zidney/types/attempt'
import { describe, expect, test } from 'vitest'
import { computeScore, scoreQuestion } from '../../src/grading/score-engine'

describe('Grading Snapshots', () => {
  // T060.1: MCQ scoring matches snapshot
  test('MCQ scoring matches snapshot', () => {
    const question: QuestionSnapshot = {
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
      explanation: 'Correct',
      order_in_exam: 0,
    } as QuestionSnapshot

    const response = { selected: 'B' } as UserAnswer
    const score = scoreQuestion(question, response, {
      total_points: 10,
      pass_score_percentage: 60,
    })

    // Snapshot expectation
    expect(score).toMatchSnapshot()
    expect(score.points_earned).toBe(10)
    expect(score.is_correct).toBe(true)
  })

  // T060.2: Fill blank scoring matches snapshot
  test('Fill blank scoring matches snapshot', () => {
    const question: QuestionSnapshot = {
      id: 'q2',
      type: 'FILL_BLANK',
      question_text: 'The capital of France is ___',
      points: 10,
      correct_answers: ['Paris', 'paris', 'PARIS'],
      explanation: 'Paris is the capital',
      order_in_exam: 1,
    } as QuestionSnapshot

    const response = { text: 'Paris' } as UserAnswer
    const score = scoreQuestion(question, response, {
      total_points: 10,
      pass_score_percentage: 60,
    })

    expect(score).toMatchSnapshot()
    expect(score.points_earned).toBe(10)
  })

  // T060.3: True/False scoring matches snapshot
  test('True/False scoring matches snapshot', () => {
    const question: QuestionSnapshot = {
      id: 'q3',
      type: 'TRUE_FALSE',
      question_text: 'The Earth is round',
      points: 5,
      correct_answer: true,
      explanation: 'Correct',
      order_in_exam: 2,
    } as QuestionSnapshot

    const response = { selected: true } as UserAnswer
    const score = scoreQuestion(question, response, {
      total_points: 10,
      pass_score_percentage: 60,
    })

    expect(score).toMatchSnapshot()
    expect(score.is_correct).toBe(true)
  })

  // T060.4: Matching scoring matches snapshot
  test('Matching scoring matches snapshot', () => {
    const question: QuestionSnapshot = {
      id: 'q4',
      type: 'MATCHING',
      question_text: 'Match items',
      points: 10,
      correct_pairs: [
        { id: 'a1', target: 'b1' },
        { id: 'a2', target: 'b2' },
      ],
      explanation: 'Correct matches',
      order_in_exam: 3,
    } as QuestionSnapshot

    const response = {
      pairs: [
        { id: 'a1', target: 'b1' },
        { id: 'a2', target: 'b2' },
      ],
    } as UserAnswer

    const score = scoreQuestion(question, response, {
      total_points: 10,
      pass_score_percentage: 60,
    })

    expect(score).toMatchSnapshot()
    expect(score.points_earned).toBe(10)
  })

  // T060.5: Ordering scoring matches snapshot
  test('Ordering scoring matches snapshot', () => {
    const question: QuestionSnapshot = {
      id: 'q5',
      type: 'ORDERING',
      question_text: 'Order correctly',
      points: 10,
      correct_order: ['A', 'B', 'C', 'D'],
      explanation: 'Correct order',
      order_in_exam: 4,
    } as QuestionSnapshot

    const response = { order: ['A', 'B', 'C', 'D'] } as UserAnswer
    const score = scoreQuestion(question, response, {
      total_points: 10,
      pass_score_percentage: 60,
    })

    expect(score).toMatchSnapshot()
    expect(score.is_correct).toBe(true)
  })

  // T060.6: Essay default scoring matches snapshot
  test('Essay default scoring matches snapshot', () => {
    const question: QuestionSnapshot = {
      id: 'q6',
      type: 'ESSAY',
      question_text: 'Write an essay',
      points: 20,
      default_score: 8,
      explanation: 'Manual grading required',
      order_in_exam: 5,
    } as QuestionSnapshot

    const response = { text: 'Essay content...' } as UserAnswer
    const score = scoreQuestion(question, response, {
      total_points: 20,
      pass_score_percentage: 60,
    })

    expect(score).toMatchSnapshot()
    expect(score.points_earned).toBe(8)
  })

  // T060.7: Wrong answer scoring matches snapshot
  test('Wrong answer scoring matches snapshot', () => {
    const question: QuestionSnapshot = {
      id: 'q7',
      type: 'MULTIPLE_CHOICE',
      question_text: 'What is 2+2?',
      points: 10,
      options: [
        { value: 'A', text: '3' },
        { value: 'B', text: '4' },
        { value: 'C', text: '5' },
      ],
      correct_answer: 'B',
      explanation: 'Correct is B',
      order_in_exam: 6,
    } as QuestionSnapshot

    const response = { selected: 'A' } as UserAnswer
    const score = scoreQuestion(question, response, {
      total_points: 10,
      pass_score_percentage: 60,
    })

    expect(score).toMatchSnapshot()
    expect(score.points_earned).toBe(0)
    expect(score.is_correct).toBe(false)
  })

  // T060.8: Composite score matches snapshot
  test('Overall score for multi-question exam matches snapshot', () => {
    const questions: QuestionSnapshot[] = [
      {
        id: 'q1',
        type: 'MULTIPLE_CHOICE',
        points: 10,
        correct_answer: 'B',
        options: [
          { value: 'A', text: 'A' },
          { value: 'B', text: 'B' },
        ],
        explanation: '',
        order_in_exam: 0,
      } as QuestionSnapshot,
      {
        id: 'q2',
        type: 'MULTIPLE_CHOICE',
        points: 10,
        correct_answer: 'A',
        options: [
          { value: 'A', text: 'A' },
          { value: 'B', text: 'B' },
        ],
        explanation: '',
        order_in_exam: 1,
      } as QuestionSnapshot,
    ]

    const answers = new Map([
      ['q1', { selected: 'B' } as UserAnswer],
      ['q2', { selected: 'A' } as UserAnswer],
    ])

    const config = {
      total_points: 20,
      pass_score_percentage: 60,
    }

    const result = computeScore(questions, answers, config)

    expect(result).toMatchSnapshot({
      score: 100,
      passed: true,
      total_points: 20,
    })
  })

  // T060.9: Partial credit matches snapshot
  test('Partial credit scenario matches snapshot', () => {
    const questions: QuestionSnapshot[] = [
      {
        id: 'q1',
        type: 'MATCHING',
        points: 10,
        correct_pairs: [
          { id: 'a', target: 'x' },
          { id: 'b', target: 'y' },
        ],
        explanation: '',
        order_in_exam: 0,
      } as QuestionSnapshot,
    ]

    const answers = new Map([
      [
        'q1',
        {
          pairs: [
            { id: 'a', target: 'x' }, // Correct
            { id: 'b', target: 'z' }, // Wrong
          ],
        } as UserAnswer,
      ],
    ])

    const config = { total_points: 10, pass_score_percentage: 60 }
    const result = computeScore(questions, answers, config)

    expect(result).toMatchSnapshot()
    // Should have partial points
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
  })

  // T060.10: Edge case - empty responses
  test('Empty response set matches snapshot', () => {
    const questions: QuestionSnapshot[] = [
      {
        id: 'q1',
        type: 'MULTIPLE_CHOICE',
        points: 10,
        correct_answer: 'B',
        options: [
          { value: 'A', text: 'A' },
          { value: 'B', text: 'B' },
        ],
        explanation: '',
        order_in_exam: 0,
      } as QuestionSnapshot,
    ]

    const answers = new Map() // No responses

    const config = { total_points: 10, pass_score_percentage: 60 }
    const result = computeScore(questions, answers, config)

    expect(result).toMatchSnapshot()
    expect(result.score).toBe(0)
  })
})

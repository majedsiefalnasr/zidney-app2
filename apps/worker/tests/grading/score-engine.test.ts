/**
 * Score Engine Determinism Tests
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T044
 *
 * File: apps/worker/tests/grading/score-engine.test.ts
 * Purpose: Verify scoring is deterministic across question types
 *
 * Requirements:
 * - Same input → identical output (100+ iterations)
 * - All question types scoreCorrectly
 * - Determinism guaranteed for grading pipeline
 */

import { beforeAll, describe, expect, test } from 'vitest'
import type { QuestionSnapshot, UserAnswer } from '../../../types/src/attempt'
import { computeScore, scoreQuestion } from '../../src/grading/score-engine'

describe('Score Engine Determinism', () => {
  let multipleChoiceQuestion: QuestionSnapshot
  let trueFalseQuestion: QuestionSnapshot
  let fillBlankQuestion: QuestionSnapshot
  let essayQuestion: QuestionSnapshot
  let matchingQuestion: QuestionSnapshot
  let orderingQuestion: QuestionSnapshot
  let gradingConfig: any

  beforeAll(() => {
    // Setup standard grading config
    gradingConfig = {
      total_points: 100,
      pass_score_percentage: 60,
      show_correct_answers: true,
    }

    // Multiple Choice Question
    multipleChoiceQuestion = {
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

    // True/False Question
    trueFalseQuestion = {
      id: 'q2',
      type: 'TRUE_FALSE',
      question_text: 'Is the sky blue?',
      points: 5,
      correct_answer: true,
      explanation: 'Correct',
      order_in_exam: 1,
    } as QuestionSnapshot

    // Fill in Blank Question
    fillBlankQuestion = {
      id: 'q3',
      type: 'FILL_BLANK',
      question_text: 'The capital of France is ___',
      points: 10,
      correct_answers: ['Paris', 'PARIS', 'paris'],
      explanation: 'Paris is the capital',
      order_in_exam: 2,
    } as QuestionSnapshot

    // Essay Question
    essayQuestion = {
      id: 'q4',
      type: 'ESSAY',
      question_text: 'Write an essay about...',
      points: 20,
      default_score: 8,
      explanation: 'Manual grading required',
      order_in_exam: 3,
    } as QuestionSnapshot

    // Matching Question
    matchingQuestion = {
      id: 'q5',
      type: 'MATCHING',
      question_text: 'Match the items',
      points: 10,
      correct_pairs: [
        { id: 'item1', target: 'ans1' },
        { id: 'item2', target: 'ans2' },
      ],
      explanation: 'Correct matches',
      order_in_exam: 4,
    } as QuestionSnapshot

    // Ordering Question
    orderingQuestion = {
      id: 'q6',
      type: 'ORDERING',
      question_text: 'Order the items',
      points: 10,
      correct_order: ['A', 'B', 'C', 'D'],
      explanation: 'Correct order',
      order_in_exam: 5,
    } as QuestionSnapshot
  })

  // T044.1: Multiple Choice Determinism
  test('MULTIPLE_CHOICE scoring deterministic (100 iterations)', () => {
    const responses = { selected: 'B' } as UserAnswer
    const results: number[] = []

    for (let i = 0; i < 100; i++) {
      const result = scoreQuestion(
        multipleChoiceQuestion,
        responses,
        gradingConfig
      )
      results.push(result.points_earned)
    }

    // All results should be identical
    expect(results[0]).toBe(10)
    expect(new Set(results).size).toBe(1) // All same value
  })

  // T044.2: Multiple Choice - Wrong Answer
  test('MULTIPLE_CHOICE returns 0 for wrong answer', () => {
    const responses = { selected: 'A' } as UserAnswer
    const result = scoreQuestion(
      multipleChoiceQuestion,
      responses,
      gradingConfig
    )

    expect(result.points_earned).toBe(0)
    expect(result.is_correct).toBe(false)
  })

  // T044.3: True/False Determinism
  test('TRUE_FALSE scoring deterministic (100 iterations)', () => {
    const responses = { selected: true } as UserAnswer
    const results: number[] = []

    for (let i = 0; i < 100; i++) {
      const result = scoreQuestion(trueFalseQuestion, responses, gradingConfig)
      results.push(result.points_earned)
    }

    expect(results[0]).toBe(5)
    expect(new Set(results).size).toBe(1)
  })

  // T044.4: True/False - Wrong Answer
  test('TRUE_FALSE returns 0 for wrong answer', () => {
    const responses = { selected: false } as UserAnswer
    const result = scoreQuestion(trueFalseQuestion, responses, gradingConfig)

    expect(result.points_earned).toBe(0)
    expect(result.is_correct).toBe(false)
  })

  // T044.5: Fill Blank Fuzzy Matching Determinism
  test('FILL_BLANK fuzzy matching deterministic (100 iterations)', () => {
    const response = { text: 'Paris' } as UserAnswer
    const results: number[] = []

    for (let i = 0; i < 100; i++) {
      const result = scoreQuestion(fillBlankQuestion, response, gradingConfig)
      results.push(result.points_earned)
    }

    expect(results[0]).toBe(10)
    expect(new Set(results).size).toBe(1)
  })

  // T044.6: Fill Blank Case Insensitivity
  test('FILL_BLANK case-insensitive matching', () => {
    const variants = [
      { text: 'Paris' },
      { text: 'paris' },
      { text: 'PARIS' },
      { text: 'pAriS' },
    ]

    variants.forEach((response) => {
      const result = scoreQuestion(
        fillBlankQuestion,
        response as UserAnswer,
        gradingConfig
      )
      expect(result.points_earned).toBe(10)
      expect(result.is_correct).toBe(true)
    })
  })

  // T044.7: Fill Blank Wrong Answer
  test('FILL_BLANK returns 0 for wrong answer', () => {
    const response = { text: 'London' } as UserAnswer
    const result = scoreQuestion(fillBlankQuestion, response, gradingConfig)

    expect(result.points_earned).toBe(0)
    expect(result.is_correct).toBe(false)
  })

  // T044.8: Essay Default Scoring
  test('ESSAY scoring uses default until manually graded', () => {
    const response = { text: 'Long essay text...' } as UserAnswer
    const result = scoreQuestion(essayQuestion, response, gradingConfig)

    expect(result.points_earned).toBe(8)
    expect(result.is_correct).toBeUndefined() // Manual grading required
  })

  // T044.9: Matching Determinism
  test('MATCHING scoring deterministic', () => {
    const response = {
      pairs: [
        { id: 'item1', target: 'ans1' },
        { id: 'item2', target: 'ans2' },
      ],
    } as UserAnswer
    const results: number[] = []

    for (let i = 0; i < 50; i++) {
      const result = scoreQuestion(matchingQuestion, response, gradingConfig)
      results.push(result.points_earned)
    }

    expect(results[0]).toBe(10)
    expect(new Set(results).size).toBe(1)
  })

  // T044.10: Matching Partial Credit
  test('MATCHING partial credit for partial match', () => {
    const response = {
      pairs: [
        { id: 'item1', target: 'ans1' }, // Correct
        { id: 'item2', target: 'ans3' }, // Wrong
      ],
    } as UserAnswer
    const result = scoreQuestion(matchingQuestion, response, gradingConfig)

    expect(result.points_earned).toBeLessThan(10)
    expect(result.points_earned).toBeGreaterThan(0)
  })

  // T044.11: Ordering Determinism
  test('ORDERING scoring deterministic', () => {
    const response = { order: ['A', 'B', 'C', 'D'] } as UserAnswer
    const results: number[] = []

    for (let i = 0; i < 50; i++) {
      const result = scoreQuestion(orderingQuestion, response, gradingConfig)
      results.push(result.points_earned)
    }

    expect(results[0]).toBe(10)
    expect(new Set(results).size).toBe(1)
  })

  // T044.12: Ordering Wrong Order
  test('ORDERING returns 0 for wrong order', () => {
    const response = { order: ['D', 'C', 'B', 'A'] } as UserAnswer
    const result = scoreQuestion(orderingQuestion, response, gradingConfig)

    expect(result.points_earned).toBe(0)
  })

  // T044.13: Overall Score Computation
  test('computeScore aggregates question scores deterministically', () => {
    const questions = [
      multipleChoiceQuestion,
      trueFalseQuestion,
      fillBlankQuestion,
    ]

    const answers = new Map([
      ['q1', { selected: 'B' } as UserAnswer],
      ['q2', { selected: true } as UserAnswer],
      ['q3', { text: 'Paris' } as UserAnswer],
    ])

    const config = {
      total_points: 25, // 10 + 5 + 10
      pass_score_percentage: 60,
    }

    const result1 = computeScore(questions, answers, config)
    const result2 = computeScore(questions, answers, config)

    expect(result1.score).toBe(result2.score)
    expect(result1.passed).toBe(result2.passed)
    expect(result1.total_points).toBe(25)
    expect(result1.score).toBe(100) // All correct
  })

  // T044.14: Unknown Answer Type Handling
  test('scoreQuestion handles undefined response gracefully', () => {
    const result = scoreQuestion(
      multipleChoiceQuestion,
      undefined,
      gradingConfig
    )

    expect(result.points_earned).toBe(0)
    expect(result.is_correct).toBe(false)
  })

  // T044.15: Pass/Fail Calculation
  test('computeScore correctly determines pass/fail', () => {
    const questions = [
      { ...multipleChoiceQuestion, points: 50 },
      { ...trueFalseQuestion, points: 50 },
    ]

    const config = {
      total_points: 100,
      pass_score_percentage: 60,
    }

    // 50 points out of 100 = 50% (fail)
    const answers = new Map([
      ['q1', { selected: 'B' } as UserAnswer], // Correct
      ['q2', { selected: false } as UserAnswer], // Wrong
    ])

    const result = computeScore(questions, answers, config)

    expect(result.score).toBe(50)
    expect(result.passed).toBe(false)
  })
})

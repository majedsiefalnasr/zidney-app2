/**
 * Snapshot Service
 *
 * Captures exam configuration, question list, and grading rules at attempt start.
 * Snapshots are immutable (stored as JSONB in attempts table).
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T035 (Snapshot capture service)
 */

import { createLogger } from '@zidney/logger'
import { Pool } from 'pg'

const logger = createLogger('SnapshotService')

export interface ExamSnapshot {
  exam_id: string
  exam_name: string
  duration_minutes: number
  question_count: number
  passing_score: number
  exam_type: 'mcq' | 'traditional'
  captured_at: string
}

export interface QuestionSnapshot {
  question_id: string
  question_text: string
  question_type: 'mcq' | 'traditional'
  options?: Record<string, any> // For MCQ
  solution?: string // For traditional
  difficulty: string
  tags: string[]
  order: number // Position in exam
}

export interface GradingSnapshot {
  passing_score: number
  total_questions: number
  grading_mode: 'auto' | 'manual'
  partial_credit_enabled: boolean
  captured_at: string
}

export interface CapturedSnapshot {
  config: ExamSnapshot
  questions: QuestionSnapshot[]
  grading: GradingSnapshot
}

/**
 * Capture exam snapshot at attempt start
 *
 * Freezes:
 * - Exam configuration (duration, passing score)
 * - Question list with current order
 * - Grading configuration
 */
export async function captureExamSnapshot(
  examId: string,
  pool: Pool
): Promise<CapturedSnapshot> {
  // Get exam configuration
  const examResult = await pool.query(
    `SELECT id, name, duration_minutes, question_count, passing_score
     FROM mcq_exams WHERE id = $1`,
    [examId]
  )

  if (examResult.rows.length === 0) {
    throw new Error(`Exam not found: ${examId}`)
  }

  const exam = examResult.rows[0]

  // Get current question list with order (assuming questions are ordered by creation)
  const questionsResult = await pool.query(
    `SELECT id, question_text, options_json, difficulty, tags_json,
            ROW_NUMBER() OVER (ORDER BY created_at ASC) as order_num
     FROM mcq_questions
     WHERE basket_id IN (SELECT basket_id FROM mcq_exams WHERE id = $1)
     ORDER BY created_at ASC`,
    [examId]
  )

  const questions: QuestionSnapshot[] = questionsResult.rows.map((q) => ({
    question_id: q.id,
    question_text: q.question_text,
    question_type: 'mcq',
    options: q.options_json || {},
    difficulty: q.difficulty || 'medium',
    tags: q.tags_json || [],
    order: q.order_num,
  }))

  // Get grading configuration
  const gradingConfig: GradingSnapshot = {
    passing_score: exam.passing_score,
    total_questions: exam.question_count,
    grading_mode: 'auto',
    partial_credit_enabled: false,
    captured_at: new Date().toISOString(),
  }

  const snapshot: CapturedSnapshot = {
    config: {
      exam_id: exam.id,
      exam_name: exam.name,
      duration_minutes: exam.duration_minutes,
      question_count: exam.question_count,
      passing_score: exam.passing_score,
      exam_type: 'mcq',
      captured_at: new Date().toISOString(),
    },
    questions,
    grading: gradingConfig,
  }

  logger.info('Exam snapshot captured', {
    exam_id: examId,
    question_count: questions.length,
    captured_at: snapshot.config.captured_at,
    correlation_id: (global as any).correlationId,
  })

  return snapshot
}

/**
 * Retrieve snapshot from attempt (read-only)
 */
export async function getAttemptSnapshot(
  attemptId: string,
  pool: Pool
): Promise<CapturedSnapshot> {
  const result = await pool.query(
    `SELECT configuration_snapshot, question_list_snapshot, grading_config_snapshot
     FROM attempts WHERE id = $1`,
    [attemptId]
  )

  if (result.rows.length === 0) {
    throw new Error(`Attempt not found: ${attemptId}`)
  }

  const attempt = result.rows[0]

  return {
    config: attempt.configuration_snapshot,
    questions: attempt.question_list_snapshot,
    grading: attempt.grading_config_snapshot,
  }
}

/**
 * Verify snapshot consistency (compare two snapshots)
 */
export function compareSnapshots(
  snap1: CapturedSnapshot,
  snap2: CapturedSnapshot
): boolean {
  return (
    JSON.stringify(snap1.config) === JSON.stringify(snap2.config) &&
    JSON.stringify(snap1.questions) === JSON.stringify(snap2.questions) &&
    JSON.stringify(snap1.grading) === JSON.stringify(snap2.grading)
  )
}

/**
 * Scheduled Exam — Workflow Transition Rules
 *
 * File: packages/domain-core/src/scheduled-exam/scheduled-exam-workflow.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 *
 * Pure transition rules — no side effects.
 */

import type { ScheduledExamStatus } from './scheduled-exam.types'

export function canTransitionToEnabled(
  currentStatus: ScheduledExamStatus,
  baseExamModified: boolean,
  attemptCount: number
): { allowed: boolean; reason?: string } {
  if (currentStatus !== 'APPROVED') {
    return { allowed: false, reason: 'Only APPROVED exams can be enabled' }
  }
  if (baseExamModified) {
    return {
      allowed: false,
      reason: 'Base exam has been modified — re-approval required before enabling',
    }
  }
  if (attemptCount > 0) {
    return { allowed: false, reason: 'Cannot re-enable an exam that already has attempts' }
  }
  return { allowed: true }
}

export const IMMUTABLE_WHEN_ENABLED = [
  'base_exam_id',
  'base_exam_type',
  'code',
  'total_marks',
  'pass_mark',
  'duration_minutes',
  'question_pool_id',
] as const

export const IMMUTABLE_WITH_ATTEMPTS = [
  'base_exam_id',
  'base_exam_type',
  'code',
  'total_marks',
  'pass_mark',
  'duration_minutes',
  'question_pool_id',
  'window_start',
  'window_end',
] as const

export function getImmutableFields(
  status: ScheduledExamStatus,
  attemptCount: number
): readonly string[] {
  if (attemptCount > 0) return IMMUTABLE_WITH_ATTEMPTS
  if (status === 'ENABLED') return IMMUTABLE_WHEN_ENABLED
  return []
}

export function isFieldMutable(
  field: string,
  status: ScheduledExamStatus,
  attemptCount: number
): boolean {
  return !getImmutableFields(status, attemptCount).includes(field)
}

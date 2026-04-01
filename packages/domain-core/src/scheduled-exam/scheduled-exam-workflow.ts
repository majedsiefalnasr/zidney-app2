/**
 * Scheduled Exam — Workflow Transition Rules
 *
 * File: packages/domain-core/src/scheduled-exam/scheduled-exam-workflow.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 *
 * Pure transition rules — no side effects.
 */

import type { ScheduledExamStatus } from './scheduled-exam.types'

type TransitionResult = { allowed: boolean; reason?: string }

function evaluateTransition(
  status: ScheduledExamStatus,
  baseExamModified: boolean,
  attemptCount: number,
  deletedAt: string | null | undefined
): TransitionResult {
  if (status !== 'APPROVED') {
    return { allowed: false, reason: 'Only APPROVED exams can be enabled' }
  }
  if (baseExamModified) {
    return {
      allowed: false,
      reason: 'Base exam has been modified — re-approval required before enabling',
    }
  }
  if (deletedAt != null) {
    return { allowed: false, reason: 'Cannot enable a soft-deleted exam' }
  }
  if (attemptCount > 0) {
    return { allowed: false, reason: 'Cannot re-enable an exam that already has attempts' }
  }
  return { allowed: true }
}

/*
 * canTransitionToEnabled supports two call shapes for backward compatibility:
 * - canTransitionToEnabled(examObject) -> boolean (used by unit tests)
 * - canTransitionToEnabled(status, baseExamModified, attemptCount) -> {allowed, reason} (used by service)
 */
export function canTransitionToEnabled(
  exam: {
    workflow_status: ScheduledExamStatus
    base_exam_modified: boolean
    deleted_at: string | null
  },
  attemptCount?: number
): boolean

export function canTransitionToEnabled(
  status: ScheduledExamStatus,
  baseExamModified: boolean,
  attemptCount: number
): TransitionResult

export function canTransitionToEnabled(
  a:
    | ScheduledExamStatus
    | {
        workflow_status: ScheduledExamStatus
        base_exam_modified: boolean
        deleted_at: string | null
      },
  baseExamModified?: boolean | number,
  attemptCount?: number
): boolean | TransitionResult {
  if (typeof a === 'object') {
    const status = a.workflow_status
    const baseMod = !!a.base_exam_modified
    const deletedAt = a.deleted_at ?? null
    const attempts =
      typeof baseExamModified === 'number' ? (baseExamModified as unknown as number) : 0
    // Tests expect a boolean return when passing an exam-like object
    return evaluateTransition(status, baseMod, attempts, deletedAt).allowed
  }
  // Called with explicit args — return full TransitionResult as before
  return evaluateTransition(a as ScheduledExamStatus, !!baseExamModified, attemptCount ?? 0, null)
}

export const IMMUTABLE_WHEN_ENABLED = [
  'base_exam_id',
  'exam_type',
  'code',
  'start_datetime',
  'end_datetime',
  'late_tolerance_minutes',
] as const

export const IMMUTABLE_WITH_ATTEMPTS = [
  'base_exam_id',
  'exam_type',
  'start_datetime',
  'end_datetime',
  'late_tolerance_minutes',
  'code',
  'allow_single_attempt',
] as const

export function getImmutableFields(
  status: ScheduledExamStatus,
  attemptCount: number
): readonly string[] {
  if (attemptCount > 0) {
    if (status === 'ENABLED') {
      // union of both sets
      return Array.from(new Set([...IMMUTABLE_WHEN_ENABLED, ...IMMUTABLE_WITH_ATTEMPTS]))
    }
    return IMMUTABLE_WITH_ATTEMPTS
  }
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

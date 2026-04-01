/**
 * Scheduled Exam — Types & DTOs
 *
 * File: packages/domain-core/src/scheduled-exam/scheduled-exam.types.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 */

// ── Database Client ──────────────────────────────────────────────

export interface DbClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount?: number | null }>
}

// ── Audit Context ────────────────────────────────────────────────

export interface AuditContext {
  user_id: string
  correlation_id: string
  workspace_slug: string
  workspace_id: string
  caller_permissions: string[]
}

// ── Enums ────────────────────────────────────────────────────────

export type ScheduledExamStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ENABLED'
  | 'DISABLED'
  | 'ARCHIVED'
export type ScheduledExamType = 'MCQ_EXAM' | 'TRADITIONAL_EXAM'
export type ForcedSubmissionReason = 'WINDOW_CLOSED' | 'DURATION_EXCEEDED' | 'CONNECTION_TIMEOUT'

// ── Row Types ────────────────────────────────────────────────────

export interface ScheduledExamRow {
  id: string
  base_exam_id: string
  base_exam_type: ScheduledExamType
  workspace_id: string
  title: string
  code: string
  instructions: string | null
  status: ScheduledExamStatus
  total_marks: string // numeric comes back as string from pg
  pass_mark: string
  duration_minutes: number | null
  window_start: Date
  window_end: Date
  question_pool_id: string | null
  base_exam_snapshot: Record<string, unknown> | null
  base_exam_hash: string | null
  base_exam_modified: boolean
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

// ── Input Types ──────────────────────────────────────────────────

export interface CreateScheduledExamInput {
  base_exam_id: string
  base_exam_type: ScheduledExamType
  title: string
  code: string
  instructions?: string
  total_marks: number
  pass_mark: number
  duration_minutes?: number
  window_start: Date
  window_end: Date
  question_pool_id?: string
}

export interface UpdateScheduledExamInput {
  title?: string
  instructions?: string
  total_marks?: number
  pass_mark?: number
  duration_minutes?: number
  window_start?: Date
  window_end?: Date
  question_pool_id?: string
}

export interface ListScheduledExamsInput {
  workspace_id: string
  status?: ScheduledExamStatus
  page?: number
  per_page?: number
}

// ── Result Types ─────────────────────────────────────────────────

export interface AttemptStartResult {
  attempt_id: string
  remaining_seconds: number
  scheduled_end_time: Date
}

export interface HeartbeatResult {
  remaining_seconds: number
  auto_submit_scheduled: boolean
}

export interface SubmitResult {
  attempt_id: string
  auto_submitted: boolean
  submitted_at: Date
}
